module "vpc" {
  source = "../../modules/gcp/vpc"

  name                     = local.name
  environment              = local.env
  region                   = var.region
  subnet_cidr              = local.cfg.subnet_cidr
  pods_cidr                = local.cfg.pods_cidr
  services_cidr            = local.cfg.services_cidr
  additional_pods_cidr     = local.cfg.dataplane_2_pods_cidr
  additional_services_cidr = local.cfg.dataplane_2_services_cidr
}

module "gke" {
  source = "../../modules/gcp/gke"

  name             = local.name
  environment      = local.env
  region           = var.region
  project_id       = var.project_id
  network_name     = module.vpc.network_name
  subnetwork_name  = module.vpc.subnetwork_name
  enable_autopilot = local.cfg.enable_gke_autopilot
  master_cidr      = local.cfg.master_cidr
  labels           = local.labels
}

# Production uses a second independent GKE cluster with dedicated secondary
# ranges and control-plane CIDR. Dev/staging keep a single cluster.
module "gke_dp2" {
  count  = local.env == "prod" ? 1 : 0
  source = "../../modules/gcp/gke"

  name                = "${local.name}-dp2"
  environment         = local.env
  region              = var.region
  project_id          = var.project_id
  network_name        = module.vpc.network_name
  subnetwork_name     = module.vpc.subnetwork_name
  enable_autopilot    = local.cfg.enable_gke_autopilot
  master_cidr         = local.cfg.dataplane_2_master_cidr
  pods_range_name     = "gke-pods-dp2"
  services_range_name = "gke-services-dp2"
  labels              = merge(local.labels, { data_plane = "2" })
}

module "gar" {
  source = "../../modules/gcp/gar"

  name        = local.name
  environment = local.env
  region      = var.region
}

module "cloudsql" {
  count  = local.cfg.enable_managed_database ? 1 : 0
  source = "../../modules/gcp/cloudsql"

  name                   = local.name
  environment            = local.env
  region                 = var.region
  network_id             = module.vpc.network_id
  vpc_peering_dependency = module.vpc.private_vpc_connection
  tier                   = local.cfg.db_tier
  high_availability      = local.cfg.db_high_availability
  deletion_protection    = local.cfg.db_deletion_protection
  db_username            = var.db_username
  db_password            = var.db_password
}

module "memorystore" {
  count  = local.cfg.enable_memorystore ? 1 : 0
  source = "../../modules/gcp/memorystore"

  name                   = local.name
  environment            = local.env
  region                 = var.region
  network_id             = module.vpc.network_id
  vpc_peering_dependency = module.vpc.private_vpc_connection
  memory_size_gb         = local.cfg.redis_memory_gb
  high_availability      = local.cfg.redis_high_availability
}

module "kms" {
  count  = local.cfg.enable_kms ? 1 : 0
  source = "../../modules/gcp/kms"

  name        = local.name
  environment = local.env
  location    = var.region
  labels      = local.labels
}

module "gcs" {
  source = "../../modules/gcp/gcs"

  name          = local.name
  environment   = local.env
  storage_class = local.cfg.gcs_storage_class
  kms_key_id    = local.cfg.enable_kms ? module.kms[0].crypto_key_id : null
  labels        = local.labels
}

module "managed_kafka" {
  count  = local.cfg.enable_managed_kafka ? 1 : 0
  source = "../../modules/gcp/managed_kafka"

  name            = local.name
  environment     = local.env
  retention_hours = local.cfg.kafka_retention_hours
  kms_key_id      = local.cfg.enable_kms ? module.kms[0].crypto_key_id : null
  labels          = local.labels
}

module "cloud_armor_lb" {
  count  = local.cfg.enable_cloud_armor_lb ? 1 : 0
  source = "../../modules/gcp/cloud_armor_lb"

  name             = local.name
  environment      = local.env
  domain_name      = var.domain_name
  rate_limit_count = local.cfg.rate_limit_count
  gcs_bucket_name  = module.gcs.bucket_name
  labels           = local.labels
}

module "cloud_cdn" {
  count  = local.cfg.enable_cloud_cdn ? 1 : 0
  source = "../../modules/gcp/cloud_cdn"

  name        = local.name
  environment = local.env
  bucket_name = module.gcs.bucket_name
  labels      = local.labels
}

module "cloud_monitoring" {
  source = "../../modules/gcp/cloud_monitoring"

  name        = local.name
  environment = local.env
  alert_email = var.alert_email
  labels      = local.labels
}

module "workload_identity" {
  source = "../../modules/gcp/workload_identity"

  name                = local.name
  environment         = local.env
  project_id          = var.project_id
  k8s_namespace       = "default"
  k8s_service_account = "backend-workload-identity"
}

module "cloud_dns" {
  count  = var.domain_name != "" ? 1 : 0
  source = "../../modules/gcp/cloud_dns"

  name        = local.name
  environment = local.env
  domain_name = var.domain_name
  a_records = local.cfg.enable_cloud_armor_lb ? {
    "@"   = [module.cloud_armor_lb[0].global_ip_address]
    "api" = [module.cloud_armor_lb[0].global_ip_address]
  } : {}
  labels = local.labels
}
