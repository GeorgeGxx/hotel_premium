# ==============================================================================
# Namespaces: gatekeeper-system, observability, opencost, auth, data, vault, keda, dev
# ==============================================================================
resource "kubernetes_namespace" "namespaces" {
  for_each = toset([
    "gatekeeper-system",
    "observability",
    "opencost",
    "auth",
    "data",
    "vault",
    "keda",
    "dev"
  ])

  metadata {
    name = each.key
    labels = each.key == "dev" ? {
      "istio-injection"                            = "enabled"
      "environment"                                = "dev"
      "pod-security.kubernetes.io/enforce"         = "privileged"
      "pod-security.kubernetes.io/enforce-version" = "latest"
      "pod-security.kubernetes.io/warn"            = "restricted"
      "pod-security.kubernetes.io/warn-version"    = "latest"
      "pod-security.kubernetes.io/audit"           = "restricted"
      "pod-security.kubernetes.io/audit-version"   = "latest"
      } : {
      "environment" = each.key
    }
  }
}

# ==============================================================================
# 2. Gatekeeper (OPA Admission Controller) v3.23.0
# ==============================================================================
resource "helm_release" "gatekeeper" {
  depends_on = [kubernetes_namespace.namespaces]

  name       = "gatekeeper"
  repository = "https://open-policy-agent.github.io/gatekeeper/charts"
  chart      = "gatekeeper"
  version    = "3.23.0"
  namespace  = "gatekeeper-system"
  timeout    = 600

  set = [
    {
      name  = "controllerManager.resources.requests.cpu"
      value = "100m"
    },
    {
      name  = "controllerManager.resources.requests.memory"
      value = "256Mi"
    },
    {
      name  = "controllerManager.resources.limits.cpu"
      value = "500m"
    },
    {
      name  = "controllerManager.resources.limits.memory"
      value = "512Mi"
    },
    {
      name  = "audit.resources.requests.cpu"
      value = "100m"
    },
    {
      name  = "audit.resources.requests.memory"
      value = "128Mi"
    }
  ]
}

# ==============================================================================
# 3. Observability: Prometheus & Grafana (kube-prometheus-stack)
# ==============================================================================
resource "helm_release" "observability" {
  depends_on = [kubernetes_namespace.namespaces]

  name       = "kube-prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "89.2.2"
  namespace  = "observability"
  timeout    = 900

  set = [
    {
      name  = "grafana.adminPassword"
      value = var.grafana_admin_password
    },
    {
      name  = "grafana.service.type"
      value = "NodePort"
    },
    {
      name  = "grafana.service.nodePort"
      value = "30030"
    },
    {
      name  = "grafana.sidecar.datasources.defaultDatasourceEnabled"
      value = "false"
    },
    {
      name  = "prometheus.prometheusSpec.retention"
      value = "1d"
    },
    {
      name  = "prometheus.prometheusSpec.resources.requests.cpu"
      value = "150m"
    },
    {
      name  = "prometheus.prometheusSpec.resources.requests.memory"
      value = "384Mi"
    },
    {
      name  = "kubeControllerManager.enabled"
      value = "false"
    },
    {
      name  = "kubeScheduler.enabled"
      value = "false"
    },
    {
      name  = "kubeEtcd.enabled"
      value = "false"
    },
    {
      name  = "kubeProxy.enabled"
      value = "false"
    }
  ]
}

# ==============================================================================
# 4. KEDA v2.21.0 (Kubernetes Event-driven Autoscaling)
# ==============================================================================
resource "helm_release" "keda" {
  depends_on = [kubernetes_namespace.namespaces]

  name       = "keda"
  repository = "https://kedacore.github.io/charts"
  chart      = "keda"
  version    = "2.21.0"
  namespace  = "keda"
  timeout    = 600

  set = [
    {
      name  = "operator.resources.requests.cpu"
      value = "100m"
    },
    {
      name  = "operator.resources.requests.memory"
      value = "128Mi"
    },
    {
      name  = "metricsServer.resources.requests.cpu"
      value = "100m"
    },
    {
      name  = "metricsServer.resources.requests.memory"
      value = "128Mi"
    }
  ]
}

# ==============================================================================
# 5. OpenCost (v2.5.32)
# ==============================================================================
resource "helm_release" "opencost" {
  depends_on = [kubernetes_namespace.namespaces]

  name       = "opencost"
  repository = "https://opencost.github.io/opencost-helm-chart"
  chart      = "opencost"
  version    = "2.5.32"
  namespace  = "opencost"
  timeout    = 600

  set = [
    {
      name  = "opencost.exporter.image.tag"
      value = "v2.5.32"
    },
    {
      name  = "opencost.ui.enabled"
      value = "true"
    },
    {
      name  = "opencost.prometheus.internal.serviceName"
      value = "kube-prometheus-prometheus"
    },
    {
      name  = "opencost.prometheus.internal.namespaceName"
      value = "observability"
    },
    {
      name  = "opencost.prometheus.internal.port"
      value = "9090"
    }
  ]
}
