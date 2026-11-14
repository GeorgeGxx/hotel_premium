variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "bucket_name" {
  description = "GCS bucket name providing static content to Cloud CDN"
  type        = string
}

variable "labels" {
  type    = map(string)
  default = {}
}
