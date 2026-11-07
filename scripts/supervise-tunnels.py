#!/usr/bin/env python3
"""
Hotel Premium DevSecOps Platform - Port Forwarding & Tunnels Supervisor
Self-healing supervisor that establishes and maintains port-forwarding tunnels
between Minikube Kubernetes cluster services and the local Windows host.

Strict Baseline:
  Python: 3.12 | Minikube: 1.39.0 | Kubernetes: 1.37.0 | Kong: 3.9.4 | Istio: 1.31.2
"""

import subprocess
import time
import sys
import os
import signal

# Hotel Premium Platform Services to Expose Locally
TUNNELS = [
    {"name": "Frontend Web App",      "ns": "dev",          "svc": "hotel-frontend",        "local": 5173,  "remote": 5173},
    {"name": "Kong API Gateway",      "ns": "dev",          "svc": "kong-proxy",            "local": 8000,  "remote": 8000},
    {"name": "Kong Admin & Metrics",  "ns": "dev",          "svc": "kong-proxy",            "local": 8001,  "remote": 8001},
    {"name": "Kong Manager Dashboard","ns": "dev",          "svc": "kong-proxy",            "local": 8002,  "remote": 8002},
    {"name": "Room Service (API/Docs)","ns": "dev",         "svc": "room-service",          "local": 8081,  "remote": 8081},
    {"name": "Stay Service (API/Docs)", "ns": "dev",         "svc": "stay-service",          "local": 8082,  "remote": 8082},
    {"name": "Billing Service (API/Docs)","ns": "dev",       "svc": "billing-service",       "local": 8083,  "remote": 8083},
    {"name": "Notification Worker (API/Docs)","ns": "dev",   "svc": "notification-worker",   "local": 8084,  "remote": 8084},
    {"name": "Keycloak IAM",          "ns": "auth",         "svc": "keycloak",              "local": 8181,  "remote": 8080},
    {"name": "HashiCorp Vault UI",    "ns": "vault",        "svc": "vault",                 "local": 8200,  "remote": 8200},
    {"name": "OpenCost FinOps UI",    "ns": "opencost",     "svc": "opencost",              "local": 7000,  "remote": 7000},
    {"name": "Kiali Mesh Console",    "ns": "observability","svc": "kiali",                 "local": 20001, "remote": 20001},
    {"name": "Prometheus Metrics",    "ns": "observability","svc": "prometheus-server",     "local": 9090,  "remote": 9090},
    {"name": "Grafana Dashboards",    "ns": "observability","svc": "grafana",               "local": 3000,  "remote": 3000},
    {"name": "Loki Log Aggregator",   "ns": "observability","svc": "loki",                  "local": 3100,  "remote": 3100},
    {"name": "Tempo Distributed Trace","ns": "observability","svc": "tempo",                 "local": 3200,  "remote": 3200},
    {"name": "Alloy Telemetry Agent", "ns": "observability","svc": "alloy",                 "local": 3300,  "remote": 3300},
    {"name": "Istio Ingress Gateway", "ns": "istio-system", "svc": "istio-ingressgateway", "local": 8080,  "remote": 80},
]

def check_service_exists(ns: str, svc: str) -> bool:
    """Verifies if the target service is registered in Kubernetes."""
    try:
        res = subprocess.run(
            ["kubectl", "get", "svc", "-n", ns, svc],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return res.returncode == 0
    except Exception:
        return False

def start_tunnel(t: dict):
    """Launches a kubectl port-forward subprocess."""
    if not check_service_exists(t["ns"], t["svc"]):
        return None
    cmd = [
        "kubectl", "port-forward",
        "-n", t["ns"],
        "--address", "0.0.0.0",
        f"svc/{t['svc']}",
        f"{t['local']}:{t['remote']}"
    ]
    try:
        return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        return None

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

def print_banner():
    print("=" * 80)
    print(" HOTEL PREMIUM DEVSECOPS PLATFORM")
    print(" > Self-Healing Network Tunnels Supervisor (Python 3.12)")
    print("=" * 80)
    print("Exposing cluster workloads directly to Windows localhost.")
    print("Press Ctrl+C to terminate all tunnels safely.\n")

import socket
from pathlib import Path

PID_FILE = Path(__file__).parent / ".tunnels.pid"

def is_port_listening(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.4)
            return s.connect_ex(("127.0.0.1", port)) == 0
    except Exception:
        return False

def stop_daemon():
    """Stops the running daemon and any orphaned port-forwards."""
    stopped = False
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                os.kill(pid, signal.SIGTERM)
            stopped = True
        except Exception:
            pass
        finally:
            PID_FILE.unlink(missing_ok=True)

    # Clean up any orphaned kubectl port-forwards
    if os.name == "nt":
        subprocess.run(["powershell", "-NoProfile", "-Command", 
                        "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'kubectl' -and $_.CommandLine -match 'port-forward' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if stopped:
        print("[OK] Network tunnels daemon and all port-forwards stopped cleanly.")
    else:
        print("[INFO] No active network tunnels daemon found.")

def show_status():
    """Inspects all tunnel endpoints on localhost."""
    print("=" * 80)
    print(" HOTEL PREMIUM - NETWORK TUNNELS STATUS")
    print("=" * 80)
    daemon_running = False
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            res = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True)
            if str(pid) in res.stdout:
                daemon_running = True
                print(f"Daemon Supervisor: ACTIVE (PID: {pid})\n")
        except Exception:
            pass
    if not daemon_running:
        print("Daemon Supervisor: NOT RUNNING\n")

    print(f"{'SERVICE':<26} {'LOCAL URL':<34} {'STATUS':<15}")
    print("-" * 78)
    for t in TUNNELS:
        active = is_port_listening(t["local"])
        status = "[ACTIVE]" if active else "[CLOSED]"
        url = f"http://localhost:{t['local']}"
        print(f"{t['name']:<26} {url:<34} {status}")
    print("-" * 78)

def main():
    if len(sys.argv) > 1:
        if sys.argv[1] in ("--stop", "-stop", "stop"):
            stop_daemon()
            sys.exit(0)
        elif sys.argv[1] in ("--status", "-status", "status"):
            show_status()
            sys.exit(0)

    # Save PID for background management
    PID_FILE.write_text(str(os.getpid()))

    print_banner()

    processes = {}
    for t in TUNNELS:
        proc = start_tunnel(t)
        processes[t["name"]] = (t, proc)
        if proc:
            print(f"  [OK] Tunnel active: {t['name']:<24} -> http://localhost:{t['local']} ({t['ns']}/{t['svc']})")
        else:
            print(f"  [--] Waiting:       {t['name']:<24} (Service '{t['svc']}' in '{t['ns']}' not yet ready; will auto-attach)")

    def cleanup_handler(sig, frame):
        print("\n\nTerminating all active network tunnels...")
        for name, (t, proc) in processes.items():
            if proc and proc.poll() is None:
                try:
                    proc.terminate()
                    proc.wait(timeout=2)
                except Exception:
                    proc.kill()
        PID_FILE.unlink(missing_ok=True)
        print("[OK] All port-forward tunnels cleanly stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup_handler)
    signal.signal(signal.SIGTERM, cleanup_handler)

    print("\n[INFO] Supervisor is monitoring active tunnels. Auto-reconnecting on pod rollout or restart...\n")

    while True:
        time.sleep(5)
        for name, (t, proc) in list(processes.items()):
            if proc is None or proc.poll() is not None:
                new_proc = start_tunnel(t)
                if new_proc:
                    print(f"  [+] Tunnel re-connected: {t['name']:<24} -> http://localhost:{t['local']}")
                processes[name] = (t, new_proc)

if __name__ == "__main__":
    main()
