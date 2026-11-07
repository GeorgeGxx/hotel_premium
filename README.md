# 🏨 Hotel Premium — Cloud-Native Enterprise Hospitality DevSecOps Platform

[![Go 1.26](https://img.shields.io/badge/Go-1.26.0-00ADD8?logo=go)](https://go.dev/)
[![React 19](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react)](https://react.dev/)
[![Kubernetes 1.37](https://img.shields.io/badge/Kubernetes-1.37.0-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![Helm 4.3.1](https://img.shields.io/badge/Helm-4.3.1_SSA-0F1689?logo=helm)](https://helm.sh/)
[![Istio 1.31.2](https://img.shields.io/badge/Istio-1.31.2_STRICT_mTLS-466BB0?logo=istio)](https://istio.io/)
[![Kong 3.9.4](https://img.shields.io/badge/Kong_Gateway-3.9.4-003459?logo=kong)](https://konghq.com/)
[![Vault 2.2.0](https://img.shields.io/badge/HashiCorp_Vault-v2.2.0-FFD814?logo=vault)](https://www.vaultproject.io/)
[![Kafka 8.3.2](https://img.shields.io/badge/Apache_Kafka-8.3.2_KRaft-231F20?logo=apachekafka)](https://kafka.apache.org/)
[![Grafana 13.2.3](https://img.shields.io/badge/Grafana_LGTM-13.2.3-F46800?logo=grafana)](https://grafana.com/)

`hotel_premium` is a production-grade, cloud-native luxury hospitality management platform engineered with **Domain-Driven Design (DDD)**, **Hexagonal / Clean Architecture**, **Event-Driven Architecture (EDA)** via Apache Kafka 8.3.2 (KRaft), **Zero-Trust Security** (Kong v3.9.4 + Keycloak 26.8.1 OIDC + Istio 1.31.2 STRICT mTLS + HashiCorp Vault v2.2.0 PKI CA & ESO), **Helm 4.3.1 Server-Side Apply**, and a full **LGTM Observability & FinOps Mesh** (Loki 3.7.8, Grafana 13.2.3, Tempo 3.0.5, Prometheus v3.14.0, Alloy v1.21.0, and OpenCost v2.5.32).

---

## 📐 Enterprise Architecture Blueprint (`docs/Diagrams.drawio`)

The complete visual architecture is maintained in **[`docs/Diagrams.drawio`](docs/Diagrams.drawio)** (and [`docs/diagrams.drawio`](docs/diagrams.drawio)), containing **12 specialized architecture tabs** (regenerated at any time via `.\platform-minikube.ps1 diagrams`):

| Tab # | Diagram Tab Name | Architectural Scope |
| :---: | :--- | :--- |
| **1** | `1. Global System Ecosystem` | End-to-end topology across React 19 SPA, Cloudflare Anycast Quick Tunnels, Kong 3.9.4, Istio 1.31.2 mTLS, Go 1.26 microservices, PostgreSQL 18, Redis 8.8.1, Kafka 8.3.2, Vault 2.2.0, and LGTM. |
| **2** | `2. Hexagonal Domain & Saga` | Ports & Adapters boundaries, `BookingSagaOrchestrator` forward/compensation steps, `singleflight` anti-stampede Redis cache, and PostgreSQL `btree_gist` range exclusion. |
| **3** | `3. Event-Driven Outbox & DLQ` | Atomic SQL + `stay_outbox_events` commit, `FOR UPDATE SKIP LOCKED` relay, Kafka 8.3.2 KRaft partitions, and `notification-worker` Redis idempotency + DLQ fallback. |
| **4** | `4. Zero-Trust Security & Vault PKI` | Keycloak 26.8.1 OIDC/RBAC, Kong Gateway hardening, Vault v2.2.0 Kubernetes Auth + Istio Root/Intermediate PKI CA (`cacerts`), and OPA Gatekeeper v3.23.0 admission control. |
| **5** | `5. Helm 4 & Istio Canary Delivery` | Helm 4.3.1 `--server-side --wait=watcher` deployment, zero-downtime `RollingUpdate`, KEDA v2.21.0 autoscaling, and Istio `VirtualService` canary traffic splitting. |
| **6** | `6. Cloudflare Edge & Tunnels` | Self-healing localhost port-forward supervisor (`127.0.0.1`) paired with Cloudflare Anycast HTTP/2 Quick Tunnels (`*.trycloudflare.com`) and GitHub Actions syncing. |
| **7** | `7. 6-Gate Shift-Left DevSecOps` | Blocking pre-flight pipeline: Gitleaks 8.30.1, Semgrep SAST, TFLint 0.64.0, Trivy 0.76.0, Conftest 0.71.1 (205/205 Rego tests), and Sigstore Cosign v3.1.3 bundle verification. |
| **8** | `8. LGTM Observability & FinOps` | W3C `traceparent` correlation across Alloy 1.21.0, Tempo 3.0.5, Loki 3.7.8, Prometheus v3.14.0, Grafana 13.2.3, OpenCost v2.5.32, and 7-day Prometheus FinOps right-sizing. |
| **9** | `9. AWS Production Cloud (EKS)` | Multi-AZ Terraform 1.16.6 topology on Amazon EKS 1.37, RDS PostgreSQL 18 Multi-AZ, ElastiCache Redis 8.8, Amazon MSK Kafka, and KMS CMK encryption. |
| **10** | `10. SRE Chaos, DDoS & BCDR` | GiST concurrency & idempotency chaos suite, edge anti-DDoS burst tester, Kafka outbox network partition drill, and PostgreSQL 18 PitR backup/restore verification. |
| **11** | `11. Platform CLI Lifecycle` | 9-stage full `up` bootstrap and `<30s` 6-stage `start`/`resume` fast-recovery workflow in `platform-minikube.ps1`. |
| **12** | `12. Data Model & ERD` | Physical PostgreSQL 18 schema (`rooms`, `stays` with `btree_gist`, `stay_outbox_events`, `billing_charges`, `audit_logs`) and Redis 8.8.1 keyspace design. |

---

## 🛠️ Technology Version Baseline

| Layer | Component | Version | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Backend** | Go / Gin / GORM / pgx | `1.26.0` / `v1.12.0` / `v1.31.2` | Hexagonal microservices (`room`, `stay`, `billing`, `notification-worker`), JWT RBAC, OpenAPI Swagger |
| **Frontend** | React / TypeScript / Vite | `19.2.4` / `6.0.2` / `8.0.5` | Luxury Guest Portal, Room Rack Matrix, Folio Manager, ErrorBoundary, non-root Nginx 1.29 |
| **API Gateway** | Kong Gateway (DB-less) | `3.9.4` | Rate limiting (`120 req/min`), request size guard, strict CORS, correlation ID, W3C OTel spans |
| **Service Mesh** | Istio + Kiali | `1.31.2` + `v2.33.0` | `STRICT` mTLS (`PeerAuthentication`), `AuthorizationPolicy`, outlier circuit breaking, canary weights |
| **Identity & Secrets** | Keycloak IAM + HashiCorp Vault + ESO | `26.8.1` + `v2.2.0` | OIDC/OAuth2 JWT roles, Vault KV-v2, K8s Auth Engine, Vault PKI CA for Istio `cacerts`, ExternalSecrets |
| **Persistence & Cache** | PostgreSQL + Redis + Redis Exporter | `18-alpine` + `8.8.1` + `v1.94.0` | `btree_gist` anti-overlap constraint, Transactional Outbox, `singleflight` cache, atomic `SetNX` locks |
| **Event Streaming** | Apache Kafka (KRaft) + KEDA | `8.3.2` + `v2.21.0` | ZooKeeper-less event streaming (`hotel.stays.lifecycle.v1` + `.dlq`), consumer-lag driven autoscaling |
| **Observability & FinOps** | Grafana / Tempo / Loki / Alloy / Prometheus / OpenCost | `13.2.3` / `3.0.5` / `3.7.8` / `1.21.0` / `v3.14.0` / `v2.5.32` | Full LGTM correlation (Traces ↔ Logs ↔ Metrics), SRE alerting rules, AWS FinOps & 7-day right-sizing |
| **Orchestration & IaC** | Minikube / K8s / Helm / Terraform | `1.39.0` / `1.37.0` / `4.3.1` / `1.16.6` | Helm 4 Server-Side Apply (`--server-side --wait=watcher`), multi-env values (`dev`, `staging`, `prod`) |
| **Shift-Left DevSecOps** | Gitleaks / Semgrep / TFLint / Trivy / Conftest / Cosign | `8.30.1` / `1.x` / `0.64.0` / `0.76.0` / `0.71.1` / `v3.1.3` | 6 mandatory security gates, OPA Gatekeeper `v3.23.0`, CycloneDX SBOMs, ECDSA P-256 Sigstore bundles |

---

## 🚀 Quick Start (`platform-minikube.ps1`)

The entire platform lifecycle—from 6-Gate Shift-Left security verification and Minikube cluster provisioning to Vault PKI seeding, Helm 4.3.1 Server-Side Apply, self-healing localhost tunnels, Cloudflare Anycast Quick Tunnels, and SRE chaos testing—is orchestrated through **[`platform-minikube.ps1`](platform-minikube.ps1)**.

### 1. Full 9-Stage Platform Bootstrap (Minikube)
```powershell
# Bootstrap Minikube 1.39.0 (K8s 1.37.0), run all 6 DevSecOps gates, build images,
# deploy Istio 1.31.2 + Vault 2.2.0 + Helm 4.3.1, and launch self-healing tunnels:
.\platform-minikube.ps1 up -Build
```

### 2. Daily `<30s` 6-Stage Fast-Resume
```powershell
# Resume a stopped Minikube cluster in under 30 seconds with Cosign verification & tunnel recovery:
.\platform-minikube.ps1 start
```

### 3. Shift-Left 6-Gate DevSecOps Pipeline
```powershell
# Run Gitleaks, Semgrep SAST, TFLint, Trivy, Conftest (205 Rego tests + Helm 4 render), and Cosign v3.1.3:
.\platform-minikube.ps1 security-scan
```

### 4. Cloudflare Anycast Quick Tunnels (`*.trycloudflare.com`)
```powershell
# Start public HTTPS Quick Tunnels for Frontend (:5173), Kong Gateway (:8000), and Keycloak (:8181):
.\platform-minikube.ps1 cloudflare -Action start

# Inspect active public tunnel URLs and HTTP health codes:
.\platform-minikube.ps1 cloudflare -Action status
```

### 5. HashiCorp Vault v2.2.0 K8s Auth & Istio PKI CA
```powershell
# Configure Vault Kubernetes Auth or mint a Root/Intermediate CA for Istio mTLS (cacerts):
.\platform-minikube.ps1 vault -VaultAction status
.\platform-minikube.ps1 vault -VaultAction k8s-auth
.\platform-minikube.ps1 vault -VaultAction istio-pki -RotateVaultPki
```

### 6. SRE Chaos, DDoS, E2E Guest Journey & FinOps Right-Sizing
```powershell
# Run Go 1.26 microservice unit & race tests:
.\platform-minikube.ps1 test

# Execute full E2E Guest Journey simulation (Browse -> Book -> Folio Charge -> Checkout):
.\platform-minikube.ps1 simulate

# Run concurrent GiST overlap & Idempotency-Key race chaos testing:
.\platform-minikube.ps1 chaos -ChaosRuns 12 -Concurrency 6

# Run edge rate-limit / anti-DDoS flood probe against Kong Gateway:
.\platform-minikube.ps1 ddos -Duration 10 -Workers 16

# Run deep LGTM observability & OpenAPI Swagger diagnostics:
.\platform-minikube.ps1 diagnose

# Run AWS FinOps cost estimation & Prometheus 7-day CPU/Memory right-sizing:
.\platform-minikube.ps1 cost
.\platform-minikube.ps1 finops-rightsize
```

---

## 📚 Documentation Index

- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — Executive architecture guide, 12-tab Draw.io blueprint overview, Transactional Outbox & DLQ flows, Vault v2.2.0 PKI CA, and SRE operations.
- **[`docs/Diagrams.drawio`](docs/Diagrams.drawio)** — 12-tab visual architecture blueprint (open in Draw.io / diagrams.net or VS Code Draw.io extension).
- **Architecture Deep-Dives (`docs/architecture/`)**:
  - [`current-state.md`](docs/architecture/current-state.md) — Current baseline architecture and verified runtime metrics.
  - [`target-state.md`](docs/architecture/target-state.md) — Cloud-native target state across Minikube and AWS EKS.
  - [`architecture-decisions.md`](docs/architecture/architecture-decisions.md) — Architectural Decision Records (ADRs 001–010).
  - [`technical-debt.md`](docs/architecture/technical-debt.md) — Remediated technical debt register and ongoing roadmap.
- **Development, Deployment, Security & Operations**:
  - [`docs/development/local-development.md`](docs/development/local-development.md) — Local development with Go 1.26, Node 22, Docker Compose, and `platform-minikube.ps1`.
  - [`docs/deployment/deployment-strategy.md`](docs/deployment/deployment-strategy.md) — Helm 4.3.1 Server-Side Apply, Istio progressive canary delivery, and GitHub Actions CI/CD.
  - [`docs/security/security-assessment.md`](docs/security/security-assessment.md) — STRIDE threat model, 6-Gate Shift-Left DevSecOps, Vault PKI CA, and Cosign supply-chain security.
  - [`docs/operations/runbooks.md`](docs/operations/runbooks.md) — Production & Minikube SRE runbooks, chaos drills, FinOps right-sizing, and BCDR procedures.
