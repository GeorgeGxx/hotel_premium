output "gke_cluster_name" {
  value = module.gke.cluster_name
}

output "hotel_chart_repository" {
  description = "Immutable GAR OCI repository consumed by Bitbucket Pipelines."
  value       = local.hotel_chart_repository
}

output "hotel_chart_version" {
  description = "Pinned chart version from k8s/helm/hotel-premium/Chart.yaml."
  value       = local.hotel_chart.version
}

output "hotel_chart_reference" {
  description = "Version-pinned GAR chart reference; Terraform provisions infrastructure, Bitbucket Pipelines deploys this artifact."
  value       = "${local.hotel_chart_repository}:${local.hotel_chart.version}"
}

output "gcp_project_id" {
  description = "GCP project used by the provider and kubeconfig setup."
  value       = var.project_id
}

output "gcp_region" {
  description = "GCP region used by the provider and kubeconfig setup."
  value       = var.region
}

output "gke_endpoint" {
  value     = module.gke.cluster_endpoint
  sensitive = true
}

output "production_dataplane_2_gke_cluster_name" {
  description = "Second independent production GKE data-plane cluster; null outside prod."
  value       = try(module.gke_dp2[0].cluster_name, null)
}

output "production_dataplane_2_gke_endpoint" {
  description = "API endpoint for the second production GKE data-plane cluster; null outside prod."
  value       = try(module.gke_dp2[0].cluster_endpoint, null)
  sensitive   = true
}

output "artifact_registry_id" {
  value = module.gar.repository_id
}

output "vpc_network_name" {
  value = module.vpc.network_name
}

output "vpc_network_id" {
  value = module.vpc.network_id
}

output "kms_key_ring_id" {
  value = try(module.kms[0].key_ring_id, null)
}

output "kms_crypto_key_id" {
  value = try(module.kms[0].crypto_key_id, null)
}

output "gcs_bucket_name" {
  value = module.gcs.bucket_name
}

output "gcs_bucket_url" {
  value = module.gcs.bucket_url
}

output "cloudsql_instance_name" {
  value = try(module.cloudsql[0].instance_name, null)
}

output "cloudsql_private_ip" {
  value = try(module.cloudsql[0].private_ip, null)
}

output "memorystore_host" {
  value = try(module.memorystore[0].host, null)
}

output "memorystore_port" {
  value = try(module.memorystore[0].port, null)
}

output "kafka_topic_name" {
  value = try(module.managed_kafka[0].topic_name, null)
}

output "kafka_topic_id" {
  value = try(module.managed_kafka[0].topic_id, null)
}

output "cloud_armor_lb_ip" {
  value = try(module.cloud_armor_lb[0].global_ip_address, null)
}

output "cloud_armor_security_policy_id" {
  value = try(module.cloud_armor_lb[0].security_policy_id, null)
}

output "cloud_cdn_ip" {
  value = try(module.cloud_cdn[0].cdn_ip_address, null)
}

output "monitoring_dashboard_id" {
  value = module.cloud_monitoring.dashboard_id
}

output "workload_identity_service_account_email" {
  value = module.workload_identity.service_account_email
}

output "cloud_dns_name_servers" {
  value = try(module.cloud_dns[0].name_servers, null)
}
