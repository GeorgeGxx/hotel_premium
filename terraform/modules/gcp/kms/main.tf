resource "google_kms_key_ring" "this" {
  name     = "${var.name}-${var.environment}-keyring"
  location = var.location
}

resource "google_kms_crypto_key" "primary" {
  name            = "${var.name}-${var.environment}-key"
  key_ring        = google_kms_key_ring.this.id
  rotation_period = var.rotation_period
  purpose         = "ENCRYPT_DECRYPT"

  labels = var.labels
}
