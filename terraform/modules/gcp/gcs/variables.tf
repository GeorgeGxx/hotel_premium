variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "location" {
  type    = string
  default = "US"
}

variable "storage_class" {
  type    = string
  default = "STANDARD"
}

variable "versioning_enabled" {
  type    = bool
  default = true
}

variable "kms_key_id" {
  description = "Optional Cloud KMS CryptoKey ID for Customer-Managed Encryption (CMEK)"
  type        = string
  default     = null
}

variable "transition_to_nearline_days" {
  description = "Number of days before transitioning non-current objects to NEARLINE storage (0 to disable)"
  type        = number
  default     = 90
}

variable "labels" {
  type    = map(string)
  default = {}
}
