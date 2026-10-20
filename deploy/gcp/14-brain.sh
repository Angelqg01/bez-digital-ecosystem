#!/usr/bin/env bash
# ============================================================================
# 14 — Desplegar el Brain (obsidian-mcp/) en Cloud Run
# ============================================================================
# Hasta ahora el Brain sólo existía en el docker compose local: en producción la
# pestaña Brain Live salía «offline» y la telemetría que la API manda en cada
# petición (api/services/brainTelemetry.js) se perdía. Esto lo despliega como un
# servicio PRIVADO, con dos cerrojos:
#   - Cloud Run `--no-allow-unauthenticated`: sólo la API y el panel, con un ID
#     token de su cuenta de servicio, pueden llamarlo.
#   - BRAIN_API_KEY (Secret Manager): el propio Brain la exige en todo salvo
#     /health y no arranca en producción sin ella.
#
#   1. Clave del Brain en Secret Manager. Se genera AQUÍ, una vez; nunca se imprime.
#   2. Bucket privado para el vault, montado en /vault. El disco de Cloud Run es
#      efímero: sin él, cada nota, episodio y la telemetría acumulada se perderían
#      en el siguiente reinicio. La primera vez se siembra con docs/obsidian-vault;
#      después NO se sobrescribe (el Brain escribe en él). SYNC_VAULT=1 sube los
#      cambios del repositorio sin borrar nada del bucket.
#   3. Imagen (Cloud Build) → servicio (una sola instancia: el fichero de
#      telemetría tiene un único escritor).
#   4. run.invoker para la API y el panel; nadie más.
#
# Idempotente: se puede relanzar para desplegar una versión nueva.
#
# Uso:        ./deploy/gcp/14-brain.sh
# Opcional:   TAG=<etiqueta>  SYNC_VAULT=1
#
# Después hay que redesplegar la API y el panel (./deploy/gcp/deploy.sh): así
# montan BRAIN_API_KEY y reciben la URL del Brain (OBSIDIAN_MCP_URL / BRAIN_URL).
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
source ./cloudrun-lib.sh
cd ../..

export PROJECT_ID REGION
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
export PROJECT_NUMBER
TAG="${TAG:-$(git rev-parse --short=12 HEAD)}"
SERVICE="bezhas-brain"
SA="${SA_MCP}@${PROJECT_ID}.iam.gserviceaccount.com"
SA_API="${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com"
SA_WEB="${SA_FRONTEND}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGEN="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/bezhas-brain:${TAG}"
BUCKET="${BRAIN_VAULT_BUCKET:-${PROJECT_ID}-brain-vault}"
SECRETO="${SECRET_PREFIX}BRAIN_API_KEY"

tiene_version() { [[ -n "$(gcloud secrets versions list "$1" --filter=state=ENABLED --limit=1 --format='value(name)' 2>/dev/null)" ]]; }
acceso_secreto() {
  gcloud secrets add-iam-policy-binding "$SECRETO" --member="serviceAccount:$1" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
}

# ── 1. Clave del Brain ──────────────────────────────────────────────────────
gcloud secrets describe "$SECRETO" >/dev/null 2>&1 \
  || gcloud secrets create "$SECRETO" --replication-policy=automatic \
       --labels=app=bezhas,platform=blockchain >/dev/null
if ! tiene_version "$SECRETO"; then
  echo "→ Generando la clave del Brain"
  # Sin salto de línea: la cabecera HTTP llega recortada y no coincidiría.
  printf %s "$(openssl rand -hex 32)" | gcloud secrets versions add "$SECRETO" --data-file=- >/dev/null
fi
# El Brain la exige; la API y el panel la envían.
for cuenta in "$SA" "$SA_API" "$SA_WEB"; do acceso_secreto "$cuenta"; done

# ── 2. Vault persistente ────────────────────────────────────────────────────
if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "→ Bucket privado gs://${BUCKET}"
  gcloud storage buckets create "gs://${BUCKET}" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention >/dev/null
fi
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA}" --role=roles/storage.objectUser --quiet >/dev/null

if [[ -z "$(gcloud storage ls "gs://${BUCKET}/" 2>/dev/null | head -1)" ]]; then
  echo "→ Sembrando el vault desde docs/obsidian-vault"
  gcloud storage rsync docs/obsidian-vault "gs://${BUCKET}" --recursive --exclude='^\.obsidian/workspace.*' >/dev/null
elif [[ "${SYNC_VAULT:-0}" == 1 ]]; then
  echo "→ Subiendo los cambios del vault del repositorio (sin borrar nada del bucket)"
  gcloud storage rsync docs/obsidian-vault "gs://${BUCKET}" --recursive --exclude='^\.obsidian/workspace.*' >/dev/null
else
  echo "→ El vault ya existe en el bucket: no se toca (SYNC_VAULT=1 para subir el del repositorio)"
fi

# ── 3. Imagen ───────────────────────────────────────────────────────────────
if gcloud artifacts docker images describe "$IMAGEN" >/dev/null 2>&1; then
  echo "→ La imagen ${IMAGEN##*/} ya existe: no se reconstruye (usa otra TAG para forzarlo)"
else
  echo "→ Cloud Build: ${IMAGEN##*/}"
  gcloud builds submit obsidian-mcp \
    --project="$PROJECT_ID" --region="$REGION" \
    --config=deploy/gcp/cloudbuild-brain.yaml \
    --service-account="projects/${PROJECT_ID}/serviceAccounts/${SA_DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --gcs-source-staging-dir="gs://${PROJECT_ID}_cloudbuild/source" \
    --substitutions="_REGION=${REGION},_ARTIFACT_REPO=${ARTIFACT_REPO},_TAG=${TAG}"
fi

# ── 4. Servicio ─────────────────────────────────────────────────────────────
# Sin Ollama en Cloud Run la búsqueda semántica cae a la de términos (lo dice
# /health); el autopilot sigue consolidando episodios cada 24 h.
echo "→ Servicio ${SERVICE}"
gcloud run deploy "$SERVICE" \
  --image="$IMAGEN" --region="$REGION" --service-account="$SA" \
  --ingress=all --no-allow-unauthenticated \
  --port=4007 --cpu=1 --memory=512Mi --min-instances=1 --max-instances=1 \
  --execution-environment=gen2 \
  --add-volume="name=vault,type=cloud-storage,bucket=${BUCKET}" \
  --add-volume-mount="volume=vault,mount-path=/vault" \
  --labels=app=bezhas,component=brain,commit="$TAG" \
  --set-env-vars="^~^NODE_ENV=production~OBSIDIAN_VAULT_PATH=/vault~OLLAMA_HOST=http://127.0.0.1:1" \
  --set-secrets="BRAIN_API_KEY=${SECRETO}:latest" --quiet

# La API (telemetría, /monitor) y el panel (proxy /api/brain) pueden invocarlo; nadie más.
invocador "$SERVICE" "$SA_API"
invocador "$SERVICE" "$SA_WEB"

echo "✅ Brain desplegado: $(url_run "$SERVICE")"
echo "   Ahora redespliega la API y el panel (./deploy/gcp/deploy.sh): montan BRAIN_API_KEY y la URL del Brain."
