variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "hotel-premium-dev"
}

variable "region" {
  description = "GCP Region for resource deployment"
  type        = string
  default     = "us-central1"
}

variable "db_username" {
  description = "Cloud SQL master username"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Cloud SQL master password"
  type        = string
  sensitive   = true
  default     = "secure_master_password"
}

variable "domain_name" {
  description = "Custom domain name for Cloud DNS and SSL termination (e.g. example.com)"
  type        = string
  default     = ""
}

variable "alert_email" {
  description = "Email address to receive monitoring alerts"
  type        = string
  default     = ""
}

variable "enable_monthly_cost_budget" {
  description = "Create a GCP Billing Budget scoped to this project. This sends billing-account notifications only; it does not stop or scale resources."
  type        = bool
  default     = false
}

variable "billing_account_id" {
  description = "GCP billing account ID (for example 000000-000000-000000); required when enable_monthly_cost_budget is true."
  type        = string
  default     = ""
}

variable "monthly_cost_budget_usd" {
  description = "Optional monthly USD budget limit by Terraform workspace (dev/staging/prod). Required when enable_monthly_cost_budget is true."
  type        = map(number)
  default     = {}
}
