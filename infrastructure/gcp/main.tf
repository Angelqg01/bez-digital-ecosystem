# ─────────────────────────────────────────────────────────────────────────────
#  infrastructure/gcp/main.tf
#  BeZhas GCP Infrastructure — Terraform
#
#  Provisions:
#   - Cloud Run (6 services)
#   - Cloud SQL for PostgreSQL 15
#   - Memorystore for Redis 7
#   - Artifact Registry
#   - Secret Manager (secrets must be populated separately via gcp-deploy.sh)
#   - Pub/Sub topics + subscriptions
#   - Cloud Storage bucket
#   - Service Account + IAM bindings
#   - VPC Connector (for Cloud Run → Cloud SQL / Redis private connectivity)
#   - Cloud KMS Key Ring + HSM Crypto Key (Web3 institutional custody/signing)
#   - BigQuery Dataset + Table (Web3 public data integration & on-chain streaming analytics)
#
#  Usage:
#   cd infrastructure/gcp
#   terraform init
#   terraform plan -var="project_id=bezhas-prod"
#   terraform apply -var="project_id=bezhas-prod"
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.20"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.20"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ── Project Info Data Source ──────────────────────────────────────────────────
data "google_project" "project" {}

# ── Variables ──────────────────────────────────────────────────────────────────

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "bezhas-prod"
}

variable "region" {
  description = "GCP Region (EU)"
  type        = string
  default     = "europe-west1"
}

variable "image_tag" {
  description = "Docker image tag (git SHA or 'latest')"
  type        = string
  default     = "latest"
}

variable "db_password" {
  description = "Cloud SQL PostgreSQL password"
  type        = string
  sensitive   = true
}

# ── Enable APIs ────────────────────────────────────────────────────────────────

resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "compute.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "pubsub.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "storage.googleapis.com",
    "aiplatform.googleapis.com",         # Vertex AI (Managed serverless Gemini)
    "cloudkms.googleapis.com",           # Cloud KMS (HSM security for wallets)
    "bigquery.googleapis.com",           # BigQuery (Web3 data and event streaming)
    "blockchainnodeengine.googleapis.com" # Blockchain Node Engine (Native node hosting)
  ])
  service            = each.value
  disable_on_destroy = false
}

# ── VPC + Private networking ───────────────────────────────────────────────────

resource "google_compute_network" "bezhas_vpc" {
  name                    = "bezhas-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.services["compute.googleapis.com"]]
}

resource "google_compute_subnetwork" "bezhas_subnet" {
  name          = "bezhas-subnet"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.bezhas_vpc.id
}

resource "google_vpc_access_connector" "bezhas_connector" {
  name          = "bezhas-vpc-connector"
  region        = var.region
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.bezhas_vpc.name
  depends_on    = [google_project_service.services["vpcaccess.googleapis.com"]]
}

resource "google_compute_global_address" "private_service_range" {
  name          = "bezhas-private-service-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.bezhas_vpc.id
  depends_on    = [google_project_service.services["compute.googleapis.com"]]
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.bezhas_vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range.name]
  depends_on              = [google_project_service.services["servicenetworking.googleapis.com"]]
}

# ── Artifact Registry ──────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "bezhas" {
  location      = var.region
  repository_id = "bezhas-services"
  description   = "BeZhas Docker images"
  format        = "DOCKER"
  depends_on    = [google_project_service.services["artifactregistry.googleapis.com"]]
}

# ── Service Account ────────────────────────────────────────────────────────────

resource "google_service_account" "bezhas_run" {
  account_id   = "bezhas-run"
  display_name = "BeZhas Cloud Run Service Account"
}

locals {
  run_sa_roles = [
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectAdmin",
    "roles/pubsub.publisher",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudsql.client",
    "roles/aiplatform.user",             # Allows serverless Gemini calling
    "roles/cloudkms.signerVerifier",     # Allows cryptographic wallet key signing
    "roles/bigquery.dataEditor"          # Allows streaming event analytics ingestion
  ]
  image_base = "${var.region}-docker.pkg.dev/${var.project_id}/bezhas-services"
}

resource "google_project_iam_member" "run_sa_bindings" {
  for_each = toset(local.run_sa_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.bezhas_run.email}"
}

# ── Cloud SQL (PostgreSQL 15) ──────────────────────────────────────────────────

resource "google_sql_database_instance" "bezhas_postgres" {
  name             = "bezhas-postgres"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = "db-g1-small"
    availability_type = "REGIONAL"  # HA for production

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      retained_backups               = 7
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.bezhas_vpc.id
      require_ssl     = true
    }

    disk_type       = "PD_SSD"
    disk_size       = 20
    disk_autoresize = true
  }

  deletion_protection = true
  depends_on          = [google_service_networking_connection.private_services]
}

resource "google_sql_database" "bezhas_db" {
  name     = "bezhas_control"
  instance = google_sql_database_instance.bezhas_postgres.name
}

resource "google_sql_user" "bezhas_user" {
  name     = "bezhas"
  instance = google_sql_database_instance.bezhas_postgres.name
  password = var.db_password
}

# ── Memorystore (Redis 7) ──────────────────────────────────────────────────────

resource "google_redis_instance" "bezhas_redis" {
  name               = "bezhas-redis"
  tier               = "BASIC"
  memory_size_gb     = 1
  region             = var.region
  redis_version      = "REDIS_7_0"
  authorized_network = google_compute_network.bezhas_vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  depends_on         = [google_service_networking_connection.private_services]
}

# ── Cloud Storage ──────────────────────────────────────────────────────────────

resource "google_storage_bucket" "bezhas_assets" {
  name                        = "bezhas-assets-prod"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  cors {
    origin          = ["https://bezhas.com", "https://app.bezhas.com"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 365 }  # Auto-delete objects older than 1 year
  }
}

# ── Pub/Sub ────────────────────────────────────────────────────────────────────

resource "google_pubsub_topic" "blockchain_events" {
  name = "bezhas-blockchain-events"
}

resource "google_pubsub_topic" "nft_events" {
  name = "bezhas-nft-events"
}

resource "google_pubsub_topic" "gas_alerts" {
  name = "bezhas-gas-alerts"
}

resource "google_pubsub_subscription" "events_bigquery" {
  name  = "bezhas-events-bigquery"
  topic = google_pubsub_topic.blockchain_events.name

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"  # 7 days
  expiration_policy { ttl = "" }  # Never expire
}

# ── Cloud KMS for Institutional Wallets (HSM-backed) ──────────────────────────

resource "google_kms_key_ring" "bezhas_keyring" {
  name       = "bezhas-web3-key-ring"
  location   = var.region
  depends_on = [google_project_service.services["cloudkms.googleapis.com"]]
}

resource "google_kms_crypto_key" "bezhas_signer_key" {
  name     = "bezhas-wallet-signer"
  key_ring = google_kms_key_ring.bezhas_keyring.id
  purpose  = "ASYMMETRIC_SIGN"

  version_template {
    algorithm        = "ECDSA_SIGN_P256_SHA256"
    protection_level = "HSM" # Hardware Security Module for FIPS 140-2 Level 3 compliance
  }
}

# ── BigQuery Web3 Event Analytics ─────────────────────────────────────────────

resource "google_bigquery_dataset" "bezhas_analytics" {
  dataset_id                  = "bezhas_blockchain_analytics"
  friendly_name               = "BeZhas Blockchain Event Analytics"
  description                 = "Stores structured logs from BeZhas Blockchain L2 smart contracts"
  location                    = var.region
  depends_on                  = [google_project_service.services["bigquery.googleapis.com"]]
}

resource "google_bigquery_table" "transaction_logs" {
  dataset_id          = google_bigquery_dataset.bezhas_analytics.dataset_id
  table_id            = "transaction_logs"
  deletion_protection = false

  schema = <<EOF
[
  {
    "name": "event_id",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "Unique event transaction hash or event UUID"
  },
  {
    "name": "timestamp",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "Timestamp of block inclusion"
  },
  {
    "name": "event_type",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "Type of event (e.g. AgentTaskRequested, AegisAlertRaised)"
  },
  {
    "name": "payload",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "Raw JSON string or metadata associated with the event"
  },
  {
    "name": "gas_used",
    "type": "INTEGER",
    "mode": "NULLABLE",
    "description": "Gas consumed by transaction"
  }
]
EOF
}

# ── Pub/Sub to BigQuery Direct Streaming Subscription ──────────────────────────

resource "google_pubsub_subscription" "events_bigquery_stream" {
  name  = "bezhas-events-bigquery-stream"
  topic = google_pubsub_topic.blockchain_events.name

  ack_deadline_seconds = 60

  bigquery_config {
    table            = "${var.project_id}:${google_bigquery_dataset.bezhas_analytics.dataset_id}.${google_bigquery_table.transaction_logs.table_id}"
    use_topic_schema = false
    write_metadata   = true # Auto-inject message attributes like message_id and publish_time
  }

  depends_on = [
    google_project_service.services["pubsub.googleapis.com"],
    google_bigquery_table.transaction_logs,
    google_project_iam_member.pubsub_bigquery_editor,
    google_project_iam_member.pubsub_bigquery_metadata
  ]
}

# Grant Pub/Sub system service account permissions to write to BigQuery
resource "google_project_iam_member" "pubsub_bigquery_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "pubsub_bigquery_metadata" {
  project = var.project_id
  role    = "roles/bigquery.metadataViewer"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# ── Cloud Run: API ─────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  name     = "bezhas-api"
  location = var.region

  template {
    service_account = google_service_account.bezhas_run.email

    vpc_access {
      connector = google_vpc_access_connector.bezhas_connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.image_base}/bezhas-api:${var.image_tag}"
      ports { container_port = 3001 }

      resources {
        limits   = { memory = "512Mi", cpu = "1" }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "3001"
      }
      env {
        name  = "GCP_ENABLED"
        value = "true"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.bezhas_assets.name
      }
      env {
        name  = "PUBSUB_TOPIC"
        value = google_pubsub_topic.blockchain_events.name
      }
      # Cloud SQL via Unix socket (no password in env — loaded from Secret Manager)
      env {
        name  = "INSTANCE_CONNECTION_NAME"
        value = "${var.project_id}:${var.region}:bezhas-postgres"
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }
  }

  depends_on = [google_project_service.services["run.googleapis.com"]]
}

# ── Cloud Run: Aegis ML engine ─────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "aegis" {
  name     = "bezhas-aegis"
  location = var.region

  template {
    service_account = google_service_account.bezhas_run.email

    vpc_access {
      connector = google_vpc_access_connector.bezhas_connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.image_base}/bezhas-aegis:${var.image_tag}"
      ports { container_port = 8001 }
      resources { limits = { memory = "1Gi", cpu = "2" } }

      env { name = "GCP_ENABLED";    value = "true" }
      env { name = "GCP_PROJECT_ID"; value = var.project_id }
      env { name = "GCP_REGION";     value = var.region }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }
  }
}

# ── Cloud Run: AI Gateway ──────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "ai_gateway" {
  name     = "bezhas-ai-gateway"
  location = var.region

  template {
    service_account = google_service_account.bezhas_run.email

    vpc_access {
      connector = google_vpc_access_connector.bezhas_connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.image_base}/bezhas-ai-gateway:${var.image_tag}"
      ports { container_port = 3002 }
      resources { limits = { memory = "512Mi", cpu = "1" } }

      env { name = "GCP_ENABLED";    value = "true" }
      env { name = "GCP_PROJECT_ID"; value = var.project_id }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }
}

# ── Cloud Run: Agent Runtime / OpenClaw orchestrator ───────────────────────────

resource "google_cloud_run_v2_service" "agent_runtime" {
  name     = "bezhas-agent-runtime"
  location = var.region

  template {
    service_account = google_service_account.bezhas_run.email

    vpc_access {
      connector = google_vpc_access_connector.bezhas_connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.image_base}/bezhas-agent-runtime:${var.image_tag}"
      ports { container_port = 3099 }
      resources { limits = { memory = "512Mi", cpu = "1" } }

      env { name = "NODE_ENV";       value = "production" }
      env { name = "PORT";           value = "3099" }
      env { name = "GCP_ENABLED";    value = "true" }
      env { name = "GCP_PROJECT_ID"; value = var.project_id }
      env { name = "AEGIS_API_URL";  value = google_cloud_run_v2_service.aegis.uri }
      env { name = "AI_ENGINE_URL";  value = google_cloud_run_v2_service.ai_gateway.uri }
      env { name = "API_URL";        value = "${google_cloud_run_v2_service.api.uri}/api" }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }
  }
}

# ── Cloud Run: Edge Node ───────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "edge_node" {
  name     = "bezhas-edge-node"
  location = var.region

  template {
    service_account = google_service_account.bezhas_run.email

    vpc_access {
      connector = google_vpc_access_connector.bezhas_connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.image_base}/bezhas-edge-node:${var.image_tag}"
      ports { container_port = 4000 }
      resources { limits = { memory = "256Mi", cpu = "0.5" } }

      env { name = "GCP_ENABLED";    value = "true" }
      env { name = "GCP_PROJECT_ID"; value = var.project_id }
      env {
        name  = "MCP_URL"
        value = google_cloud_run_v2_service.ai_gateway.uri
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 20
    }
  }
}

# ── Cloud Run: Control Center (Next.js) ───────────────────────────────────────

resource "google_cloud_run_v2_service" "control_center" {
  name     = "bezhas-control-center"
  location = var.region

  template {
    service_account = google_service_account.bezhas_run.email

    containers {
      image = "${local.image_base}/bezhas-control-center:${var.image_tag}"
      ports { container_port = 3000 }
      resources { limits = { memory = "512Mi", cpu = "1" } }

      env { name = "NODE_ENV";                         value = "production" }
      env { name = "NEXT_PUBLIC_SITE_URL";             value = "https://bezhas.com" }
      env { name = "NEXT_PUBLIC_API_URL";              value = google_cloud_run_v2_service.api.uri }
      env { name = "NEXT_PUBLIC_RPC_URL";              value = "https://rpc.bezhas.com" }
      # GA4 — set your Measurement ID here
      env { name = "NEXT_PUBLIC_GA_MEASUREMENT_ID";    value = "" }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }
  }
}

# ── Public IAM — allow unauthenticated access to frontend + edge node ──────────

resource "google_cloud_run_service_iam_member" "frontend_public" {
  service  = google_cloud_run_v2_service.control_center.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "api_public" {
  service  = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "edge_node_public" {
  service  = google_cloud_run_v2_service.edge_node.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Outputs ────────────────────────────────────────────────────────────────────

output "frontend_url"   { value = google_cloud_run_v2_service.control_center.uri }
output "api_url"        { value = google_cloud_run_v2_service.api.uri }
output "aegis_url"      { value = google_cloud_run_v2_service.aegis.uri }
output "ai_gateway_url" { value = google_cloud_run_v2_service.ai_gateway.uri }
output "agent_runtime_url" { value = google_cloud_run_v2_service.agent_runtime.uri }
output "edge_node_url"  { value = google_cloud_run_v2_service.edge_node.uri }
output "redis_host"     { value = google_redis_instance.bezhas_redis.host }
output "db_instance"    { value = google_sql_database_instance.bezhas_postgres.connection_name }
output "ar_repository"  { value = google_artifact_registry_repository.bezhas.id }
output "kms_key_ring"   { value = google_kms_key_ring.bezhas_keyring.id }
output "kms_crypto_key" { value = google_kms_crypto_key.bezhas_signer_key.id }
output "bq_dataset"     { value = google_bigquery_dataset.bezhas_analytics.friendly_name }
