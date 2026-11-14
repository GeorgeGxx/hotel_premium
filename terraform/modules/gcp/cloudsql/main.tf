resource "google_sql_database_instance" "this" {
  name             = "${var.name}-${var.environment}-pg18"
  database_version = "POSTGRES_18"
  region           = var.region

  depends_on = [var.vpc_peering_dependency]

  settings {
    tier              = var.tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = var.disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
      ssl_mode        = "TRUSTED_CLIENT_CERTIFICATE_REQUIRED"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.high_availability
      start_time                     = "03:00"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
    }
  }

  deletion_protection = var.deletion_protection

  lifecycle {
    # Managed Cloud SQL is only enabled for cloud staging/prod workspaces.
    # Keep this literal; lifecycle meta-arguments cannot be conditional.
    prevent_destroy = true

    precondition {
      condition     = var.environment != "prod" || var.deletion_protection
      error_message = "Production Cloud SQL requires deletion protection."
    }

    precondition {
      condition     = var.environment != "prod" || var.high_availability
      error_message = "Production Cloud SQL must use regional high availability."
    }

    postcondition {
      condition     = var.environment != "prod" || (self.deletion_protection && self.settings[0].backup_configuration[0].enabled)
      error_message = "Production Cloud SQL must retain deletion protection and automated backups."
    }
  }
}

resource "google_sql_database" "databases" {
  for_each = toset(var.database_names)

  name     = each.key
  instance = google_sql_database_instance.this.name
}

resource "google_sql_user" "this" {
  name     = var.db_username
  instance = google_sql_database_instance.this.name
  password = var.db_password
}
