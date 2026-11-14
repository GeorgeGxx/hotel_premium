resource "google_artifact_registry_repository" "this" {
  location      = var.region
  repository_id = "${var.name}-${var.environment}"
  description   = "Docker artifact registry for ${var.name} microservices (${var.environment})"
  format        = "DOCKER"
}
