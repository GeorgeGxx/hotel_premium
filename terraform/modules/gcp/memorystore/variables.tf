variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "network_id" {
  type = string
}

variable "vpc_peering_dependency" {
  description = "Dependency on service networking connection"
  type        = any
  default     = null
}

variable "memory_size_gb" {
  type    = number
  default = 5
}

variable "high_availability" {
  type    = bool
  default = false
}
