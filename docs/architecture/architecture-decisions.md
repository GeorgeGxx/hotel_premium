# Architecture Decision Records (ADRs) — `hotel_premium`

---

## ADR-001: Preserve Go 1.26, Gin v1.12.0, and GORM v1.31.2 with PostgreSQL GiST Constraints

- **Status**: Accepted
- **Context**: `hotel_premium` requires high-throughput concurrency, strict relational integrity against double-booking, and maintainable repository abstractions aligned with our reference standards (`go 1.26`, `github.com/gin-gonic/gin v1.12.0`, `gorm.io/gorm v1.31.2`, `gorm.io/driver/postgres v1.6.3`).
- **Decision**:
  1. Standardize all persistence repositories (`GormRoomRepository`, `GormStayRepository`, `GormBillingRepository`, `AuditRepository`) on **GORM v1.31.2** backed by `gorm.io/driver/postgres v1.6.3` (`pgx/v5` under the hood).
  2. Preserve PostgreSQL native `btree_gist` exclusion constraint (`stays_room_period_exclusion`) to guarantee zero double-bookings at the database engine level even under concurrent transactions.
  3. Mark PostgreSQL `GENERATED ALWAYS` columns (`stay_charges.total_price`) with `gorm:"column:total_price;->;<-:false"` so GORM reads the database-computed value without attempting to `INSERT` or `UPDATE` it.
  4. Propagate all errors inside `db.WithContext(ctx).Transaction(...)` so any failure in room status update, folio calculation, or outbox insertion triggers an immediate transaction rollback.
- **Consequences**: Eliminates silent partial commits and generated-column SQL errors while retaining 100% compatibility with existing domain ports.

---

## ADR-002: Clear North-South (Kong v3.9.4) and East-West (Istio + Kiali) Separation

- **Status**: Accepted
- **Context**: Running both an API Gateway and a Service Mesh can lead to duplicated ingress layers or bypassed security controls (as seen when `VirtualService` routed external traffic directly to microservices, bypassing Kong).
- **Decision**:
  1. **Kong Gateway v3.9.4** handles all **North-South** edge concerns: public routing (`/api/v1/rooms`, `/api/v1/stays`, `/api/v1/billing`, `/api/v1/notifications`, `/api/v1/events/live`, `/`), rate limiting, request body size limits, CORS, security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`), and W3C trace propagation.
  2. In Kubernetes, Istio `IngressGateway` forwards external HTTP/HTTPS traffic exclusively to `kong-gateway.dev.svc.cluster.local:8000` (not around Kong).
  3. **Istio 1.31.2** handles all **East-West** mesh concerns: `PeerAuthentication` (`mode: STRICT`), `DestinationRule` (`tls.mode: ISTIO_MUTUAL` + outlier detection), and default-deny + explicit allow `AuthorizationPolicy` resources so microservices only accept traffic from `kong-gateway` or authorized peer service accounts.
  4. **Kiali v2.33.0** provides real-time service mesh topology, mTLS verification, and Tempo/Prometheus correlation.
- **Consequences**: Single well-defined edge policy enforcement point (Kong) combined with cryptographic zero-trust east-west transport (Istio).

---

## ADR-003: Hardened JWT & Role-Based Access Control (RBAC) Verification

- **Status**: Accepted
- **Context**: `backend/internal/infrastructure/http/rbac.go` previously trusted client-supplied `X-User-Role` headers unconditionally and contained a substring check (`strings.Contains(auth, "admin")`) that allowed trivial privilege escalation.
- **Decision**:
  1. Remove the substring `"admin"` bypass immediately.
  2. Support full hospitality domain roles (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPING`, `USER`) with hierarchical/explicit permission checks.
  3. Verify HMAC-SHA256 / RSA JWT tokens (`Authorization: Bearer <token>`) cryptographically when present, extracting `role` / `realm_access.roles` claims.
  4. Only allow `X-User-Role` header fallback when explicitly authenticated via trusted internal gateway token (`X-Gateway-Secret`) or when `APP_ENV` is `development`/`test` (never in `production`).
  5. Enforce RBAC middleware across mutating endpoints (`PATCH /api/v1/rooms/:id/price`, `PATCH /api/v1/rooms/:id/status`, `POST /api/v1/billing/shifts/*`, etc.).
- **Consequences**: Prevents header spoofing and unauthorized administrative mutations while preserving smooth local testing and frontend persona switching in development.

---

## ADR-004: Transactional Outbox + Idempotent Kafka Consumer with DLQ (`hotel.stays.lifecycle.v1`)

- **Status**: Accepted
- **Context**: Distributed state changes between `stay-service` and `notification-worker` must never lose events if Kafka is temporarily unavailable, nor process duplicate messages on consumer rebalance.
- **Decision**:
  1. `GormStayRepository` writes normalized lifecycle events (`STAY_CREATED`, `GUEST_CHECKED_OUT`, `STAY_CANCELLED`) into `stay_outbox_events` inside the same database transaction as the `Stay` mutation.
  2. `OutboxPublisher` polls `stay_outbox_events` using `FOR UPDATE SKIP LOCKED` and publishes to Kafka topic `hotel.stays.lifecycle.v1`.
  3. `notification-worker` normalizes both uppercase (`STAY_CREATED`) and PascalCase (`StayCreated`) event types, deduplicates events by `event_id` via Redis (`SetNX` with 24h TTL), retries transient failures with exponential backoff + jitter, and publishes poison pills to `hotel.stays.lifecycle.v1.dlq`.
- **Consequences**: Guarantees at-least-once delivery from `stay-service` and effectively-once execution in `notification-worker`.

---

## ADR-005: Unified Telemetry Collection via Grafana Alloy to Tempo, Loki, and Prometheus

- **Status**: Accepted
- **Context**: Running both `otel-collector` and `alloy` in Docker Compose while using only `alloy` in Kubernetes created configuration drift and broken trace/log pipelines.
- **Decision**:
  1. Standardize on **Grafana Alloy v1.21.0** (`:3300` UI/metrics, `:4317` OTLP gRPC, `:4318` OTLP HTTP) as the primary telemetry collector across both Docker Compose and Kubernetes.
  2. Configure Alloy to receive OTLP traces, metrics, and logs, scrape Docker container logs (`discovery.docker` -> `loki.source.docker` -> `loki.process`), and forward to **Grafana Tempo 3.0.5** (`:3200`), **Grafana Loki 3.7.8** (`:3100` with `allow_structured_metadata: true`), and **Prometheus v3.14.0** (`:9090`).
  3. Maintain two distinct, non-redundant **Grafana 13.2.3** (`:3000`) dashboards:
     - **Hotel Business KPIs ($ USD)**: ADR, RevPAR, Occupancy %, Length of Stay, Cancellation Rate, Revenue by Room Category (`SGL`, `DBL`, `STE`).
     - **Hotel Technical & SRE Operations**: RED metrics (Request rate, Error rate, Duration p95/p99), Go runtime memory/goroutines, PostgreSQL connections, Redis hit ratio, Kafka consumer lag, and Kong upstream health.
- **Consequences**: Eliminates duplicate collectors, ensures 100% parity between local Compose and Kubernetes observability, and provides full trace-to-log-to-metric correlation.

---

## ADR-006: AWS-Only Production Infrastructure via Modular Terraform & GitHub Actions OIDC

- **Status**: Accepted
- **Context**: Production deployment targets AWS exclusively without static IAM access keys or manual click-ops.
- **Decision**:
  1. Provision AWS infrastructure under `terraform/environments/aws/` and `terraform/modules/aws/` covering VPC (3 AZs, public/private/data subnets, VPC Flow Logs), EKS (managed node groups with IMDSv2 `http_tokens = "required"`, control plane audit logging), RDS PostgreSQL (Multi-AZ, KMS encrypted, private subnet SG), ElastiCache Redis (encryption at rest/in transit), MSK Kafka, ECR (immutable tags, scan on push), KMS customer-managed keys, IAM IRSA (ESO, ALB/NLB, EBS CSI), and GitHub Actions OIDC federation.
  2. Enforce blocking CI/CD quality and security gates in `.github/workflows/` (`ci-devsecops.yml`, `cd-aws.yml`, `helm-chart-release.yml`) with zero `|| true` bypasses, CycloneDX SBOM generation, and Cosign image signing/verification by `@sha256` digest.
- **Consequences**: Repeatable, auditable, least-privilege cloud infrastructure and supply-chain security.
