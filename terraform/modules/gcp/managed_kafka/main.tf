# Dead Letter Topic for Failed Events
resource "google_pubsub_topic" "dead_letter" {
  name         = "${var.name}-${var.environment}-orders-dlq"
  kms_key_name = var.kms_key_id
  labels       = var.labels
}

# Main Orders Event Topic (MSK/Kafka equivalent)
resource "google_pubsub_topic" "orders" {
  name         = "${var.name}-${var.environment}-orders-topic"
  kms_key_name = var.kms_key_id
  labels       = var.labels

  message_retention_duration = "${var.retention_hours * 3600}s"
}

# Consumer Subscription with Dead-Letter Policy
resource "google_pubsub_subscription" "orders_sub" {
  name  = "${var.name}-${var.environment}-orders-consumer"
  topic = google_pubsub_topic.orders.id

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
