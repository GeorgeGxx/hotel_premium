#!/usr/bin/env python3
"""
Hotel Premium DevSecOps Platform - Cryptographic Secret Generator
Generates high-entropy CSPRNG credentials for Vault v2.2.0, PostgreSQL 18,
Keycloak 26.8.1, Redis 8.8.1, and Go Gin JWT middleware.

Strict Baseline:
  Python: 3.12 | Vault: v2.2.0 | Postgres: 18 | Redis: 8.8.1 | Keycloak: 26.8.1
"""

import argparse
import base64
import json
import secrets
import string
import sys
from typing import Dict

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def generate_alphanumeric(length: int = 32) -> str:
    """Generates alphanumeric credentials without problematic shell characters."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

def generate_complex_password(length: int = 32) -> str:
    """Generates strong passwords containing symbols, uppercase, lowercase, and digits."""
    safe_symbols = "!@#$%^&*()-_=+"
    alphabet = string.ascii_letters + string.digits + safe_symbols
    password = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice(safe_symbols),
    ]
    password += [secrets.choice(alphabet) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(password)
    return "".join(password)

def generate_jwt_key(bits: int = 256) -> str:
    """Generates a secure 256-bit Base64-encoded HMAC secret key."""
    random_bytes = secrets.token_bytes(bits // 8)
    return base64.b64encode(random_bytes).decode("utf-8")

def build_credentials_bundle(length: int = 32) -> Dict[str, str]:
    """Builds a complete, unified credentials bundle for Hotel Premium."""
    return {
        "POSTGRES_USER": "hotel_user",
        "POSTGRES_PASSWORD": generate_complex_password(length),
        "POSTGRES_DB": "hotel_db",
        "KEYCLOAK_ADMIN": "admin",
        "KEYCLOAK_ADMIN_PASSWORD": generate_complex_password(length),
        "KEYCLOAK_CLIENT_SECRET": generate_alphanumeric(length),
        "JWT_SECRET": generate_jwt_key(256),
        "VAULT_DEV_ROOT_TOKEN": "root",
        "VAULT_APP_TOKEN": generate_alphanumeric(length),
        "REDIS_PASSWORD": generate_alphanumeric(length),
    }

def format_env(bundle: Dict[str, str]) -> str:
    lines = [
        "# ==============================================================================",
        "# Hotel Premium DevSecOps Platform - Cryptographically Generated Credentials",
        "# Generated with CSPRNG entropy via Python 3.12 (Zero-Trust Standard)",
        "# ==============================================================================",
    ]
    for key, val in bundle.items():
        lines.append(f'{key}="{val}"')
    return "\n".join(lines)

def format_k8s_yaml(bundle: Dict[str, str]) -> str:
    def b64(v: str) -> str:
        return base64.b64encode(v.encode("utf-8")).decode("utf-8")

    return f"""apiVersion: v1
kind: Secret
metadata:
  name: hotel-database-credentials
  namespace: data
type: Opaque
data:
  POSTGRES_USER: {b64(bundle['POSTGRES_USER'])}
  POSTGRES_PASSWORD: {b64(bundle['POSTGRES_PASSWORD'])}
  POSTGRES_DB: {b64(bundle['POSTGRES_DB'])}
---
apiVersion: v1
kind: Secret
metadata:
  name: hotel-auth-credentials
  namespace: auth
type: Opaque
data:
  KEYCLOAK_ADMIN: {b64(bundle['KEYCLOAK_ADMIN'])}
  KEYCLOAK_ADMIN_PASSWORD: {b64(bundle['KEYCLOAK_ADMIN_PASSWORD'])}
  JWT_SECRET: {b64(bundle['JWT_SECRET'])}
---
apiVersion: v1
kind: Secret
metadata:
  name: hotel-app-secrets
  namespace: dev
type: Opaque
data:
  JWT_SECRET: {b64(bundle['JWT_SECRET'])}
  REDIS_PASSWORD: {b64(bundle['REDIS_PASSWORD'])}
"""

def format_vault_json(bundle: Dict[str, str]) -> str:
    payload = {
        "hotel-database": {
            "POSTGRES_USER": bundle["POSTGRES_USER"],
            "POSTGRES_PASSWORD": bundle["POSTGRES_PASSWORD"],
            "POSTGRES_DB": bundle["POSTGRES_DB"],
        },
        "hotel-auth": {
            "KEYCLOAK_ADMIN": bundle["KEYCLOAK_ADMIN"],
            "KEYCLOAK_ADMIN_PASSWORD": bundle["KEYCLOAK_ADMIN_PASSWORD"],
            "JWT_SECRET": bundle["JWT_SECRET"],
        },
        "hotel-cache": {
            "REDIS_PASSWORD": bundle["REDIS_PASSWORD"],
        }
    }
    return json.dumps(payload, indent=2)

def main():
    parser = argparse.ArgumentParser(description="Hotel Premium CSPRNG Secret Generator")
    parser.add_argument("--format", choices=["env", "k8s-yaml", "vault-json", "json"], default="env",
                        help="Output format (env, k8s-yaml, vault-json, json)")
    parser.add_argument("--length", type=int, default=32,
                        help="Password character length (default: 32)")
    args = parser.parse_args()

    bundle = build_credentials_bundle(length=args.length)

    if args.format == "env":
        print(format_env(bundle))
    elif args.format == "k8s-yaml":
        print(format_k8s_yaml(bundle))
    elif args.format == "vault-json":
        print(format_vault_json(bundle))
    elif args.format == "json":
        print(json.dumps(bundle, indent=2))

if __name__ == "__main__":
    main()
