resource "google_dns_managed_zone" "this" {
  name        = replace("${var.name}-${var.environment}-zone", ".", "-")
  dns_name    = "${var.domain_name}."
  description = "Managed Cloud DNS Zone for ${var.name} (${var.environment})"

  labels = var.labels
}

resource "google_dns_record_set" "a_records" {
  for_each = var.a_records

  name         = each.key == "@" ? google_dns_managed_zone.this.dns_name : "${each.key}.${google_dns_managed_zone.this.dns_name}"
  managed_zone = google_dns_managed_zone.this.name
  type         = "A"
  ttl          = 300
  rrdatas      = each.value
}
