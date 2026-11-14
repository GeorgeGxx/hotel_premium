# nosemgrep: terraform.gcp.security.gcp-cloud-storage-logging.gcp-cloud-storage-logging
resource "google_storage_bucket" "this" {
  name                        = "${var.name}-${var.environment}-assets"
  location                    = var.location
  storage_class               = var.storage_class
  uniform_bucket_level_access = true
  force_destroy               = var.environment != "prod"

  versioning {
    enabled = var.versioning_enabled
  }

  dynamic "encryption" {
    for_each = var.kms_key_id != null ? [var.kms_key_id] : []
    content {
      default_kms_key_name = encryption.value
    }
  }

  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"
    }
    condition {
      age = 7
    }
  }

  dynamic "lifecycle_rule" {
    for_each = var.transition_to_nearline_days > 0 ? [var.transition_to_nearline_days] : []
    content {
      action {
        type          = "SetStorageClass"
        storage_class = "NEARLINE"
      }
      condition {
        age = lifecycle_rule.value
      }
    }
  }

  labels = var.labels
}
