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
    "ms_products",
    "ms_inventory",
    "ms_orders",
    "ms_payments",
    "ms_fulfillment",
    "ms_analytics",
    "products_service_db",
    "orders_service_db",
    "inventory_service_db",
    "notification_service_db",
    "payments_service_db",
    "fulfillment_service_db",
    "analytics_service_db",
    "keycloak_db"
  ]
}

variable "db_username" {
  type    = string
  default = "ecommerce_admin"
}

variable "db_password" {
  type      = string
  sensitive = true
}
