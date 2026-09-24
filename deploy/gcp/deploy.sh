#!/usr/bin/env bash
# ============================================================================
# Construir y desplegar los tres servicios con Cloud Build.
# ============================================================================
# Uso (desde cualquier sitio):  ./deploy/gcp/deploy.sh
# Variables opcionales: TAG (por defecto el commit actual), y las públicas del
# frontend que quieras fijar: GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID,
# WALLET_CONNECT_PROJECT_ID, STRIPE_PUBLIC_KEY (son públicas, van al navegador).
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
cd ../..

if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  Hay cambios sin commitear; la imagen no corresponderá a ningún commit." >&2
fi
TAG="${TAG:-$(git rev-parse --short=12 HEAD)}"

SUBS="_REGION=${REGION},_ARTIFACT_REPO=${ARTIFACT_REPO},_TAG=${TAG}"
SUBS+=",_WWW_URL=https://${WWW_HOST},_API_URL=https://${API_HOST},_WS_URL=wss://${API_HOST},_MCP_URL=https://${MCP_HOST}"
SUBS+=",_SA_BACKEND=${SA_BACKEND},_SA_FRONTEND=${SA_FRONTEND},_SA_MCP=${SA_MCP}"
SUBS+=",_VPC_NETWORK=${VPC_NETWORK},_VPC_SUBNET=${VPC_SUBNET}"
[[ -n "${GOOGLE_CLIENT_ID:-}" ]]          && SUBS+=",_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
[[ -n "${GITHUB_CLIENT_ID:-}" ]]          && SUBS+=",_GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}"
[[ -n "${WALLET_CONNECT_PROJECT_ID:-}" ]] && SUBS+=",_WALLET_CONNECT_PROJECT_ID=${WALLET_CONNECT_PROJECT_ID}"
[[ -n "${STRIPE_PUBLIC_KEY:-}" ]]         && SUBS+=",_STRIPE_PUBLIC_KEY=${STRIPE_PUBLIC_KEY}"
[[ -n "${INGRESS:-}" ]]                   && SUBS+=",_INGRESS=${INGRESS}"

echo "→ Cloud Build: $PROJECT_ID, tag $TAG"
gcloud builds submit . \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --config=deploy/gcp/cloudbuild.yaml \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${SA_DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --gcs-source-staging-dir="gs://${PROJECT_ID}_cloudbuild/source" \
  --substitutions="$SUBS"

echo "✅ Desplegado $TAG. Si es el primer despliegue: ./deploy/gcp/03-load-balancer.sh"
