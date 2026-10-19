#!/usr/bin/env bash
# ============================================================================
# 10 — Desplegar OPERANT (business-ops/) en Cloud Run
# ============================================================================
# Hasta ahora OPERANT sólo existía en el docker compose local, así que el panel
# de producción buscaba http://localhost:3010 y no encontraba nada. Esto lo
# despliega como un servicio PRIVADO más (`--no-allow-unauthenticated`, igual que
# aegis o el ai-gateway) y deja la API apuntando a él.
#
#   1. Base de datos `operant` en la instancia Cloud SQL de la plataforma (IP
#      privada, extensión pgvector) con dos roles, como en el compose: el
#      DUEÑO (migraciones; crea operant_app y la RLS) y operant_app (el servidor;
#      sin ser superusuario, para que la RLS aísle a los tenants).
#   2. Secretos en Secret Manager. Las contraseñas y la clave interna se generan
#      AQUÍ y sólo viven ahí: ni se imprimen ni pasan por ningún fichero.
#   3. Imagen (Cloud Build) → job de migraciones → servicio.
#   4. run.invoker para la cuenta de servicio de la API, que llama a OPERANT con
#      un ID token (api/services/operantBridge.js).
#
# Idempotente: se puede relanzar para desplegar una versión nueva.
#
# Uso:        ./deploy/gcp/10-operant.sh
# Opcional:   TAG=<etiqueta>   (por defecto, el commit actual)
#
# MOTOR IA: sin BC_ANTHROPIC_API_KEY el servicio arranca en modo SIMULADO y lo
# dice en /healthz (Ollama no es práctico en Cloud Run). Para activarlo:
#     printf %s "<clave>" | gcloud secrets create BC_ANTHROPIC_API_KEY --data-file=-
#     (o `versions add` si ya existe) y relanzar este script.
# TELEGRAM queda desactivado aquí: los mismos bots no pueden hacer polling desde
# dos sitios a la vez, y hoy los atiende la instancia local.
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
SQL_INSTANCE="${SQL_INSTANCE:-bezhas-pg}"
DB_NAME="operant"
SERVICE="bezhas-operant"
SA="${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGEN="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/bezhas-operant:${TAG}"
P="${SECRET_PREFIX}"

existe_secreto() { gcloud secrets describe "$1" >/dev/null 2>&1; }
# guardar_secreto <nombre>  (valor por stdin): crea o añade versión; no imprime nada.
guardar_secreto() {
  if existe_secreto "$1"; then gcloud secrets versions add "$1" --data-file=- >/dev/null
  else gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null; fi
  gcloud secrets add-iam-policy-binding "$1" --member="serviceAccount:${SA}" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
}
aleatorio() { openssl rand -hex 24; }

# ── 1. Base de datos y roles ────────────────────────────────────────────────
echo "→ Base de datos '${DB_NAME}' en ${SQL_INSTANCE}"
gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1 \
  || gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null

IP_PRIVADA=$(gcloud sql instances describe "$SQL_INSTANCE" --format=json \
  | python3 -c "import sys,json;print(next((a['ipAddress'] for a in json.load(sys.stdin)['ipAddresses'] if a['type']=='PRIVATE'),''))")
[[ -n "$IP_PRIVADA" ]] || { echo "La instancia $SQL_INSTANCE no tiene IP privada." >&2; exit 1; }

if ! existe_secreto "${P}OPERANT_OWNER_DATABASE_URL"; then
  echo "→ Creando el rol dueño 'operant' y los secretos de conexión"
  PASS_OWNER=$(aleatorio); PASS_APP=$(aleatorio)
  gcloud sql users create operant --instance="$SQL_INSTANCE" --password="$PASS_OWNER" >/dev/null
  printf 'postgresql://operant:%s@%s:5432/%s' "$PASS_OWNER" "$IP_PRIVADA" "$DB_NAME" | guardar_secreto "${P}OPERANT_OWNER_DATABASE_URL"
  printf 'postgresql://operant_app:%s@%s:5432/%s' "$PASS_APP" "$IP_PRIVADA" "$DB_NAME" | guardar_secreto "${P}OPERANT_DATABASE_URL"
  printf %s "$PASS_APP" | guardar_secreto "${P}OPERANT_PG_APP_PASSWORD"
  unset PASS_OWNER PASS_APP
fi
if ! existe_secreto "${P}OPERANT_INTERNAL_KEY"; then
  echo "→ Generando la clave interna API ↔ OPERANT"
  aleatorio | guardar_secreto "${P}OPERANT_INTERNAL_KEY"
fi
# Secreto de plataforma que OPERANT reutiliza: sólo se le da acceso.
gcloud secrets add-iam-policy-binding "${P}JWT_SECRET" --member="serviceAccount:${SA}" \
  --role=roles/secretmanager.secretAccessor --quiet >/dev/null

# ── 2. Imagen ───────────────────────────────────────────────────────────────
echo "→ Cloud Build: ${IMAGEN##*/}"
gcloud builds submit business-ops \
  --project="$PROJECT_ID" --region="$REGION" \
  --config=deploy/gcp/cloudbuild-operant.yaml \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${SA_DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --gcs-source-staging-dir="gs://${PROJECT_ID}_cloudbuild/source" \
  --substitutions="_REGION=${REGION},_ARTIFACT_REPO=${ARTIFACT_REPO},_TAG=${TAG}"

# ── 3. Migraciones (rol dueño; crean operant_app, RLS y pgvector) ───────────
echo "→ Migraciones de OPERANT"
gcloud run jobs deploy bezhas-operant-migrate \
  --image="$IMAGEN" --region="$REGION" --service-account="$SA" \
  --command=sh --args="-c,DATABASE_URL=\"\$OWNER_DATABASE_URL\" node src/db/migrate.js" \
  --network="$VPC_NETWORK" --subnet="$VPC_SUBNET" --vpc-egress=private-ranges-only \
  --set-env-vars=NODE_ENV=production \
  --set-secrets="OWNER_DATABASE_URL=${P}OPERANT_OWNER_DATABASE_URL:latest,PG_APP_PASSWORD=${P}OPERANT_PG_APP_PASSWORD:latest" \
  --max-retries=0 --task-timeout=900s \
  --labels=app=bezhas,component=operant-migrate,commit="$TAG" \
  --execute-now --wait --quiet

# ── 4. Servicio ─────────────────────────────────────────────────────────────
SECRETOS="DATABASE_URL=${P}OPERANT_DATABASE_URL:latest,JWT_SECRET=${P}JWT_SECRET:latest,INTERNAL_API_KEY=${P}OPERANT_INTERNAL_KEY:latest"
if [[ -n "$(gcloud secrets versions list "${P}ANTHROPIC_API_KEY" --filter=state=ENABLED --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
  gcloud secrets add-iam-policy-binding "${P}ANTHROPIC_API_KEY" --member="serviceAccount:${SA}" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
  SECRETOS+=",ANTHROPIC_API_KEY=${P}ANTHROPIC_API_KEY:latest"
  MOTOR="activado (Claude)"
else
  MOTOR="SIMULADO (falta ${P}ANTHROPIC_API_KEY)"
fi

echo "→ Servicio ${SERVICE} (motor IA: ${MOTOR})"
gcloud run deploy "$SERVICE" \
  --image="$IMAGEN" --region="$REGION" --service-account="$SA" \
  --ingress=all --no-allow-unauthenticated \
  --port=4000 --cpu=1 --memory=1Gi --min-instances=1 --max-instances=2 \
  --no-cpu-throttling --execution-environment=gen2 \
  --network="$VPC_NETWORK" --subnet="$VPC_SUBNET" --vpc-egress=private-ranges-only \
  --labels=app=bezhas,component=operant,commit="$TAG" \
  --set-env-vars="^~^NODE_ENV=production~PORT=4000~BEZHAS_API_URL=https://${API_HOST}~BEZHAS_TENANT_ID=bezhas~TELEGRAM_ENABLED=false~TIER_FRONTIER_PROVIDER=anthropic~TIER_FRONTIER_MODEL=claude-opus-5-5~TIER_MID_PROVIDER=anthropic~TIER_MID_MODEL=claude-sonnet-5-5~TIER_FAST_PROVIDER=anthropic~TIER_FAST_MODEL=claude-haiku-5-5" \
  --set-secrets="$SECRETOS" --quiet

# La API (misma cuenta de servicio) puede invocarlo; nadie más.
invocador "$SERVICE" "$SA"

echo "✅ OPERANT desplegado: $(url_run "$SERVICE")"
echo "   Ahora redespliega la API (./deploy/gcp/deploy.sh): trae OPERANT_API_URL y OPERANT_INTERNAL_KEY."
