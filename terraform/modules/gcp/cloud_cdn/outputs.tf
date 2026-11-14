output "cdn_ip_address" {
  value       = google_compute_global_address.cdn_ip.address
  description = "Public IP address of the Cloud CDN frontend"
}

output "backend_bucket_id" {
  value = google_compute_backend_bucket.this.id
}
