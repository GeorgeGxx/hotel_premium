output "global_ip_address" {
  value       = google_compute_global_address.this.address
  description = "Public IP address of the External HTTP(S) Load Balancer"
}

output "security_policy_id" {
  value       = google_compute_security_policy.this.id
  description = "ID of the Cloud Armor WAF security policy"
}

output "backend_service_id" {
  value       = google_compute_backend_service.api_backend.id
  description = "ID of the default backend service"
}

output "url_map_id" {
  value       = google_compute_url_map.this.id
  description = "ID of the URL map"
}
