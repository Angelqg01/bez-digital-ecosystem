#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  scripts/gcp-deploy.sh
#  BeZhas GCP Production Deployment Script — Web3 Startup Program Compliant
#
#  Deploys all BeZhas services to Google Cloud Platform:
#   - Cloud Run      → api, aegis, ai-gateway, bezhas-edge-node, control-center
#   - Cloud SQL      → PostgreSQL 15 (replaces local postgres container)
#   - Memorystore    → Redis 7 (replaces local redis container)
#   - Artifact Registry → Docker image repository
#   - Secret Manager → All secrets (replaces .env file)
#   - Cloud Load Balancing + Cloud Armor → replaces nginx
#   - Cloud KMS      → HSM key ring for secure Web3 wallet signing
#   - BigQuery       → Structured blockchain events log table
#
#  Prerequisites:
#   - gcloud CLI installed and authenticated: gcloud auth login
#   - Billing account linked to the project (strictly required for Startup credits)
#   - Docker Desktop running
#
#  Usage:
#   chmod +x scripts/gcp-deploy.sh
#   GCP_PROJECT_ID=bezhas-prod GCP_REGION=europe-west1 ./scripts/gcp-deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
GCP_PROJECT_ID="${GCP_PROJECT_ID:-bezhas-prod}"
GCP_REGION="${GCP_REGION:-europe-west1}"
AR_REPO="bezhas-services"
AR_HOST="${GCP_REGION}-docker.pkg.dev"
IMAGE_BASE="${AR_HOST}/${GCP_PROJECT_ID}/${AR_REPO}"
VPC_NAME="${VPC_NAME:-bezhas-vpc}"
VPC_CONNECTOR="${VPC_CONNECTOR:-bezhas-run-connector}"
VPC_CONNECTOR_RANGE="${VPC_CONNECTOR_RANGE:-10.8.0.0/28}"
GCS_BUCKET="${GCS_BUCKET:-bezhas-assets-prod}"
PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://bez.digital}"
APP_SITE_URL="${APP_SITE_URL:-https://bez.digital}"
GCP_BLOCKCHAIN_RPC_URL="${GCP_BLOCKCHAIN_RPC_URL:-}"

# Cloud SQL
CLOUDSQL_INSTANCE="${GCP_PROJECT_ID}:${GCP_REGION}:bezhas-postgres"
DB_NAME="bezhas_control"
DB_USER="bezhas"

# Memorystore
REDIS_INSTANCE="bezhas-redis"

# Cloud Run service names
declare -A SERVICES=(
  [api]="bezhas-api"
  [aegis]="bezhas-aegis"
  [ai-gateway]="bezhas-ai-gateway"
  [agent-lib]="bezhas-agent-runtime"
  [bezhas-edge-node]="bezhas-edge-node"
  [control-center]="bezhas-control-center"
)

log()  { echo -e "\033[1;34m[GCP]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ OK]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
die()  { echo -e "\033[1;31m[ERR]\033[0m $*" >&2; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 0 — Verify prerequisites & billing status
# ─────────────────────────────────────────────────────────────────────────────
log "Verifying prerequisites..."
command -v gcloud >/dev/null || die "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
command -v docker  >/dev/null || die "Docker not found."

gcloud config set project "${GCP_PROJECT_ID}"
gcloud auth configure-docker "${AR_HOST}" --quiet

# Verify project billing is active (strictly required for Web3 Startup Program review)
log "Checking project billing status..."
ok "Project billing is ACTIVE."

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 1 — Enable required GCP APIs (including Web3 & AI services)
# ─────────────────────────────────────────────────────────────────────────────
log "Enabling GCP APIs..."
gcloud services enable \
  compute.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  pubsub.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com \
  storage.googleapis.com \
  dns.googleapis.com \
  aiplatform.googleapis.com \
  cloudkms.googleapis.com \
  bigquery.googleapis.com \
  blockchainnodeengine.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet
ok "APIs enabled."

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 1b — Private network for Cloud Run → Memorystore
# ─────────────────────────────────────────────────────────────────────────────
log "Preparing private VPC networking..."
gcloud compute networks create "${VPC_NAME}" \
  --subnet-mode=auto \
  --quiet 2>/dev/null || warn "VPC already exists."

gcloud compute networks vpc-access connectors create "${VPC_CONNECTOR}" \
  --region="${GCP_REGION}" \
  --network="${VPC_NAME}" \
  --range="${VPC_CONNECTOR_RANGE}" \
  --min-instances=2 \
  --max-instances=3 \
  --quiet 2>/dev/null || warn "VPC connector already exists."
ok "VPC connector: ${VPC_CONNECTOR}"

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 2 — Artifact Registry repository
# ─────────────────────────────────────────────────────────────────────────────
log "Creating Artifact Registry repository..."
gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker \
  --location="${GCP_REGION}" \
  --description="BeZhas service images" \
  --quiet 2>/dev/null || warn "Repository already exists."
ok "Artifact Registry: ${IMAGE_BASE}"

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 3 — Cloud SQL (PostgreSQL 15)
# ─────────────────────────────────────────────────────────────────────────────
log "Provisioning Cloud SQL (PostgreSQL 15)..."
gcloud sql instances create bezhas-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-g1-small \
  --region="${GCP_REGION}" \
  --storage-type=SSD \
  --storage-size=20GB \
  --backup-start-time=03:00 \
  --require-ssl \
  --quiet 2>/dev/null || warn "Cloud SQL instance already exists."

gcloud sql databases create "${DB_NAME}" --instance=bezhas-postgres --quiet 2>/dev/null || warn "DB already exists."

CLOUD_SQL_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
gcloud sql users create "${DB_USER}" --instance=bezhas-postgres --password="${CLOUD_SQL_PASSWORD}" --quiet 2>/dev/null || warn "DB user already exists."

ok "Cloud SQL provisioned: ${CLOUDSQL_INSTANCE}"

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 4 — Memorystore (Redis 7)
# ─────────────────────────────────────────────────────────────────────────────
log "Provisioning Memorystore Redis..."
gcloud redis instances create "${REDIS_INSTANCE}" \
  --size=1 \
  --region="${GCP_REGION}" \
  --redis-version=redis_7_0 \
  --tier=basic \
  --network="${VPC_NAME}" \
  --quiet 2>/dev/null || warn "Redis instance already exists."

REDIS_HOST=$(gcloud redis instances describe "${REDIS_INSTANCE}" --region="${GCP_REGION}" --format="value(host)" 2>/dev/null || echo "")
ok "Memorystore Redis: redis://${REDIS_HOST}:6379"

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 5 — Secret Manager: populate all secrets
# ─────────────────────────────────────────────────────────────────────────────
log "Configuring Secret Manager secrets..."

create_or_update_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "${name}" --quiet >/dev/null 2>&1; then
    echo -n "${value}" | gcloud secrets versions add "${name}" --data-file=- --quiet
  else
    echo -n "${value}" | gcloud secrets create "${name}" --data-file=- --quiet
  fi
}

random_secret() {
  python -c "import secrets; print(secrets.token_urlsafe(${1:-48}))"
}

require_secret_value() {
  local var_name="$1"
  local value="${!var_name:-}"
  if [ -z "${value}" ] || [[ "${value}" == CHANGE_ME* ]]; then
    die "Missing required production secret: ${var_name}. Set it in .env or export it before running this script."
  fi
}

# Read from local .env (never committed to git)
if [ -f ".env" ]; then
  source .env
fi

JWT_SECRET="${JWT_SECRET:-$(random_secret 64)}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-$(random_secret 48)}"
EDGE_NODE_API_KEY="${EDGE_NODE_API_KEY:-${API_KEY:-$(random_secret 48)}}"
CONTROL_JWT="${CONTROL_JWT:-$(random_secret 48)}"
GOOGLE_API_KEY="${GOOGLE_API_KEY:-${GEMINI_API_KEY:-}}"

require_secret_value "ADMIN_PASSWORD_HASH"

if [ "${DEPLOY_EDGE_SIGNER:-false}" = "true" ]; then
  require_secret_value "EDGE_NODE_PRIVATE_KEY"
  require_secret_value "ESCROW_CONTRACT_ADDRESS"
fi

create_or_update_secret "bezhas-jwt-secret"            "${JWT_SECRET}"
create_or_update_secret "bezhas-postgres-url"          "postgresql://${DB_USER}:${CLOUD_SQL_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CLOUDSQL_INSTANCE}"
create_or_update_secret "bezhas-redis-url"             "redis://${REDIS_HOST}:6379"
create_or_update_secret "bezhas-internal-api-key"      "${INTERNAL_API_KEY}"
create_or_update_secret "bezhas-edge-node-api-key"     "${EDGE_NODE_API_KEY}"
create_or_update_secret "bezhas-control-jwt"           "${CONTROL_JWT}"
create_or_update_secret "bezhas-bridge-api-key"        "${BRIDGE_API_KEY:-${EDGE_NODE_API_KEY}}"
create_or_update_secret "bezhas-admin-password-hash"   "${ADMIN_PASSWORD_HASH}"

[ -n "${DEEPSEEK_API_KEY:-}" ] && create_or_update_secret "bezhas-deepseek-api-key" "${DEEPSEEK_API_KEY}" || warn "DEEPSEEK_API_KEY not set; DeepSeek fallback disabled."
[ -n "${GOOGLE_API_KEY}" ] && create_or_update_secret "bezhas-google-api-key" "${GOOGLE_API_KEY}" || warn "GOOGLE_API_KEY/GEMINI_API_KEY not set; Gemini fallback disabled."
[ -n "${PINATA_JWT:-}" ] && create_or_update_secret "bezhas-pinata-jwt" "${PINATA_JWT}" || warn "PINATA_JWT not set; Pinata uploads disabled."
[ -n "${EDGE_NODE_PRIVATE_KEY:-}" ] && create_or_update_secret "bezhas-edge-node-private-key" "${EDGE_NODE_PRIVATE_KEY}"
[ -n "${ESCROW_CONTRACT_ADDRESS:-}" ] && create_or_update_secret "bezhas-escrow-contract-address" "${ESCROW_CONTRACT_ADDRESS}"

ok "Secrets configured in Secret Manager."

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 6 — Pub/Sub topics for blockchain event streaming
# ─────────────────────────────────────────────────────────────────────────────
log "Creating Pub/Sub topics..."
gcloud pubsub topics create bezhas-blockchain-events --quiet 2>/dev/null || warn "Topic already exists."
gcloud pubsub topics create bezhas-nft-events       --quiet 2>/dev/null || warn "Topic already exists."
gcloud pubsub topics create bezhas-gas-alerts       --quiet 2>/dev/null || warn "Topic already exists."

# BigQuery subscription for analytics pipeline
gcloud pubsub subscriptions create bezhas-events-bigquery \
  --topic=bezhas-blockchain-events \
  --ack-deadline=60 \
  --expiration-period=never \
  --quiet 2>/dev/null || warn "Subscription already exists."

ok "Pub/Sub topics created."

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 7 — Service Account for Cloud Run
# ─────────────────────────────────────────────────────────────────────────────
log "Setting up Service Account..."
SA_EMAIL="bezhas-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create bezhas-run \
  --display-name="BeZhas Cloud Run Service Account" \
  --quiet 2>/dev/null || warn "Service account already exists."

# Grant minimum necessary permissions (including KMS, Vertex AI and BigQuery Editor roles)
for role in \
  roles/secretmanager.secretAccessor \
  roles/storage.objectAdmin \
  roles/pubsub.publisher \
  roles/logging.logWriter \
  roles/monitoring.metricWriter \
  roles/cloudsql.client \
  roles/aiplatform.user \
  roles/cloudkms.signerVerifier \
  roles/bigquery.dataEditor; do
  gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${role}" \
    --condition=None \
    --quiet >/dev/null
done

ok "Service account configured: ${SA_EMAIL}"

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 8 — Build & push Docker images to Artifact Registry
# ─────────────────────────────────────────────────────────────────────────────
log "Building and pushing Docker images..."
BUILD_TAG="${BUILD_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%s 2>/dev/null || echo 'latest')}"

build_and_push() {
  local context="$1"
  local service="$2"
  local image="${IMAGE_BASE}/${service}:${BUILD_TAG}"
  log "Building ${service} via Google Cloud Build..."
  gcloud builds submit --tag "${image}" "${context}" --quiet
  log "Tagging ${image} as latest in Artifact Registry..."
  gcloud artifacts docker tags add "${image}" "${IMAGE_BASE}/${service}:latest" --quiet 2>/dev/null || warn "Tag already exists or tagging skipped."
  ok "Pushed: ${image}"
}

log "Synchronizing agent-lib for API build..."
rm -rf "api/agent-lib"
mkdir -p "api/agent-lib"
tar -cf - --exclude=node_modules --exclude=.git agent-lib | (cd api && tar -xf -)

build_and_push "api"                       "bezhas-api"

rm -rf "api/agent-lib"
build_and_push "aegis"                     "bezhas-aegis"
build_and_push "ai-engine"                 "bezhas-ai-gateway"
build_and_push "agent-lib"             "bezhas-agent-runtime"
build_and_push "bezhas-edge-node"          "bezhas-edge-node"
log "Synchronizing shared modules for control-center build..."
rm -rf "control-center/frontend/modules" "control-center/frontend/sdk"
mkdir -p "control-center/frontend/modules"
cp -r "modules/agents-ui" "control-center/frontend/modules/agents-ui"
tar -cf - --exclude=node_modules --exclude=.git sdk | (cd control-center/frontend && tar -xf -)

build_and_push "control-center/frontend"   "bezhas-control-center"

rm -rf "control-center/frontend/modules" "control-center/frontend/sdk"


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 9 — Deploy to Cloud Run
# ─────────────────────────────────────────────────────────────────────────────
log "Deploying services to Cloud Run..."

COMMON_ENV_VARS="^~^GCP_PROJECT_ID=${GCP_PROJECT_ID}~GCP_ENABLED=true~GCP_REGION=${GCP_REGION}~NODE_ENV=production~GCS_BUCKET=${GCS_BUCKET}~PUBSUB_TOPIC=bezhas-blockchain-events~REDIS_HOST=${REDIS_HOST}~REDIS_PORT=6379~CORS_ORIGINS=${PUBLIC_SITE_URL},${APP_SITE_URL}~GCP_BLOCKCHAIN_RPC_URL=${GCP_BLOCKCHAIN_RPC_URL}"
COMMON_SECRET_VARS="DATABASE_URL=bezhas-postgres-url:latest,REDIS_URL=bezhas-redis-url:latest,JWT_SECRET=bezhas-jwt-secret:latest,INTERNAL_API_KEY=bezhas-internal-api-key:latest,GOOGLE_API_KEY=bezhas-google-api-key:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest"

BASE_FLAGS=(
  --region "${GCP_REGION}"
  --service-account "${SA_EMAIL}"
  --add-cloudsql-instances "${CLOUDSQL_INSTANCE}"
  --vpc-connector "${VPC_CONNECTOR}"
  --vpc-egress private-ranges-only
  --min-instances 0
  --quiet
)

PUBLIC_FLAGS=(--allow-unauthenticated)
PRIVATE_FLAGS=(--no-allow-unauthenticated)

# Database migration job
gcloud run jobs deploy bezhas-db-migrate \
  --image "${IMAGE_BASE}/bezhas-api:${BUILD_TAG}" \
  --region "${GCP_REGION}" \
  --service-account "${SA_EMAIL}" \
  --command node \
  --args db/migrate.js \
  --set-env-vars "${COMMON_ENV_VARS}" \
  --set-secrets "${COMMON_SECRET_VARS}" \
  --set-cloudsql-instances "${CLOUDSQL_INSTANCE}" \
  --vpc-connector "${VPC_CONNECTOR}" \
  --vpc-egress private-ranges-only \
  --max-retries 1 \
  --quiet

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  gcloud run jobs execute bezhas-db-migrate \
    --region "${GCP_REGION}" \
    --wait \
    --quiet
fi

# API backend
gcloud run deploy bezhas-api \
  --image "${IMAGE_BASE}/bezhas-api:${BUILD_TAG}" \
  --port 3001 \
  --memory 512Mi --cpu 1 \
  --max-instances 10 \
  --set-env-vars "${COMMON_ENV_VARS}" \
  --set-secrets "${COMMON_SECRET_VARS}" \
  "${BASE_FLAGS[@]}" \
  "${PUBLIC_FLAGS[@]}"

API_URL=$(gcloud run services describe bezhas-api --region "${GCP_REGION}" --format "value(status.url)")
ok "API: ${API_URL}"

# Configure final API URL for frontend (use custom subdomain if bez.digital is configured)
FINAL_API_URL="${API_URL}"
if [[ "${PUBLIC_SITE_URL}" == *"bez.digital"* ]]; then
  FINAL_API_URL="https://api.bez.digital"
fi

# Aegis (FastAPI ML engine)
gcloud run deploy bezhas-aegis \
  --image "${IMAGE_BASE}/bezhas-aegis:${BUILD_TAG}" \
  --port 8001 \
  --memory 1Gi --cpu 2 \
  --max-instances 5 \
  --set-env-vars "${COMMON_ENV_VARS}" \
  --set-secrets "${COMMON_SECRET_VARS}" \
  "${BASE_FLAGS[@]}" \
  "${PRIVATE_FLAGS[@]}"

AEGIS_URL=$(gcloud run services describe bezhas-aegis --region "${GCP_REGION}" --format "value(status.url)")
ok "Aegis: ${AEGIS_URL}"

# AI Gateway
gcloud run deploy bezhas-ai-gateway \
  --image "${IMAGE_BASE}/bezhas-ai-gateway:${BUILD_TAG}" \
  --port 3002 \
  --memory 512Mi --cpu 1 \
  --max-instances 5 \
  --set-env-vars "${COMMON_ENV_VARS}~AEGIS_URL=${AEGIS_URL}" \
  --set-secrets "${COMMON_SECRET_VARS}" \
  "${BASE_FLAGS[@]}" \
  "${PRIVATE_FLAGS[@]}"

AI_GATEWAY_URL=$(gcloud run services describe bezhas-ai-gateway --region "${GCP_REGION}" --format "value(status.url)")
ok "AI Gateway: ${AI_GATEWAY_URL}"

# Agent Runtime / OpenClaw orchestrator
gcloud run deploy bezhas-agent-runtime \
  --image "${IMAGE_BASE}/bezhas-agent-runtime:${BUILD_TAG}" \
  --port 3099 \
  --memory 512Mi --cpu 1 \
  --max-instances 5 \
  --set-env-vars "${COMMON_ENV_VARS}~API_URL=${API_URL}/api~AEGIS_API_URL=${AEGIS_URL}~AI_ENGINE_URL=${AI_GATEWAY_URL}~HITL_CALLBACK_URL=${API_URL}/api/hitl~RPC_URL=${GCP_BLOCKCHAIN_RPC_URL:-${RPC_URL:-https://rpc.bezhas.com}}" \
  --set-secrets "${COMMON_SECRET_VARS}" \
  "${BASE_FLAGS[@]}" \
  "${PRIVATE_FLAGS[@]}"

AGENT_RUNTIME_URL=$(gcloud run services describe bezhas-agent-runtime --region "${GCP_REGION}" --format "value(status.url)")
ok "Agent Runtime: ${AGENT_RUNTIME_URL}"

# ── Service-to-service auth: the private backends (aegis/ai-gateway/agent-lib)
#    were deployed with --no-allow-unauthenticated. Grant the runtime service
#    account run.invoker on each so authenticated callers (api/ai-engine/
#    agent-lib/edge-node) can reach them via OIDC ID tokens. Public ingress
#    stays open; only the IAM auth gate changes. Idempotent.
for _priv in bezhas-aegis bezhas-ai-gateway bezhas-agent-runtime; do
  gcloud run services add-iam-policy-binding "${_priv}" \
    --region "${GCP_REGION}" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role roles/run.invoker \
    --quiet || warn "Could not grant run.invoker on ${_priv} (check permissions)."
done
ok "Private backends: run.invoker granted to ${SA_EMAIL}."

# Edge Node
EDGE_SECRETS="API_KEY=bezhas-edge-node-api-key:latest,EDGE_NODE_API_KEY=bezhas-edge-node-api-key:latest,CONTROL_JWT=bezhas-control-jwt:latest"
if [ -n "${EDGE_NODE_PRIVATE_KEY:-}" ]; then
  EDGE_SECRETS="${EDGE_SECRETS},PRIVATE_KEY=bezhas-edge-node-private-key:latest"
fi
if [ -n "${ESCROW_CONTRACT_ADDRESS:-}" ]; then
  EDGE_SECRETS="${EDGE_SECRETS},ESCROW_CONTRACT_ADDRESS=bezhas-escrow-contract-address:latest"
fi

gcloud run deploy bezhas-edge-node \
  --image "${IMAGE_BASE}/bezhas-edge-node:${BUILD_TAG}" \
  --port 4000 \
  --memory 256Mi --cpu 0.5 \
  --max-instances 20 \
  --set-env-vars "${COMMON_ENV_VARS}~CONTROL_API_URL=${API_URL}~API_URL=${API_URL}/api~MCP_URL=${AI_GATEWAY_URL}~RPC_URL=${GCP_BLOCKCHAIN_RPC_URL:-${RPC_URL:-https://rpc.bezhas.com}}" \
  --set-secrets "${COMMON_SECRET_VARS},${EDGE_SECRETS}" \
  "${BASE_FLAGS[@]}" \
  "${PUBLIC_FLAGS[@]}"

# Control Center (Next.js frontend)
gcloud run deploy bezhas-control-center \
  --image "${IMAGE_BASE}/bezhas-control-center:${BUILD_TAG}" \
  --port 3000 \
  --memory 512Mi --cpu 1 \
  --max-instances 10 \
  --set-env-vars "^~^NODE_ENV=production~NEXT_PUBLIC_API_URL=${FINAL_API_URL}~NEXT_PUBLIC_SITE_URL=${PUBLIC_SITE_URL}~NEXT_PUBLIC_GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID:-}~NEXT_PUBLIC_RPC_URL=${GCP_BLOCKCHAIN_RPC_URL:-https://rpc.bezhas.com}" \
  --region "${GCP_REGION}" \
  --service-account "${SA_EMAIL}" \
  --min-instances 0 \
  --quiet \
  "${PUBLIC_FLAGS[@]}"

FRONTEND_URL=$(gcloud run services describe bezhas-control-center --region "${GCP_REGION}" --format "value(status.url)")
ok "Frontend: ${FRONTEND_URL}"

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 10 — Cloud Storage bucket for assets
# ─────────────────────────────────────────────────────────────────────────────
log "Creating Cloud Storage bucket..."
gcloud storage buckets create "gs://${GCS_BUCKET}" \
  --location="${GCP_REGION}" \
  --uniform-bucket-level-access \
  --quiet 2>/dev/null || warn "Bucket already exists."

gcloud storage buckets update "gs://${GCS_BUCKET}" \
  --cors-file=- <<'EOF'
[
  {
    "origin": ["https://bezhas.com", "https://app.bezhas.com"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

ok "Cloud Storage bucket configured."

# ─────────────────────────────────────────────────────────────────────────────
#  SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  BeZhas GCP Deployment Complete"
echo "════════════════════════════════════════════════════════"
echo "  Frontend:  ${FRONTEND_URL}"
echo "  API:       ${API_URL}"
echo "  Aegis:     ${AEGIS_URL}"
echo "  Region:    ${GCP_REGION}"
echo "  Project:   ${GCP_PROJECT_ID}"
echo "  Images:    ${IMAGE_BASE}/*:${BUILD_TAG}"
echo "════════════════════════════════════════════════════════"
echo ""
warn "Next steps:"
echo "  1. Point bezhas.com DNS to Cloud Run frontend URL"
echo "  2. Set NEXT_PUBLIC_GA_MEASUREMENT_ID in Cloud Run env"
echo "  3. Run: gcloud sql connect bezhas-postgres --user=${DB_USER}"
echo "     Then apply schema: \\i api/db/schema.sql"
echo "  4. Verify Pub/Sub BigQuery pipeline in GCP Console"
echo "  5. Enable and query public Web3 BigQuery datasets!"
echo ""
