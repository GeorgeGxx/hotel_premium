resource "google_compute_network" "this" {
  name                    = "${var.name}-${var.environment}-vpc"
  auto_create_subnetworks = false
  description             = "VPC network for ${var.name} Microservices (${var.environment})"
}

resource "google_compute_subnetwork" "this" {
  name                     = "${var.name}-${var.environment}-subnet-${var.region}"
  ip_cidr_range            = var.subnet_cidr
  region                   = var.region
  network                  = google_compute_network.this.id
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = var.services_cidr
  }

  dynamic "secondary_ip_range" {
    for_each = var.additional_pods_cidr == null ? [] : [var.additional_pods_cidr]
    content {
      range_name    = "gke-pods-dp2"
      ip_cidr_range = secondary_ip_range.value
    }
  }

  dynamic "secondary_ip_range" {
    for_each = var.additional_services_cidr == null ? [] : [var.additional_services_cidr]
    content {
      range_name    = "gke-services-dp2"
      ip_cidr_range = secondary_ip_range.value
    }
  }
}

resource "google_compute_router" "this" {
  name    = "${var.name}-${var.environment}-router"
  region  = var.region
  network = google_compute_network.this.id
}

resource "google_compute_router_nat" "this" {
  name                               = "${var.name}-${var.environment}-nat"
  router                             = google_compute_router.this.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

resource "google_compute_global_address" "private_ip_allocation" {
  name          = "${var.name}-${var.environment}-private-ip-alloc"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.this.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.this.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_allocation.name]
}
