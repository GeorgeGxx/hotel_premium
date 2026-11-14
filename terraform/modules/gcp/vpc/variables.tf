variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "subnet_cidr" {
  type = string
}

variable "pods_cidr" {
  type = string
}

variable "services_cidr" {
  type = string
}

variable "additional_pods_cidr" {
  description = "Optional second GKE data-plane Pod range, reserved for prod."
  type        = string
  default     = null
}

variable "additional_services_cidr" {
  description = "Optional second GKE data-plane Services range, reserved for prod."
  type        = string
  default     = null
}
