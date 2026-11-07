# Comprehensive Security Assessment & Threat Model — `hotel_premium`

## 1. Executive Summary

This document establishes the baseline security assessment, threat model (STRIDE), and remediation controls for `hotel_premium` across application, API gateway, service mesh, secrets management, Kubernetes runtime, AWS cloud infrastructure, and CI/CD supply chain layers.

---

## 2. STRIDE Threat Model & Remediations

| Threat Category | Attack Vector Identified in Baseline Audit | Impact | Remediation Implemented |
| :--- | :--- | :--- | :--- |
| **Spoofing** | External attacker sends `X-User-Role: ADMIN` or `Authorization: Bearer fake_admin_123` to bypass `GinRBACMiddleware` (`backend/internal/infrastructure/http/rbac.go`). | Critical privilege escalation to hotel administrator. | Cryptographic JWT HMAC/JWKS signature and expiration verification in `rbac.go`; substring `"admin"` check eliminated; Kong strips unverified internal identity headers at ingress. |
| **Tampering** | Duplicate or replayed `POST /api/v1/stays` or `POST /api/v1/billing/charges` requests with identical `Idempotency-Key` across different routes. | Cross-endpoint response poisoning or duplicate billing charges. | Scoped idempotency cache key (`idempotency:response:<method>:<path>:<key>`) in Redis with atomic `SetNX` distributed lock (`idempotency:lock:<method>:<path>:<key>`) and `billing-service` Redis wiring. |
| **Repudiation** | Silent failure of `auditRepo.Record(...)` due to missing `audit_logs` table migration. | Loss of forensic trail for booking saga compensations and administrative price overrides. | Added migration `000004_create_audit_logs.sql` and structured JSON logs correlated with W3C `trace_id` and `span_id`. |
| **Information Disclosure** | Wildcard `redirectUris: ["*"]` in `keycloak/hotel-realm-realm.json`; Kong Admin API bound to `0.0.0.0:8001`; plaintext secrets in K8s manifests. | OAuth2 authorization code/token interception; unauthorized gateway reconfiguration; credential leakage. | Restricted Keycloak `redirectUris` and `webOrigins` to explicit origins; bound Kong Admin API to `127.0.0.1:8001`; externalized Kubernetes secrets via HashiCorp Vault + External Secrets Operator (ESO). |
| **Denial of Service** | Unbounded HTTP request bodies, missing rate limits in Kubernetes Kong config, and two conflicting KEDA `ScaledObject`s on `notification-worker`. | Memory exhaustion, connection pool saturation, and broken autoscaling under traffic spikes. | Enforced HTTP server timeouts (`ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`), Gin body size middleware, Kong rate-limiting (`120 req/min`), PostgreSQL connection pool caps, and consolidated KEDA `ScaledObject`. |
| **Elevation of Privilege** | `dev` namespace labeled `pod-security.kubernetes.io/enforce: privileged`; Gatekeeper `security-constraints.yaml` broken due to `trusted_registries` parameter typo; missing Istio `AuthorizationPolicy`. | Lateral movement inside Kubernetes cluster and container breakout. | Enforced `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, fixed Gatekeeper `parameters.registries`, enforced Istio `STRICT` mTLS and least-privilege `AuthorizationPolicy`. |

---

## 3. Defense-in-Depth Controls Matrix

### 3.1 Application & API Security (Go / Gin / GORM)
- **Authentication & RBAC**:
  - Supports hospitality roles: `ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPING`, and `USER`.
  - Validates `Authorization: Bearer <jwt>` signature, `exp`, `nbf`, and extracts role claims from top-level `role`, `roles`, or Keycloak `realm_access.roles`.
- **SQL Injection Prevention**:
  - Parameterized queries via GORM v1.31.2 (`Where("id = ?", id)`) and `pgx/v5`; zero string-concatenated SQL statements.
- **CORS & Security Headers**:
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and strict CORS header allowlists (`Authorization`, `Content-Type`, `X-User-Role`, `Idempotency-Key`, `X-Idempotency-Key`, `X-Correlation-ID`).

### 3.2 Edge Gateway (Kong v3.9.4) & Service Mesh (Istio 1.31.2)
- **Kong Gateway (North-South)**:
  - Admin API restricted to loopback (`127.0.0.1:8001`).
  - Rate limiting, request size limiting, CORS, and correlation ID injection.
- **Istio Service Mesh (East-West)**:
  - `PeerAuthentication` with `mtls.mode: STRICT` across application namespaces.
  - `DestinationRule` with `tls.mode: ISTIO_MUTUAL` and circuit-breaking outlier detection.
  - Default-deny + explicit allow `AuthorizationPolicy` restricting microservice ingress to `kong-gateway` and authorized internal callers.

### 3.3 Secrets Management & Mesh PKI (HashiCorp Vault v2.2.0 + ESO + Istio CA)
- Least-privilege HCL policies (`infrastructure/vault/policies/hotel-policy.hcl`) granting `read` only to `secret/data/hotel-premium/*`.
- **Vault Kubernetes Auth (`auth/kubernetes`)**: Configured via `.\platform-minikube.ps1 vault -VaultAction k8s-auth`, binding `hotel-policy` to the External Secrets Operator and microservice ServiceAccounts (`PruneLegacyVaultRole` removes overly permissive roles).
- **Vault PKI Root & Intermediate CA for Istio (`pki` / `pki_int`)**: Configured via `.\platform-minikube.ps1 vault -VaultAction istio-pki`, minting a 10-year Root CA and 5-year Intermediate CA injected into `istio-system/cacerts` for automatic SPIFFE X.509 mTLS rotation.
- `ClusterSecretStore` (`infrastructure/eso/cluster-secret-store.yaml`) pointing to `http://vault.vault.svc.cluster.local:8200` with Kubernetes ServiceAccount auth, syncing secrets into namespace `dev` via `ExternalSecret`.

### 3.4 Cloud Infrastructure Security (AWS Terraform 1.16.6)
- **Encryption at Rest & In Transit**: Customer-managed AWS KMS key with automatic key rotation (`enable_key_rotation = true`) encrypting EKS Kubernetes secrets, RDS PostgreSQL storage, ElastiCache Redis, MSK Kafka, ECR repositories, and CloudWatch/VPC Flow Logs.
- **Compute Hardening**: EKS Managed Node Groups enforce EC2 Launch Templates with **IMDSv2 required** (`http_tokens = "required"`, `http_put_response_hop_limit = 2`) and encrypted EBS volumes.
- **Network Segmentation**: RDS, ElastiCache, and MSK reside in isolated private data subnets with Security Groups permitting ingress exclusively from EKS worker node security groups on their respective ports (`5432`, `6379`, `9092`/`9094`) and egress restricted to the VPC CIDR.

### 3.5 6-Gate Shift-Left DevSecOps & Software Supply Chain Security (`.\platform-minikube.ps1 security-scan`)
- **Gate 1 — Gitleaks (`8.30.1`)**: Blocks commits or builds containing hardcoded credentials or private keys (`0` leaks).
- **Gate 2 — Semgrep SAST (`devsecops/sast/semgrep/semgrep-rules.yaml`)**: Enforces Go, TypeScript/React, and Python security rules (blocks SQL string concatenation, `dangerouslySetInnerHTML`, TLS `InsecureSkipVerify`, `eval`, and shell injection).
- **Gate 3 — TFLint (`0.64.0`)**: Enforces Terraform HCL best practices and provider typing across `local-minikube` and `aws`.
- **Gate 4 — Trivy (`0.76.0`)**: Scans Go modules (`go.mod`), npm lockfiles (`package-lock.json`), Dockerfiles, and Kubernetes manifests with `0` vulnerabilities and `0` misconfigurations.
- **Gate 5 — OPA Conftest (`0.71.1`) + Helm `4.3.1`**: Evaluates `devsecops/policies/conftest/security.rego` across static Kubernetes manifests and dynamically rendered Helm 4 templates (`205/205` Rego policy tests passed).
- **Gate 6 — Sigstore Cosign (`v3.1.3`)**: Verifies cryptographic ECDSA P-256 signatures and Sigstore v0.3 provenance bundles (`devsecops/supply-chain/cosign/supply-chain-manifest.sigstore.json` verified via `cosign.pub`) alongside keyless OIDC image signing in GitHub Actions.
