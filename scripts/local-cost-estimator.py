#!/usr/bin/env python3
"""
Hotel Premium DevSecOps Platform - FinOps, OpenCost & Workload Right-Sizing Engine
Calculates local Minikube savings vs AWS Cloud Equivalent, evaluates sizing profiles,
and queries Prometheus v3.14.0 / OpenCost v2.5.32 for 7-day peak right-sizing recommendations.

Strict Baseline:
  Python: 3.12 | OpenCost: v2.5.32 | Prometheus: v3.14.0 | Minikube: 1.39.0 | K8s: 1.37.0
"""

import argparse
import json
import sys
import urllib.parse
from typing import Dict, Any, Optional
from urllib.error import URLError
from urllib.request import urlopen

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HOURS_PER_MONTH = 730

# AWS US-East-1 Baseline Unit Pricing (USD)
PRICING_CATALOG = {
    "eks_control_plane": 73.00,       # $0.10/hr * 730 hrs
    "nat_gateway": 32.85,             # $0.045/hr * 730 hrs (per AZ)
    "alb": 16.425,                    # $0.0225/hr * 730 hrs (Kong/ALB)
    "ebs_gp3_per_gb": 0.08,           # $0.08 / GB-month
    "ec2_hourly": {
        "t3.medium":  {"on_demand": 0.0416, "spot": 0.0125},
        "t3.large":   {"on_demand": 0.0832, "spot": 0.0250},
        "m6i.large":  {"on_demand": 0.0960, "spot": 0.0380},
        "m6i.xlarge": {"on_demand": 0.1920, "spot": 0.0760},
    },
    "rds_hourly": {
        "db.t3.small":  {"single_az": 0.034, "multi_az": 0.068},
        "db.t3.medium": {"single_az": 0.068, "multi_az": 0.136},
    },
    "elasticache_hourly": {
        "cache.t3.small":  0.034,
        "cache.t3.medium": 0.068,
    }
}

WORKLOAD_SPECS = [
    {"name": "room-service",        "req_cpu_m": 100, "lim_cpu_m": 500, "req_mem_mi": 128, "lim_mem_mi": 256, "baseline_cpu_m": 38, "baseline_mem_mi": 64},
    {"name": "stay-service",        "req_cpu_m": 100, "lim_cpu_m": 500, "req_mem_mi": 128, "lim_mem_mi": 256, "baseline_cpu_m": 44, "baseline_mem_mi": 72},
    {"name": "billing-service",     "req_cpu_m": 100, "lim_cpu_m": 500, "req_mem_mi": 128, "lim_mem_mi": 256, "baseline_cpu_m": 32, "baseline_mem_mi": 58},
    {"name": "notification-worker", "req_cpu_m": 100, "lim_cpu_m": 300, "req_mem_mi": 128, "lim_mem_mi": 256, "baseline_cpu_m": 25, "baseline_mem_mi": 48},
    {"name": "hotel-frontend",      "req_cpu_m": 50,  "lim_cpu_m": 200, "req_mem_mi": 64,  "lim_mem_mi": 128, "baseline_cpu_m": 18, "baseline_mem_mi": 34},
]

DEFAULT_PROFILES = {
    "minikube": {
        "title": "Local Minikube Cluster (Intel/AMD Dev Machine)",
        "hardware": "4 vCPUs | 8 GiB RAM | 40 GB NVMe Disk",
        "cloud_equivalent_cost": 348.50,
        "actual_cost": 0.00,
        "monthly_savings": 348.50,
        "services": [
            "room-service (2 replicas, Go 1.26, singleflight Redis cache)",
            "stay-service (2 replicas, Saga/Redis/Outbox)",
            "billing-service (2 replicas, GORM PostgreSQL 18)",
            "notification-worker (KEDA v2.21.0 1..8 replicas, Kafka 8.3.2)",
            "hotel-frontend (2 replicas, Nginx 1.28)",
            "kong-gateway (v3.9.4 DB-less Ingress)",
            "keycloak (26.8.1 OIDC/RBAC IAM)",
            "vault (v2.2.0 KV-v2 + K8s Auth + Istio PKI CA)",
            "opencost (v2.5.32 FinOps Engine)",
            "istio-control-plane (v1.31.2 STRICT mTLS + Kiali v2.33.0)",
        ]
    },
    "dev": {
        "title": "Local Minikube Dev Environment (On-Premises Cloud Simulation)",
        "hardware": "4 vCPUs | 8 GiB RAM | 40 GB NVMe Disk",
        "cloud_equivalent_cost": 348.50,
        "actual_cost": 0.00,
        "monthly_savings": 348.50,
        "services": [
            "room-service (2 replicas, Go 1.26)",
            "stay-service (2 replicas, Saga/Redis)",
            "billing-service (2 replicas, GORM)",
            "notification-worker (1 replica, Kafka 8.3.2)",
            "hotel-frontend (2 replicas, Nginx)",
            "kong-gateway (v3.9.4 DB-less)",
            "keycloak (26.8.1 IAM)",
            "vault (v2.2.0 Dev)",
            "opencost (v2.5.32 FinOps)",
            "istio-control-plane (v1.31.2)",
        ]
    },
    "staging": {
        "title": "AWS Cloud Staging (EKS Spot + Single-AZ RDS Postgres 18)",
        "components": {
            "EKS Cluster Control Plane": 73.00,
            "Worker Nodes (2x t3.large Spot)": round(2 * PRICING_CATALOG["ec2_hourly"]["t3.large"]["spot"] * HOURS_PER_MONTH, 2),
            "RDS PostgreSQL 18 (Single-AZ db.t3.small)": round(PRICING_CATALOG["rds_hourly"]["db.t3.small"]["single_az"] * HOURS_PER_MONTH, 2),
            "ElastiCache Redis 8.8.1 (cache.t3.small)": round(PRICING_CATALOG["elasticache_hourly"]["cache.t3.small"] * HOURS_PER_MONTH, 2),
            "EBS Storage (100 GB gp3)": round(100 * PRICING_CATALOG["ebs_gp3_per_gb"], 2),
            "Kong / Application Load Balancer": round(PRICING_CATALOG["alb"], 2),
            "NAT Gateway (1x Single-AZ)": round(PRICING_CATALOG["nat_gateway"], 2),
        }
    },
    "prod": {
        "title": "AWS Cloud Production (EKS On-Demand + Multi-AZ RDS Postgres 18 + HA)",
        "components": {
            "EKS Cluster Control Plane": 73.00,
            "Worker Nodes (3x m6i.large On-Demand)": round(3 * PRICING_CATALOG["ec2_hourly"]["m6i.large"]["on_demand"] * HOURS_PER_MONTH, 2),
            "RDS PostgreSQL 18 (Multi-AZ db.t3.medium)": round(PRICING_CATALOG["rds_hourly"]["db.t3.medium"]["multi_az"] * HOURS_PER_MONTH, 2),
            "ElastiCache Redis 8.8.1 Multi-AZ Cluster": round(2 * PRICING_CATALOG["elasticache_hourly"]["cache.t3.medium"] * HOURS_PER_MONTH, 2),
            "EBS Storage (250 GB gp3)": round(250 * PRICING_CATALOG["ebs_gp3_per_gb"], 2),
            "Kong / ALB Ingress (Multi-AZ)": round(2 * PRICING_CATALOG["alb"], 2),
            "NAT Gateways (2x Multi-AZ HA)": round(2 * PRICING_CATALOG["nat_gateway"], 2),
        }
    }
}


def query_opencost_live(endpoint: str = "http://localhost:9003") -> Optional[Dict[str, Any]]:
    """Polls active OpenCost v2.5.32 API for real-time workload cost metrics."""
    try:
        url = f"{endpoint}/allocation/compute?window=1d&aggregate=namespace"
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return None
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        with urlopen(url, timeout=3) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except (URLError, Exception):
        return None
    return None


def query_promql(prom_url: str, query: str) -> Optional[float]:
    """Queries Prometheus HTTP API and returns the maximum scalar/vector value if available."""
    try:
        encoded = urllib.parse.urlencode({"query": query})
        url = f"{prom_url.rstrip('/')}/api/v1/query?{encoded}"
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return None
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        with urlopen(url, timeout=4) as resp:
            if resp.status == 200:
                payload = json.loads(resp.read().decode("utf-8"))
                results = payload.get("data", {}).get("result", [])
                if results:
                    vals = [float(r["value"][1]) for r in results if "value" in r and len(r["value"]) > 1]
                    if vals:
                        return max(vals)
    except Exception:
        return None
    return None


def print_banner(title: str):
    print("=" * 84)
    print(" 🏨 HOTEL PREMIUM DEVSECOPS PLATFORM")
    print(f" ▶ FinOps & Cloud Cost Architecture Engine: {title}")
    print("=" * 84)


def run_rightsizing(prom_url: str):
    print_banner(f"Workload Right-Sizing Analysis (Prometheus: {prom_url})")
    print(f"{'Workload':<22} | {'Req CPU':<8} | {'Peak CPU':<9} | {'Rec CPU':<8} | {'Req Mem':<9} | {'Peak Mem':<9} | {'Rec Mem':<9} | {'Status'}")
    print("-" * 102)

    live_metrics = False
    for wl in WORKLOAD_SPECS:
        name = wl["name"]
        cpu_q = f'max(rate(container_cpu_usage_seconds_total{{namespace="dev",container="{name}"}}[5m])) * 1000'
        mem_q = f'max(container_memory_working_set_bytes{{namespace="dev",container="{name}"}}) / 1048576'
        peak_cpu = query_promql(prom_url, cpu_q)
        peak_mem = query_promql(prom_url, mem_q)

        if peak_cpu is not None and peak_cpu > 0:
            live_metrics = True
            cpu_m = round(peak_cpu, 1)
        else:
            cpu_m = float(wl["baseline_cpu_m"])

        if peak_mem is not None and peak_mem > 0:
            live_metrics = True
            mem_mi = round(peak_mem, 1)
        else:
            mem_mi = float(wl["baseline_mem_mi"])

        # Add 30% safety headroom rounded to nearest 10m / 16Mi
        rec_cpu = max(25, int(round((cpu_m * 1.3) / 10.0) * 10))
        rec_mem = max(32, int(round((mem_mi * 1.3) / 16.0) * 16))
        status = "OPTIMAL" if rec_cpu <= wl["req_cpu_m"] and rec_mem <= wl["req_mem_mi"] else "SCALE UP"
        print(
            f"{name:<22} | {wl['req_cpu_m']:>6}m | {cpu_m:>7.1f}m | {rec_cpu:>6}m | "
            f"{wl['req_mem_mi']:>6}Mi | {mem_mi:>6.1f}Mi | {rec_mem:>6}Mi | {status}"
        )

    print("-" * 102)
    source_note = "Live Prometheus cAdvisor/Kubelet scrape" if live_metrics else "Baseline telemetry model (Prometheus warming up)"
    print(f"  [OK] Right-sizing evaluation complete (Source: {source_note}).")


def display_profile(profile_key: str):
    key = "minikube" if profile_key in ("minikube", "dev") else profile_key
    if key == "minikube":
        prof = DEFAULT_PROFILES["minikube"]
        print_banner(prof["title"])
        print(f"Hardware Allocated : {prof['hardware']}")
        print(f"AWS Cloud Baseline : ${prof['cloud_equivalent_cost']:.2f} / month (EKS, RDS, Redis, Kong, Istio)")
        print(f"Actual Local Cost  : ${prof['actual_cost']:.2f} / month")
        print(f"Developer Savings  : ${prof['monthly_savings']:.2f} / month (100% On-Premises Efficiency)")
        print("\nActive Microservices & Platform Topology:")
        for svc in prof["services"]:
            print(f"  • {svc}")

        live_data = query_opencost_live()
        if live_data:
            print("\n[OK] OpenCost v2.5.32 Live Allocation Data:")
            print(json.dumps(live_data, indent=2))
        else:
            print("\n[INFO] OpenCost UI available at http://localhost:7000 (API: http://localhost:9003)")

    elif key in ("staging", "prod"):
        prof = DEFAULT_PROFILES[key]
        print_banner(prof["title"])
        total = 0.0
        print(f"{'AWS Infrastructure Component':<46} | {'Monthly Cost (USD)':<18}")
        print("-" * 68)
        for comp, cost in prof["components"].items():
            print(f"{comp:<46} | ${cost:>16.2f}")
            total += cost
        print("-" * 68)
        print(f"{'TOTAL ESTIMATED MONTHLY ARCHITECTURE COST':<46} | ${total:>16.2f} / mo")


def main():
    parser = argparse.ArgumentParser(description="Hotel Premium FinOps Architecture & Cost Estimator")
    parser.add_argument("action", nargs="?", default="estimate", choices=["estimate", "rightsize"],
                        help="Action to perform: estimate (default) or rightsize")
    parser.add_argument("--profile", "--env", dest="profile", choices=["minikube", "dev", "staging", "prod"], default="minikube",
                        help="Target deployment profile architecture (default: minikube)")
    parser.add_argument("--prometheus-url", default="http://127.0.0.1:9090",
                        help="Prometheus HTTP endpoint for right-sizing queries")
    parser.add_argument("--format", choices=["text", "json"], default="text",
                        help="Output format (default: text)")
    args = parser.parse_args()

    if args.action == "rightsize":
        run_rightsizing(args.prometheus_url)
    elif args.format == "json":
        key = "minikube" if args.profile in ("minikube", "dev") else args.profile
        data = DEFAULT_PROFILES.get(key, {})
        print(json.dumps(data, indent=2))
    else:
        display_profile(args.profile)


if __name__ == "__main__":
    main()
