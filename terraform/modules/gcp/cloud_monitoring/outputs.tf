output "dashboard_id" {
  value = google_monitoring_dashboard.this.id
}

output "cpu_alert_policy_id" {
  value = google_monitoring_alert_policy.cpu_alert.id
}

output "http_5xx_alert_policy_id" {
  value = google_monitoring_alert_policy.http_5xx_alert.id
}
