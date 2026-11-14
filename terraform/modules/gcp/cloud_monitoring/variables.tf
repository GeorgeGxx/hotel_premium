variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "alert_email" {
  description = "Optional email address to receive notification alerts"
  type        = string
  default     = ""
}

variable "labels" {
  type    = map(string)
  default = {}
}
