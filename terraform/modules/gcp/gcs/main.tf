resource "google_storage_bucket" "access_logs" {
  name                        = "${var.name}-${var.environment}-access-logs"
  location                    = var.location
  storage_class               = var.storage_class
  uniform_bucket_level_access = true
  force_destroy               = var.environment != "prod"

  versioning {
    enabled = true
  }

  logging {
    log_bucket        = "${var.name}-${var.environment}-access-logs"
    log_object_prefix = "audit-access-logs/"
  }

  encryption {
    default_kms_key_name = var.kms_key_id
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 90
    }
  }

  labels = var.labels
}

resource "google_storage_bucket" "this" {
  name                        = "${var.name}-${var.environment}-assets"
  location                    = var.location
  storage_class               = var.storage_class
  uniform_bucket_level_access = true
  force_destroy               = var.environment != "prod"

  versioning {
    enabled = var.versioning_enabled
  }

  logging {
    log_bucket        = google_storage_bucket.access_logs.name
    log_object_prefix = "assets-access-logs/"
  }

  encryption {
    default_kms_key_name = var.kms_key_id
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
