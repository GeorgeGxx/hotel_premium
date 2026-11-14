resource "google_compute_backend_bucket" "this" {
  name        = "${var.name}-${var.environment}-cdn-backend"
  description = "Cloud CDN Backend Bucket for ${var.name} static assets"
  bucket_name = var.bucket_name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    client_ttl        = 3600
    default_ttl       = 3600
    max_ttl           = 86400
    negative_caching  = true
    serve_while_stale = 86400
  }
}

resource "google_compute_url_map" "this" {
  name            = "${var.name}-${var.environment}-cdn-url-map"
  default_service = google_compute_backend_bucket.this.id
}

resource "google_compute_target_http_proxy" "this" {
  name    = "${var.name}-${var.environment}-cdn-proxy"
  url_map = google_compute_url_map.this.id
}

resource "google_compute_global_address" "cdn_ip" {
  name = "${var.name}-${var.environment}-cdn-ip"
}

resource "google_compute_global_forwarding_rule" "this" {
  name                  = "${var.name}-${var.environment}-cdn-fr"
  target                = google_compute_target_http_proxy.this.id
  port_range            = "80"
  ip_address            = google_compute_global_address.cdn_ip.address
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
