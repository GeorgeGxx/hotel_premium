#!/usr/bin/env bash
# ==============================================================================
# Hotel Premium - Red Hat OpenShift 4.x / ROSA / ARO Deployment Script
# Provisions Namespaces, SCC Bindings, OpenShift Routes, and Helm 4 Release
# ==============================================================================
set -euo pipefail

NAMESPACE_APP="hotel-premium"
NAMESPACE_DATA="data"
NAMESPACE_AUTH="auth"

echo "=== [1/5] Creating OpenShift Projects / Namespaces ==="
oc get project "${NAMESPACE_APP}" >/dev/null 2>&1 || oc new-project "${NAMESPACE_APP}"
oc get project "${NAMESPACE_DATA}" >/dev/null 2>&1 || oc new-project "${NAMESPACE_DATA}"
oc get project "${NAMESPACE_AUTH}" >/dev/null 2>&1 || oc new-project "${NAMESPACE_AUTH}"

echo "=== [2/5] Configuring Security Context Constraints (SCC) ==="
# Allow stateful data services (PostgreSQL, Kafka, Redis) to run under anyuid
oc adm policy add-scc-to-user anyuid -z hotel-data-sa -n "${NAMESPACE_DATA}" || true
oc adm policy add-scc-to-user anyuid -z default -n "${NAMESPACE_AUTH}" || true

echo "=== [3/5] Deploying Microservices via Helm 4 Chart ==="
helm upgrade --install hotel-premium ./k8s/helm/hotel-premium \
  --namespace "${NAMESPACE_APP}" \
  -f ./k8s/helm/hotel-premium/values-openshift.yaml \
  --wait \
  --timeout 300s

echo "=== [4/5] Exposing Frontend via OpenShift Edge Route & Service Mesh Member Roll ==="
oc apply -f ./k8s/openshift/routes.yaml -n "${NAMESPACE_APP}"
oc apply -f ./k8s/openshift/service-mesh.yaml || true

echo "=== [5/5] Deployment Succeeded ==="
FRONTEND_ROUTE=$(oc get route hotel-frontend -n "${NAMESPACE_APP}" -o jsonpath='{.spec.host}' 2>/dev/null || echo "Pending")
echo "Hotel Premium Frontend is accessible at: https://${FRONTEND_ROUTE}"
