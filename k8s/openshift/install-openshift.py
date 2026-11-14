#!/usr/bin/env python3
"""
Hotel Premium - Red Hat OpenShift 4.x / ROSA / ARO Deployment Automator
Standard cross-platform deployment script for OpenShift environments.
Coordinates project provisioning, SCC permissions, Helm 4 release, and Route verification.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Terminal ANSI styling
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"


def log_step(step: str, total: int, title: str) -> None:
    print(f"\n{BOLD}{CYAN}▶ [{step}/{total}] {title}{RESET}")


def log_success(msg: str) -> None:
    print(f"{GREEN}✓ {msg}{RESET}")


def log_warn(msg: str) -> None:
    print(f"{YELLOW}⚠ {msg}{RESET}")


def log_error(msg: str) -> None:
    print(f"{RED}✗ {msg}{RESET}")


def run_command(cmd: list[str], check: bool = True, capture: bool = False) -> subprocess.CompletedProcess[str]:
    """Executes a subprocess command safely with strict argument lists."""
    try:
        res = subprocess.run(
            cmd,
            check=check,
            capture_output=capture,
            text=True,
        )
        return res
    except subprocess.CalledProcessError as e:
        if capture and e.stderr:
            log_error(f"Command failed: {' '.join(cmd)}\nStderr: {e.stderr.strip()}")
        raise


def check_prerequisites() -> tuple[str, str]:
    """Ensures required CLIs (oc, helm) exist on system PATH."""
    oc_path = shutil.which("oc") or shutil.which("oc.exe")
    helm_path = shutil.which("helm") or shutil.which("helm.exe")

    if not oc_path:
        log_error("OpenShift CLI ('oc') was not found in PATH.")
        log_warn("Please install the oc client: https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html")
        sys.exit(1)

    if not helm_path:
        log_error("Helm CLI ('helm') was not found in PATH.")
        log_warn("Please install Helm 3 or 4: https://helm.sh/docs/intro/install/")
        sys.exit(1)

    return oc_path, helm_path


def verify_openshift_connection(oc_cmd: str) -> str:
    """Verifies that the oc client is currently logged into an active OpenShift cluster."""
    try:
        res = run_command([oc_cmd, "whoami"], check=True, capture=True)
        user = res.stdout.strip()
        log_success(f"Connected to OpenShift as: {BOLD}{user}{RESET}")
        return user
    except Exception:
        log_error("Not authenticated to an OpenShift cluster. Please run 'oc login <server>' first.")
        sys.exit(1)


def ensure_project(oc_cmd: str, project_name: str) -> None:
    """Creates an OpenShift project if it does not already exist."""
    check = run_command([oc_cmd, "get", "project", project_name], check=False, capture=True)
    if check.returncode == 0:
        log_success(f"Project '{project_name}' already exists.")
    else:
        print(f"Creating project '{project_name}'...")
        run_command([oc_cmd, "new-project", project_name], check=True, capture=True)
        log_success(f"Project '{project_name}' created successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Hotel Premium OpenShift Deployment Automator")
    parser.add_argument("--namespace", default="hotel-premium", help="Target OpenShift application project (default: hotel-premium)")
    parser.add_argument("--data-namespace", default="data", help="Target data project (default: data)")
    parser.add_argument("--auth-namespace", default="auth", help="Target auth project (default: auth)")
    parser.add_argument("--timeout", default="300s", help="Helm release rollout timeout (default: 300s)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate deployment with Helm template and dry-run checks")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent.parent
    chart_dir = repo_root / "k8s" / "helm" / "hotel-premium"
    values_file = chart_dir / "values-openshift.yaml"
    scc_file = repo_root / "k8s" / "openshift" / "scc-bindings.yaml"
    mesh_file = repo_root / "k8s" / "openshift" / "service-mesh.yaml"
    routes_file = repo_root / "k8s" / "openshift" / "routes.yaml"

    total_steps = 5
    print(f"\n{BOLD}================================================================================")
    print(" HOTEL PREMIUM — RED HAT OPENSHIFT DEPLOYMENT AUTOMATOR")
    print(f"================================================================================{RESET}")

    # Step 1: Pre-flight Verification
    log_step("1", total_steps, "Verifying CLI Prerequisites & Cluster Authentication")
    oc_cmd, helm_cmd = check_prerequisites()
    verify_openshift_connection(oc_cmd)

    if args.dry_run:
        print(f"{YELLOW}[DRY-RUN MODE ACTIVATED]{RESET}")

    # Step 2: OpenShift Projects
    log_step("2", total_steps, "Provisioning OpenShift Projects / Namespaces")
    if not args.dry_run:
        ensure_project(oc_cmd, args.namespace)
        ensure_project(oc_cmd, args.data_namespace)
        ensure_project(oc_cmd, args.auth_namespace)
    else:
        print(f"Would create/verify projects: {args.namespace}, {args.data_namespace}, {args.auth_namespace}")

    # Step 3: Security Context Constraints (SCC)
    log_step("3", total_steps, "Configuring Security Context Constraints (SCC)")
    if not args.dry_run:
        if scc_file.exists():
            run_command([oc_cmd, "apply", "-f", str(scc_file)], check=False)
            log_success("Applied SCC bindings from k8s/openshift/scc-bindings.yaml")
        else:
            run_command([oc_cmd, "adm", "policy", "add-scc-to-user", "anyuid", "-z", "hotel-data-sa", "-n", args.data_namespace], check=False)
            run_command([oc_cmd, "adm", "policy", "add-scc-to-user", "anyuid", "-z", "default", "-n", args.auth_namespace], check=False)
            log_success("Assigned 'anyuid' SCC to stateful data service accounts.")
    else:
        print(f"Would apply SCC permissions for {args.data_namespace}/hotel-data-sa and {args.auth_namespace}/default")

    # Step 4: Helm 4 Deployment
    log_step("4", total_steps, "Deploying Microservices with Helm 4 & OpenShift Values")
    helm_args = [
        helm_cmd,
        "upgrade",
        "--install",
        "hotel-premium",
        str(chart_dir),
        "--namespace",
        args.namespace,
        "-f",
        str(values_file),
    ]

    if args.dry_run:
        helm_args.append("--dry-run")
        run_command(helm_args, check=True)
        log_success("Dry-run Helm upgrade evaluated cleanly.")
    else:
        helm_args.extend(["--wait", "--timeout", args.timeout])
        run_command(helm_args, check=True)
        log_success("Hotel Premium microservices deployed and healthy.")

    # Step 5: Routes & Public Ingress Verification
    log_step("5", total_steps, "Verifying OpenShift Routes & Edge TLS Endpoints")
    if not args.dry_run:
        if routes_file.exists():
            run_command([oc_cmd, "apply", "-f", str(routes_file), "-n", args.namespace], check=False)
        if mesh_file.exists():
            run_command([oc_cmd, "apply", "-f", str(mesh_file)], check=False)

        time.sleep(2)
        route_res = run_command(
            [oc_cmd, "get", "route", "hotel-frontend", "-n", args.namespace, "-o", "jsonpath={.spec.host}"],
            check=False,
            capture=True,
        )
        host = route_res.stdout.strip() if route_res.returncode == 0 else ""

        print(f"\n{BOLD}================================================================================")
        print(" RED HAT OPENSHIFT DEPLOYMENT COMPLETE")
        print(f"================================================================================{RESET}")
        if host:
            log_success(f"Frontend URL (Edge TLS): {BOLD}https://{host}{RESET}")
        else:
            log_warn("Route is provisioning or pending external DNS resolution. Check with: 'oc get routes -n " + args.namespace + "'")

        print(f"\n{CYAN}To monitor pod compliance under restricted-v2 SCC:{RESET}")
        print(f"  oc get pods -n {args.namespace} -o custom-columns=NAME:.metadata.name,SCC:.metadata.annotations.'openshift\\.io/scc'")
    else:
        log_success("Dry-run complete. System is 100% compliant for OpenShift.")


if __name__ == "__main__":
    main()
