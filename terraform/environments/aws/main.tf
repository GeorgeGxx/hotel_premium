locals {
  name_prefix  = "${var.project_name}-${var.environment}"
  nat_gw_count = var.environment == "prod" ? length(var.availability_zones) : 1
  microservices = toset([
    "hotel-room-service",
    "hotel-stay-service",
    "hotel-billing-service",
    "hotel-notification-worker",
    "hotel-frontend",
  ])
}

data "aws_caller_identity" "current" {}

# ==============================================================================
# 1. CUSTOMER-MANAGED KMS KEY (Encryption at Rest for EKS, RDS, Redis, MSK, ECR, Logs)
# ==============================================================================
resource "aws_kms_key" "platform" {
  description             = "Customer-managed KMS key for ${local.name_prefix} encryption at rest"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogsEncryption"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "platform" {
  name          = "alias/${local.name_prefix}-cmk"
  target_key_id = aws_kms_key.platform.key_id
}

# ==============================================================================
# 2. MULTI-AZ VPC, SUBNETS (Public / Private App / Isolated Data) & FLOW LOGS
# ==============================================================================
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name                                             = "${local.name_prefix}-public-${var.availability_zones[count.index]}"
    "kubernetes.io/role/elb"                         = "1"
    "kubernetes.io/cluster/${local.name_prefix}-eks" = "shared"
  }
}

resource "aws_subnet" "private_app" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name                                             = "${local.name_prefix}-private-app-${var.availability_zones[count.index]}"
    "kubernetes.io/role/internal-elb"                = "1"
    "kubernetes.io/cluster/${local.name_prefix}-eks" = "shared"
  }
}

resource "aws_subnet" "private_data" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${local.name_prefix}-private-data-${var.availability_zones[count.index]}"
    Tier = "Data"
  }
}

resource "aws_eip" "nat" {
  count  = local.nat_gw_count
  domain = "vpc"
  tags = {
    Name = "${local.name_prefix}-nat-eip-${count.index}"
  }
}

resource "aws_nat_gateway" "main" {
  count         = local.nat_gw_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  depends_on    = [aws_internet_gateway.igw]

  tags = {
    Name = "${local.name_prefix}-nat-${count.index}"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[var.environment == "prod" ? count.index : 0].id
  }
}

resource "aws_route_table_association" "private_app" {
  count          = length(aws_subnet.private_app)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id

  tags = {
    Name = "${local.name_prefix}-s3-endpoint"
  }
}

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/${local.name_prefix}-flow-logs"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.platform.arn
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "${local.name_prefix}-vpc-flow-logs-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${local.name_prefix}-vpc-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "${aws_cloudwatch_log_group.vpc_flow_logs.arn}:*"
    }]
  })
}

resource "aws_flow_log" "vpc" {
  iam_role_arn    = aws_iam_role.vpc_flow_logs.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id
}

# ==============================================================================
# 3. AMAZON EKS CLUSTER & HARDENED IMDSv2 MANAGED NODE GROUP
# ==============================================================================
resource "aws_iam_role" "eks_cluster" {
  name = "${local.name_prefix}-eks-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_security_group" "eks_nodes" {
  name        = "${local.name_prefix}-eks-nodes-sg"
  description = "Security group for EKS worker nodes"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Node to node East-West Istio mTLS and kubelet traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  egress {
    description = "Outbound intra-VPC cluster communication and VPC endpoints"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
}

resource "aws_eks_cluster" "main" {
  name     = "${local.name_prefix}-eks"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.eks_cluster_version

  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = true
  }

  vpc_config {
    subnet_ids              = aws_subnet.private_app[*].id
    endpoint_private_access = true
    endpoint_public_access  = false
    public_access_cidrs     = [var.vpc_cidr]
    security_group_ids      = [aws_security_group.eks_nodes.id]
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.platform.arn
    }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  depends_on = [aws_iam_role_policy_attachment.eks_cluster_policy]
}

data "tls_certificate" "eks_oidc" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks_oidc.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_role" "eks_nodes" {
  name = "${local.name_prefix}-eks-node-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_ecr_readonly" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_launch_template" "eks_nodes" {
  name_prefix = "${local.name_prefix}-node-lt-"
  description = "Hardened launch template enforcing IMDSv2 and KMS-encrypted root EBS"

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 50
      volume_type           = "gp3"
      encrypted             = true
      kms_key_id            = aws_kms_key.platform.arn
      delete_on_termination = true
    }
  }
}

resource "aws_eks_node_group" "app_nodes" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${local.name_prefix}-app-nodes"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = aws_subnet.private_app[*].id
  instance_types  = var.eks_node_instance_types

  launch_template {
    id      = aws_launch_template.eks_nodes.id
    version = aws_launch_template.eks_nodes.latest_version
  }

  scaling_config {
    desired_size = var.environment == "prod" ? 3 : 2
    min_size     = var.environment == "prod" ? 3 : 2
    max_size     = var.environment == "prod" ? 8 : 4
  }

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_ecr_readonly,
  ]
}

# ==============================================================================
# 4. AMAZON ECR REPOSITORIES (Immutable Tags + KMS + Scan on Push)
# ==============================================================================
resource "aws_ecr_repository" "services" {
  for_each             = local.microservices
  name                 = each.value
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.platform.arn
  }
}

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Retain last 20 immutable release images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# ==============================================================================
# 5. AMAZON RDS POSTGRESQL, ELASTICACHE REDIS, MSK KAFKA & SECRETS MANAGER
# ==============================================================================
resource "aws_security_group" "data_plane" {
  name        = "${local.name_prefix}-data-sg"
  description = "Least-privilege security group for RDS PostgreSQL, ElastiCache Redis, and MSK Kafka"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL 5432 from EKS worker nodes only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  ingress {
    description     = "Redis 6379 from EKS worker nodes only"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  ingress {
    description     = "MSK Kafka TLS 9094 from EKS worker nodes only"
    from_port       = 9094
    to_port         = 9094
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    description = "Restrict data-plane egress strictly to VPC CIDR"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name_prefix}-rds-subnet-group"
  subnet_ids = aws_subnet.private_data[*].id
}

resource "aws_db_instance" "postgres" {
  identifier                      = "${local.name_prefix}-postgres"
  engine                          = "postgres"
  engine_version                  = "17.2"
  instance_class                  = var.db_instance_class
  allocated_storage               = 50
  max_allocated_storage           = 200
  storage_type                    = "gp3"
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.platform.arn
  db_name                         = "hotel_premium_db"
  username                        = var.db_username
  password                        = var.db_password
  db_subnet_group_name            = aws_db_subnet_group.postgres.name
  vpc_security_group_ids          = [aws_security_group.data_plane.id]
  multi_az                        = var.environment == "prod"
  publicly_accessible             = false
  backup_retention_period         = 7
  deletion_protection             = var.environment == "prod"
  skip_final_snapshot             = var.environment != "prod"
  final_snapshot_identifier       = var.environment == "prod" ? "${local.name_prefix}-postgres-final-snapshot" : null
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.platform.arn
  auto_minor_version_upgrade      = true
  copy_tags_to_snapshot           = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private_data[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "Encrypted Redis cache and idempotency lock store for Hotel Premium"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.environment == "prod" ? 2 : 1
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.data_plane.id]
  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.platform.arn
  transit_encryption_enabled = true
  automatic_failover_enabled = var.environment == "prod"
}

resource "aws_cloudwatch_log_group" "msk_broker_logs" {
  name              = "/aws/msk/${local.name_prefix}-broker-logs"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.platform.arn
}

resource "aws_msk_cluster" "kafka" {
  cluster_name           = "${local.name_prefix}-msk"
  kafka_version          = "3.7.x"
  number_of_broker_nodes = length(var.availability_zones)

  broker_node_group_info {
    instance_type   = var.msk_instance_type
    client_subnets  = aws_subnet.private_data[*].id
    security_groups = [aws_security_group.data_plane.id]

    storage_info {
      ebs_storage_info {
        volume_size = 50
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_key.platform.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk_broker_logs.name
      }
    }
  }
}

resource "aws_secretsmanager_secret" "hotel_app" {
  name                    = "${local.name_prefix}/app-credentials"
  description             = "Encrypted database, Redis, and MSK credentials for Hotel Premium microservices"
  kms_key_id              = aws_kms_key.platform.arn
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "hotel_app" {
  secret_id = aws_secretsmanager_secret.hotel_app.id
  secret_string = jsonencode({
    DB_HOST                 = aws_db_instance.postgres.address
    DB_PORT                 = "5432"
    DB_USER                 = var.db_username
    DB_PASSWORD             = var.db_password
    DB_NAME                 = "hotel_premium_db"
    REDIS_ADDR              = "${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
    KAFKA_BOOTSTRAP_SERVERS = aws_msk_cluster.kafka.bootstrap_brokers_tls
  })
}

# ==============================================================================
# 6. GITHUB ACTIONS OIDC FEDERATION (Zero Static AWS Keys in CI/CD)
# ==============================================================================
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions_deployer" {
  name = "${local.name_prefix}-github-actions-eks-deployer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:${var.github_repository}:ref:refs/heads/master",
            "repo:${var.github_repository}:environment:production"
          ]
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_deployer" {
  name = "${local.name_prefix}-github-actions-deployer-policy"
  role = aws_iam_role.github_actions_deployer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowECRToken"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "AllowECRPushPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = [for repo in aws_ecr_repository.services : repo.arn]
      },
      {
        Sid      = "AllowEKSDescribe"
        Effect   = "Allow"
        Action   = ["eks:DescribeCluster"]
        Resource = aws_eks_cluster.main.arn
      },
      {
        Sid    = "AllowKMSForECR"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.platform.arn
      }
    ]
  })
}

resource "aws_eks_access_entry" "github_actions" {
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = aws_iam_role.github_actions_deployer.arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "github_actions_admin" {
  cluster_name  = aws_eks_cluster.main.name
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
  principal_arn = aws_iam_role.github_actions_deployer.arn

  access_scope {
    type = "cluster"
  }
}

# ==============================================================================
# 7. FINOPS COST GUARDRAILS (AWS Budgets Alerting at 80% and 100%)
# ==============================================================================
resource "aws_budgets_budget" "monthly_cost" {
  name         = "${local.name_prefix}-monthly-budget"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_notification_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_notification_email]
  }
}
