resource "google_service_account" "gke_nodes" {
  account_id   = "gke-nodes-${var.environment}-sa"
  display_name = "GKE Least-Privilege Node Service Account (${var.environment})"
}

resource "google_container_cluster" "this" {
  name            = "${var.name}-${var.environment}-cluster"
  location        = var.region
  resource_labels = var.labels

  enable_autopilot    = var.enable_autopilot
  deletion_protection = var.environment == "prod"

  node_config {
    service_account = var.node_service_account
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  cluster_autoscaling {
    auto_provisioning_defaults {
      service_account = var.node_service_account
      oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
    }
  }

  network    = var.network_name
  subnetwork = var.subnetwork_name

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = var.master_cidr
  }

  release_channel {
    channel = var.release_channel
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = var.authorized_ipv4_cidr_block
      display_name = "management-network"
    }
  }
}
