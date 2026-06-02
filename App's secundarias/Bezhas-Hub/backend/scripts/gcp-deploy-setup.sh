#!/bin/bash
# ============================================================
# BeZhas — Script de Setup y Deploy en GCP Cloud Run
# ============================================================
# USO: bash scripts/gcp-deploy-setup.sh [--setup|--deploy|--all]
#
# --setup : Inicializa recursos GCP (solo la primera vez)
# --deploy: Solo construye y despliega imagen (deploys subsiguientes)
# --all   : Setup completo + deploy inicial
# ============================================================

set -euo pipefail

# ── Configuración ─────────────────────────────────────────────
PROJECT_ID="totemic-bonus-479312-c6"
REGION="europe-west1"
SERVICE_NAME="bezhas-backend"
SA_NAME="bezhas-backend-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()    { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }

# ── Funciones ─────────────────────────────────────────────────

check_prereqs() {
  log_info "Verificando prerequisitos..."
  command -v gcloud >/dev/null 2>&1 || { log_error "gcloud CLI no instalado. Ver: https://cloud.google.com/sdk/docs/install"; exit 1; }
  command -v docker >/dev/null 2>&1 || { log_error "Docker no instalado."; exit 1; }
  
  CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
  if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    log_warn "Proyecto actual: $CURRENT_PROJECT. Cambiando a $PROJECT_ID..."
    gcloud config set project $PROJECT_ID
  fi
  log_success "Prerequisitos OK. Proyecto: $PROJECT_ID"
}

enable_apis() {
  log_info "Habilitando APIs de GCP necesarias..."
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com \
    iam.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    --project=$PROJECT_ID
  log_success "APIs habilitadas"
}

create_service_account() {
  log_info "Creando Service Account: $SA_EMAIL"
  
  # Crear SA (ignora error si ya existe)
  gcloud iam service-accounts create $SA_NAME \
    --display-name="BeZhas Backend Service Account" \
    --description="SA para el backend de BeZhas en Cloud Run" \
    --project=$PROJECT_ID 2>/dev/null || log_warn "Service Account ya existe"
  
  # Otorgar permisos necesarios
  for ROLE in \
    "roles/secretmanager.secretAccessor" \
    "roles/logging.logWriter" \
    "roles/monitoring.metricWriter" \
    "roles/cloudtrace.agent"; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SA_EMAIL" \
      --role="$ROLE" \
      --quiet
    log_success "Rol asignado: $ROLE"
  done
}

create_secrets() {
  log_info "Creando secretos en GCP Secret Manager..."
  log_warn "ATENCIÓN: Debes tener el archivo backend/.env con los valores correctos"
  
  # Función auxiliar para crear o actualizar secreto
  upsert_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID >/dev/null 2>&1; then
      echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME \
        --data-file=- --project=$PROJECT_ID
      log_success "Actualizado: $SECRET_NAME"
    else
      echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME \
        --data-file=- --project=$PROJECT_ID
      log_success "Creado: $SECRET_NAME"
    fi
  }
  
  if [ ! -f "backend/.env" ]; then
    log_error "No se encontró backend/.env. Crearlo desde .env.example"
    exit 1
  fi
  
  # Cargar variables del .env
  source backend/.env 2>/dev/null || true
  
  # Subir secretos (usa los valores del .env local)
  upsert_secret "mongodb-uri"             "${MONGODB_URI:-}"
  upsert_secret "jwt-secret"              "${JWT_SECRET:-}"
  upsert_secret "stripe-secret-key"       "${STRIPE_SECRET_KEY:-}"
  upsert_secret "stripe-webhook-secret"   "${STRIPE_WEBHOOK_SECRET:-}"
  upsert_secret "hot-wallet-private-key"  "${HOT_WALLET_PRIVATE_KEY:-}"
  upsert_secret "relayer-private-key"     "${RELAYER_PRIVATE_KEY:-}"
  upsert_secret "gemini-api-key"          "${GEMINI_API_KEY:-}"
  upsert_secret "openai-api-key"          "${OPENAI_API_KEY:-}"
  upsert_secret "cookie-secret"           "${COOKIE_SECRET:-}"
  upsert_secret "discord-webhook-url"     "${DISCORD_WEBHOOK_URL:-}"
  upsert_secret "telegram-bot-token"      "${TELEGRAM_BOT_TOKEN:-}"
  
  # Redis URL — opcional (si no hay, DISABLE_BULLMQ=true actúa de fallback)
  if [ -n "${REDIS_URL:-}" ]; then
    upsert_secret "redis-url" "${REDIS_URL:-}"
  else
    log_warn "REDIS_URL vacío — BullMQ desactivado en producción"
    upsert_secret "redis-url" "disabled"
  fi
  
  log_success "Todos los secretos configurados en Secret Manager"
}

build_and_push() {
  local TAG=${1:-latest}
  log_info "Construyendo imagen Docker: ${IMAGE}:${TAG}"
  
  cd backend
  
  # Usar Cloud Build (no requiere Docker local)
  gcloud builds submit \
    --tag "${IMAGE}:${TAG}" \
    --config cloudbuild.yaml \
    --project=$PROJECT_ID \
    --timeout=1200s \
    .
  
  cd ..
  log_success "Imagen publicada: ${IMAGE}:${TAG}"
}

deploy_cloud_run() {
  local TAG=${1:-latest}
  log_info "Desplegando $SERVICE_NAME en Cloud Run ($REGION)..."
  
  gcloud run services replace backend/service.yaml \
    --region=$REGION \
    --project=$PROJECT_ID
  
  # Verificar deploy
  SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(status.url)")
  
  log_success "Servicio desplegado: $SERVICE_URL"
  
  # Health check
  sleep 15
  HEALTH=$(curl -sf "$SERVICE_URL/api/health" 2>&1 || echo "ERROR")
  echo "Health: $HEALTH"
  
  if echo "$HEALTH" | grep -q '"status":"ok"'; then
    log_success "✅ Deploy completado exitosamente"
    echo ""
    echo "======================================"
    echo "🌐 URL Producción: $SERVICE_URL"
    echo "📊 Health: $SERVICE_URL/api/health"
    echo "📚 Docs: $SERVICE_URL/api-docs"
    echo "======================================"
  else
    log_warn "Health check no respondió. Verificar logs:"
    gcloud run logs read --service=$SERVICE_NAME --region=$REGION --limit=30
  fi
}

update_deploy_workflow() {
  log_info "Actualizando workflow de deploy..."
  cat > _agents/workflows/deploy.md << 'EOF'
---
description: How to deploy the BeZhas backend to GCP Cloud Run
---

# Deploy BeZhas Backend

## GCP Project: totemic-bonus-479312-c6 | Región: europe-west1

## Pre-requisitos
- gcloud CLI instalado y autenticado (`gcloud auth login`)
- Docker instalado (para builds locales)
- Acceso al proyecto GCP

## Pasos

// turbo-all

1. Verificar que el backend compila sin errores:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3\backend"
node -e "require('./config.js'); console.log('Config OK');"
```

2. Correr tests críticos antes de deploy:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3\backend"
pnpm exec jest tests/payment-system.test.js tests/bridge.core.test.js --no-cache --bail --passWithNoTests
```

3. Build y deploy vía Cloud Build (recomendado):
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3\backend"
gcloud builds submit --config cloudbuild.yaml --project totemic-bonus-479312-c6
```

4. Deploy manual si Cloud Build no está disponible:
```bash
# Build imagen
docker build -f Dockerfile.production -t gcr.io/totemic-bonus-479312-c6/bezhas-backend:latest .
docker push gcr.io/totemic-bonus-479312-c6/bezhas-backend:latest

# Deploy a Cloud Run
gcloud run services replace service.yaml --region europe-west1 --project totemic-bonus-479312-c6
```

5. Verificar health post-deploy:
```bash
curl https://bezhas-backend-HASH.europe-west1.run.app/api/health
```

## Rollback
```bash
gcloud run services update-traffic bezhas-backend \
  --to-revisions=REVISION_ID=100 \
  --region europe-west1
```

## Ver logs en tiempo real
```bash
gcloud run logs tail --service bezhas-backend --region europe-west1
```
EOF
  log_success "Workflow actualizado"
}

# ── Main ──────────────────────────────────────────────────────

MODE=${1:-"--help"}

case "$MODE" in
  --setup)
    check_prereqs
    enable_apis
    create_service_account
    create_secrets
    log_success "Setup GCP completado. Ahora ejecuta: bash scripts/gcp-deploy-setup.sh --deploy"
    ;;
  --deploy)
    check_prereqs
    build_and_push "latest"
    deploy_cloud_run "latest"
    ;;
  --all)
    check_prereqs
    enable_apis
    create_service_account
    create_secrets
    build_and_push "latest"
    deploy_cloud_run "latest"
    update_deploy_workflow
    ;;
  --secrets-only)
    check_prereqs
    create_secrets
    ;;
  --help|*)
    echo ""
    echo "BeZhas GCP Deploy Script"
    echo "========================"
    echo "Uso: bash scripts/gcp-deploy-setup.sh [OPCIÓN]"
    echo ""
    echo "Opciones:"
    echo "  --setup        Inicializa recursos GCP (primera vez)"
    echo "  --deploy       Build + deploy sin setup"
    echo "  --all          Setup completo + deploy"
    echo "  --secrets-only Solo actualiza secretos en Secret Manager"
    echo ""
    echo "Proyecto: $PROJECT_ID"
    echo "Región:   $REGION"
    echo "Servicio: $SERVICE_NAME"
    echo ""
    ;;
esac
