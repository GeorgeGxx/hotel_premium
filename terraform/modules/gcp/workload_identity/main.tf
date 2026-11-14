# Dedicated Google Service Account for Kubernetes workloads
resource "google_service_account" "this" {
  account_id   = "${var.name}-${var.environment}-sa"
  display_name = "${var.name} Microservices Workload Service Account (${var.environment})"
  description  = "Service account mapped to Kubernetes ServiceAccount via GCP Workload Identity"
}

# Bind GSA to KSA via roles/iam.workloadIdentityUser
resource "google_service_account_iam_member" "workload_identity_user" {
  service_account_id = google_service_account.this.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/${var.k8s_service_account}]"
}

# Grant optional GCP roles to the Service Account
resource "google_project_iam_member" "roles" {
  for_each = toset(var.roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.this.email}"
}
