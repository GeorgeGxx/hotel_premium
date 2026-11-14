variable "aws_region" {
  description = "Target AWS region for Hotel Premium EKS and data infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Canonical project identifier"
  type        = string
  default     = "hotel-premium"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "Primary CIDR block for the AWS VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "Availability Zones for Multi-AZ high availability"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "eks_cluster_version" {
  description = "Amazon EKS Kubernetes control plane version"
  type        = string
  default     = "1.32"
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for EKS managed worker nodes"
  type        = list(string)
  default     = ["m6i.large", "m6a.large"]
}

variable "db_instance_class" {
  description = "Amazon RDS PostgreSQL instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_username" {
  description = "Master username for RDS PostgreSQL"
  type        = string
  default     = "hotel_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL (injected via TF_VAR_db_password or AWS Secrets Manager)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 16
    error_message = "db_password must be at least 16 characters long."
  }
}

variable "redis_node_type" {
  description = "Amazon ElastiCache Redis node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "msk_instance_type" {
  description = "Amazon MSK Kafka broker instance type"
  type        = string
  default     = "kafka.t3.small"
}

variable "github_repository" {
  description = "GitHub repository in org/repo format allowed to assume the OIDC deployment role"
  type        = string
  default     = "georgegxx/hotel_premium"
}

variable "monthly_budget_usd" {
  description = "Monthly AWS FinOps cost budget threshold in USD"
  type        = string
  default     = "450"
}

variable "budget_notification_email" {
  description = "Email address for AWS Budget FinOps alerts"
  type        = string
  default     = "finops-alerts@hotelpremium.com"
}
