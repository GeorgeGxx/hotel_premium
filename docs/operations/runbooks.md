# Operational Runbooks & Incident Response — `hotel_premium`

This document provides step-by-step operational procedures for SREs and platform engineers operating `hotel_premium` in Docker Compose, Minikube, and Amazon EKS.

---

## Runbook 1: Service Health & Readiness Triage

### Symptoms
- Prometheus alert `HotelMicroserviceDown` or `KongUpstreamTargetUnhealthy` fires.
- Kong returns `502 Bad Gateway` or `503 Service Unavailable`.

### Diagnostic Steps
1. **Check Service Health Endpoints**:
   ```powershell
   # Via Kong Gateway
   curl.exe -i http://localhost:8000/api/v1/rooms/health
   # Direct container healthcheck (Docker Compose)
   docker compose ps
   ```
2. **Inspect Structured Logs in Grafana Loki (`http://localhost:3000`)**:
   - Navigate to **Explore -> Loki** and run:
     ```logql
     {service_name=~"room-service|stay-service|billing-service|notification-worker"} |= "ERROR"
     ```
3. **Kubernetes Pod Status**:
   ```powershell
   kubectl get pods -n dev -o wide
   kubectl describe pod -n dev -l app=stay-service
   kubectl logs -n dev -l app=stay-service --tail=100
   ```

### Resolution
- If PostgreSQL connectivity is degraded, verify `postgres` pod/container readiness and check `pg_stat_activity` for connection saturation (`PostgresConnectionSaturation` alert).
- Roll out a clean restart if transient network partition occurred:
  ```powershell
  kubectl rollout restart deployment/stay-service -n dev
  ```

---

## Runbook 2: PostgreSQL GiST Overlap Conflict (`409 Conflict`) vs. Database Saturation

### Symptoms
- Spike in `409 Conflict` responses on `POST /api/v1/stays` or `POST /api/v1/stays/saga-booking`.
- Or spike in `500 Internal Server Error` with `SQLSTATE 53300 (too_many_connections)`.

### Diagnostic Steps
1. **Distinguish Domain Invariant vs. Infrastructure Error**:
   - `409 Conflict` (`ErrRoomOverlap`): Expected domain rejection enforced by PostgreSQL `stays_room_period_exclusion` (`btree_gist`) when two guests attempt to book the same room for overlapping dates. No infrastructure intervention required.
   - `500 Internal Server Error`: Check PostgreSQL active connections in Grafana (**Hotel Technical & SRE Operations** dashboard -> *PostgreSQL Active Connections*).
2. **Inspect Locks & Active Queries**:
   ```powershell
   docker exec -it postgres psql -U hotel_admin -d hotel_premium_db -c "SELECT pid, state, wait_event_type, query FROM pg_stat_activity WHERE datname = 'hotel_premium_db';"
   ```

### Resolution
- Ensure `DB_MAX_OPEN_CONNS` (default `25` per service) × replica count remains below PostgreSQL `max_connections` (`200`).
- Terminate stuck idle-in-transaction sessions exceeding 5 minutes:
  ```sql
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < NOW() - INTERVAL '5 minutes';
  ```

---

## Runbook 3: Kafka Consumer Lag & Dead Letter Queue (`hotel.stays.lifecycle.v1.dlq`)

### Symptoms
- Prometheus alert `KafkaHighConsumerLag` triggers (`kafka_consumergroup_lag > 100`).
- Or messages appear on `hotel.stays.lifecycle.v1.dlq`.

### Diagnostic Steps
1. **Check Consumer Group Lag**:
   ```powershell
   docker exec -it kafka kafka-consumer-groups --bootstrap-server kafka:29092 --describe --group hotel-notification-cg
   ```
2. **Inspect DLQ Messages**:
   ```powershell
   docker exec -it kafka kafka-console-consumer --bootstrap-server kafka:29092 --topic hotel.stays.lifecycle.v1.dlq --from-beginning --max-messages 10
   ```
3. **Check Outbox Backlog in PostgreSQL**:
   ```sql
   SELECT status, count(*), min(created_at) FROM stay_outbox_events GROUP BY status;
   ```

### Resolution
- If `stay_outbox_events` has rows stuck in `PENDING`, verify `hotel-stay-service` can reach `kafka:29092`.
- After fixing a poison-pill bug in `notification-worker`, replay DLQ events safely (Redis idempotency key `notif:dedup:<event_id>` prevents duplicate emails/SMS for already-processed events).

---

## Runbook 4: Redis Cache & Idempotency Store Recovery

### Symptoms
- Increased latency on `GET /api/v1/rooms` or idempotency lock timeouts (`409 Request with this Idempotency-Key is currently being processed`).

### Diagnostic Steps
1. **Verify Redis Health & Memory**:
   ```powershell
   docker exec -it redis redis-cli info memory
   docker exec -it redis redis-cli dbsize
   ```
2. **Check Stuck Idempotency Locks**:
   ```powershell
   docker exec -it redis redis-cli --scan --pattern "idempotency:lock:*"
   ```

### Resolution
- Idempotency locks automatically expire after `30s` TTL, and cached responses expire after `24h`.
- To force a room catalog cache refresh after manual DB maintenance:
  ```powershell
  docker exec -it redis redis-cli DEL "rooms:all"
  ```

---

## Runbook 5: Vault Unsealing & External Secrets Sync

### Symptoms
- Alert `VaultInstanceDown` fires or Kubernetes `ExternalSecret` objects show `SecretSyncedError`.

### Diagnostic Steps
```powershell
kubectl get clustersecretstore,externalsecret -A
kubectl describe externalsecret hotel-app-secrets -n dev
```

### Resolution
1. Verify Vault service reachability at `http://vault.vault.svc.cluster.local:8200/v1/sys/health`.
2. Re-run Vault KV-v2 seeding, Kubernetes Auth binding, and Istio PKI CA provisioning via `platform-minikube.ps1`:
   ```powershell
   .\platform-minikube.ps1 vault -VaultAction seed
   .\platform-minikube.ps1 vault -VaultAction k8s-auth
   .\platform-minikube.ps1 vault -VaultAction istio-pki -RotateVaultPki
   ```
3. Force immediate ESO reconciliation:
   ```powershell
   kubectl annotate externalsecret hotel-app-secrets -n dev force-sync="$(date +%s)" --overwrite
   ```

---

## Runbook 6: Cloudflare Quick Tunnels, SRE Chaos Drills & FinOps Right-Sizing

### 6.1 Public Edge Tunnel Recovery (`scripts/manage-cloudflare-tunnels.ps1`)
- Inspect or restart the Cloudflare Anycast HTTP/2 Quick Tunnels (`frontend`, `gateway`, `keycloak`) and optionally sync public URLs to GitHub Actions repository variables:
  ```powershell
  .\platform-minikube.ps1 cloudflare -Action status
  .\platform-minikube.ps1 cloudflare -Action restart
  pwsh -File .\scripts\manage-cloudflare-tunnels.ps1 -Action Start -UpdateGitHub -Repo "GeorgeGxx/hotel_premium"
  ```

### 6.2 Automated SRE Diagnostics, Chaos & DDoS Drills (`scripts/hotel-sre-suite.py`)
- Run deep LGTM observability and OpenAPI Swagger verification:
  ```powershell
  .\platform-minikube.ps1 diagnose
  ```
- Execute concurrent PostgreSQL `btree_gist` overlap & Redis `Idempotency-Key` race chaos tests:
  ```powershell
  .\platform-minikube.ps1 chaos -ChaosRuns 12 -Concurrency 6
  ```
- Execute edge rate-limit / anti-DDoS flood probes against Kong Gateway (`120 req/min` threshold):
  ```powershell
  .\platform-minikube.ps1 ddos -Duration 10 -Workers 16
  ```

### 6.3 Prometheus 7-Day FinOps Workload Right-Sizing (`scripts/local-cost-estimator.py`)
- Query 7-day P95 CPU and peak working-set memory from Prometheus (`:9090`) and generate right-sized Helm `resources.requests` YAML recommendations with a 25% SRE safety buffer:
  ```powershell
  .\platform-minikube.ps1 finops-rightsize
  ```
