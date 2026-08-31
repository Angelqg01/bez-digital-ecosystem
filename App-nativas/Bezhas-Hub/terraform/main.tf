# ═══════════════════════════════════════════════════════════
# BeZhas Platform - GCP Infrastructure (Terraform)
# 
# Deploys to Google Cloud Run (Serverless):
# - Backend API
# - MCP Intelligence Server
# - Frontend (static via Cloud Run)
# 
# Uses:
# - Artifact Registry for Docker images
# - Secret Manager for sensitive keys
# - Cloud Scheduler for periodic gas analysis
# - VPC Connector for internal MCP <-> Backend latency
# ═══════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# ─── Variables ────────────────────────────────────────────
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment: staging | production"
  type        = string
  default     = "staging"
}

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string"
  type        = string
  sensitive   = true
}

variable "polygon_rpc_url" {
  description = "Polygon RPC URL"
  type        = string
  default     = "https://polygon-rpc.com"
}

variable "polygon_amoy_rpc_url" {
  description = "Polygon Amoy testnet RPC URL"
  type        = string
  default     = "https://rpc-amoy.polygon.technology"
}

# ─── Provider ─────────────────────────────────────────────
provider "google" {
  project = var.project_id
  region  = var.region
}

# ─── Enable Required APIs ─────────────────────────────────
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "vpcaccess.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# ─── Artifact Registry ───────────────────────────────────
resource "google_artifact_registry_repository" "bezhas" {
  location      = var.region
  repository_id = "bezhas-platform"
  format        = "DOCKER"
  description   = "BeZhas Platform Docker images"

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

# ─── Secret Manager ──────────────────────────────────────
resource "google_secret_manager_secret" "relayer_key" {
  secret_id = "bezhas-relayer-private-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret" "stripe_secret" {
  secret_id = "bezhas-stripe-secret-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret" "mongodb_uri" {
  secret_id = "bezhas-mongodb-uri"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "mongodb_uri_value" {
  secret      = google_secret_manager_secret.mongodb_uri.id
  secret_data = var.mongodb_uri
}

# ─── VPC Connector (internal MCP <-> Backend) ────────────
resource "google_vpc_access_connector" "bezhas_connector" {
  name          = "bezhas-vpc-connector"
  region        = var.region
  ip_cidr_range = "10.8.0.0/28"
  network       = "default"

  depends_on = [google_project_service.apis["vpcaccess.googleapis.com"]]
}

# ─── Service Account ─────────────────────────────────────
resource "google_service_account" "bezhas_runner" {
  account_id   = "bezhas-cloud-run"
  display_name = "BeZhas Cloud Run Service Account"
}

resource "google_secret_manager_secret_iam_member" "relayer_access" {
  secret_id = google_secret_manager_secret.relayer_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.bezhas_runner.email}"
}

resource "google_secret_manager_secret_iam_member" "stripe_access" {
  secret_id = google_secret_manager_secret.stripe_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.bezhas_runner.email}"
}

resource "google_secret_manager_secret_iam_member" "mongodb_access" {
  secret_id = google_secret_manager_secret.mongodb_uri.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.bezhas_runner.email}"
}

# ═══════════════════════════════════════════════════════════
# Cloud Run: MCP Intelligence Server
# ═══════════════════════════════════════════════════════════
resource "google_cloud_run_v2_service" "mcp_server" {
  name     = "bezhas-intelligence"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY" # Only accessible from VPC

  template {
    service_account = google_service_account.bezhas_runner.email

    vpc_access {
      connector = google_vpc_access_connector.bezhas_connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    scaling {
      min_instance_count = 0 # Scale to zero when idle
      max_instance_count = 5
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/bezhas-platform/mcp-server:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NETWORK_MODE"
        value = var.environment == "production" ? "mainnet" : "amoy"
      }

      env {
        name  = "POLYGON_RPC_URL"
        value = var.polygon_rpc_url
      }

      env {
        name  = "POLYGON_AMOY_RPC_URL"
        value = var.polygon_amoy_rpc_url
      }

      env {
        name  = "BEZ_CONTRACT_ADDRESS"
        value = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"
      }

      env {
        name  = "HTTP_PORT"
        value = "8080"
      }

      env {
        name = "MONGODB_URI"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.mongodb_uri.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_iam_member.mongodb_access,
  ]
}

# ═══════════════════════════════════════════════════════════
# Cloud Run: Backend API
# ═══════════════════════════════════════════════════════════
resource "google_cloud_run_v2_service" "backend" {
  name     = "bezhas-backend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.bezhas_runner.email

    vpc_access {
      connector = google_vpc_access_connector.bezhas_connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    scaling {
      min_instance_count = 1 # Always-on for API
      max_instance_count = 10
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/bezhas-platform/backend:latest"

      ports {
        container_port = 3001
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "PORT"
        value = "3001"
      }

      env {
        name  = "MCP_SERVER_URL"
        value = google_cloud_run_v2_service.mcp_server.uri
      }

      env {
        name  = "BEZCOIN_CONTRACT_ADDRESS"
        value = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"
      }

      env {
        name = "MONGODB_URI"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.mongodb_uri.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "RELAYER_PRIVATE_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.relayer_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_secret.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_cloud_run_v2_service.mcp_server,
  ]
}

# Allow public access to Backend
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  name     = google_cloud_run_v2_service.backend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ═══════════════════════════════════════════════════════════
# Cloud Scheduler: Periodic Gas Analysis Cache
# Runs every 10 minutes to update gas price cache in MongoDB
# ═══════════════════════════════════════════════════════════
resource "google_cloud_scheduler_job" "gas_cache_updater" {
  name     = "bezhas-gas-cache-updater"
  schedule = "*/10 * * * *" # Every 10 minutes
  region   = var.region

  http_target {
    uri         = "${google_cloud_run_v2_service.mcp_server.uri}/api/mcp/analyze-gas"
    http_method = "POST"
    headers = {
      "Content-Type" = "application/json"
    }
    body = base64encode(jsonencode({
      transactionType  = "token_transfer"
      estimatedValueUSD = 100
    }))
  }

  depends_on = [
    google_project_service.apis["cloudscheduler.googleapis.com"],
    google_cloud_run_v2_service.mcp_server,
  ]
}

# ─── Outputs ──────────────────────────────────────────────
output "backend_url" {
  value       = google_cloud_run_v2_service.backend.uri
  description = "Backend API URL"
}

output "mcp_server_url" {
  value       = google_cloud_run_v2_service.mcp_server.uri
  description = "MCP Intelligence Server URL (internal)"
}

output "artifact_registry" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/bezhas-platform"
  description = "Docker registry path"
}
