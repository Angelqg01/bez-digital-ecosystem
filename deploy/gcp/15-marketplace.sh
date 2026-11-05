#!/usr/bin/env bash
# ============================================================================
# 15 — API Marketplace en producción (docs/developer/MARKETPLACE_PRODUCCION.md)
# ============================================================================
# Subcomandos:
#
#   info          Lo PÚBLICO de las claves del marketplace del .env: direcciones
#                 de las wallets de anclaje y de alta (para fondearlas con POL y
#                 darles rol en los contratos), huella de la clave de recibos y
#                 certificado de cliente mTLS (para los proveedores). Nunca
#                 imprime una clave privada.
#   job           Despliega el Cloud Run Job `bezhas-marketplace-anchor` con la
#                 imagen actual de la api y lo programa cada hora con Cloud
#                 Scheduler. Requiere que deploy.sh ya haya subido una imagen
#                 con scripts/marketplace-anchor.js.
#   anclar        Ejecuta el job una vez y espera.
#   proxy on|off  Abre o cierra el proxy (MARKETPLACE_PROXY_ENABLED) en bezhas-api.
#
# Uso:  ./deploy/gcp/15-marketplace.sh info [fichero .env]
#       ./deploy/gcp/15-marketplace.sh job
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env

JOB=bezhas-marketplace-anchor
CRON=bezhas-marketplace-anchor-hourly
F="${2:-$HOME/bezhas-blockchain.env}"
valor() { grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$F" 2>/dev/null | tail -n1 | cut -d= -f2-; }

direccion_de() {  # imprime la dirección de una clave privada sin sacarla por argumentos
  local api=../../api
  if [[ -d "$api/node_modules/ethers" ]]; then
    CLAVE="$1" node -e 'const {Wallet}=require(process.argv[1]);process.stdout.write(new Wallet(process.env.CLAVE).address)' \
      "$(cd "$api" && pwd)/node_modules/ethers"
  elif command -v cast >/dev/null; then
    CLAVE="$1" bash -c 'cast wallet address --private-key "$CLAVE"'
  else
    echo "(instala las dependencias de api/ o Foundry para ver la dirección)"
  fi
}

case "${1:-}" in
  info)
    [[ -f "$F" ]] || { echo "No existe $F: ejecuta 00-generar-env.sh" >&2; exit 1; }
    for k in MARKETPLACE_ANCHOR_KEY MARKETPLACE_REGISTRAR_KEY; do
      v=$(valor "$k")
      if [[ -n "$v" ]]; then echo "$k → $(direccion_de "$v")"; else echo "$k → (vacía)"; fi
    done
    echo "  · Fondéalas con POL (gas) y NADA más. Anclaje: OPERATOR_ROLE en TelemetryAnchor (ANCHOR_OPERATOR)."
    echo "  · Alta de listings: REGISTRAR_ROLE en MarketplaceSettlement (MKT_REGISTRAR)."
    pub=$(valor MARKETPLACE_RECEIPT_PUBLIC_KEY)
    [[ -n "$pub" ]] && echo "Recibos (ES256), sha256 de la clave pública: $(printf '%s' "$pub" | base64 -d | openssl pkey -pubin -outform DER 2>/dev/null | openssl dgst -sha256 -r | cut -d' ' -f1)"
    crt=$(valor MARKETPLACE_MTLS_CERT)
    if [[ -n "$crt" ]]; then
      echo "Certificado de cliente mTLS (para los proveedores con listings de escritura):"
      printf '%s' "$crt" | base64 -d | openssl x509 -noout -subject -enddate -fingerprint -sha256
      printf '%s' "$crt" | base64 -d
    fi
    ;;

  job)
    gcloud config set project "$PROJECT_ID" >/dev/null
    IMAGEN=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" \
               --format='value(spec.template.spec.containers[0].image)')
    [[ -n "$IMAGEN" ]] || { echo "No encuentro $BACKEND_SERVICE: ejecuta antes deploy.sh" >&2; exit 1; }

    # Sólo se montan los secretos que tienen versión: uno vacío haría fallar el job.
    SECRETOS="DATABASE_URL=${SECRET_PREFIX}DATABASE_URL:latest"
    for k in POLYGON_RPC_URL MARKETPLACE_ANCHOR_KEY BEZHAS_L2_RPC_URL; do
      if [[ -n "$(gcloud secrets versions list "${SECRET_PREFIX}$k" --filter=state=ENABLED --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
        SECRETOS+=",$k=${SECRET_PREFIX}$k:latest"
      elif [[ "$k" != BEZHAS_L2_RPC_URL ]]; then
        echo "⚠️  ${SECRET_PREFIX}$k no tiene versión: el job cerrará lotes pero no anclará." >&2
      fi
    done

    echo "→ Job $JOB (imagen ${IMAGEN##*/})"
    gcloud run jobs deploy "$JOB" \
      --image="$IMAGEN" --region="$REGION" \
      --service-account="${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" \
      --command=node --args=scripts/marketplace-anchor.js \
      --network="$VPC_NETWORK" --subnet="$VPC_SUBNET" --vpc-egress=private-ranges-only \
      --set-env-vars=NODE_ENV=production \
      --set-secrets="$SECRETOS" \
      --max-retries=0 --task-timeout=900s \
      --labels=app=bezhas,component=marketplace-anchor \
      --quiet

    gcloud services enable cloudscheduler.googleapis.com --quiet
    gcloud run jobs add-iam-policy-binding "$JOB" --region="$REGION" \
      --member="serviceAccount:${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" \
      --role=roles/run.invoker --quiet >/dev/null
    URI="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB}:run"
    if gcloud scheduler jobs describe "$CRON" --location="$REGION" >/dev/null 2>&1; then
      gcloud scheduler jobs update http "$CRON" --location="$REGION" --schedule="7 * * * *" --uri="$URI" \
        --http-method=POST --oauth-service-account-email="${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" --quiet
    else
      gcloud scheduler jobs create http "$CRON" --location="$REGION" --schedule="7 * * * *" --uri="$URI" \
        --http-method=POST --time-zone="Europe/Madrid" \
        --oauth-service-account-email="${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" --quiet
    fi
    echo "✅ $JOB programado cada hora (minuto 7). Primera pasada a mano: $0 anclar"
    ;;

  anclar)
    gcloud config set project "$PROJECT_ID" >/dev/null
    gcloud run jobs execute "$JOB" --region="$REGION" --wait \
      || { gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=$JOB" \
             --limit=10 --freshness=15m --format='value(textPayload)' >&2; exit 1; }
    gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=$JOB AND textPayload:\"[MARKETPLACE-ANCHOR]\"" \
      --limit=3 --freshness=15m --format='value(textPayload)'
    ;;

  proxy)
    estado="${2:-}"
    [[ "$estado" == on || "$estado" == off ]] || { echo "Uso: $0 proxy on|off" >&2; exit 1; }
    gcloud config set project "$PROJECT_ID" >/dev/null
    v=false; [[ "$estado" == on ]] && v=true
    gcloud run services update "$BACKEND_SERVICE" --region="$REGION" \
      --update-env-vars="MARKETPLACE_PROXY_ENABLED=$v" --quiet
    echo "✅ Proxy del marketplace: $estado"
    ;;

  *)
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
