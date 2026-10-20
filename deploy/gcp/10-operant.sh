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
# Opcional:   TAG=<etiqueta>   (por defecto, el commit actual; si su imagen ya
#             existe en Artifact Registry no se reconstruye)
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
# Sin salto de línea final: un `echo` guardaba «clave\n» y la comparación contra el
# valor de la cabecera HTTP (que va recortado) nunca coincidía («puente no autorizado»).
aleatorio() { printf %s "$(openssl rand -hex 24)"; }

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
if gcloud artifacts docker images describe "$IMAGEN" >/dev/null 2>&1; then
  echo "→ La imagen ${IMAGEN##*/} ya existe: no se reconstruye (usa otra TAG para forzarlo)"
else
echo "→ Cloud Build: ${IMAGEN##*/}"
gcloud builds submit business-ops \
  --project="$PROJECT_ID" --region="$REGION" \
  --config=deploy/gcp/cloudbuild-operant.yaml \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${SA_DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --gcs-source-staging-dir="gs://${PROJECT_ID}_cloudbuild/source" \
  --substitutions="_REGION=${REGION},_ARTIFACT_REPO=${ARTIFACT_REPO},_TAG=${TAG}"
fi

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

# Correo (buzón de Hostinger): sólo si 11-operant-correo.sh ha guardado la contraseña.
# Con él OPERANT envía por SMTP (smtp.hostinger.com:465) y lee la bandeja y el DMARC
# por IMAP (imap.hostinger.com, deducido del host SMTP).
CORREO_OPERANT="${CORREO_OPERANT:-yoelceo@bezhas.com}"
EXTRA_ENV=""
if [[ -n "$(gcloud secrets versions list "${P}OPERANT_SMTP_PASS" --filter=state=ENABLED --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
  gcloud secrets add-iam-policy-binding "${P}OPERANT_SMTP_PASS" --member="serviceAccount:${SA}" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
  SECRETOS+=",SMTP_PASS=${P}OPERANT_SMTP_PASS:latest"
  EXTRA_ENV="~SMTP_HOST=smtp.hostinger.com~SMTP_PORT=465~SMTP_USER=${CORREO_OPERANT}~MAIL_FROM=BeZhas <${CORREO_OPERANT}>"
  CORREO="activado (${CORREO_OPERANT})"
else
  CORREO="simulado (falta ${P}OPERANT_SMTP_PASS: ./deploy/gcp/11-operant-correo.sh)"
fi

# Canales de atención al cliente (12-operant-canales.sh los activa guardando sus secretos):
#   Telegram: bot general + secreto del webhook. Entra por la API (api.bezhas.com/api/operant/channels/telegram).
#   Correo:   auto-respondedor de los alias de atención, SÓLO desde la fecha de activación guardada.
tiene_version() { [[ -n "$(gcloud secrets versions list "$1" --filter=state=ENABLED --limit=1 --format='value(name)' 2>/dev/null)" ]]; }
TELEGRAM_ENV="~TELEGRAM_ENABLED=false"
if tiene_version "${P}OPERANT_TELEGRAM_BOT_TOKEN" && tiene_version "${P}OPERANT_TELEGRAM_SECRET"; then
  for sec in OPERANT_TELEGRAM_BOT_TOKEN OPERANT_TELEGRAM_SECRET; do
    gcloud secrets add-iam-policy-binding "${P}${sec}" --member="serviceAccount:${SA}" \
      --role=roles/secretmanager.secretAccessor --quiet >/dev/null
  done
  SECRETOS+=",TELEGRAM_BOT_TOKEN=${P}OPERANT_TELEGRAM_BOT_TOKEN:latest,TELEGRAM_WEBHOOK_SECRET=${P}OPERANT_TELEGRAM_SECRET:latest"
  TELEGRAM_ENV="~TELEGRAM_ENABLED=true"
  TELEGRAM="activado"
else
  TELEGRAM="desactivado (falta ${P}OPERANT_TELEGRAM_BOT_TOKEN: ./deploy/gcp/12-operant-canales.sh)"
fi
AUTORESPUESTA_ENV=""
if [[ -n "$EXTRA_ENV" ]] && tiene_version "${P}OPERANT_MAIL_AUTOREPLY_SINCE"; then
  gcloud secrets add-iam-policy-binding "${P}OPERANT_MAIL_AUTOREPLY_SINCE" --member="serviceAccount:${SA}" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
  SECRETOS+=",MAIL_AUTOREPLY_SINCE=${P}OPERANT_MAIL_AUTOREPLY_SINCE:latest"
  AUTORESPUESTA_ENV="~MAIL_AUTOREPLY=true"
  AUTORESPUESTA="activa"
else
  AUTORESPUESTA="desactivada"
fi

# Motor de IA (con la GPU NVIDIA, 7B responde en ~2 s; en CPU tardaba 8-20 s y los canales dan 30 s en total).
# Por defecto Claude. Si existe una IA LOCAL publicada por túnel (scripts/ollama/), ésta
# pasa a ser la primaria y Claude el respaldo (cuando hay clave): el coste es cero y, si el túnel cae
# o Claude no tiene saldo, el cliente recibe el aviso honesto y se escala a una persona.
TIERS="~TIER_FRONTIER_PROVIDER=anthropic~TIER_FRONTIER_MODEL=claude-opus-5-5~TIER_MID_PROVIDER=anthropic~TIER_MID_MODEL=claude-sonnet-5-5~TIER_FAST_PROVIDER=anthropic~TIER_FAST_MODEL=claude-haiku-5-5"
if tiene_version "${P}OPERANT_OLLAMA_URL" && tiene_version "${P}OPERANT_OLLAMA_API_KEY"; then
  for sec in OPERANT_OLLAMA_URL OPERANT_OLLAMA_API_KEY; do
    gcloud secrets add-iam-policy-binding "${P}${sec}" --member="serviceAccount:${SA}" \
      --role=roles/secretmanager.secretAccessor --quiet >/dev/null
  done
  SECRETOS+=",OLLAMA_URL=${P}OPERANT_OLLAMA_URL:latest,OLLAMA_API_KEY=${P}OPERANT_OLLAMA_API_KEY:latest"
  TIERS="~TIER_FRONTIER_PROVIDER=ollama~TIER_FRONTIER_MODEL=${OLLAMA_MODELO_PESADO:-qwen2.5:7b}~TIER_MID_PROVIDER=ollama~TIER_MID_MODEL=${OLLAMA_MODELO_MEDIO:-qwen2.5:7b}~TIER_FAST_PROVIDER=ollama~TIER_FAST_MODEL=${OLLAMA_MODELO_LIGERO:-qwen2.5:3b}"
  if [[ "$MOTOR" == activado* ]]; then
    TIERS+="~TIER_FRONTIER_FALLBACK_PROVIDER=anthropic~TIER_FRONTIER_FALLBACK_MODEL=claude-opus-5-5~TIER_MID_FALLBACK_PROVIDER=anthropic~TIER_MID_FALLBACK_MODEL=claude-sonnet-5-5~TIER_FAST_FALLBACK_PROVIDER=anthropic~TIER_FAST_FALLBACK_MODEL=claude-haiku-5-5"
  fi
  MOTOR="IA LOCAL por túnel${MOTOR:+ (respaldo: $MOTOR)}"
fi

echo "→ Servicio ${SERVICE} (motor IA: ${MOTOR}; correo: ${CORREO}; Telegram: ${TELEGRAM}; auto-respuesta por correo: ${AUTORESPUESTA})"
gcloud run deploy "$SERVICE" \
  --image="$IMAGEN" --region="$REGION" --service-account="$SA" \
  --ingress=all --no-allow-unauthenticated \
  --port=4000 --cpu=1 --memory=1Gi --min-instances=1 --max-instances=2 \
  --no-cpu-throttling --execution-environment=gen2 \
  --network="$VPC_NETWORK" --subnet="$VPC_SUBNET" --vpc-egress=private-ranges-only \
  --labels=app=bezhas,component=operant,commit="$TAG" \
  --set-env-vars="^~^NODE_ENV=production~BEZHAS_API_URL=https://${API_HOST}~BEZHAS_TENANT_ID=bezhas${TELEGRAM_ENV}${TIERS}${EXTRA_ENV}${AUTORESPUESTA_ENV}" \
  --set-secrets="$SECRETOS" --quiet

# La API (misma cuenta de servicio) puede invocarlo; nadie más.
invocador "$SERVICE" "$SA"

echo "✅ OPERANT desplegado: $(url_run "$SERVICE")"
# Sólo hace falta redesplegar la API si aún no conoce a OPERANT (primer despliegue o clave nueva).
ENV_API=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" \
  --format='value(spec.template.spec.containers[0].env)' 2>/dev/null || true)
if [[ "$ENV_API" != *OPERANT_API_URL* || "$ENV_API" != *OPERANT_INTERNAL_KEY* ]]; then
  echo "   Ahora redespliega la API (./deploy/gcp/deploy.sh): trae OPERANT_API_URL y OPERANT_INTERNAL_KEY."
else
  echo "   La API ya apunta a OPERANT: no hace falta redesplegarla."
fi
