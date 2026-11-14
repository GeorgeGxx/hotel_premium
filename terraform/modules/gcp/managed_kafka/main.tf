# Dead Letter Topic for Failed Stay Lifecycle Events
resource "google_pubsub_topic" "dead_letter" {
  name         = "${var.name}-${var.environment}-stays-lifecycle-dlq"
  kms_key_name = var.kms_key_id
  labels       = var.labels
}

# Main Hotel Stays Lifecycle Event Topic (hotel.stays.lifecycle.v1)
resource "google_pubsub_topic" "stays_lifecycle" {
  name         = "${var.name}-${var.environment}-stays-lifecycle-topic"
  kms_key_name = var.kms_key_id
  labels       = var.labels

  message_retention_duration = "${var.retention_hours * 3600}s"
}

# Consumer Subscription for Notification Worker with Dead-Letter Policy
resource "google_pubsub_subscription" "stays_lifecycle_sub" {
  name  = "${var.name}-${var.environment}-notification-worker-sub"
  topic = google_pubsub_topic.stays_lifecycle.id

  ack_deadline_seconds       = 30
  retain_acked_messages      = false
  message_retention_duration = "${var.retention_hours * 3600}s"

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = var.labels
}
