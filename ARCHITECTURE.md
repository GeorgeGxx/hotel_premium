# Hotel Premium - Enterprise Microservices Architecture & Operations Runbook

## 1. Executive Architecture Overview

`hotel_premium` is a decoupled, cloud-native enterprise luxury hospitality management platform built using Domain-Driven Design (DDD), Clean Architecture, Event-Driven Architecture (EDA) with Apache Kafka 8.3.2 in KRaft mode, HashiCorp Vault 2.2.0 with External Secrets Operator (ESO), Kong API Gateway 3.9.4 DB-less, and a complete Observability Mesh (Tempo 3.0.5, Loki 3.7.8, Prometheus v3.14.0, Alloy v1.21.0, OpenTelemetry Collector, and Grafana 13.2.3 Explore).

```mermaid
flowchart TD
    subgraph Clients ["Client Layer"]
        SPA["React 19 + Tailwind CSS v4 Guest Portal & Rack Matrix"]
    end

    subgraph Gateway ["API Gateway (Kong 3.9.4 DB-less)"]
        Kong["Kong Ingress (:8000)"]
        KAdmin["Kong Admin & Metrics (:8001)"]
        RateLimit["Rate Limiting (120 req/m)"]
        CORS["Strict CORS & W3C Tracing Ingress"]
        Kong --- RateLimit
        Kong --- CORS
    end

    subgraph CoreServices ["Microservices Domain Tier (Go 1.26)"]
        RoomSvc["room-service (:8081)"]
        StaySvc["stay-service (:8082)\n+ Transactional Outbox"]
        BillSvc["billing-service (:8083)"]
        NotifWorker["notification-worker (:8084)\nKafka Event Consumer"]
    end

    subgraph Security ["Security & Identity Layer"]
        Vault["HashiCorp Vault 2.2.0 (KV-v2 Secrets)"]
        ESO["External Secrets Operator (ESO)"]
        Keycloak["Keycloak 26.8.1 (OIDC / OAuth2 / JWT)"]
        Vault -->|SecretStore| ESO
    end

    subgraph EventStream ["Event-Driven Backbone (KRaft)"]
        Kafka["Apache Kafka 8.3.2 (KRaft, No ZooKeeper)"]
        KafkaExp["Kafka Exporter v1.9.0 (:9308)"]
        Kafka --> KafkaExp
    end

    subgraph Persistence ["Persistence & Caching Tier"]
        Postgres[("PostgreSQL 18\n(btree_gist Exclusion Constraints)")]
        Redis[("Redis 8.8.1-Alpine Cache")]
    end

    subgraph Observability ["Observability Mesh (Grafana Explore)"]
        OTelCol["OTel Collector Contrib (:4317/:4318)"]
        Tempo["Grafana Tempo 3.0.5 (Distributed Tracing :3200)"]
        Loki["Grafana Loki 3.7.8 (Structured Logs :3100)"]
        Prometheus["Prometheus v3.14.0 (Metrics & SRE Alerts :9090)"]
        Alloy["Grafana Alloy v1.21.0"]
        Grafana["Grafana v13.2.3 (:3000)"]
    end

    SPA -->|HTTP / REST| Kong
    Kong -->|Round-Robin / Active Circuit Breakers| RoomSvc
    Kong -->|Round-Robin / Active Circuit Breakers| StaySvc
    Kong -->|Round-Robin / Active Circuit Breakers| BillSvc
    Kong -->|Auth Ingress| Keycloak

    RoomSvc --> Postgres
    RoomSvc --> Redis
    StaySvc --> Postgres
    StaySvc -->|Publish Pending Events| Kafka
    Kafka -->|Consume Lifecycle Events| NotifWorker
    BillSvc --> Postgres

    Kong -->|W3C Spans| OTelCol
    RoomSvc & StaySvc & BillSvc & NotifWorker -->|OTLP Traces| OTelCol
    OTelCol --> Tempo
    OTelCol --> Loki
    Prometheus -->|Scrape /metrics| Kong
    Prometheus -->|Scrape /metrics| CoreServices
    Prometheus -->|Scrape /metrics| KafkaExp
    Grafana --> Tempo
    Grafana --> Loki
    Grafana --> Prometheus
```

---

## 2. Service Catalog & Ports Matrix

| Service Component | Port (Internal) | Host Port | Technology Stack | Responsibilities |
|---|---|---|---|---|
| **Kong API Gateway** | `8000`, `8001` | `8000`, `8001` | Kong Gateway 3.9.4 | Reverse proxy, routing, circuit breaking, OTel tracing, rate limiting |
| **Frontend Web** | `80` | `80` | React 19, Tailwind CSS v4, Nginx | Luxury Guest Booking Portal, Room Rack Matrix, Reservation Manager |
| **Room Service** | `8081` | `8081` | Go 1.26, pgx/v5, Redis 8.8.1 | Room inventory, room categories, housekeeping statuses |
| **Stay Service** | `8082` | `8082` | Go 1.26, pgx/v5, Kafka Outbox | Reservations, check-in, check-out, GiST range exclusion anti-double booking |
| **Billing Service** | `8083` | `8083` | Go 1.26, pgx/v5 | Folio billing, room charges, point-of-sale invoicing |
| **Notification Worker**| `8084` | `8084` | Go 1.26, segmentio/kafka-go | Asynchronous Kafka event consumer, VIP guest notifications, housekeeping alerts |
| **Apache Kafka** | `29092`, `9092` | `9092` | Confluent Kafka 8.3.2 (KRaft) | Event-driven messaging backbone with 3 partitions per topic |
| **Kafka Exporter** | `9308` | `9308` | Kafka Exporter v1.9.0 | Topic partition lag, consumer group offsets, broker metrics |
| **HashiCorp Vault** | `8200` | `8200` | HashiCorp Vault 2.2.0 | KV-v2 engine, AppRole auth, secret engine for microservices & ESO |
| **Keycloak IAM** | `8080` | `8181` | Keycloak 26.8.1 | OIDC realm, JWT tokens, RBAC roles (`admin_user`, `basic_user`) |
| **PostgreSQL** | `5432` | `5432` | PostgreSQL 18-Alpine | Relational persistence, GiST exclusion constraints, outbox events |
| **Redis** | `6379` | `6379` | Redis 8.8.1-Alpine | L1 caching for room racks and session tokens |
| **Redis Exporter** | `9121` | `9121` | Redis Exporter v1.94.0 | Redis key pattern & memory/hit-ratio telemetry |
| **Grafana** | `3000` | `3000` | Grafana 13.2.3 | Unified Explore UI, Tempo Service Graph, Loki correlation |
| **Tempo** | `3200`, `4317` | `3200` | Grafana Tempo 3.0.5 | Distributed tracing backend, service maps, span metrics generator |
| **Loki** | `3100` | `3100` | Grafana Loki 3.7.8 | High-efficiency structured JSON log aggregation |
| **Alloy** | `3300`, `4317`, `4318` | `3300` | Grafana Alloy v1.21.0 | Unified OTLP & log telemetry collector agent |
| **Prometheus** | `9090` | `9090` | Prometheus 3.14.0 | TSDB metrics collection, active SRE alerting rules |
| **OTel Collector** | `4317`, `4318` | `4317`, `4318` | OpenTelemetry Collector Contrib 0.159.0 | OTLP telemetry ingestion pipeline (traces, metrics, logs) |

---

## 3. Distributed Tracing & Grafana Explore Integration

### Unified Service Discovery in Tempo
All services propagate distributed context via W3C `traceparent` headers (`00-{trace_id}-{span_id}-{flags}`) and are automatically queryable in Grafana Explore (`http://localhost:3000/explore`) using the **Tempo** datasource:
1. `kong-api-gateway` (Kong Ingress Spans)
2. `room-service` (Go 1.26 Server Spans)
3. `stay-service` (Go 1.26 Server & Database Spans)
4. `billing-service` (Go 1.26 Server Spans)
5. `notification-worker` (Async Kafka Consumer Spans)

### Bidirectional Observability Correlation
- **Traces ➔ Logs (Tempo ➔ Loki)**: Click "Logs for this span" inside any Tempo trace in Grafana Explore to immediately view correlated JSON logs filtered by `trace_id`.
- **Logs ➔ Traces (Loki ➔ Tempo)**: Click the `TraceID` or `W3CTraceID` derived field in Loki logs to jump directly into the full Tempo timeline.
- **Traces ➔ Metrics (Tempo ➔ Prometheus)**: Tempo Metrics Generator generates span rate (`traces_spanmetrics_calls_total`) and P95 latency (`traces_spanmetrics_latency_bucket`) queryable in Prometheus.
- **NodeGraph & Service Map**: Visualizes dependencies dynamically:
  `kong-api-gateway` ➔ `room-service` & `stay-service` ➔ `Kafka 8.3.2` ➔ `notification-worker`.

---

## 4. Resilience & The Transactional Outbox Pattern

To prevent dual-write inconsistencies between database transactions and message broker calls, `stay-service` implements the **Transactional Outbox Pattern**:
1. When a reservation is created, updated, or cancelled, the event payload is inserted into `stay_outbox_events` in the **same atomic database transaction** as the reservation.
2. A dedicated background goroutine (`OutboxPublisher`) periodically scans `stay_outbox_events` using `SELECT ... FOR UPDATE SKIP LOCKED` and publishes pending events to Kafka.
3. If Kafka is temporarily down, reservations are still confirmed with zero downtime for guests. Once Kafka recovers, all pending events are drained in strict FIFO sequence.
4. **Resilience Verification**: Run `pwsh -File ./scripts/resilience-test.ps1` to automatically execute a live chaos experiment pausing Kafka and verifying zero-loss event recovery.

---

## 5. Security, Vault PKI CA & 6-Gate Shift-Left DevSecOps

### 5.1 HashiCorp Vault v2.2.0, ESO & Istio PKI CA
1. **Vault KV-v2 Storage**:
   - `secret/data/hotel-premium/database` (DB Host, credentials, pool limits)
   - `secret/data/hotel-premium/jwt` (JWT signing secret, expiration hours)
   - `secret/data/hotel-premium/keycloak` (OAuth2 client ID and secret)
2. **Vault Kubernetes Auth Engine (`.\platform-minikube.ps1 vault -VaultAction k8s-auth`)**:
   - Configures Vault's `auth/kubernetes` mount against the Kubernetes TokenReview API and binds least-privilege policy `hotel-policy` to the External Secrets Operator and microservice ServiceAccounts in `dev`.
3. **Vault PKI Root & Intermediate CA for Istio (`.\platform-minikube.ps1 vault -VaultAction istio-pki`)**:
   - Provisions a 10-year Root CA (`pki`) and 5-year Intermediate CA (`pki_int`), signs the Istio mesh intermediate certificate, and injects secret `cacerts` into `istio-system` so `istiod` issues mTLS SPIFFE X.509 workload certificates rooted in HashiCorp Vault.
4. **External Secrets Operator (ESO)**:
   - Manifests in `infrastructure/vault/eso/` and `infrastructure/eso/` define `ClusterSecretStore` and `ExternalSecret` resources to synchronize Vault secrets directly into Kubernetes Secrets (`hotel-app-secrets`).

### 5.2 6-Gate Shift-Left DevSecOps Pipeline (`.\platform-minikube.ps1 security-scan`)
Every local bootstrap (`up`) and CI/CD execution enforces six mandatory security gates:
1. **Gate 1 — Gitleaks (`8.30.1`)**: Repository-wide SAST secret detection (`0` leaks allowed).
2. **Gate 2 — Semgrep SAST**: Custom OWASP Top 10 & Go/TypeScript/Python static rules (`devsecops/sast/semgrep/semgrep-rules.yaml`).
3. **Gate 3 — TFLint (`0.64.0`)**: Terraform HCL static analysis across `terraform/environments/local-minikube` and `terraform/environments/aws`.
4. **Gate 4 — Trivy (`0.76.0`)**: Vulnerability, Dockerfile, and Kubernetes misconfiguration scanning (`CRITICAL`/`HIGH` blocker).
5. **Gate 5 — OPA Conftest (`0.71.1`) + Helm `4.3.1` Template Gate**: Evaluates `devsecops/policies/conftest/security.rego` across both static Kubernetes manifests and dynamically rendered `helm template` output (`205/205` Rego checks passed).
6. **Gate 6 — Sigstore Cosign (`v3.1.3`)**: Cryptographic signature and provenance bundle verification (`devsecops/supply-chain/cosign/supply-chain-manifest.sigstore.json` verified via `cosign.pub`).

---

## 6. SRE Alerting Rules & FinOps Right-Sizing

### 6.1 Prometheus SRE Alerting Rules (`infrastructure/prometheus/alerts.yml`)
- **`HotelMicroserviceDown`**: Triggered if any microservice instance (`room-service`, `stay-service`, `billing-service`, `notification-worker`) is down for > 30s (`severity: critical`).
- **`KongGatewayDown`**: Triggered if Kong API Gateway stops responding on `:8001` for > 30s (`severity: page`).
- **`KafkaHighConsumerLag`**: Triggered if consumer group lag exceeds 50 messages (`severity: warning`).
- **`VaultInstanceDown`**: Triggered if Vault instance is unreachable or sealed (`severity: critical`).
- **`KongUpstreamTargetUnhealthy`**: Triggered if active healthchecks trip a circuit breaker on an upstream target (`severity: warning`).
- **`PostgresConnectionSaturation`**: Triggered if active database connections exceed 80% pool capacity (`severity: warning`).

### 6.2 FinOps & 7-Day Prometheus Right-Sizing (`scripts/local-cost-estimator.py`)
- **Cloud Cost Estimation (`.\platform-minikube.ps1 cost`)**: Evaluates Kubernetes CPU/Memory requests against AWS EKS, RDS, ElastiCache, and MSK pricing with On-Demand vs. 1-Year Savings Plan comparisons.
- **Automated Right-Sizing (`.\platform-minikube.ps1 finops-rightsize`)**: Queries 7-day P95 CPU (`rate(container_cpu_usage_seconds_total[5m])`) and peak working-set memory (`container_memory_working_set_bytes`) from Prometheus (`:9090`), applies a 25% SRE safety buffer, and generates ready-to-apply Helm `resources.requests` YAML snippets.

---

## 7. Enterprise Visual Blueprints (`docs/Diagrams.drawio`)

The repository includes a 12-tab Draw.io architecture suite at **[`docs/Diagrams.drawio`](docs/Diagrams.drawio)** (and [`docs/diagrams.drawio`](docs/diagrams.drawio)), generated deterministically by `scripts/generate_drawio.py` (`.\platform-minikube.ps1 diagrams`):

1. **`1. Global System Ecosystem`** — Full North-South & East-West architecture across React 19, Cloudflare Quick Tunnels, Kong 3.9.4, Istio 1.31.2, Go 1.26 microservices, PostgreSQL 18, Redis 8.8.1, Kafka 8.3.2, Vault 2.2.0, and LGTM.
2. **`2. Hexagonal Domain & Saga`** — Ports & Adapters architecture, `BookingSagaOrchestrator`, `singleflight` anti-stampede cache, and PostgreSQL `btree_gist` exclusion constraints.
3. **`3. Event-Driven Outbox & DLQ`** — Transactional Outbox (`stay_outbox_events`), `FOR UPDATE SKIP LOCKED` relay, Kafka 8.3.2 KRaft partitions, and `notification-worker` DLQ recovery.
4. **`4. Zero-Trust Security & Vault PKI`** — Keycloak 26.8.1 OIDC, Kong Gateway security plugins, Vault v2.2.0 K8s Auth & Istio PKI CA (`cacerts`), and OPA Gatekeeper v3.23.0.
5. **`5. Helm 4 & Istio Canary Delivery`** — Helm 4.3.1 Server-Side Apply (`--server-side --wait=watcher`), zero-downtime `RollingUpdate`, KEDA v2.21.0 autoscaling, and Istio `VirtualService` canary splitting.
6. **`6. Cloudflare Edge & Tunnels`** — Self-healing localhost port-forward supervisor paired with `cloudflared` Anycast HTTP/2 Quick Tunnels (`*.trycloudflare.com`).
7. **`7. 6-Gate Shift-Left DevSecOps`** — Gitleaks, Semgrep SAST, TFLint, Trivy, Conftest (205 Rego tests), and Sigstore Cosign v3.1.3 verification flow.
8. **`8. LGTM Observability & FinOps`** — W3C `traceparent` pipeline across Alloy 1.21.0, Tempo 3.0.5, Loki 3.7.8, Prometheus v3.14.0, Grafana 13.2.3, and OpenCost v2.5.32.
9. **`9. AWS Production Cloud (EKS)`** — Multi-AZ Terraform 1.16.6 architecture on Amazon EKS 1.37, RDS PostgreSQL 18, ElastiCache Redis 8.8, Amazon MSK, and AWS KMS.
10. **`10. SRE Chaos, DDoS & BCDR`** — Concurrent GiST & idempotency chaos testing, edge anti-DDoS flood probes, Kafka outbox resilience drills, and PostgreSQL 18 PitR BCDR.
11. **`11. Platform CLI Lifecycle`** — 9-stage full `up` bootstrap and `<30s` 6-stage `start`/`resume` fast-recovery workflow in `platform-minikube.ps1`.
12. **`12. Data Model & ERD`** — Physical PostgreSQL 18 relational schema and Redis 8.8.1 keyspace layout.

---

## 8. Operations & Unified CLI Commands (`platform-minikube.ps1`)

```powershell
# 1. Full 9-stage Minikube bootstrap with 6-Gate DevSecOps & Helm 4.3.1 Server-Side Apply
.\platform-minikube.ps1 up -Build

# 2. Fast-resume cluster in <30s with Cosign provenance & self-healing tunnels
.\platform-minikube.ps1 start

# 3. Run all 6 Shift-Left DevSecOps gates (Gitleaks, Semgrep, TFLint, Trivy, Conftest, Cosign)
.\platform-minikube.ps1 security-scan

# 4. Manage public Cloudflare Anycast Quick Tunnels (start | status | restart | stop)
.\platform-minikube.ps1 cloudflare -Action start
.\platform-minikube.ps1 cloudflare -Action status

# 5. Manage HashiCorp Vault v2.2.0 (status | seed | k8s-auth | istio-pki)
.\platform-minikube.ps1 vault -VaultAction k8s-auth
.\platform-minikube.ps1 vault -VaultAction istio-pki

# 6. Run E2E guest journey simulation, concurrent GiST chaos, DDoS probe, and LGTM diagnostics
.\platform-minikube.ps1 simulate
.\platform-minikube.ps1 chaos
.\platform-minikube.ps1 ddos
.\platform-minikube.ps1 diagnose

# 7. Run FinOps cloud cost estimation & Prometheus 7-day workload right-sizing
.\platform-minikube.ps1 cost
.\platform-minikube.ps1 finops-rightsize

# 8. Regenerate the 12-tab Draw.io architecture blueprints
.\platform-minikube.ps1 diagrams
```
