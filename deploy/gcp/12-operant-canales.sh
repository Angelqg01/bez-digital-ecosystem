#!/usr/bin/env bash
# ============================================================================
# 12 — Activar los canales de atención de OPERANT en Cloud Run: Telegram y correo
# ============================================================================
# A partir de aquí OPERANT atiende por sí solo lo que entra por:
#   · Telegram  → el bot general (webhook público en la API, que reenvía a OPERANT)
#   · Correo    → support@, ventas@, facturacion@, marketing@, infrastructure@
# y, junto con el chat/RAG, convierte esos mensajes en altas de perfil (enlace de registro),
# suscripción a planes (enlace; paga la persona) y newsletter (doble confirmación).
#
# ANTES: despliega la API (./deploy/gcp/deploy.sh) y OPERANT (./deploy/gcp/10-operant.sh): la
# API tiene que tener ya la ruta del webhook antes de que Telegram empiece a llamarla.
#
# Qué hace, preguntando antes de cada paso que cambia algo:
#   1. Guarda el token del bot (BC_OPERANT_TELEGRAM_BOT_TOKEN) y un secreto de webhook nuevo
#      (BC_OPERANT_TELEGRAM_SECRET) en Secret Manager. El token se lee de .env (TELEGRAM_BOT_TOKEN)
#      o se pide SIN ECO; no se imprime ni se guarda en ningún fichero.
#   2. Registra el webhook en Telegram (setWebhook) hacia https://api.bezhas.com/api/operant/channels/telegram.
#      ⚠ Un bot sólo puede tener UN webhook, y no convive con getUpdates: desde ese momento la
#      instancia local de OPERANT deja de recibir los mensajes de ESE bot. Apaga allí
#      TELEGRAM_ENABLED o quita el token del bot general para que no compitan.
#   3. Guarda la fecha de activación del auto-respondedor de correo (BC_OPERANT_MAIL_AUTOREPLY_SINCE).
#      Sólo se contestará el correo llegado desde AHORA: el histórico no se toca.
#   4. Redespliega bezhas-operant con todo ello (10-operant.sh, sin reconstruir la imagen).
#
# Uso:   ./deploy/gcp/12-operant-canales.sh            (todo)
#        ./deploy/gcp/12-operant-canales.sh telegram   (sólo Telegram)
#        ./deploy/gcp/12-operant-canales.sh correo     (sólo el auto-respondedor de correo)
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
gcloud config set project "$PROJECT_ID" >/dev/null
RAIZ="$(cd ../.. && pwd)"
P="${SECRET_PREFIX}"
QUE="${1:-todo}"

confirmar() { local r; read -r -p "$1 [s/N] " r; [[ "$r" =~ ^[sSyY]$ ]]; }
existe_secreto() { gcloud secrets describe "$1" >/dev/null 2>&1; }
guardar() {  # guardar <secreto>  (valor por stdin, sin salto de línea)
  if existe_secreto "$1"; then gcloud secrets versions add "$1" --data-file=- >/dev/null
  else gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null; fi
}

if [[ "$QUE" == "todo" || "$QUE" == "telegram" ]]; then
  echo "── Telegram ────────────────────────────────────────────────"
  TOKEN=""
  if [[ -f "$RAIZ/.env" ]] && grep -q '^TELEGRAM_BOT_TOKEN=.\+' "$RAIZ/.env"; then
    if confirmar "Usar el TELEGRAM_BOT_TOKEN de $RAIZ/.env (el bot general)?"; then
      TOKEN=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$RAIZ/.env" | cut -d= -f2- | tr -d "\"'\r")
    fi
  fi
  if [[ -z "$TOKEN" ]]; then
    printf 'Token del bot de Telegram (no se mostrará): ' >&2; read -rs TOKEN; echo >&2
  fi
  [[ -n "$TOKEN" ]] || { echo "Token vacío: no se cambia nada." >&2; exit 1; }

  # Comprobar el token SIN imprimirlo: getMe devuelve el nombre del bot.
  BOT=$(curl -fsS "https://api.telegram.org/bot${TOKEN}/getMe" | python3 -c "import sys,json;d=json.load(sys.stdin);print('@'+d['result']['username'] if d.get('ok') else '')" 2>/dev/null || true)
  [[ -n "$BOT" ]] || { echo "❌ Telegram no acepta ese token (getMe falló)." >&2; exit 1; }
  echo "→ Bot: $BOT"
  confirmar "Registrar el webhook de $BOT hacia la API? (la instancia local dejará de recibir sus mensajes)" || { echo "Cancelado."; exit 1; }

  printf %s "$TOKEN" | guardar "${P}OPERANT_TELEGRAM_BOT_TOKEN"
  SECRETO_WEBHOOK=$(openssl rand -hex 24)
  printf %s "$SECRETO_WEBHOOK" | guardar "${P}OPERANT_TELEGRAM_SECRET"
  echo "→ Token y secreto del webhook guardados en Secret Manager."

  # La API necesita el secreto nuevo (lo monta secrets.list) y OPERANT también: redespliegue de
  # OPERANT aquí; la API lo recoge al forzar una revisión nueva.
  TELEGRAM_PEND=1
fi

if [[ "$QUE" == "todo" || "$QUE" == "correo" ]]; then
  echo "── Correo ──────────────────────────────────────────────────"
  if ! existe_secreto "${P}OPERANT_SMTP_PASS"; then
    echo "❌ Falta la contraseña del buzón: ejecuta antes ./deploy/gcp/11-operant-correo.sh" >&2; exit 1
  fi
  echo "OPERANT contestará SOLO el correo dirigido a support@, ventas@, facturacion@, marketing@ e"
  echo "infrastructure@ llegado desde ahora, desde esa misma dirección. Nunca a máquinas, listas ni @bezhas.com."
  if confirmar "Activar el auto-respondedor de correo desde este momento?"; then
    date -u +%Y-%m-%dT%H:%M:%SZ | tr -d '\n' | guardar "${P}OPERANT_MAIL_AUTOREPLY_SINCE"
    echo "→ Fecha de activación guardada."
  else
    echo "→ Auto-respondedor sin activar."
  fi
fi

# La API monta OPERANT_TELEGRAM_SECRET con su propio despliegue: se fuerza una revisión nueva.
if existe_secreto "${P}OPERANT_TELEGRAM_SECRET"; then
  gcloud secrets add-iam-policy-binding "${P}OPERANT_TELEGRAM_SECRET" \
    --member="serviceAccount:${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
fi

TAG_ACTUAL=$(gcloud run services describe bezhas-operant --region="$REGION" --format='value(metadata.labels.commit)')
[[ -n "$TAG_ACTUAL" ]] || { echo "No encuentro bezhas-operant: ejecuta antes 10-operant.sh" >&2; exit 1; }
echo "→ Redesplegando OPERANT con los canales activados…"
TAG="$TAG_ACTUAL" ./10-operant.sh

if [[ "${TELEGRAM_PEND:-}" == "1" ]]; then
  echo "→ Mirando que la API tenga el secreto (revisión nueva de bezhas-api)…"
  gcloud run services update bezhas-api --region="$REGION" \
    --update-secrets="OPERANT_TELEGRAM_SECRET=${P}OPERANT_TELEGRAM_SECRET:latest" --quiet >/dev/null
  # setWebhook va DESPUÉS de que la API ya verifica el secreto nuevo.
  SECRETO_WEBHOOK=$(gcloud secrets versions access latest --secret="${P}OPERANT_TELEGRAM_SECRET")
  TOKEN_GUARDADO=$(gcloud secrets versions access latest --secret="${P}OPERANT_TELEGRAM_BOT_TOKEN")
  RESP=$(curl -fsS -X POST "https://api.telegram.org/bot${TOKEN_GUARDADO}/setWebhook" \
    --data-urlencode "url=https://${API_HOST}/api/operant/channels/telegram" \
    --data-urlencode "secret_token=${SECRETO_WEBHOOK}" \
    --data-urlencode 'allowed_updates=["message","edited_message"]' \
    --data-urlencode 'drop_pending_updates=true')
  unset TOKEN_GUARDADO SECRETO_WEBHOOK
  echo "$RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print('→ setWebhook:', 'OK' if d.get('ok') else d)"
fi

echo "✅ Listo. Comprueba:  curl -s https://${API_HOST}/api/operant/health"
echo "   Prueba Telegram escribiendo «quiero crear una cuenta» al bot; y un correo a support@bezhas.com desde otra dirección."
