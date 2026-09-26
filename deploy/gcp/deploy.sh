#!/usr/bin/env bash
# ============================================================================
# Construir y desplegar BeZhas Blockchain con Cloud Build.
# ============================================================================
# Uso (desde cualquier sitio):  ./deploy/gcp/deploy.sh
#
# Variables opcionales:
#   TAG                 etiqueta de las imágenes (por defecto, el commit actual)
#   ADMIN_WALLET        dirección 0x del administrador (login por wallet)
#   GA_MEASUREMENT_ID   Google Analytics
#   PUBLIC_RPC_URL, CHAIN_ID, BEZ_TOKEN   red que ve el navegador (por defecto,
#                       Polygon mainnet y el BEZ de Polygon)
# Todas son PÚBLICAS: Next.js las incrusta en el JavaScript del navegador.
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
cd ../..

if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  Hay cambios sin commitear; la imagen no corresponderá a ningún commit." >&2
fi
TAG="${TAG:-$(git rev-parse --short=12 HEAD)}"

# ── Comprobación previa: secretos obligatorios ─────────────────────────────
# Sin ellos los contenedores no arrancan (la api y el ai-gateway se cierran
# al ver que falta JWT_SECRET o INTERNAL_API_KEY) y el balanceador da 404/503.
# Pasa cuando 02-secrets.sh rechazó el .env y no subió nada: mejor pararse
# aquí, en segundos, que tras 20 minutos de build.
echo "→ Comprobando secretos obligatorios en Secret Manager (${SECRET_PREFIX}*)"
faltan=()
while read -r clave _ requisito _; do
  [[ -z "${clave:-}" || "$clave" == \#* || "$requisito" != obligatorio ]] && continue
  if [[ -z "$(gcloud secrets versions list "${SECRET_PREFIX}${clave}" --project="$PROJECT_ID" \
               --filter=state=ENABLED --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
    faltan+=("$clave")
  fi
done < deploy/gcp/secrets.list
if ((${#faltan[@]})); then
  echo "❌ Faltan secretos obligatorios (sin versión en Secret Manager):" >&2
  printf '   - %s\n' "${faltan[@]}" >&2
  echo "   Ejecuta ./deploy/gcp/00-generar-env.sh y ./deploy/gcp/02-secrets.sh ~/bezhas-blockchain.env" >&2
  echo "   (si 02 muestra errores de validación, corrígelos en el .env: no sube nada hasta que pasa)." >&2
  exit 1
fi

# Comas dentro de un valor: gcloud usa ^~^ para cambiar el separador.
SUBS="^~^_REGION=${REGION}~_ARTIFACT_REPO=${ARTIFACT_REPO}~_TAG=${TAG}"
SUBS+="~_WWW_URL=https://${WWW_HOST}~_API_URL=https://${API_HOST}~_MCP_HOST=${MCP_HOST}"
SUBS+="~_CORS_ORIGINS=https://${WWW_HOST},https://${DOMAIN}"
SUBS+="~_SECRET_PREFIX=${SECRET_PREFIX}"
SUBS+="~_SA_BACKEND=${SA_BACKEND}~_SA_FRONTEND=${SA_FRONTEND}~_SA_MCP=${SA_MCP}~_SA_EDGE=${SA_EDGE}"
SUBS+="~_VPC_NETWORK=${VPC_NETWORK}~_VPC_SUBNET=${VPC_SUBNET}"
[[ -n "${ADMIN_WALLET:-}" ]]      && SUBS+="~_ADMIN_WALLET=${ADMIN_WALLET}"
[[ -n "${GA_MEASUREMENT_ID:-}" ]] && SUBS+="~_GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID}"
[[ -n "${PUBLIC_RPC_URL:-}" ]]    && SUBS+="~_PUBLIC_RPC_URL=${PUBLIC_RPC_URL}"
[[ -n "${CHAIN_ID:-}" ]]          && SUBS+="~_CHAIN_ID=${CHAIN_ID}"
[[ -n "${BEZ_TOKEN:-}" ]]         && SUBS+="~_BEZ_TOKEN=${BEZ_TOKEN}"
[[ -n "${INGRESS:-}" ]]           && SUBS+="~_INGRESS=${INGRESS}"

echo "→ Cloud Build: $PROJECT_ID, tag $TAG (sube solo lo que permite .gcloudignore)"
gcloud builds submit . \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --config=deploy/gcp/cloudbuild.yaml \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${SA_DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --gcs-source-staging-dir="gs://${PROJECT_ID}_cloudbuild/source" \
  --substitutions="$SUBS"

echo "✅ Desplegado $TAG."
echo "   Si es el primer despliegue de esta plataforma: ./deploy/gcp/03-load-balancer.sh"
echo "   Comprobar: ./deploy/gcp/05-verify.sh"
