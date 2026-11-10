# Hotel Premium - Red Hat OpenShift Deployment Guide

This guide details how to deploy **Hotel Premium** on **Red Hat OpenShift Container Platform (OCP 4.x)**, **Red Hat OpenShift on AWS (ROSA)**, or **Azure Red Hat OpenShift (ARO)** with full dual-compatibility with standard Kubernetes / Minikube / EKS.

---

## 1. Architectural Adaptations for OpenShift

| Requirement | Standard Kubernetes (Minikube / EKS) | Red Hat OpenShift (OCP 4.x / ROSA / ARO) | Implementation in Hotel Premium |
| :--- | :--- | :--- | :--- |
| **Pod Security** | Explicit UIDs (`runAsUser: 10001`, `101`, `999`, `70`) | Dynamic UID assignment via `restricted-v2` SCC | `values-openshift.yaml` omits fixed UIDs; uses `runAsNonRoot: true` |
| **Ingress** | Kong Ingress / Istio Ingress Gateway / ALB | OpenShift HAProxy `Route` (`route.openshift.io/v1`) | `k8s/helm/hotel-premium/templates/routes.yaml` (Edge TLS termination) |
| **Stateful SCC** | Standard ServiceAccount | `anyuid` SCC assigned to `hotel-data-sa` | [`k8s/openshift/scc-bindings.yaml`](scc-bindings.yaml) |
| **Service Mesh** | Upstream Istio 1.31.2 | Red Hat OpenShift Service Mesh (RHOSSM / Sail) | [`k8s/openshift/service-mesh.yaml`](service-mesh.yaml) |
| **StorageClass** | `standard` (Minikube) / `gp3` (EKS) | `gp3-csi` (ROSA) / `odf-ceph-rbd` (ODF) | Inherits default OpenShift StorageClass with SELinux support |

---

## 2. One-Click Deployment via Helm 4

### Prerequisites
- OpenShift CLI (`oc`) authenticated to the cluster (`oc login`).
- Helm 4.3+ CLI installed.

### Execution

```bash
# 1. Clone & Navigate
cd hotel_premium

# 2. Assign SCC for Stateful Data Layer (Postgres, Kafka, Redis)
oc apply -f k8s/openshift/scc-bindings.yaml

# 3. Deploy Application Microservices via Helm with OpenShift values
helm upgrade --install hotel-premium ./k8s/helm/hotel-premium \
  --namespace hotel-premium \
  --create-namespace \
  -f ./k8s/helm/hotel-premium/values-openshift.yaml

# 4. Verify Route and Service Endpoints
oc get routes -n hotel-premium
```

---

## 3. Verifying Pod Compliance under `restricted-v2` SCC

Verify that application microservices run under OpenShift's default unprivileged security context constraints:

```bash
oc get pods -n hotel-premium -o custom-columns=NAME:.metadata.name,SCC:.metadata.annotations.'openshift\.io/scc'
```

Expected output:
```text
NAME                                  SCC
hotel-frontend-xxxx-xxxx              restricted-v2
room-service-xxxx-xxxx                restricted-v2
stay-service-xxxx-xxxx                restricted-v2
billing-service-xxxx-xxxx             restricted-v2
notification-worker-xxxx-xxxx         restricted-v2
```

---

## 4. GitOps / ArgoCD / OpenShift GitOps

For automated continuous delivery via **OpenShift GitOps (ArgoCD)**, create an Application pointing to this repository:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: hotel-premium-openshift
  namespace: openshift-gitops
spec:
  project: default
  source:
    repoURL: https://github.com/GeorgeGxx/hotel_premium.git
    targetRevision: master
    path: k8s/helm/hotel-premium
    helm:
      valueFiles:
        - values-openshift.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: hotel-premium
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```
