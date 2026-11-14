variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "k8s_namespace" {
  description = "Kubernetes Namespace"
  type        = string
  default     = "default"
}

variable "k8s_service_account" {
  description = "Kubernetes Service Account Name"
  type        = string
  default     = "backend-workload-identity"
}

variable "roles" {
  description = "List of GCP IAM roles to grant to the service account"
  type        = list(string)
  default = [
    "roles/cloudsql.client",
    "roles/storage.objectViewer"
  ]
}
