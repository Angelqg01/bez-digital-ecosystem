#!/usr/bin/env bash
# ============================================================================
# 11 — Conectar el buzón de Hostinger (yoelceo@bezhas.com) a OPERANT en Cloud Run
# ============================================================================
# Pide la contraseña del buzón SIN eco (no queda en el historial, en pantalla ni
# en ningún fichero), la guarda en Secret Manager (BC_OPERANT_SMTP_PASS) y
# redespliega bezhas-operant con SMTP_HOST/SMTP_USER y ese secreto. Con eso
# OPERANT envía por SMTP y lee la bandeja y el DMARC por IMAP.
#
# La contraseña la escribes TÚ: nadie más debe verla (ni un asistente de IA).
#
# Uso:        ./deploy/gcp/11-operant-correo.sh
# Otra cuenta: CORREO_OPERANT=otra@bezhas.com ./deploy/gcp/11-operant-correo.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
gcloud config set project "$PROJECT_ID" >/dev/null

CORREO="${CORREO_OPERANT:-yoelceo@bezhas.com}"
SECRETO="${SECRET_PREFIX}OPERANT_SMTP_PASS"

printf 'Contraseña del buzón %s (no se mostrará): ' "$CORREO" >&2
read -rs PASS; echo >&2
[[ -n "$PASS" ]] || { echo "Contraseña vacía: no se cambia nada." >&2; exit 1; }

# Sin salto de línea final: la contraseña es exactamente lo que escribiste.
if gcloud secrets describe "$SECRETO" >/dev/null 2>&1; then
  printf %s "$PASS" | gcloud secrets versions add "$SECRETO" --data-file=- >/dev/null
else
  printf %s "$PASS" | gcloud secrets create "$SECRETO" --replication-policy=automatic --data-file=- >/dev/null
fi
unset PASS
echo "→ Contraseña guardada en Secret Manager (${SECRETO})."

# Redespliega OPERANT con la misma imagen que ya está en marcha (no reconstruye).
TAG_ACTUAL=$(gcloud run services describe bezhas-operant --region="$REGION" \
  --format='value(metadata.labels.commit)')
[[ -n "$TAG_ACTUAL" ]] || { echo "No encuentro bezhas-operant: ejecuta antes 10-operant.sh" >&2; exit 1; }
CORREO_OPERANT="$CORREO" TAG="$TAG_ACTUAL" ./10-operant.sh

echo "✅ Listo. Comprueba: curl -s https://api.bezhas.com/api/operant/health  (email.mode debe ser smtp)"
