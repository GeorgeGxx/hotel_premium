variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "project_id" {
  type = string
}

variable "network_name" {
  type = string
}

variable "subnetwork_name" {
  type = string
}

variable "enable_autopilot" {
  type    = bool
  default = true
}

variable "master_cidr" {
  type    = string
  default = "172.16.0.0/28"
}

variable "release_channel" {
  type    = string
  default = "REGULAR"
}

variable "pods_range_name" {
  description = "Subnet secondary range assigned to this cluster's Pods."
  type        = string
  default     = "gke-pods"
}

variable "services_range_name" {
  description = "Subnet secondary range assigned to this cluster's Services."
  type        = string
  default     = "gke-services"
}

variable "labels" {
  description = "GCP resource labels applied to the GKE cluster for cost attribution."
  type        = map(string)
  default     = {}
}

variable "authorized_ipv4_cidr_block" {
  description = "The CIDR block from which to allow access to the master."
  type        = string
  default     = "10.0.0.0/8"
}
