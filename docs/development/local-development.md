# Local Development Guide — `hotel_premium`

This guide covers building, testing, and running the `hotel_premium` platform locally using native Go/Node toolchains, Docker Compose, and Minikube.

---

## 1. Prerequisites

| Tool | Required Version | Verification Command |
| :--- | :--- | :--- |
| **Go** | `1.26+` | `go version` |
| **Node.js & npm** | Node `22+` / npm `10+` | `node -v && npm -v` |
| **Docker & Docker Compose** | Docker Engine `27+` / Compose `v2+` | `docker compose version` |
| **Minikube & kubectl** | Minikube `v1.39.0` / kubectl `v1.37.0` | `minikube version && kubectl version --client` |
| **Helm** | `v4.3.1` (Server-Side Apply + Watcher) | `helm version` |
| **Terraform** | `>= 1.16.6` | `terraform version` |
| **Cloudflared CLI** | `>= 2026.10.1` | `cloudflared --version` |
| **DevSecOps Scanners** | Gitleaks `8.30.1`, Semgrep, TFLint `0.64.0`, Trivy `0.76.0`, Conftest `0.71.1`, Cosign `v3.1.3` | `.\platform-minikube.ps1 tools` |

---

## 2. Environment Configuration

1. Copy `.env.example` to `.env` if not already present:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Key local port mappings (configured in `.env` and `compose.yaml`):
   - **Frontend SPA (Nginx)**: `http://localhost:80` (and `http://localhost:5173` in Vite dev mode)
   - **Kong API Gateway (Proxy)**: `http://localhost:8000`
   - **Kong Admin API (Loopback only)**: `http://127.0.0.1:8001`
   - **Room Service**: `http://localhost:8081`
   - **Stay Service**: `http://localhost:8082`
   - **Billing Service**: `http://localhost:8083`
   - **Notification Worker**: `http://localhost:8084`
   - **Keycloak IAM**: `http://localhost:8080`
   - **HashiCorp Vault**: `http://localhost:8200`
   - **Grafana UI**: `http://localhost:3000`
   - **Grafana Loki**: `http://localhost:3100`
   - **Grafana Tempo**: `http://localhost:3200`
   - **Grafana Alloy UI**: `http://localhost:3300`
   - **Prometheus UI**: `http://localhost:9090`

---

## 3. Running with Docker Compose

### 3.1 Full Platform Startup (Default)
```powershell
docker compose up -d --build
```
Check service health:
```powershell
docker compose ps
```

### 3.2 Modular Profiles
`compose.yaml` supports running targeted subsets when developing on constrained laptops while keeping full-stack startup as the default when all services are invoked:
- **Core Application & Data (`postgres`, `redis`, `kafka`, microservices, `frontend`)**:
  ```powershell
  docker compose up -d postgres redis kafka kafka-init hotel-room-service hotel-stay-service hotel-billing-service hotel-notification-worker hotel-frontend
  ```
- **API Gateway (`kong`)**:
  ```powershell
  docker compose up -d kong
  ```
- **Observability Stack (`alloy`, `tempo`, `loki`, `prometheus`, `grafana`, exporters)**:
  ```powershell
  docker compose up -d alloy tempo loki prometheus grafana postgres-exporter redis-exporter kafka-exporter
  ```

---

## 4. Running Tests & Linters Locally

### 4.1 Backend (Go 1.26 / Gin / GORM)
```powershell
cd backend
go vet ./...
go test -v -race ./...
```

### 4.2 Frontend (React 19 / TypeScript / Vitest)
```powershell
cd frontend
npm test -- --run
npm run build
```

### 4.3 Infrastructure & Policy Validation
```powershell
# Validate Docker Compose configuration
docker compose config -q

# Lint and render Helm chart
helm lint k8s/helm/hotel-premium
helm template hotel-premium k8s/helm/hotel-premium -f k8s/helm/hotel-premium/values-dev.yaml

# Validate Terraform configurations
terraform -chdir=terraform/environments/local-minikube fmt -check
terraform -chdir=terraform/environments/aws fmt -check
```

---

## 5. Local Kubernetes (Minikube) & Cloudflare Quick Tunnels Workflow

Use `platform-minikube.ps1` to manage the complete local Kubernetes lifecycle (Istio 1.31.2 + Kiali v2.33.0, Kong 3.9.4, Keycloak 26.8.1, Vault v2.2.0 PKI CA, LGTM Observability, and the `hotel-premium` Helm 4.3.1 release):

```powershell
# 1. Full 9-stage bootstrap: 6-Gate DevSecOps, image build/load, Helm 4.3.1 SSA, and tunnels
.\platform-minikube.ps1 up -Build

# 2. Fast-resume a stopped cluster in <30s with Cosign provenance & self-healing tunnels
.\platform-minikube.ps1 start

# 3. Run the 6-Gate Shift-Left DevSecOps pipeline (Gitleaks, Semgrep, TFLint, Trivy, Conftest, Cosign)
.\platform-minikube.ps1 security-scan

# 4. Check cluster, pod, HPA, PDB, KEDA, and tunnel status
.\platform-minikube.ps1 status

# 5. Open or verify self-healing local port-forward tunnels (127.0.0.1)
.\platform-minikube.ps1 tunnels

# 6. Start public HTTPS Cloudflare Anycast Quick Tunnels (*.trycloudflare.com)
.\platform-minikube.ps1 cloudflare -Action start
.\platform-minikube.ps1 cloudflare -Action status

# 7. Run E2E guest journey, concurrent GiST chaos, DDoS probe, and LGTM diagnostics
.\platform-minikube.ps1 simulate
.\platform-minikube.ps1 chaos
.\platform-minikube.ps1 ddos
.\platform-minikube.ps1 diagnose

# 8. Tear down cleanly (or add -Destroy to purge VM and local Terraform state)
.\platform-minikube.ps1 down
```
