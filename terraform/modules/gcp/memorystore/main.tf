resource "google_redis_instance" "this" {
  name                    = "${var.name}-${var.environment}-redis"
  tier                    = var.high_availability ? "STANDARD_HA" : "BASIC"
  memory_size_gb          = var.memory_size_gb
  region                  = var.region
  authorized_network      = var.network_id
  redis_version           = "REDIS_7_2"
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  auth_enabled            = true
  display_name            = "${var.name} Redis Distributed Cache and Rate Limiter"

  depends_on = [var.vpc_peering_dependency]
}
