output "vpc_id" {
  description = "ID of the Multi-AZ AWS VPC"
  value       = aws_vpc.main.id
}

output "eks_cluster_name" {
  description = "Name of the Amazon EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "Endpoint for the Amazon EKS Kubernetes API server"
  value       = aws_eks_cluster.main.endpoint
}

output "rds_postgres_endpoint" {
  description = "Connection endpoint for Amazon RDS PostgreSQL"
  value       = aws_db_instance.postgres.endpoint
}

output "elasticache_redis_endpoint" {
  description = "Primary endpoint for Amazon ElastiCache Redis"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "ecr_repository_urls" {
  description = "Map of microservice names to Amazon ECR repository URLs"
  value       = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}

output "github_actions_role_arn" {
  description = "IAM Role ARN assumed by GitHub Actions via OIDC"
  value       = aws_iam_role.github_actions_deployer.arn
}
