variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "domain_name" {
  description = "Base domain name for Cloud DNS (e.g., example.com)"
  type        = string
}

variable "a_records" {
  description = "Map of subdomain to list of IP addresses (use '@' for zone apex)"
  type        = map(list(string))
  default     = {}
}

variable "labels" {
  type    = map(string)
  default = {}
}
