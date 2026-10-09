#!/usr/bin/env bash
# ============================================================================
# 01 — Preparar el proyecto de Google Cloud (se ejecuta una vez; es idempotente)
# ============================================================================
#   - Activa las APIs necesarias.
#   - Crea el repositorio de Artifact Registry.
#   - Crea una cuenta de servicio por servicio de Cloud Run, sin roles de
#     proyecto: cada una solo podrá leer los secretos que le toquen (02).
#   - Crea la cuenta que despliega y la federa con GitHub Actions mediante
#     Workload Identity Federation (sin claves JSON de larga duración).
#
# Uso:  gcloud auth login && ./deploy/gcp/01-bootstrap.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
echo "→ Proyecto $PROJECT_ID (#$PROJECT_NUMBER), región $REGION"

echo "→ Activando APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  containerscanning.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

echo "→ Artifact Registry: $ARTIFACT_REPO"
if ! gcloud artifacts repositories describe "$ARTIFACT_REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker --location="$REGION" \
    --description="Imágenes de la plataforma BeZhas"
fi
# Conservar solo las 20 imágenes más recientes por paquete (coste y superficie).
POLITICA=$(mktemp)
cat > "$POLITICA" <<'JSON'
[
  {"name":"keep-recent","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":20}},
  {"name":"delete-old","action":{"type":"Delete"},"condition":{"olderThan":"2592000s"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies "$ARTIFACT_REPO" \
  --location="$REGION" --policy="$POLITICA" --no-dry-run >/dev/null
rm -f "$POLITICA"

# Una cuenta de servicio recién creada tarda unos segundos en ser visible para
# IAM: asignarle un rol justo después falla con «does not exist». Se reintenta
# con espera creciente en vez de abortar a mitad del bootstrap.
reintentar() {
  local intento
  for intento in 1 2 3 4 5 6; do
    "$@" && return 0
    echo "   (IAM aún no ve la cuenta; reintento $intento/6 en $((intento * 5)) s)" >&2
    sleep $((intento * 5))
  done
  "$@"
}

crear_sa() {
  local nombre="$1" descripcion="$2"
  if ! gcloud iam service-accounts describe "${nombre}@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$nombre" --display-name="$descripcion"
  fi
}

echo "→ Cuentas de servicio de ejecución"
crear_sa "$SA_BACKEND"  "BeZhas backend (Cloud Run)"
crear_sa "$SA_FRONTEND" "BeZhas frontend (Cloud Run)"
crear_sa "$SA_MCP"      "BeZhas servicios internos: aegis, ai-gateway, agent-runtime"
crear_sa "$SA_EDGE"     "BeZhas edge node (Cloud Run)"

# Todas escriben logs y métricas; nada más a nivel de proyecto.
for sa in "$SA_BACKEND" "$SA_FRONTEND" "$SA_MCP" "$SA_EDGE"; do
  for rol in roles/logging.logWriter roles/monitoring.metricWriter; do
    reintentar gcloud projects add-iam-policy-binding "$PROJECT_ID" --condition=None --quiet \
      --member="serviceAccount:${sa}@${PROJECT_ID}.iam.gserviceaccount.com" --role="$rol" >/dev/null
  done
done

echo "→ Cuenta de despliegue: $SA_DEPLOYER"
crear_sa "$SA_DEPLOYER" "BeZhas despliegue (GitHub Actions / Cloud Build)"
DEPLOYER="${SA_DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com"
for rol in roles/run.admin roles/artifactregistry.writer roles/cloudbuild.builds.editor \
           roles/logging.logWriter roles/logging.viewer roles/serviceusage.serviceUsageConsumer \
           roles/secretmanager.viewer; do
  reintentar gcloud projects add-iam-policy-binding "$PROJECT_ID" --condition=None --quiet \
    --member="serviceAccount:${DEPLOYER}" --role="$rol" >/dev/null
done
# secretmanager.viewer ve QUÉ secretos tienen versión (para decidir cuáles
# montar), pero no puede leer su contenido.

# Bucket donde `gcloud builds submit` sube el código. Acceso del despliegue
# limitado a ESTE bucket (no storage.admin sobre todo el proyecto).
BUCKET="gs://${PROJECT_ID}_cloudbuild"
gcloud storage buckets describe "$BUCKET" >/dev/null 2>&1 || \
  gcloud storage buckets create "$BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
reintentar gcloud storage buckets add-iam-policy-binding "$BUCKET" --quiet \
  --member="serviceAccount:${DEPLOYER}" --role=roles/storage.objectAdmin >/dev/null
reintentar gcloud storage buckets add-iam-policy-binding "$BUCKET" --quiet \
  --member="serviceAccount:${DEPLOYER}" --role=roles/storage.legacyBucketReader >/dev/null

# Puede "actuar como" las cuentas de ejecución (necesario para desplegar con
# --service-account), pero solo sobre esas, no sobre todo el proyecto.
for sa in "$SA_BACKEND" "$SA_FRONTEND" "$SA_MCP" "$SA_EDGE"; do
  reintentar gcloud iam service-accounts add-iam-policy-binding "${sa}@${PROJECT_ID}.iam.gserviceaccount.com" --quiet \
    --member="serviceAccount:${DEPLOYER}" --role=roles/iam.serviceAccountUser >/dev/null
done
# Cloud Build ejecuta los pasos con la cuenta de despliegue.
reintentar gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --quiet \
  --member="serviceAccount:${DEPLOYER}" --role=roles/iam.serviceAccountUser >/dev/null

echo "→ Workload Identity Federation para GitHub ($GITHUB_REPO)"
if ! gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
fi
if ! gcloud iam workload-identity-pools providers describe bezhas-repo \
      --location=global --workload-identity-pool=github >/dev/null 2>&1; then
  # La condición restringe el proveedor a ESTE repositorio: sin ella, cualquier
  # repositorio de GitHub podría pedir credenciales al pool.
  gcloud iam workload-identity-pools providers create-oidc bezhas-repo \
    --location=global --workload-identity-pool=github \
    --display-name="bez-digital-ecosystem" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
fi
reintentar gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --quiet \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GITHUB_REPO}" >/dev/null

cat <<MSG

✅ Proyecto preparado.

Secretos para GitHub (Settings → Secrets and variables → Actions):
  GCP_PROJECT_ID                  = ${PROJECT_ID}
  GCP_SERVICE_ACCOUNT             = ${DEPLOYER}
  GCP_WORKLOAD_IDENTITY_PROVIDER  = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/bezhas-repo

Siguiente paso: ./deploy/gcp/02-secrets.sh <fichero .env de producción>
MSG
