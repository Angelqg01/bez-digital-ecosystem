#!/usr/bin/env bash
# ============================================================================
# 08 — Aplicar el usuario/contraseña del admin de Secret Manager a la base
# ============================================================================
# El login del panel lee las credenciales de la tabla `admin_credentials`;
# ADMIN_USERNAME / ADMIN_PASSWORD_HASH solo la siembran la PRIMERA vez. Si se
# cambian después (00-generar-env.sh + 02-secrets.sh), la api los ignora hasta
# ejecutar esto.
#
# Lanza un Cloud Run Job con la imagen actual de la api, dentro de la VPC
# (Cloud SQL no tiene IP pública), que ejecuta scripts/sync-admin-from-env.js.
# No toca el 2FA. No se imprime ningún secreto.
#
# Uso (tras 02-secrets.sh con las credenciales nuevas):
#   ./deploy/gcp/08-reset-admin.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
gcloud config set project "$PROJECT_ID" >/dev/null

IMAGEN=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" \
           --format='value(spec.template.spec.containers[0].image)')
[[ -n "$IMAGEN" ]] || { echo "No encuentro $BACKEND_SERVICE: ejecuta antes deploy.sh" >&2; exit 1; }

echo "→ Aplicando las credenciales de ${SECRET_PREFIX}ADMIN_* a la base (imagen ${IMAGEN##*/})"
gcloud run jobs deploy bezhas-admin-sync \
  --image="$IMAGEN" --region="$REGION" \
  --service-account="${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --command=node --args=scripts/sync-admin-from-env.js \
  --network="$VPC_NETWORK" --subnet="$VPC_SUBNET" --vpc-egress=private-ranges-only \
  --set-env-vars=NODE_ENV=production \
  --set-secrets="DATABASE_URL=${SECRET_PREFIX}DATABASE_URL:latest,ADMIN_USERNAME=${SECRET_PREFIX}ADMIN_USERNAME:latest,ADMIN_PASSWORD_HASH=${SECRET_PREFIX}ADMIN_PASSWORD_HASH:latest" \
  --max-retries=0 --task-timeout=300s \
  --labels=app=bezhas,component=admin-sync \
  --execute-now --wait --quiet \
  || {
    echo "❌ El job falló. Detalle:" >&2
    gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=bezhas-admin-sync" \
      --limit=10 --freshness=15m --format='value(textPayload)' >&2
    echo "   Si dice «Cannot find module …sync-admin-from-env.js», la imagen es anterior a este" >&2
    echo "   script: ejecuta ./deploy/gcp/deploy.sh y repite." >&2
    exit 1
  }

gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=bezhas-admin-sync AND textPayload:\"[ADMIN]\"" \
  --limit=1 --freshness=15m --format='value(textPayload)'
echo "✅ Listo: entra en https://${WWW_HOST}/admin/login con el usuario nuevo."
