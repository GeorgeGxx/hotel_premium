variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "retention_hours" {
  description = "Message retention in hours"
  type        = number
  default     = 24
}

variable "kms_key_id" {
  description = "Optional Cloud KMS key for customer-managed encryption"
  type        = string
  default     = null
}

variable "labels" {
  type    = map(string)
  default = {}
}
