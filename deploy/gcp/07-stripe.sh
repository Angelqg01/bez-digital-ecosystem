#!/usr/bin/env bash
# ============================================================================
# 07 — Stripe: comprobar el catálogo y crear el webhook de producción
# ============================================================================
# Usa la clave secreta de ~/bezhas-blockchain.env (STRIPE_SECRET_KEY) y:
#   1. Comprueba que es una clave LIVE y que ve los precios del catálogo de
#      api/config/plans.js y stripe-payment-links.js (si no, es de otra cuenta
#      o de modo test y los cobros fallarían).
#   2. Crea el webhook https://api.bezhas.com/api/webhooks/stripe con los
#      eventos que procesa la api, y guarda su secreto (whsec_…) en el .env
#      como STRIPE_WEBHOOK_SECRET. Stripe solo enseña ese secreto al crearlo,
#      así que si el webhook ya existe y el .env no tiene el secreto, se
#      recrea (pidiendo confirmación).
#   3. Informa de a dónde redirige cada Payment Link tras pagar.
#
# Nada se imprime: la clave viaja a curl por un fichero temporal (no por la
# línea de comandos) y el whsec_ va directo al .env (permisos 600).
#
# Después:  ./deploy/gcp/02-secrets.sh ~/bezhas-blockchain.env && ./deploy/gcp/deploy.sh
#
# Uso:  ./deploy/gcp/07-stripe.sh [fichero .env]
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
F="${1:-$HOME/bezhas-blockchain.env}"
API="${STRIPE_API:-https://api.stripe.com}"   # STRIPE_API solo para pruebas
URL_WEBHOOK="https://${API_HOST}/api/webhooks/stripe"
# Los eventos que trata api/routes/webhooks.js (ni uno más: cada evento
# enviado y no tratado es tráfico y ruido).
EVENTOS=(checkout.session.completed payment_intent.payment_failed charge.refunded charge.dispute.created)
command -v jq >/dev/null || { echo "Falta jq" >&2; exit 1; }
[[ -f "$F" ]] || { echo "No existe $F (ejecuta 00-generar-env.sh)" >&2; exit 2; }

valor() { grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$F" | tail -n1 | cut -d= -f2- | sed -E "s/^[\"']|[\"']$//g"; }
poner() {  # poner CLAVE VALOR (sustituye o añade; el valor no pasa por argumentos de sed)
  local tmp; tmp=$(mktemp)
  grep -vE "^[[:space:]]*(export[[:space:]]+)?$1=" "$F" > "$tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  cat "$tmp" > "$F"; rm -f "$tmp"
}

SK=$(valor STRIPE_SECRET_KEY)
if [[ -z "$SK" ]]; then
  read -rsp "Clave secreta de Stripe (sk_live_… o rk_live_…): " SK; echo
  [[ -n "$SK" ]] || { echo "Sin clave no se puede seguir." >&2; exit 2; }
  GUARDAR_SK=1
fi
if [[ ! "$SK" =~ ^(sk|rk)_live_ ]]; then
  if [[ "$SK" =~ ^(sk|rk)_test_ ]]; then
    echo "⚠️  Es una clave de MODO TEST: los clientes no pagarían de verdad." >&2
    [[ "${PERMITIR_TEST:-0}" == 1 ]] || { echo "   (PERMITIR_TEST=1 para seguir igualmente)" >&2; exit 1; }
  else
    echo "❌ STRIPE_SECRET_KEY no es una clave secreta de Stripe." >&2; exit 1
  fi
fi

CFG=$(mktemp); trap 'rm -f "$CFG"' EXIT
printf 'user = "%s:"\nsilent\nshow-error\n' "$SK" > "$CFG"
stripe() {  # stripe MÉTODO RUTA [--data-urlencode …]
  local m="$1" r="$2"; shift 2
  curl -K "$CFG" -X "$m" "${API}$r" "$@"
}

echo "→ Cuenta de Stripe"
cuenta=$(stripe GET /v1/account)
if jq -e '.error' >/dev/null <<< "$cuenta"; then
  echo "❌ Stripe rechaza la clave: $(jq -r '.error.message' <<< "$cuenta")" >&2; exit 1
fi
echo "   $(jq -r '"\(.settings.dashboard.display_name // .business_profile.name // .id) (\(.id)) — cobros: \(if .charges_enabled then "activos" else "NO activos" end)"' <<< "$cuenta")"
[[ "$(jq -r '.charges_enabled' <<< "$cuenta")" == true ]] || \
  echo "⚠️  La cuenta aún no puede cobrar: completa la verificación en el panel de Stripe." >&2
[[ "${GUARDAR_SK:-0}" == 1 ]] && poner STRIPE_SECRET_KEY "$SK"

echo "→ Catálogo (precios de api/config)"
cd ../..
mal=0
for p in $(grep -ohE "price_[A-Za-z0-9]+" api/config/plans.js api/config/stripe-payment-links.js | sort -u); do
  r=$(stripe GET "/v1/prices/$p")
  if jq -e '.error' >/dev/null <<< "$r"; then
    echo "   ❌ $p: $(jq -r '.error.message' <<< "$r")"; mal=$((mal + 1))
  else
    echo "   ✅ $p $(jq -r '"\(.nickname // .product) · \(if .unit_amount then (.unit_amount/100|tostring) + " " + (.currency|ascii_upcase) else "por uso" end)\(if .recurring then " / " + .recurring.interval else "" end)\(if .active then "" else " (INACTIVO)" end)"' <<< "$r")"
  fi
done
if ((mal)); then
  echo "❌ $mal precios no existen en esta cuenta/modo: la clave es de otra cuenta o de modo test." >&2
  exit 1
fi

echo "→ Webhook: $URL_WEBHOOK"
existentes=$(stripe GET "/v1/webhook_endpoints?limit=100" | jq -r --arg u "$URL_WEBHOOK" '.data[]? | select(.url == $u) | .id')
WH=$(valor STRIPE_WEBHOOK_SECRET)
args=(--data-urlencode "url=$URL_WEBHOOK" --data-urlencode "description=BeZhas api (www.bezhas.com)")
for e in "${EVENTOS[@]}"; do args+=(--data-urlencode "enabled_events[]=$e"); done

if [[ -n "$existentes" && -n "$WH" ]]; then
  for id in $existentes; do
    stripe POST "/v1/webhook_endpoints/$id" "${args[@]:2}" >/dev/null   # solo eventos y descripción
  done
  echo "   Ya existe y el .env tiene su secreto: eventos actualizados."
else
  if [[ -n "$existentes" ]]; then
    echo "   Ya existe, pero el .env no tiene su secreto (Stripe solo lo muestra al crearlo)."
    read -rp "   ¿Recrearlo? El antiguo deja de recibir eventos. [s/N] " r
    [[ "$r" =~ ^[sSyY]$ ]] || { echo "Cancelado."; exit 0; }
    for id in $existentes; do stripe DELETE "/v1/webhook_endpoints/$id" >/dev/null; done
  fi
  nuevo=$(stripe POST /v1/webhook_endpoints "${args[@]}")
  if jq -e '.error' >/dev/null <<< "$nuevo"; then
    echo "❌ No se pudo crear: $(jq -r '.error.message' <<< "$nuevo")" >&2; exit 1
  fi
  poner STRIPE_WEBHOOK_SECRET "$(jq -r '.secret' <<< "$nuevo")"
  echo "   Creado ($(jq -r '.id' <<< "$nuevo")); secreto guardado en $F (no se muestra)."
fi

echo "→ Payment Links: a dónde vuelve el cliente tras pagar"
# Tras pagar, el cliente debe volver a esta web. Los que apunten a otro
# dominio (p. ej. el antiguo bez.digital) se pueden corregir aquí.
VUELTA="${VUELTA_PAGO:-https://${WWW_HOST}/payments}"
LINKS=$(stripe GET "/v1/payment_links?limit=100")
corregir=()
for u in $(grep -ohE "https://buy.stripe.com/[A-Za-z0-9]+" api/config/stripe-payment-links.js | sort -u); do
  pl=$(jq -c --arg u "$u" '.data[]? | select(.url == $u)' <<< "$LINKS")
  if [[ -z "$pl" ]]; then echo "   ❌ $u no está en esta cuenta"; continue; fi
  destino=$(jq -r 'if .after_completion.type == "redirect" then .after_completion.redirect.url else "" end' <<< "$pl")
  echo "   $u → ${destino:-página de confirmación de Stripe}$(jq -r 'if .active then "" else " (INACTIVO)" end' <<< "$pl")"
  [[ "$destino" =~ ^https://([a-z0-9-]+\.)*${DOMAIN//./\\.}(/|$) ]] || corregir+=("$(jq -r '.id' <<< "$pl")")
done
if ((${#corregir[@]})); then
  read -rp "   ¿Hacer que esos ${#corregir[@]} vuelvan a ${VUELTA}? [s/N] " r
  if [[ "$r" =~ ^[sSyY]$ ]]; then
    for id in "${corregir[@]}"; do
      stripe POST "/v1/payment_links/$id" --data-urlencode "after_completion[type]=redirect" \
        --data-urlencode "after_completion[redirect][url]=${VUELTA}" >/dev/null
    done
    echo "   Actualizados."
  fi
fi

cat <<MSG

✅ Stripe listo en $F.
   Siguiente:  ./deploy/gcp/02-secrets.sh $F && ./deploy/gcp/deploy.sh
   Prueba real: compra el plan más barato con tu tarjeta, comprueba el alta en
   el panel y reembólsala desde Stripe (el reembolso también llega a la api).
MSG
