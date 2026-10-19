#!/usr/bin/env bash
# ============================================================================
# 13 — Cargar la documentación pública de BeZhas en la base de conocimiento de OPERANT
# ============================================================================
# Sin esto, Soporte de OPERANT no sabe nada de BEZ-Coin, de cómo comprar ni de los planes y
# contesta «no tenemos detalles» a lo más importante. Copia el corpus PÚBLICO del RAG de la API
# (api/services/knowledge/seed.js) al KB de OPERANT, igual que el botón «Sincronizar RAG» del
# panel pero sin sesión de administrador. Idempotente: OPERANT reemplaza por id (rag:<id>).
#
# Corre como Cloud Run Job con la imagen actual de la API y su cuenta de servicio (que ya puede
# invocar OPERANT). Repítelo cuando cambie la documentación.
#
# Uso:   ./deploy/gcp/13-operant-conocimiento.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
gcloud config set project "$PROJECT_ID" >/dev/null

IMAGEN=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" \
           --format='value(spec.template.spec.containers[0].image)')
[[ -n "$IMAGEN" ]] || { echo "No encuentro $BACKEND_SERVICE" >&2; exit 1; }
SA="${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com"
URL_OPERANT="$(gcloud run services describe bezhas-operant --region="$REGION" --format='value(status.url)')"

echo "→ Sincronizando el conocimiento público hacia OPERANT (imagen ${IMAGEN##*/})"
gcloud run jobs deploy bezhas-operant-kb \
  --image="$IMAGEN" --region="$REGION" --service-account="$SA" \
  --command=node --args=scripts/sync-operant-kb.js \
  --network="$VPC_NETWORK" --subnet="$VPC_SUBNET" --vpc-egress=private-ranges-only \
  --set-env-vars="NODE_ENV=production,OPERANT_API_URL=${URL_OPERANT}" \
  --set-secrets="DATABASE_URL=${SECRET_PREFIX}DATABASE_URL:latest,OPERANT_INTERNAL_KEY=${SECRET_PREFIX}OPERANT_INTERNAL_KEY:latest" \
  --max-retries=0 --task-timeout=600s --execute-now --wait --quiet
echo "→ Resultado:"
gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="bezhas-operant-kb"' \
  --limit 6 --freshness=15m --format='value(textPayload)' | grep -E "RESULT|ERR|corpus" || true
gcloud run jobs delete bezhas-operant-kb --region="$REGION" --quiet >/dev/null
echo "✅ Listo: escribe al bot «¿Qué es BEZ-Coin?»."
