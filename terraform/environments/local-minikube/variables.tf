variable "kubeconfig_path" {
  type        = string
  description = "Path to the local kubeconfig file"
  default     = "~/.kube/config"
}

variable "kube_context" {
  type        = string
  description = "Kubernetes context to target (minikube)"
  default     = "minikube"
}

variable "grafana_admin_password" {
  type        = string
  description = "Initial admin password for Grafana"
  default     = "admin"
  sensitive   = true
}
