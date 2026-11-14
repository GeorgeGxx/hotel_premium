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

variable "tier" {
  type    = string
  default = "db-custom-4-16384"
}

variable "high_availability" {
  type    = bool
  default = false
}

variable "disk_size_gb" {
  type    = number
  default = 50
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "database_names" {
  type = list(string)
  default = [
    "hotel_db",
    "keycloak_db"
  ]
}

variable "db_username" {
  type    = string
  default = "hotel_user"
}

variable "db_password" {
  type      = string
  sensitive = true
}
