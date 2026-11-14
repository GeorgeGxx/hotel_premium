output "key_ring_id" {
  value = google_kms_key_ring.this.id
}

output "key_ring_name" {
  value = google_kms_key_ring.this.name
}

output "crypto_key_id" {
  value = google_kms_crypto_key.primary.id
}

output "crypto_key_name" {
  value = google_kms_crypto_key.primary.name
}
