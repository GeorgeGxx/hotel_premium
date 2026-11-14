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
  default     = "dev"
}

variable "k8s_service_account" {
  description = "Primary Kubernetes Service Account Name"
  type        = string
  default     = "stay-service-sa"
}

variable "k8s_service_accounts" {
  description = "All Hotel Premium Kubernetes Service Accounts bound to Workload Identity"
  type        = list(string)
  default = [
    "room-service-sa",
    "stay-service-sa",
    "billing-service-sa",
    "notification-worker-sa"
  ]
}

variable "roles" {
  description = "List of GCP IAM roles to grant to the service account"
  type        = list(string)
  default = [
    "roles/cloudsql.client",
    "roles/storage.objectViewer"
  ]
}
