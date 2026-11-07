#!/usr/bin/env python3
r"""
==============================================================================
Hotel Premium - Enterprise Architecture Diagram Generator (generate_drawio.py)
Generates 12 comprehensive architectural diagram tabs in:
  - docs/Diagrams.drawio
  - docs/diagrams.drawio

Orchestrator Command (platform-minikube.ps1):
  .\platform-minikube.ps1 diagrams
==============================================================================
"""

import os
import sys
import xml.etree.ElementTree as ET

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def build_drawio_xml() -> bytes:
    root_mxfile = ET.Element("mxfile", host="Electron", pages="12", type="device")

    def create_page(page_id: str, page_name: str):
        diagram = ET.SubElement(root_mxfile, "diagram", id=page_id, name=page_name)
        model = ET.SubElement(
            diagram,
            "mxGraphModel",
            dx="2000",
            dy="1200",
            grid="1",
            gridSize="10",
            guides="1",
            tooltips="1",
            connect="1",
            arrows="1",
            fold="1",
            page="1",
            pageScale="1",
            pageWidth="1920",
            pageHeight="1080",
            math="0",
            shadow="0",
        )
        root = ET.SubElement(model, "root")
        ET.SubElement(root, "mxCell", id="0")
        ET.SubElement(root, "mxCell", id="1", parent="0")
        return root

    def add_node(root, cell_id: str, parent_id: str, value: str, style: str, x: int, y: int, w: int, h: int):
        cell = ET.SubElement(root, "mxCell", id=cell_id, parent=parent_id, value=value, style=style, vertex="1")
        ET.SubElement(
            cell,
            "mxGeometry",
            {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"},
        )
        return cell

    def add_edge(root, cell_id: str, parent_id: str, value: str, style: str, source_id: str, target_id: str):
        cell = ET.SubElement(
            root,
            "mxCell",
            id=cell_id,
            parent=parent_id,
            value=value,
            style=style,
            edge="1",
            source=source_id,
            target=target_id,
        )
        ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
        return cell

    title_style = "text;html=1;align=center;verticalAlign=middle;rounded=0;"
    group_style = "rounded=1;whiteSpace=wrap;html=1;fillColor=#F8FAFC;strokeColor=#CBD5E1;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=15;spacingTop=10;fontColor=#334155;fontSize=13;dashed=1;"
    blue_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=#EFF6FF;strokeColor=#3B82F6;strokeWidth=2;fontColor=#1E3A8A;fontSize=11;"
    indigo_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=#EEF2FF;strokeColor=#6366F1;strokeWidth=2;fontColor=#312E81;fontSize=11;"
    green_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=#ECFDF5;strokeColor=#10B981;strokeWidth=2;fontColor=#064E3B;fontSize=11;"
    amber_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=#FEF3C7;strokeColor=#F59E0B;strokeWidth=2;fontColor=#78350F;fontSize=11;"
    purple_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=#F3E8FF;strokeColor=#8B5CF6;strokeWidth=2;fontColor=#4C1D95;fontSize=11;"
    pink_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=#FDF2F8;strokeColor=#EC4899;strokeWidth=2;fontColor=#831843;fontSize=11;"
    cyan_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=#E0F2FE;strokeColor=#0284C7;strokeWidth=2;fontColor=#0C4A6E;fontSize=11;"
    red_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=#FEE2E2;strokeColor=#EF4444;strokeWidth=2;fontColor=#7F1D1D;fontSize=11;"
    db_style = "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=10;fillColor=#ECFDF5;strokeColor=#10B981;strokeWidth=2;fontColor=#064E3B;fontSize=11;"
    edge_blue = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#3B82F6;strokeWidth=2;"
    edge_green = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#10B981;strokeWidth=2;"
    edge_amber = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#F59E0B;strokeWidth=2;"
    edge_purple = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#8B5CF6;strokeWidth=2;dashed=1;"

    # =========================================================================
    # TAB 1: General Architecture & Microservices
    # =========================================================================
    p1 = create_page("page_1_general", "1. General Architecture & Microservices")
    add_node(p1, "p1_title", "1", "<b style='font-size:22px;color:#1E293B;'>HOTEL PREMIUM — ENTERPRISE CLOUD-NATIVE ARCHITECTURE</b><br><span style='font-size:13px;color:#64748B;'>Go 1.26 • Gin &amp; GORM • React 19 • Kong Gateway v3.9.4 • Istio 1.31.2 • PostgreSQL 18 • Redis 8.8.1 • Kafka 8.3.2 KRaft • Vault v2.2.0 • Helm 4.3.1 • LGTM Observability</span>", title_style, 160, 25, 1600, 50)

    add_node(p1, "p1_g_client", "1", "<b>🌐 CLIENT &amp; EDGE VERIFICATION LAYER</b>", group_style, 50, 95, 340, 440)
    add_node(p1, "p1_spa", "1", "<b>Hotel Premium React 19 SPA</b><br>Nginx 1.28-alpine (:5173 / :80)<br>Luxury Booking Portal • Room Rack Matrix<br>Interactive Folio &amp; Housekeeping Console", blue_box, 75, 145, 290, 90)
    add_node(p1, "p1_cf", "1", "<b>Cloudflare Anycast Quick Tunnels</b><br>cloudflared 2026.10.1 (HTTP/2)<br>Public *.trycloudflare.com Edge URLs<br>GitHub Actions Post-Deploy Sync", cyan_box, 75, 255, 290, 85)
    add_node(p1, "p1_sre", "1", "<b>SRE &amp; Contract Verification Suite</b><br>hotel-sre-suite.py (E2E, Chaos, DDoS)<br>Newman API Contracts • Grafana k6 SLO<br>OWASP ZAP Baseline DAST", blue_box, 75, 360, 290, 85)

    add_node(p1, "p1_g_edge", "1", "<b>🛡️ API GATEWAY, SERVICE MESH &amp; IAM</b>", group_style, 420, 95, 380, 440)
    add_node(p1, "p1_kong", "1", "<b>Kong API Gateway v3.9.4 (DB-less)</b><br>Proxy :8000 • Admin/Metrics 127.0.0.1:8001<br>North-South Routing • Rate Limiting (120/m)<br>CORS • W3C traceparent Injection", indigo_box, 445, 145, 330, 95)
    add_node(p1, "p1_istio", "1", "<b>Istio Service Mesh 1.31.2 + Kiali v2.33.0</b><br>East-West STRICT mTLS (SPIFFE Identity)<br>DestinationRule Outlier Circuit Breakers<br>Progressive Canary Traffic Splitting", green_box, 445, 260, 330, 90)
    add_node(p1, "p1_kc", "1", "<b>Keycloak IAM 26.8.1</b><br>Port 8181 (OIDC / OAuth2 / JWKS)<br>Realm: hotel-realm<br>Roles: ADMIN, MANAGER, RECEPTIONIST, USER", pink_box, 445, 370, 330, 90)

    add_node(p1, "p1_g_ms", "1", "<b>📦 GO 1.26 MICROSERVICES DOMAIN LAYER (Clean Architecture &amp; DDD)</b>", group_style, 830, 95, 480, 440)
    add_node(p1, "p1_room", "1", "<b>room-service (:8081)</b><br>Go 1.26 • Gin • GORM • Swagger OpenAPI<br>Room Inventory, Categories &amp; Housekeeping<br>Redis Singleflight Stampede Protection", green_box, 855, 140, 430, 80)
    add_node(p1, "p1_stay", "1", "<b>stay-service (:8082)</b><br>Go 1.26 • Booking Saga Orchestrator<br>PostgreSQL 18 GiST Anti-Double-Booking<br>Transactional Outbox + Redis Idempotency", green_box, 855, 235, 430, 85)
    add_node(p1, "p1_bill", "1", "<b>billing-service (:8083)</b><br>Go 1.26 • Guest Folios, POS Charges &amp; Cash Shifts<br>Scoped Redis Idempotency Middleware<br>Prometheus Golden Signals &amp; OTLP Spans", green_box, 855, 335, 430, 80)
    add_node(p1, "p1_notif", "1", "<b>notification-worker (:8084)</b><br>Go 1.26 • Kafka 8.3.2 Consumer Group<br>Redis Event Deduplication (notif:dedup:*)<br>Non-Blocking Retry + DLQ Publisher • KEDA 1..8", cyan_box, 855, 430, 430, 85)

    add_node(p1, "p1_g_data", "1", "<b>💾 DATA, CACHE &amp; EVENT BACKBONE (namespace: data)</b>", group_style, 1340, 95, 520, 440)
    add_node(p1, "p1_pg", "1", "<b>PostgreSQL 18 (Alpine)</b><br>Port 5432 • btree_gist Exclusion Constraint<br>Tables: rooms, guests, stays, stay_charges,<br>stay_outbox_events, audit_logs<br>+ postgres-exporter v0.20.1 (:9187)", db_style, 1370, 140, 460, 110)
    add_node(p1, "p1_redis", "1", "<b>Redis 8.8.1 (Alpine)</b><br>Port 6379 • Singleflight Room Cache (rooms:all)<br>Scoped Idempotency Locks &amp; Dedup Keys<br>+ redis-exporter v1.94.0 (:9121)", red_box, 1370, 270, 460, 95)
    add_node(p1, "p1_kafka", "1", "<b>Apache Kafka 8.3.2 (KRaft Mode — No ZooKeeper)</b><br>Port 9092 / 29092 • LZ4 Compression<br>Topics: hotel.stays.lifecycle.v1 (3 partitions)<br>&amp; hotel.stays.lifecycle.v1.DLQ<br>+ kafka-exporter v1.9.0 (:9308)", amber_box, 1370, 385, 460, 120)

    add_node(p1, "p1_g_sec", "1", "<b>🔒 ZERO-TRUST SECRETS &amp; POLICY GOVERNANCE</b>", group_style, 50, 565, 850, 250)
    add_node(p1, "p1_vault", "1", "<b>HashiCorp Vault v2.2.0 (:8200)</b><br>KV-v2 Engine (secret/hotel-database, secret/hotel-auth)<br>Kubernetes Auth (Scoped Per-Service Roles)<br>Root &amp; Intermediate PKI CA for Istio mTLS (cacerts)", purple_box, 75, 615, 390, 170)
    add_node(p1, "p1_eso", "1", "<b>External Secrets Operator (ESO) &amp; OPA Gatekeeper v3.23.0</b><br>ClusterSecretStore &amp; ExternalSecret -> K8s Secrets<br>Gatekeeper Constraints: K8sDisallowRoot, K8sRequiredResources,<br>K8sTrustedRegistries • Conftest 0.71.1 (205/205 Rego Checks)<br>Sigstore Cosign v3.1.3 Provenance Attestation", purple_box, 485, 615, 390, 170)

    add_node(p1, "p1_g_obs", "1", "<b>📊 FULL-STACK LGTM OBSERVABILITY &amp; FINOPS (namespaces: observability, opencost)</b>", group_style, 930, 565, 930, 250)
    add_node(p1, "p1_alloy", "1", "<b>Grafana Alloy v1.21.0 (:3300)</b><br>OTLP gRPC :4317 / HTTP :4318<br>Batch Processor -> Tempo, Loki &amp; Prometheus", cyan_box, 955, 615, 280, 80)
    add_node(p1, "p1_tempo", "1", "<b>Grafana Tempo v3.0.5 (:3200)</b><br>Distributed Traces &amp; Service Graph<br>Span Metrics Generator -> Prometheus", cyan_box, 1255, 615, 280, 80)
    add_node(p1, "p1_loki", "1", "<b>Grafana Loki v3.7.8 (:3100)</b><br>Structured Metadata &amp; TSDB v13<br>7-Day Compactor Retention • TraceID Links", cyan_box, 1555, 615, 280, 80)
    add_node(p1, "p1_prom", "1", "<b>Prometheus v3.14.0 (:9090)</b><br>15s Scrape • 10 Active SRE Alerting Rules<br>Microservices, Kong, Exporters &amp; KEDA", amber_box, 955, 715, 280, 80)
    add_node(p1, "p1_graf", "1", "<b>Grafana v13.2.3 (:3000)</b><br>TraceQL Editor • Correlations • FlameGraph<br>Business &amp; Technical SRE Dashboards", amber_box, 1255, 715, 280, 80)
    add_node(p1, "p1_cost", "1", "<b>OpenCost v2.5.32 (:7000 / :9003)</b><br>Real-Time Namespace Cost Allocation<br>Prometheus 7-Day Peak Right-Sizing", green_box, 1555, 715, 280, 80)

    add_edge(p1, "p1_e1", "1", "HTTPS / HTTP", edge_blue, "p1_spa", "p1_kong")
    add_edge(p1, "p1_e2", "1", "Public Tunnel", edge_blue, "p1_cf", "p1_kong")
    add_edge(p1, "p1_e3", "1", "STRICT mTLS", edge_green, "p1_kong", "p1_room")
    add_edge(p1, "p1_e4", "1", "STRICT mTLS", edge_green, "p1_kong", "p1_stay")
    add_edge(p1, "p1_e5", "1", "STRICT mTLS", edge_green, "p1_kong", "p1_bill")
    add_edge(p1, "p1_e6", "1", "GORM / pgx", edge_green, "p1_stay", "p1_pg")
    add_edge(p1, "p1_e7", "1", "Singleflight / Lock", edge_amber, "p1_room", "p1_redis")
    add_edge(p1, "p1_e8", "1", "Outbox Publish", edge_amber, "p1_stay", "p1_kafka")
    add_edge(p1, "p1_e9", "1", "Consume + Dedup", edge_amber, "p1_kafka", "p1_notif")
    add_edge(p1, "p1_e10", "1", "OTLP Spans/Logs", edge_purple, "p1_stay", "p1_alloy")

    # =========================================================================
    # TAB 2: HashiCorp Vault v2.2.0 Zero-Trust Security Architecture
    # =========================================================================
    p2 = create_page("page_2_vault", "2. HashiCorp Vault v2.2.0 Zero-Trust Security")
    add_node(p2, "p2_title", "1", "<b style='font-size:22px;color:#1E293B;'>HASHICORP VAULT v2.2.0 — ZERO-TRUST SECRETS &amp; PKI ARCHITECTURE</b><br><span style='font-size:13px;color:#64748B;'>KV-v2 Secrets • Scoped Kubernetes ServiceAccount Auth • External Secrets Operator (ESO) • Istio Root &amp; Intermediate PKI CA</span>", title_style, 200, 30, 1500, 50)
    add_node(p2, "p2_cli", "1", "<b>1. Orchestrator Vault Automation</b><br><code>.\\platform-minikube.ps1 vault -VaultAction &lt;action&gt;</code><br>• <b>status:</b> Audits seal state &amp; v2.2.0 health<br>• <b>seed:</b> Seeds secret/hotel-database, secret/hotel-auth, secret/application<br>• <b>k8s-auth:</b> Configures auth/kubernetes &amp; 4 least-privilege roles<br>• <b>istio-pki:</b> Generates Root/Intermediate CA &amp; signs istio-system/cacerts", purple_box, 80, 120, 520, 160)
    add_node(p2, "p2_srv", "1", "<b>2. HashiCorp Vault v2.2.0 Server (namespace: vault)</b><br>Image: <code>hashicorp/vault:2.2.0</code> • Port 8200<br>• Readiness &amp; Liveness Probes: <code>GET /v1/sys/health</code><br>• Non-root execution (UID 100 / GID 1000)<br>• Token &amp; Kubernetes ServiceAccount Authentication", purple_box, 660, 120, 540, 160)
    add_node(p2, "p2_eso", "1", "<b>3. External Secrets Operator (ESO)</b><br>ClusterSecretStore: <code>vault-backend</code><br>ExternalSecret: <code>hotel-app-secrets</code> (namespace: dev)<br>• Synchronizes Vault KV-v2 secrets into native K8s Secrets<br>• Zero application code coupling to Vault REST API", green_box, 1260, 120, 520, 160)

    add_node(p2, "p2_kv", "1", "<b>KV-v2 Secrets Engine (secret/)</b><br>• <code>secret/data/hotel-database</code> (PostgreSQL 18 credentials)<br>• <code>secret/data/hotel-auth</code> (JWT signing key &amp; Keycloak admin)<br>• <code>secret/data/application</code> (Kafka brokers &amp; runtime env)", blue_box, 80, 340, 520, 140)
    add_node(p2, "p2_k8s", "1", "<b>Scoped Kubernetes Auth Roles (auth/kubernetes)</b><br>• <code>room-service-role</code> -> <code>room-service-policy</code> (TTL 1h, ns: dev)<br>• <code>stay-service-role</code> -> <code>stay-service-policy</code> (TTL 1h, ns: dev)<br>• <code>billing-service-role</code> -> <code>billing-service-policy</code> (TTL 1h, ns: dev)<br>• <code>notification-worker-role</code> -> <code>notification-worker-policy</code> (TTL 1h, ns: dev)", green_box, 660, 340, 540, 140)
    add_node(p2, "p2_pki", "1", "<b>Vault PKI Engine for Istio Service Mesh (pki/ &amp; pki_int/)</b><br>• Root CA: <code>hotel-premium.local Root CA</code> (87600h)<br>• Intermediate CA: <code>hotel-premium.local Istio Intermediate CA</code> (43800h)<br>• Provisions <code>ca-cert.pem</code>, <code>ca-key.pem</code>, <code>root-cert.pem</code>, <code>cert-chain.pem</code><br>• Mounted into <code>istiod</code> via <code>istio-system/cacerts</code> for STRICT mTLS", pink_box, 1260, 340, 520, 140)

    add_edge(p2, "p2_e1", "1", "Configures &amp; Seeds", edge_purple, "p2_cli", "p2_srv")
    add_edge(p2, "p2_e2", "1", "Syncs KV-v2", edge_green, "p2_srv", "p2_eso")
    add_edge(p2, "p2_e3", "1", "", edge_blue, "p2_srv", "p2_kv")
    add_edge(p2, "p2_e4", "1", "", edge_green, "p2_srv", "p2_k8s")
    add_edge(p2, "p2_e5", "1", "Signs cacerts", edge_purple, "p2_srv", "p2_pki")

    # =========================================================================
    # TAB 3: Kong Gateway v3.9.4 & Istio 1.31.2 Service Mesh
    # =========================================================================
    p3 = create_page("page_3_kong_istio", "3. Kong Gateway v3.9.4 & Istio 1.31.2 Mesh")
    add_node(p3, "p3_title", "1", "<b style='font-size:22px;color:#1E293B;'>NORTH-SOUTH API GATEWAY (KONG v3.9.4) vs. EAST-WEST SERVICE MESH (ISTIO 1.31.2)</b><br><span style='font-size:13px;color:#64748B;'>Strict separation of concerns: Kong handles external API protection; Istio enforces workload identity, STRICT mTLS, and Canary traffic shifting</span>", title_style, 160, 30, 1600, 50)
    add_node(p3, "p3_ns", "1", "<b>🌐 NORTH-SOUTH TRAFFIC: Kong Gateway v3.9.4 (DB-less Declarative Mode)</b><br>• Public Proxy Port: <code>8000</code> | Loopback-Only Admin &amp; Status API: <code>127.0.0.1:8001</code><br>• Non-root hardened runtime with writable ephemeral prefix: <code>KONG_PREFIX=/tmp/kong</code><br>• Declarative <code>kong.yml</code> routes: <code>/api/v1/rooms</code>, <code>/api/v1/stays</code>, <code>/api/v1/billing</code>, <code>/api/v1/notifications</code><br>• Edge Plugins: Rate-Limiting (120 req/min), Request Size Limiting, Strict CORS, Correlation-ID &amp; OpenTelemetry W3C Propagation", indigo_box, 80, 120, 820, 220)
    add_node(p3, "p3_ew", "1", "<b>🔒 EAST-WEST TRAFFIC: Istio Service Mesh 1.31.2 + Kiali v2.33.0</b><br>• Control Plane: <code>istiod</code> in <code>istio-system</code> backed by Vault PKI <code>cacerts</code><br>• <code>PeerAuthentication</code>: Enforces <code>mtls.mode: STRICT</code> across namespace <code>dev</code><br>• <code>DestinationRule</code>: <code>ISTIO_MUTUAL</code> TLS + Connection Pool &amp; Outlier Detection Circuit Breakers<br>• <code>AuthorizationPolicy</code>: Default-deny + explicit SPIFFE allowlist for Kong Gateway and internal S2S calls<br>• Progressive Canary Engine: <code>.\\platform-minikube.ps1 canary -Action weight|promote|retire</code>", green_box, 960, 120, 820, 220)

    add_node(p3, "p3_pod1", "1", "<b>Pod: room-service + Envoy Proxy</b><br>SPIFFE Identity • Port 8081<br>Canary VirtualService (90/10 split)", green_box, 80, 410, 400, 110)
    add_node(p3, "p3_pod2", "1", "<b>Pod: stay-service + Envoy Proxy</b><br>SPIFFE Identity • Port 8082<br>S2S mTLS caller to room-service", green_box, 520, 410, 400, 110)
    add_node(p3, "p3_pod3", "1", "<b>Pod: billing-service + Envoy Proxy</b><br>SPIFFE Identity • Port 8083<br>Folio &amp; Charge API", green_box, 960, 410, 400, 110)
    add_node(p3, "p3_pod4", "1", "<b>Pod: notification-worker + Envoy Proxy</b><br>SPIFFE Identity • Port 8084<br>KEDA Autoscaled Kafka Consumer", cyan_box, 1400, 410, 380, 110)

    add_edge(p3, "p3_e1", "1", "North-South Ingress -> East-West Mesh", edge_blue, "p3_ns", "p3_ew")
    add_edge(p3, "p3_e2", "1", "STRICT mTLS", edge_green, "p3_ns", "p3_pod1")
    add_edge(p3, "p3_e3", "1", "STRICT mTLS", edge_green, "p3_ns", "p3_pod2")
    add_edge(p3, "p3_e4", "1", "STRICT mTLS S2S", edge_green, "p3_pod2", "p3_pod1")

    # =========================================================================
    # TAB 4: Kubernetes & Minikube 8-Namespace Topology
    # =========================================================================
    p4 = create_page("page_4_k8s_namespaces", "4. Kubernetes & Minikube 8-Namespace Topology")
    add_node(p4, "p4_title", "1", "<b style='font-size:22px;color:#1E293B;'>KUBERNETES v1.37.0 &amp; MINIKUBE v1.39.0 — 8 STRICT NAMESPACES TOPOLOGY</b><br><span style='font-size:13px;color:#64748B;'>gatekeeper-system • observability • opencost • auth • data • vault • keda • dev (+ istio-system)</span>", title_style, 200, 25, 1500, 50)

    add_node(p4, "ns1", "1", "<b>1. gatekeeper-system</b><br>OPA Gatekeeper v3.23.0<br>• gatekeeper-controller-manager<br>• gatekeeper-audit<br>• K8sDisallowRoot<br>• K8sRequiredResources<br>• K8sTrustedRegistries", amber_box, 60, 110, 400, 190)
    add_node(p4, "ns2", "1", "<b>2. observability</b><br>LGTM Telemetry Stack<br>• Grafana v13.2.3 (:3000)<br>• Prometheus v3.14.0 (:9090)<br>• Tempo v3.0.5 (:3200)<br>• Loki v3.7.8 (:3100)<br>• Alloy v1.21.0 (:3300)", cyan_box, 500, 110, 400, 190)
    add_node(p4, "ns3", "1", "<b>3. opencost</b><br>FinOps Engine v2.5.32<br>• opencost (:9003 API)<br>• opencost-ui (:7000 UI)<br>• Live K8s Cost Allocation<br>• Connected to Prometheus", green_box, 940, 110, 400, 190)
    add_node(p4, "ns4", "1", "<b>4. auth</b><br>Identity &amp; Access Management<br>• Keycloak 26.8.1 (:8181)<br>• Realm: hotel-realm<br>• OIDC / PKCE / RBAC Roles<br>• Automated Bootstrap Script", pink_box, 1380, 110, 440, 190)

    add_node(p4, "ns5", "1", "<b>5. data</b><br>Stateful Persistence &amp; Exporters<br>• PostgreSQL 18 (:5432) + GiST<br>• Redis 8.8.1 (:6379)<br>• Apache Kafka 8.3.2 KRaft (:9092)<br>• postgres-exporter v0.20.1 (:9187)<br>• redis-exporter v1.94.0 (:9121)<br>• kafka-exporter v1.9.0 (:9308)", amber_box, 60, 340, 400, 220)
    add_node(p4, "ns6", "1", "<b>6. vault</b><br>Secrets &amp; PKI Engine<br>• HashiCorp Vault v2.2.0 (:8200)<br>• KV-v2 Secrets Store<br>• Kubernetes Auth Engine<br>• Root &amp; Intermediate PKI CA", purple_box, 500, 340, 400, 220)
    add_node(p4, "ns7", "1", "<b>7. keda</b><br>Event-Driven Autoscaling v2.21.0<br>• keda-operator<br>• keda-operator-metrics-apiserver<br>• keda-admission-webhooks<br>• Scales notification-worker (1..8)", blue_box, 940, 340, 400, 220)
    add_node(p4, "ns8", "1", "<b>8. dev (Helm 4.3.1 Release: hotel-premium)</b><br>PodSecurity: enforce=privileged (Istio init) | warn/audit=baseline<br>• kong-gateway v3.9.4 (:8000 / :8001)<br>• room-service (:8081) • stay-service (:8082)<br>• billing-service (:8083) • notification-worker (:8084)<br>• hotel-frontend (:5173 / :80) • HPA &amp; KEDA ScaledObject", green_box, 1380, 340, 440, 220)

    # =========================================================================
    # TAB 5: End-to-End Hotel Guest Journey & Booking Saga Sequence
    # =========================================================================
    p5 = create_page("page_5_saga_seq", "5. E2E Guest Journey & Booking Saga Sequence")
    add_node(p5, "p5_title", "1", "<b style='font-size:22px;color:#1E293B;'>END-TO-END HOTEL GUEST JOURNEY &amp; DISTRIBUTED BOOKING SAGA SEQUENCE</b><br><span style='font-size:13px;color:#64748B;'>React 19 SPA ➔ Kong v3.9.4 ➔ Stay Service ➔ Redis Idempotency ➔ Room Service ➔ PostgreSQL 18 GiST + Outbox ➔ Kafka 8.3.2 ➔ Notification Worker</span>", title_style, 140, 25, 1640, 50)

    add_node(p5, "s_s1", "1", "<b>1. Guest Catalog Query:</b> React 19 SPA requests <code>GET /api/v1/rooms</code> via Kong Gateway (:8000) -> <code>room-service</code> serves from Redis 8.8.1 <code>singleflight</code> cache (<code>rooms:all</code>).", blue_box, 120, 110, 1600, 55)
    add_node(p5, "s_s2", "1", "<b>2. Idempotent Booking Request:</b> Guest submits <code>POST /api/v1/stays/saga-booking</code> with <code>Idempotency-Key</code> and W3C <code>traceparent</code> header.", indigo_box, 120, 180, 1600, 55)
    add_node(p5, "s_s3", "1", "<b>3. Distributed Idempotency Lock (Redis 8.8.1):</b> <code>stay-service</code> acquires atomic <code>SETNX idempotency:lock:POST:/api/v1/stays/saga-booking:&lt;key&gt;</code> (30s TTL) and checks cached response (24h TTL).", red_box, 120, 250, 1600, 55)
    add_node(p5, "s_s4", "1", "<b>4. Saga Step 1 (Room Reservation):</b> <code>BookingSagaOrchestrator</code> verifies availability and transitions room status via <code>room-service</code> over Istio STRICT mTLS.", green_box, 120, 320, 1600, 55)
    add_node(p5, "s_s5", "1", "<b>5. Saga Step 2 (Atomic DB + GiST + Outbox):</b> PostgreSQL 18 validates <code>stays_room_period_exclusion</code> (<code>btree_gist</code> zero double-booking) and commits <code>stays</code> + <code>stay_outbox_events</code> in one ACID transaction. (If Step 2 fails, Saga executes compensating rollback freeing the room).", green_box, 120, 390, 1600, 65)
    add_node(p5, "s_s6", "1", "<b>6. Asynchronous Outbox Dispatch:</b> Background <code>OutboxPublisher</code> polls <code>stay_outbox_events</code> with <code>SELECT ... FOR UPDATE SKIP LOCKED</code> and publishes LZ4 event to Kafka 8.3.2 topic <code>hotel.stays.lifecycle.v1</code>.", amber_box, 120, 470, 1600, 55)
    add_node(p5, "s_s7", "1", "<b>7. Deduplicated Notification &amp; DLQ Safety:</b> <code>notification-worker</code> checks <code>SETNX notif:dedup:&lt;event_id&gt;</code> in Redis, dispatches VIP welcome notification, or routes poison-pill messages after 3 retries to <code>hotel.stays.lifecycle.v1.DLQ</code>.", cyan_box, 120, 540, 1600, 60)

    # =========================================================================
    # TAB 6: Transactional Outbox, Kafka 8.3.2 KRaft & KEDA v2.21.0
    # =========================================================================
    p6 = create_page("page_6_outbox_kafka_keda", "6. Outbox, Kafka 8.3.2 KRaft & KEDA v2.21.0")
    add_node(p6, "p6_title", "1", "<b style='font-size:22px;color:#1E293B;'>TRANSACTIONAL OUTBOX, APACHE KAFKA 8.3.2 KRAFT &amp; KEDA v2.21.0 AUTOSCALING</b><br><span style='font-size:13px;color:#64748B;'>Zero dual-write data loss during broker outages, LZ4 high-throughput streaming, Redis deduplication, and lag-driven autoscaling</span>", title_style, 160, 30, 1600, 50)
    add_node(p6, "p6_outbox", "1", "<b>PostgreSQL 18 Transactional Outbox</b><br>• Table: <code>stay_outbox_events</code><br>• Atomic commit with <code>stays</code> table<br>• Polled via <code>FOR UPDATE SKIP LOCKED</code><br>• Exponential backoff retry on broker outage", db_style, 80, 140, 480, 180)
    add_node(p6, "p6_kafka", "1", "<b>Apache Kafka 8.3.2 (KRaft Mode)</b><br>• Image: <code>confluentinc/cp-kafka:8.3.2</code><br>• Compression: <code>LZ4</code><br>• Primary Topic: <code>hotel.stays.lifecycle.v1</code> (3 partitions)<br>• Dead-Letter Topic: <code>hotel.stays.lifecycle.v1.DLQ</code> (7d retention)", amber_box, 660, 140, 520, 180)
    add_node(p6, "p6_keda", "1", "<b>KEDA v2.21.0 ScaledObject (notification-worker-scaler)</b><br>• Target: <code>deployment/notification-worker</code><br>• Min Replicas: <code>1</code> | Max Replicas: <code>8</code> | Fallback: <code>2</code> replicas<br>• Trigger 1: Kafka Consumer Lag &gt; <code>10</code> (<code>hotel-notification-cg</code>)<br>• Trigger 2: CPU Utilization &gt; <code>75%</code><br>• Stabilization Window: ScaleUp <code>30s</code> / ScaleDown <code>180s</code>", blue_box, 1280, 140, 540, 180)
    add_edge(p6, "p6_e1", "1", "Publish LZ4 Batch", edge_amber, "p6_outbox", "p6_kafka")
    add_edge(p6, "p6_e2", "1", "Consumer Lag Metrics", edge_blue, "p6_kafka", "p6_keda")

    # =========================================================================
    # TAB 7: LGTM Observability, OpenTelemetry & FinOps Architecture
    # =========================================================================
    p7 = create_page("page_7_observability_finops", "7. LGTM Observability & FinOps Architecture")
    add_node(p7, "p7_title", "1", "<b style='font-size:22px;color:#1E293B;'>UNIFIED LGTM OBSERVABILITY MESH &amp; OPENCOST FINOPS ARCHITECTURE</b><br><span style='font-size:13px;color:#64748B;'>Grafana v13.2.3 • Tempo v3.0.5 • Loki v3.7.8 • Prometheus v3.14.0 • Alloy v1.21.0 • OpenCost v2.5.32</span>", title_style, 180, 30, 1560, 50)
    add_node(p7, "p7_alloy", "1", "<b>Grafana Alloy v1.21.0 (:3300)</b><br>• Unified OTLP Receiver (:4317 gRPC / :4318 HTTP)<br>• <code>otelcol.processor.batch</code> pipeline<br>• Forwards traces to Tempo, structured JSON logs to Loki, and span metrics to Prometheus", cyan_box, 80, 130, 520, 160)
    add_node(p7, "p7_pillars", "1", "<b>Three Telemetry Pillars + Exporters</b><br>• <b>Tempo v3.0.5 (:3200):</b> Distributed traces + <code>metrics_generator</code> (service-graphs &amp; span-metrics)<br>• <b>Loki v3.7.8 (:3100):</b> TSDB v13 + <code>allow_structured_metadata: true</code> + 7d compactor<br>• <b>Prometheus v3.14.0 (:9090):</b> 10 SRE Alert Rules + Postgres (v0.20.1), Redis (v1.94.0), Kafka (v1.9.0) exporters", amber_box, 660, 130, 560, 160)
    add_node(p7, "p7_graf", "1", "<b>Grafana v13.2.3 (:3000) &amp; OpenCost v2.5.32 (:7000)</b><br>• Feature Toggles: <code>traceqlEditor,correlations,flameGraph</code><br>• Bidirectional Trace ➔ Log (<code>trace_id</code>) &amp; Trace ➔ Metric correlation<br>• OpenCost live namespace allocation + <code>finops-rightsize</code> 7-day peak recommender ($348.50/mo local savings)", green_box, 1280, 130, 540, 160)
    add_edge(p7, "p7_e1", "1", "OTLP / Remote Write", edge_blue, "p7_alloy", "p7_pillars")
    add_edge(p7, "p7_e2", "1", "Datasources &amp; Alerts", edge_green, "p7_pillars", "p7_graf")

    # =========================================================================
    # TAB 8: 6-Gate Shift-Left DevSecOps & Helm 4.3.1 CI/CD Pipeline
    # =========================================================================
    p8 = create_page("page_8_devsecops_cicd", "8. 6-Gate DevSecOps & Helm 4.3.1 Pipeline")
    add_node(p8, "p8_title", "1", "<b style='font-size:22px;color:#1E293B;'>6-GATE SHIFT-LEFT DEVSECOPS &amp; HELM 4.3.1 DELIVERY PIPELINE</b><br><span style='font-size:13px;color:#64748B;'>Zero soft-fails • Gitleaks 8.30.1 • Semgrep SAST • TFLint 0.64.0 • Trivy 0.76.0 • Conftest 0.71.1 (205/205) • Cosign v3.1.3 • Helm 4.3.1 SSA</span>", title_style, 160, 30, 1600, 50)
    add_node(p8, "g1", "1", "<b>Gate 1: Gitleaks 8.30.1</b><br>Isolated Git-tracked scan<br><code>0 secret leaks</code>", blue_box, 60, 140, 260, 100)
    add_node(p8, "g2", "1", "<b>Gate 2: Semgrep SAST</b><br>Go, TypeScript &amp; Python<br><code>0 ERROR findings</code>", blue_box, 350, 140, 260, 100)
    add_node(p8, "g3", "1", "<b>Gate 3: TFLint 0.64.0</b><br>Minikube &amp; AWS Terraform<br><code>0 warnings</code>", indigo_box, 640, 140, 260, 100)
    add_node(p8, "g4", "1", "<b>Gate 4: Trivy 0.76.0</b><br>Vuln, Misconfig, Secret, SBOM<br><code>0 HIGH/CRITICAL</code>", amber_box, 930, 140, 260, 100)
    add_node(p8, "g5", "1", "<b>Gate 5: Conftest 0.71.1</b><br>Static + Helm 4.3.1 Rendered<br><code>205/205 Rego passed</code>", green_box, 1220, 140, 280, 100)
    add_node(p8, "g6", "1", "<b>Gate 6: Cosign v3.1.3</b><br>ECDSA P-256 Sigstore Bundle<br><code>Verified OK</code>", purple_box, 1530, 140, 310, 100)
    add_node(p8, "p8_helm", "1", "<b>Helm 4.3.1 Native Deployment Engine</b><br><code>helm upgrade --install hotel-premium k8s/helm/hotel-premium --server-side=true --force-conflicts --rollback-on-failure --wait=watcher</code><br>• Enforces <code>values.schema.json</code> validation before rendering • Atomic Server-Side Apply field ownership • kstatus real-time watcher", green_box, 60, 300, 1780, 120)

    # =========================================================================
    # TAB 9: Cloudflare Anycast Quick Tunnels & Self-Healing Network
    # =========================================================================
    p9 = create_page("page_9_cloudflare_tunnels", "9. Cloudflare Quick Tunnels & Network Supervisor")
    add_node(p9, "p9_title", "1", "<b style='font-size:22px;color:#1E293B;'>CLOUDFLARE ANYCAST QUICK TUNNELS &amp; SELF-HEALING PORT-FORWARD ARCHITECTURE</b><br><span style='font-size:13px;color:#64748B;'>Automated local port-forwarding (supervise-tunnels.py) + Public HTTPS Edge Tunnels (manage-cloudflare-tunnels.ps1)</span>", title_style, 160, 30, 1600, 50)
    add_node(p9, "p9_local", "1", "<b>1. Self-Healing Localhost Supervisor (scripts/supervise-tunnels.py)</b><br>• Automatically started by <code>.\\platform-minikube.ps1 up</code> and <code>start</code><br>• Continuously monitors and auto-restarts <code>kubectl port-forward</code> sockets:<br>  Frontend (:5173), Kong (:8000/:8001/:8002), Room (:8081), Stay (:8082), Billing (:8083),<br>  Notif (:8084), Keycloak (:8181), Vault (:8200), Grafana (:3000), Prometheus (:9090), Alloy (:3300), OpenCost (:7000), Kiali (:20001)", blue_box, 80, 130, 820, 200)
    add_node(p9, "p9_cf", "1", "<b>2. Cloudflare Anycast Quick Tunnels (scripts/manage-cloudflare-tunnels.ps1)</b><br>• Command: <code>.\\platform-minikube.ps1 cloudflare -Action start|status|restart|stop</code><br>• Spawns HTTP/2 <code>cloudflared</code> tunnels for Frontend (:5173), Kong Gateway (:8000), and Keycloak (:8181)<br>• Persists active public <code>https://*.trycloudflare.com</code> URLs in <code>scripts/.cloudflare-tunnels.json</code><br>• Automatically consumed by <code>Get-DevSecOpsTargetUrl</code> for external Newman, k6 &amp; OWASP ZAP scans", cyan_box, 960, 130, 840, 200)
    add_edge(p9, "p9_e1", "1", "Exposes Local Ports to Cloudflare Edge", edge_blue, "p9_local", "p9_cf")

    # =========================================================================
    # TAB 10: AWS Production Cloud Architecture (EKS, RDS 18, Redis, MSK)
    # =========================================================================
    p10 = create_page("page_10_aws_cloud", "10. AWS Production Cloud Architecture (EKS)")
    add_node(p10, "p10_title", "1", "<b style='font-size:22px;color:#1E293B;'>AWS PRODUCTION CLOUD ARCHITECTURE — AMAZON EKS, RDS POSTGRESQL 18, ELASTICACHE &amp; MSK</b><br><span style='font-size:13px;color:#64748B;'>Terraform v1.16.6 IaC • Private VPC Endpoints • IMDSv2 Enforced • Customer-Managed KMS • Trivy AWS-0040/0041/0104 Clean</span>", title_style, 140, 30, 1640, 50)
    add_node(p10, "p10_vpc", "1", "<b>AWS Multi-AZ VPC (10.0.0.0/16) — Hardened Network Perimeter</b><br>• EKS API Server: <code>endpoint_public_access = false</code>, <code>endpoint_private_access = true</code>, <code>public_access_cidrs = [var.vpc_cidr]</code><br>• EKS Worker Nodes Security Group: Egress strictly scoped to <code>[var.vpc_cidr]</code> (Zero unrestricted 0.0.0.0/0 egress)<br>• EC2 Launch Template: <code>http_tokens = required</code> (IMDSv2 mandatory) + KMS-encrypted GP3 EBS volumes", indigo_box, 80, 130, 820, 200)
    add_node(p10, "p10_data", "1", "<b>Managed AWS Data &amp; Security Tier (Private Subnets)</b><br>• <b>Amazon RDS PostgreSQL 18:</b> Multi-AZ, KMS encrypted at rest, automated backups &amp; PitR<br>• <b>Amazon ElastiCache Redis 8.8.1:</b> Multi-AZ Replication Group, transit &amp; at-rest encryption<br>• <b>Amazon MSK (Apache Kafka):</b> 3-AZ broker cluster with TLS encryption<br>• <b>AWS KMS &amp; IAM OIDC:</b> Automatic key rotation + Keyless GitHub Actions OIDC deployer role", green_box, 960, 130, 840, 200)

    # =========================================================================
    # TAB 11: PostgreSQL 18 BCDR, PitR & Chaos Engineering Drills
    # =========================================================================
    p11 = create_page("page_11_bcdr_chaos", "11. BCDR, PitR & Chaos Engineering Drills")
    add_node(p11, "p11_title", "1", "<b style='font-size:22px;color:#1E293B;'>BUSINESS CONTINUITY, DISASTER RECOVERY (BCDR) &amp; CHAOS ENGINEERING DRILLS</b><br><span style='font-size:13px;color:#64748B;'>Automated RPO/RTO Verification • Kafka Broker Outage Outbox Drill • Concurrent GiST + Redis Idempotency Chaos • Edge Anti-DDoS Probe</span>", title_style, 140, 30, 1640, 50)
    add_node(p11, "p11_bcdr", "1", "<b>1. PostgreSQL 18 Backup &amp; PitR Drill (bcdr)</b><br>Command: <code>.\\platform-minikube.ps1 bcdr</code><br>• Executes <code>pg_dump</code> snapshot &amp; checksum verification<br>• Validates Recovery Time Objective (RTO &lt; 5m) &amp; RPO", green_box, 80, 140, 400, 170)
    add_node(p11, "p11_outbox", "1", "<b>2. Kafka Outage Resilience Drill (chaos-drills)</b><br>Command: <code>.\\platform-minikube.ps1 chaos-drills</code><br>• Pauses Kafka 8.3.2 broker, creates VIP reservation<br>• Verifies 0% user downtime &amp; automatic Outbox drain on recovery", amber_box, 520, 140, 420, 170)
    add_node(p11, "p11_chaos", "1", "<b>3. Concurrent GiST &amp; Idempotency Chaos (chaos)</b><br>Command: <code>.\\platform-minikube.ps1 chaos</code><br>• Fires concurrent overlapping booking bursts with shared <code>Idempotency-Key</code><br>• Proves 0 double-bookings &amp; 0 HTTP 500 errors", purple_box, 980, 140, 400, 170)
    add_node(p11, "p11_ddos", "1", "<b>4. Edge Rate-Limiting &amp; Anti-DDoS Probe (ddos)</b><br>Command: <code>.\\platform-minikube.ps1 ddos</code><br>• Floods Kong Gateway (:8000) with multi-worker burst traffic<br>• Verifies HTTP 429 throttling &amp; p50/p95 latency stability", red_box, 1420, 140, 400, 170)

    # =========================================================================
    # TAB 12: Unified Orchestrator Lifecycle (platform-minikube.ps1)
    # =========================================================================
    p12 = create_page("page_12_orchestrator", "12. Unified Orchestrator (platform-minikube.ps1)")
    add_node(p12, "p12_title", "1", "<b style='font-size:22px;color:#1E293B;'>UNIFIED PLATFORM ORCHESTRATOR — platform-minikube.ps1 COMMAND MATRIX</b><br><span style='font-size:13px;color:#64748B;'>9-Stage Full Bootstrap (up) • 6-Stage Fast Resume (&lt;30s start) • 36 Self-Contained DevSecOps, Cloud, Vault &amp; SRE Commands</span>", title_style, 160, 30, 1600, 50)
    add_node(p12, "p12_up", "1", "<b>9-Stage Full Bootstrap (<code>.\\platform-minikube.ps1 up [-Build]</code>)</b><br>[1/9] 6-Gate Shift-Left Security Scan (Gitleaks, Semgrep, TFLint, Trivy, Conftest 205/205, Cosign)<br>[2/9] Minikube v1.39.0 / K8s v1.37.0 Startup (Smart Docker RAM Auto-Adjust + metrics-server wait)<br>[3/9] 8 Strict Namespaces &amp; PodSecurity Standards<br>[4/9] OPA Gatekeeper v3.23.0 ConstraintTemplates &amp; Security Constraints<br>[5/9] Istio 1.31.2 Service Mesh (STRICT mTLS), Kiali v2.33.0 &amp; Kong Gateway v3.9.4<br>[6/9] Keycloak 26.8.1, LGTM Observability, HashiCorp Vault v2.2.0 (KV + K8s Auth) &amp; OpenCost v2.5.32<br>[7/9] HorizontalPodAutoscalers (HPA) &amp; KEDA v2.21.0 Event-Driven Autoscaling<br>[8/9] PostgreSQL 18 Migrations (000001..000004), Kafka 8.3.2 Topics &amp; Helm 4.3.1 Server-Side Apply<br>[9/9] Self-Healing Localhost Tunnels, 9/9 HTTP Smoke Verification &amp; FinOps Cost Report", blue_box, 80, 120, 840, 260)
    add_node(p12, "p12_start", "1", "<b>6-Stage Fast Resume &lt;30s (<code>.\\platform-minikube.ps1 start</code>) &amp; Operational Commands</b><br>• <b>Fast Resume:</b> [1/6] Core CLIs ➔ [2/6] Cosign Provenance ➔ [3/6] Minikube Resume ➔ [4/6] Wait Critical Pods ➔ [5/6] Reconcile Vault &amp; Istio ➔ [6/6] Connect Tunnels &amp; Smoke Test<br>• <b>Cloudflare Edge:</b> <code>cloudflare -Action start|status|restart|stop</code><br>• <b>Vault Zero-Trust:</b> <code>vault -VaultAction status|seed|k8s-auth|istio-pki</code><br>• <b>SRE &amp; Testing:</b> <code>test</code>, <code>smoke-test</code>, <code>simulate</code>, <code>contract</code>, <code>performance</code>, <code>dast</code>, <code>ddos</code>, <code>chaos</code>, <code>chaos-drills</code>, <code>diagnose</code>, <code>bcdr</code><br>• <b>FinOps &amp; IaC:</b> <code>cost</code>, <code>finops-rightsize</code>, <code>plan</code>, <code>apply</code>, <code>graph</code>, <code>diagrams</code>, <code>set-tag</code>", green_box, 960, 120, 840, 260)

    ET.indent(root_mxfile, space="  ")
    return ET.tostring(root_mxfile, encoding="utf-8", xml_declaration=True)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    docs_dir = os.path.join(root_dir, "docs")
    os.makedirs(docs_dir, exist_ok=True)

    xml_bytes = build_drawio_xml()
    targets = [
        os.path.join(docs_dir, "Diagrams.drawio"),
        os.path.join(docs_dir, "diagrams.drawio"),
    ]
    for path in targets:
        with open(path, "wb") as f:
            f.write(xml_bytes)
        print(f"  [OK] Generated 12-tab enterprise architecture blueprint: {path}")


if __name__ == "__main__":
    main()
