output "topic_name" {
  value = google_pubsub_topic.stays_lifecycle.name
}

output "topic_id" {
  value = google_pubsub_topic.stays_lifecycle.id
}

output "subscription_name" {
  value = google_pubsub_subscription.stays_lifecycle_sub.name
}

output "subscription_id" {
  value = google_pubsub_subscription.stays_lifecycle_sub.id
}

output "dead_letter_topic_name" {
  value = google_pubsub_topic.dead_letter.name
}
