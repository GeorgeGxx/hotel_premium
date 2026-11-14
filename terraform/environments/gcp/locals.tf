locals {
  name = "hotel-premium-gcp"
  env  = contains(["dev", "staging", "prod"], terraform.workspace) ? terraform.workspace : "dev"

  labels = {
    project             = "hotel-premium"
    environment         = local.env
    managed_by          = "terraform"
    cloud               = "gcp"
    owner               = "hotel-devops-team"
    cost_center         = "hotel-premium-${local.env}"
    cost_allocation     = "opencost-workload-allocation"
    security_compliance = "pci-dss"
  }

  env_config = {
    dev = {
      subnet_cidr               = "10.30.0.0/20"
      pods_cidr                 = "10.31.0.0/16"
      services_cidr             = "10.32.0.0/20"
      master_cidr               = "172.16.0.0/28"
      dataplane_2_pods_cidr     = null
      dataplane_2_services_cidr = null
      dataplane_2_master_cidr   = null
      enable_gke_autopilot      = true
      enable_managed_database   = false
      db_tier                   = "db-custom-2-7680"
      db_high_availability      = false
      db_deletion_protection    = false
      enable_memorystore        = false
      redis_memory_gb           = 1
      redis_high_availability   = false
      enable_kms                = true
      enable_managed_kafka      = false
      kafka_retention_hours     = 24
      enable_cloud_armor_lb     = false
      rate_limit_count          = 1000
      enable_cloud_cdn          = false
      gcs_storage_class         = "STANDARD"
    }
    staging = {
      subnet_cidr               = "10.35.0.0/20"
      pods_cidr                 = "10.36.0.0/16"
      services_cidr             = "10.37.0.0/20"
      master_cidr               = "172.16.1.0/28"
      dataplane_2_pods_cidr     = null
      dataplane_2_services_cidr = null
      dataplane_2_master_cidr   = null
      enable_gke_autopilot      = true
      enable_managed_database   = true
      db_tier                   = "db-custom-2-7680"
      db_high_availability      = false
      db_deletion_protection    = false
      enable_memorystore        = true
      redis_memory_gb           = 2
      redis_high_availability   = false
      enable_kms                = true
      enable_managed_kafka      = true
      kafka_retention_hours     = 48
      enable_cloud_armor_lb     = true
      rate_limit_count          = 2000
      enable_cloud_cdn          = true
      gcs_storage_class         = "STANDARD"
    }
    prod = {
      subnet_cidr               = "10.40.0.0/20"
      pods_cidr                 = "10.41.0.0/16"
      services_cidr             = "10.42.0.0/20"
      master_cidr               = "172.16.2.0/28"
      dataplane_2_pods_cidr     = "10.43.0.0/16"
      dataplane_2_services_cidr = "10.44.0.0/20"
      dataplane_2_master_cidr   = "172.16.3.0/28"
      enable_gke_autopilot      = true
      enable_managed_database   = true
      db_tier                   = "db-custom-4-16384"
      db_high_availability      = true
      db_deletion_protection    = true
      enable_memorystore        = true
      redis_memory_gb           = 5
      redis_high_availability   = true
      enable_kms                = true
      enable_managed_kafka      = true
      kafka_retention_hours     = 168
      enable_cloud_armor_lb     = true
      rate_limit_count          = 5000
      enable_cloud_cdn          = true
      gcs_storage_class         = "STANDARD"
    }
  }

  cfg = local.env_config[local.env]
}

locals {
  hotel_chart            = yamldecode(file("${path.module}/../../../k8s/helm/hotel-premium/Chart.yaml"))
  hotel_chart_repository = local.hotel_chart.annotations["hotel-premium.io/helm-oci-repository"]
}
