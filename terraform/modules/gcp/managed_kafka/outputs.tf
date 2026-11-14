output "topic_name" {
  value = google_pubsub_topic.orders.name
}

output "topic_id" {
  value = google_pubsub_topic.orders.id
}

output "subscription_name" {
  value = google_pubsub_subscription.orders_sub.name
}

output "subscription_id" {
  value = google_pubsub_subscription.orders_sub.id
}

output "dead_letter_topic_name" {
  value = google_pubsub_topic.dead_letter.name
}
