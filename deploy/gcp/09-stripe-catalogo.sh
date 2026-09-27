#!/usr/bin/env bash
# ============================================================================
# 09 — Crear el catálogo de BeZhas en la cuenta de Stripe de la clave del .env
# ============================================================================
# Crea (o reutiliza, si ya existen) en la cuenta de STRIPE_SECRET_KEY:
#   - 4 productos: Starter (pago por uso), Creator Pro, Business, Enterprise VIP
#   - 7 precios: mensual y anual de los tres planes + el medido de Starter
#   - el medidor `bezhas_api_credits` (lo usa api/services/usageBilling.js)
#   - 6 Payment Links de planes (metadata plan_id/billing, vuelta a
#     https://www.bezhas.com/onboarding) y el de compra directa de BEZ-Coin
#   - el webhook https://api.bezhas.com/api/webhooks/stripe; su secreto
#     (whsec_…) va directo al .env, sin mostrarse
#
# Idempotente: lo creado por este script lleva metadata platform=bezhas (y
# los precios un lookup_key), así que volver a ejecutarlo no duplica nada.
# Al final imprime los identificadores (no son secretos) para ponerlos en
# api/config/plans.js, stripe-payment-links.js y el panel.
#
# Uso:  ./deploy/gcp/09-stripe-catalogo.sh [fichero .env]
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
F="${1:-$HOME/bezhas-blockchain.env}"
API="${STRIPE_API:-https://api.stripe.com}"
VUELTA="https://${WWW_HOST}/onboarding?session_id={CHECKOUT_SESSION_ID}&plan="
command -v jq >/dev/null || { echo "Falta jq" >&2; exit 1; }

valor() { grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$F" | tail -n1 | cut -d= -f2- | sed -E "s/^[\"']|[\"']$//g"; }
poner() { local t; t=$(mktemp); grep -vE "^[[:space:]]*(export[[:space:]]+)?$1=" "$F" > "$t" || true; printf '%s=%s\n' "$1" "$2" >> "$t"; cat "$t" > "$F"; rm -f "$t"; }

SK=$(valor STRIPE_SECRET_KEY)
[[ "$SK" =~ ^(sk|rk)_live_ ]] || { echo "❌ STRIPE_SECRET_KEY del .env no es una clave live" >&2; exit 1; }
CFG=$(mktemp); trap 'rm -f "$CFG"' EXIT
# globoff: los corchetes de lookup_keys[] no son un patrón de curl.
printf 'user = "%s:"\nsilent\nshow-error\ngloboff\n' "$SK" > "$CFG"; unset SK

stripe() {  # stripe MÉTODO RUTA [--data-urlencode k=v …] — sale con error si Stripe lo devuelve
  local m="$1" r="$2" out; shift 2
  out=$(curl -K "$CFG" -X "$m" "${API}$r" "$@")
  if jq -e '.error' >/dev/null 2>&1 <<< "$out"; then
    echo "❌ Stripe ($m $r): $(jq -r '.error.message' <<< "$out")" >&2; return 1
  fi
  printf '%s' "$out"
}
todos() {  # todos RUTA — lista paginada completa, un objeto JSON por línea
  local r="$1" sep='?' desde="" pag
  [[ "$r" == *\?* ]] && sep='&'
  while :; do
    pag=$(stripe GET "${r}${sep}limit=100${desde:+&starting_after=$desde}")
    jq -c '.data[]' <<< "$pag"
    [[ "$(jq -r '.has_more' <<< "$pag")" == true ]] || break
    desde=$(jq -r '.data[-1].id' <<< "$pag")
  done
}

cuenta=$(stripe GET /v1/account)
echo "→ Cuenta: $(jq -r '"\(.settings.dashboard.display_name // .id) (\(.id))"' <<< "$cuenta")"
read -rp "   ¿Crear aquí el catálogo de BeZhas? [s/N] " r
[[ "$r" =~ ^[sSyY]$ ]] || { echo "Cancelado."; exit 0; }

# ── Productos ───────────────────────────────────────────────────────────────
PRODUCTOS=$(todos "/v1/products?active=true")
producto() {  # producto PLAN NOMBRE DESCRIPCIÓN → id
  local id
  id=$(jq -r --arg p "$1" 'select(.metadata.platform == "bezhas" and .metadata.plan_id == $p) | .id' <<< "$PRODUCTOS" | head -n1)
  if [[ -z "$id" ]]; then
    id=$(stripe POST /v1/products --data-urlencode "name=$2" --data-urlencode "description=$3" \
           --data-urlencode "tax_code=txcd_10000000" \
           --data-urlencode "metadata[platform]=bezhas" --data-urlencode "metadata[plan_id]=$1" | jq -r '.id')
  fi
  echo "$id"
}
echo "→ Productos"
P_STARTER=$(producto starter "BeZhas Starter — Pago por uso API-SDK" "Plan Starter: 15 días gratis, después pago por consumo real de llamadas API-SDK (coste Claude + cómputo BeZhas +25%). 1 crédito = 0,001 EUR.")
P_CREATOR=$(producto creator_pro "BeZhas Creator Pro" "Suscripción BeZhas Creator Pro — 99 EUR/mes. 1.500 AI Actions, 25% gas subsidy, staking 18.75% APY.")
P_BUSINESS=$(producto business "BeZhas Business" "Suscripción BeZhas Business — 499 EUR/mes. 15.000 AI Actions, 50% gas subsidy, staking 25% APY.")
P_VIP=$(producto enterprise_vip "BeZhas Enterprise VIP" "Suscripción BeZhas Enterprise VIP — 2.499 EUR/mes. AI Actions ilimitadas, 100% gas subsidy, staking 31.25% APY.")
P_BEZ=$(producto bez_coin "Obtén BEZ-Coin" "Compra directa de BEZ-Coin. Los tokens se envían a la wallet indicada al confirmarse el pago.")
echo "   starter=$P_STARTER creator_pro=$P_CREATOR business=$P_BUSINESS enterprise_vip=$P_VIP bez_coin=$P_BEZ"

# ── Medidor del plan Starter ────────────────────────────────────────────────
echo "→ Medidor bezhas_api_credits"
MTR=$(todos "/v1/billing/meters?status=active" | jq -r 'select(.event_name == "bezhas_api_credits") | .id' | head -n1)
[[ -n "$MTR" ]] || MTR=$(stripe POST /v1/billing/meters --data-urlencode "display_name=BeZhas API credits" \
  --data-urlencode "event_name=bezhas_api_credits" --data-urlencode "default_aggregation[formula]=sum" \
  --data-urlencode "customer_mapping[type]=by_id" --data-urlencode "customer_mapping[event_payload_key]=stripe_customer_id" \
  --data-urlencode "value_settings[event_payload_key]=value" | jq -r '.id')
echo "   $MTR"

# ── Precios (lookup_key = idempotencia) ─────────────────────────────────────
precio() {  # precio LOOKUP PRODUCTO args… → id
  local lk="$1" prod="$2" id; shift 2
  id=$(stripe GET "/v1/prices?active=true&lookup_keys[]=$lk" | jq -r '.data[0].id // empty')
  [[ -n "$id" ]] || id=$(stripe POST /v1/prices --data-urlencode "lookup_key=$lk" --data-urlencode "product=$prod" \
                          --data-urlencode "currency=eur" --data-urlencode "metadata[platform]=bezhas" "$@" | jq -r '.id')
  echo "$id"
}
echo "→ Precios"
PR_CREATOR_M=$(precio bezhas_creator_pro_monthly "$P_CREATOR" --data-urlencode unit_amount=9900 --data-urlencode "recurring[interval]=month" --data-urlencode "metadata[plan_id]=creator_pro" --data-urlencode "metadata[billing]=monthly")
PR_CREATOR_A=$(precio bezhas_creator_pro_annual "$P_CREATOR" --data-urlencode unit_amount=99000 --data-urlencode "recurring[interval]=year" --data-urlencode "metadata[plan_id]=creator_pro" --data-urlencode "metadata[billing]=annual")
PR_BUSINESS_M=$(precio bezhas_business_monthly "$P_BUSINESS" --data-urlencode unit_amount=49900 --data-urlencode "recurring[interval]=month" --data-urlencode "metadata[plan_id]=business" --data-urlencode "metadata[billing]=monthly")
PR_BUSINESS_A=$(precio bezhas_business_annual "$P_BUSINESS" --data-urlencode unit_amount=499000 --data-urlencode "recurring[interval]=year" --data-urlencode "metadata[plan_id]=business" --data-urlencode "metadata[billing]=annual")
PR_VIP_M=$(precio bezhas_enterprise_vip_monthly "$P_VIP" --data-urlencode unit_amount=249900 --data-urlencode "recurring[interval]=month" --data-urlencode "metadata[plan_id]=enterprise_vip" --data-urlencode "metadata[billing]=monthly")
PR_VIP_A=$(precio bezhas_enterprise_vip_annual "$P_VIP" --data-urlencode unit_amount=2499000 --data-urlencode "recurring[interval]=year" --data-urlencode "metadata[plan_id]=enterprise_vip" --data-urlencode "metadata[billing]=annual")
PR_STARTER=$(precio bezhas_starter_payg "$P_STARTER" --data-urlencode "unit_amount_decimal=0.1" --data-urlencode "recurring[interval]=month" --data-urlencode "recurring[usage_type]=metered" --data-urlencode "recurring[meter]=$MTR" --data-urlencode "nickname=Starter payg (1 crédito = 0,001 EUR, coste+25%)" --data-urlencode "metadata[plan_id]=starter" --data-urlencode "metadata[billing]=payg")
PR_BEZ=$(precio bezhas_bez_coin "$P_BEZ" --data-urlencode "custom_unit_amount[enabled]=true" --data-urlencode "custom_unit_amount[minimum]=5000" --data-urlencode "custom_unit_amount[maximum]=1000000" --data-urlencode "custom_unit_amount[preset]=95000" --data-urlencode "metadata[use]=bez_coin_direct_purchase")

# ── Payment Links ───────────────────────────────────────────────────────────
ENLACES=$(todos "/v1/payment_links?active=true")
# El IVA automático exige Stripe Tax activado en la cuenta; si no lo está,
# los enlaces se crean sin él y se avisa.
IVA=(--data-urlencode "automatic_tax[enabled]=true")
enlace() {  # enlace CLAVE PRECIO args… → "id url"
  local clave="$1" pr="$2" e; shift 2
  e=$(jq -r --arg k "$clave" 'select(.metadata.platform == "bezhas" and .metadata.link == $k) | "\(.id) \(.url)"' <<< "$ENLACES" | head -n1)
  if [[ -z "$e" ]]; then
    local base=(--data-urlencode "line_items[0][price]=$pr" --data-urlencode "line_items[0][quantity]=1"
                --data-urlencode "metadata[platform]=bezhas" --data-urlencode "metadata[link]=$clave"
                --data-urlencode "billing_address_collection=required" --data-urlencode "phone_number_collection[enabled]=true"
                --data-urlencode "tax_id_collection[enabled]=true")
    e=$(stripe POST /v1/payment_links "${base[@]}" "${IVA[@]}" "$@" 2>/tmp/stripe-err.$$ | jq -r '"\(.id) \(.url)"') || {
      if grep -qi "tax" /tmp/stripe-err.$$; then
        echo "   ⚠️  Stripe Tax no está activo: $clave se crea SIN IVA automático (actívalo en el panel de Stripe)" >&2
        IVA=()
        e=$(stripe POST /v1/payment_links "${base[@]}" "$@" | jq -r '"\(.id) \(.url)"')
      else cat /tmp/stripe-err.$$ >&2; rm -f /tmp/stripe-err.$$; return 1; fi
    }
    rm -f /tmp/stripe-err.$$
  fi
  echo "$e"
}
plan_link() {  # plan_link PLAN BILLING PRECIO [wallet]
  local extra=(--data-urlencode "metadata[plan_id]=$1" --data-urlencode "metadata[billing]=$2"
               --data-urlencode "after_completion[type]=redirect"
               --data-urlencode "after_completion[redirect][url]=${VUELTA}$1")
  enlace "plan_${1}_${2}" "$3" "${extra[@]}"
}
echo "→ Payment Links"
L_CREATOR_M=$(plan_link creator_pro monthly "$PR_CREATOR_M")
L_CREATOR_A=$(plan_link creator_pro annual "$PR_CREATOR_A")
L_BUSINESS_M=$(plan_link business monthly "$PR_BUSINESS_M")
L_BUSINESS_A=$(plan_link business annual "$PR_BUSINESS_A")
L_VIP_M=$(plan_link enterprise_vip monthly "$PR_VIP_M")
L_VIP_A=$(plan_link enterprise_vip annual "$PR_VIP_A")
L_BEZ=$(enlace bez_coin_direct_purchase "$PR_BEZ" \
  --data-urlencode "custom_fields[0][key]=walletaddresstosendbezcoin" --data-urlencode "custom_fields[0][type]=text" \
  --data-urlencode "custom_fields[0][label][type]=custom" --data-urlencode "custom_fields[0][label][custom]=Wallet address to send BEZ-Coin" \
  --data-urlencode "invoice_creation[enabled]=true" \
  --data-urlencode "after_completion[type]=hosted_confirmation" \
  --data-urlencode "after_completion[hosted_confirmation][custom_message]=Pago recibido. Tus BEZ-Coin se enviarán a la wallet indicada en cuanto se confirme el cobro.")

# ── Webhook ─────────────────────────────────────────────────────────────────
echo "→ Webhook https://${API_HOST}/api/webhooks/stripe"
URL_WH="https://${API_HOST}/api/webhooks/stripe"
WH=$(todos "/v1/webhook_endpoints" | jq -r --arg u "$URL_WH" 'select(.url == $u) | .id' | head -n1)
if [[ -z "$WH" ]]; then
  nuevo=$(stripe POST /v1/webhook_endpoints --data-urlencode "url=$URL_WH" --data-urlencode "description=BeZhas api (www.bezhas.com)" \
    --data-urlencode "enabled_events[]=checkout.session.completed" --data-urlencode "enabled_events[]=payment_intent.payment_failed" \
    --data-urlencode "enabled_events[]=charge.refunded" --data-urlencode "enabled_events[]=charge.dispute.created")
  WH=$(jq -r '.id' <<< "$nuevo")
  poner STRIPE_WEBHOOK_SECRET "$(jq -r '.secret' <<< "$nuevo")"
  echo "   creado $WH; secreto guardado en $F (no se muestra)"
else
  echo "   ya existe ($WH): si el .env no tiene SU secreto, cópialo del panel (Webhooks → Revelar)"
fi

cat <<MSG

✅ Catálogo listo. Pega este bloque a Claude para actualizar el código (no contiene secretos):
----- BEZHAS-STRIPE-IDS -----
account=$(jq -r '.id' <<< "$cuenta")
product.starter=$P_STARTER
product.creator_pro=$P_CREATOR
product.business=$P_BUSINESS
product.enterprise_vip=$P_VIP
meter=$MTR
price.starter_payg=$PR_STARTER
price.creator_pro.monthly=$PR_CREATOR_M
price.creator_pro.annual=$PR_CREATOR_A
price.business.monthly=$PR_BUSINESS_M
price.business.annual=$PR_BUSINESS_A
price.enterprise_vip.monthly=$PR_VIP_M
price.enterprise_vip.annual=$PR_VIP_A
link.creator_pro.monthly=${L_CREATOR_M#* }
link.creator_pro.annual=${L_CREATOR_A#* }
link.business.monthly=${L_BUSINESS_M#* }
link.business.annual=${L_BUSINESS_A#* }
link.enterprise_vip.monthly=${L_VIP_M#* }
link.enterprise_vip.annual=${L_VIP_A#* }
link.bez_coin=${L_BEZ#* }
webhook=$WH
----- FIN -----
MSG
