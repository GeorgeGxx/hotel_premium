# GlitchTip error tracking

## Selected release

- GlitchTip image: `glitchtip/glitchtip:7.0.0` (exact stable tag; latest stable observed on 2026-11-18).
- Official Helm chart: `9.2.0`, appVersion `7.0.0` (chart digest `sha256:a14b1face40ee3631ae017d5ed213ee19536f94e5d568cf06675eb9e8b8bf8f5`).
- Local database: PostgreSQL `18.7` (`postgres:18.7-alpine`); GlitchTip 7.0 requires PostgreSQL 15 or newer. The official installation page still says 14+, so the 7.0 release note takes precedence.
- Kubernetes uses authenticated chart-managed Valkey. Compose uses PostgreSQL-only mode.

## Local Compose

The opt-in service set is independent and binds only to loopback port 8092. Use synthetic hotel bookings only.

The PostgreSQL 18 image mounts its data volume at `/var/lib/postgresql`. This configuration is for a new PostgreSQL 18 data directory; it does not migrate an existing PostgreSQL 16 volume. Back up and migrate existing data with `pg_dump`/restore before switching.

```powershell
$env:GLITCHTIP_DB_PASSWORD = '<URL-safe local password>'
$env:GLITCHTIP_SECRET_KEY = '<generated random secret>'
docker compose -f compose.yaml -f compose.glitchtip.yaml --profile glitchtip up -d glitchtip
```

Open `http://localhost:8092`, create the project, and set its DSN in the untracked local environment as `GLITCHTIP_DSN`. Keep the application secret and database password out of Git. To stop while preserving data, use the same Compose files and `down` without `-v`.

## GKE deployment

The official Helm chart is `glitchtip` version `9.2.0` from `https://gitlab.com/api/v4/projects/16325141/packages/helm/stable`; values are in `k8s/helm/glitchtip/`. Provision Kubernetes Secrets `glitchtip-django-secret` (`SECRET_KEY`) and `glitchtip-database-url` (`DATABASE_URL`) from Google Secret Manager through the project's approved workload identity/secret delivery path. Use a dedicated Cloud SQL PostgreSQL 18 database with backups; Cloud SQL manages the minor version. The chart's authenticated Valkey deployment is used for task/cache work.

Ingress remains disabled. Provide private DNS and TLS before cloud use; `errors.example.invalid` is a placeholder. No Terraform apply, GKE deployment, or cloud ingestion test was run.

## Data handling and status

The Compose overlay passes `GLITCHTIP_DSN` to backend containers when configured; blank DSNs keep SDK sending disabled. Sentry SDK initialization, event sanitization, release metadata, and synthetic ingestion verification remain pending. GlitchTip complements Grafana/Prometheus/Loki/Tempo/Alloy for grouped application errors; it does not replace their metric, log, or trace roles. Never transmit secrets or full payment/reservation records.
# Audit status

The React frontend and four Go services initialize GlitchTip-compatible SDKs. Browser and server DSNs are separate configuration values. Event hooks remove request, user, context, extra, breadcrumb, message, and transaction payloads and redact exception text; trace sampling is disabled.

The Bitbucket deployment installs chart 9.2.0 and app 7.0.0, but requires preprovisioned database, Django, Valkey, and client DSN secrets. The GKE hostname is a placeholder and ingress is disabled. A synthetic event, retention, backup, and alerting checks are required before declaring rollout complete.
