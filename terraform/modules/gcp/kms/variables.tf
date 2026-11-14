variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "location" {
  description = "GCP region or multi-region for KMS keyring"
  type        = string
  default     = "us-central1"
}

variable "rotation_period" {
  description = "Key rotation period in seconds (default 90 days: 7776000s)"
  type        = string
  default     = "7776000s"
}

variable "labels" {
  type    = map(string)
  default = {}
}
