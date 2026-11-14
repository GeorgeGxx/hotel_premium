# Notification Channel for Alerts
resource "google_monitoring_notification_channel" "email" {
  count        = var.alert_email != "" ? 1 : 0
  display_name = "${var.name}-${var.environment}-email-alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

# Alert Policy: High GKE Container CPU Utilization (>80%)
resource "google_monitoring_alert_policy" "cpu_alert" {
  display_name = "${var.name}-${var.environment}-high-container-cpu"
  combiner     = "OR"

  conditions {
    display_name = "Container CPU usage exceeds 80%"
    condition_threshold {
      filter          = "metric.type=\"kubernetes.io/container/cpu/limit_utilization\" AND resource.type=\"k8s_container\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.80

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.label.namespace_name", "resource.label.pod_name"]
      }
    }
  }

  notification_channels = var.alert_email != "" ? [google_monitoring_notification_channel.email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert Policy: Microservices High HTTP 5XX Error Rate
resource "google_monitoring_alert_policy" "http_5xx_alert" {
  display_name = "${var.name}-${var.environment}-high-5xx-rate"
  combiner     = "OR"

  conditions {
    display_name = "Load Balancer 5XX error count exceeds threshold"
    condition_threshold {
      filter          = "metric.type=\"loadbalancing.googleapis.com/https/request_count\" AND resource.type=\"https_lb_rule\" AND metric.label.response_code_class=\"500\""
      duration        = "120s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = var.alert_email != "" ? [google_monitoring_notification_channel.email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}

# Cloud Monitoring Dashboard for Microservices
resource "google_monitoring_dashboard" "this" {
  dashboard_json = jsonencode({
    displayName = "${var.name}-${var.environment}-microservices-observability"
    gridLayout = {
      columns = "2"
      widgets = [
        {
          title = "GKE Pod CPU Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"kubernetes.io/container/cpu/limit_utilization\" AND resource.type=\"k8s_container\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      crossSeriesReducer = "REDUCE_MEAN"
                      groupByFields      = ["resource.label.pod_name"]
                    }
                  }
                }
              }
            ]
          }
        },
        {
          title = "HTTP Load Balancer Request Rates (2XX vs 5XX)"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"loadbalancing.googleapis.com/https/request_count\" AND resource.type=\"https_lb_rule\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.response_code_class"]
                    }
                  }
                }
              }
            ]
          }
        }
      ]
    }
  })
}
