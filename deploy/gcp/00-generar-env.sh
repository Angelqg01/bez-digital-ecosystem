#!/usr/bin/env bash
# ============================================================================
# 00 — Generar el .env de producción (en Cloud Shell, nunca en el repositorio)
# ============================================================================
# Crea o COMPLETA ~/bezhas.env.production (permisos 600):
#
#   1. Secretos internos: los genera al azar con openssl. Nunca se imprimen y
#      nadie tiene que verlos ni copiarlos: JWT, cookies, cifrado, sal del
#      vigilante, firma de suscripciones, clave interna, contraseña de AdminJS.
#   2. Par ES256 del servidor OAuth del MCP (PEM en base64, una línea).
#   3. Valores públicos conocidos (orígenes CORS, contrato BEZ en Polygon).
#   4. Claves de terceros (Stripe, OAuth, IA, RPC…): deja la línea vacía para
#      que la rellenes tú con `nano`.
#
# Solo AÑADE las claves que falten: si el fichero ya existe, lo que tenga se
# conserva tal cual. Así se puede volver a ejecutar tras cada cambio de la
# plataforma sin perder nada ni rotar secretos sin querer.
#
# Uso:  ./deploy/gcp/00-generar-env.sh [fichero]   (por defecto ~/bezhas.env.production)
set -euo pipefail
F="${1:-$HOME/bezhas.env.production}"
umask 077
touch "$F"; chmod 600 "$F"

tiene() { grep -qE "^[[:space:]]*(export[[:space:]]+)?$1=" "$F"; }
poner() {  # poner CLAVE VALOR — solo si la clave no existe
  if tiene "$1"; then return; fi
  printf '%s=%s\n' "$1" "$2" >> "$F"; nuevas+=("$1")
}
nuevas=()
hex() { openssl rand -hex "${1:-32}"; }

# ── 1. Secretos internos (al azar) ─────────────────────────────────────────
for k in JWT_SECRET JWT_REFRESH_SECRET COOKIE_SECRET ADMIN_TOKEN ADMIN_SECRET \
         CONTACT_ENCRYPTION_KEY INTERNAL_API_KEY WATCHDOG_SUBJECT_SALT \
         SUBSCRIPTION_SIGNATURE_SECRET; do
  poner "$k" "$(hex 32)"
done
# fieldEncryption.js lo usa como Buffer.from(clave, 'hex'): 32 bytes en hex.
poner ENCRYPTION_MASTER_KEY "$(hex 32)"
poner ADMIN_PASSWORD "$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"

# ── 2. Par ES256 del servidor OAuth ────────────────────────────────────────
if ! tiene OAUTH_JWT_PRIVATE_KEY || ! tiene OAUTH_JWT_PUBLIC_KEY; then
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  openssl ecparam -name prime256v1 -genkey -noout 2>/dev/null \
    | openssl pkcs8 -topk8 -nocrypt > "$TMP/priv.pem"
  openssl ec -in "$TMP/priv.pem" -pubout > "$TMP/pub.pem" 2>/dev/null
  # Se regeneran los dos juntos: una privada sin su pública no arranca.
  sed -i '/^OAUTH_JWT_PRIVATE_KEY=/d; /^OAUTH_JWT_PUBLIC_KEY=/d' "$F"
  poner OAUTH_JWT_PRIVATE_KEY "$(base64 -w0 "$TMP/priv.pem")"
  poner OAUTH_JWT_PUBLIC_KEY  "$(base64 -w0 "$TMP/pub.pem")"
fi

# ── 3. Valores públicos conocidos ──────────────────────────────────────────
poner ALLOWED_ORIGINS "https://www.bezhas.com,https://bezhas.com"
poner BEZCOIN_CONTRACT_ADDRESS "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"
poner ADMIN_EMAIL ""

# ── 4. Claves de terceros: vacías, para rellenar a mano ────────────────────
for k in POLYGON_RPC_URL TREASURY_WALLET SUPER_ADMIN_WALLETS \
         STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PUBLISHABLE_KEY \
         RELAYER_PRIVATE_KEY HOT_WALLET_PRIVATE_KEY \
         GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET \
         LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_SECRET \
         GEMINI_API_KEY OPENAI_API_KEY ANTHROPIC_API_KEY DEEPSEEK_API_KEY \
         TELEGRAM_BOT_TOKEN TELEGRAM_SECURITY_CHAT_ID DISCORD_WEBHOOK_URL \
         MONGODB_URI REDIS_URL; do
  poner "$k" ""
done

echo "Fichero: $F (permisos 600)"
if ((${#nuevas[@]})); then
  echo "Añadidas ${#nuevas[@]} claves: ${nuevas[*]}"
else
  echo "No faltaba ninguna clave; no se ha cambiado nada."
fi
vacias=$(grep -cE '^[A-Z_]+=$' "$F" || true)
cat <<MSG

Siguiente paso: rellena las ${vacias} claves vacías (las de terceros):
  nano $F
Las que no uses (p. ej. LinkedIn) déjalas vacías: son opcionales.

Reglas para las wallets (02-secrets.sh las comprueba):
  - RELAYER_PRIVATE_KEY y HOT_WALLET_PRIVATE_KEY: wallets NUEVAS y distintas,
    con saldo mínimo de POL y sin roles de admin. NUNCA la clave de la wallet
    del tesoro, de un super-admin o de la multisig.
  - TREASURY_WALLET y SUPER_ADMIN_WALLETS: solo DIRECCIONES 0x…, nunca claves.

Para entrar en AdminJS (${ADMIN_EMAIL:-el ADMIN_EMAIL que pongas}):
  grep ^ADMIN_PASSWORD= $F

Cuando esté completo:  ./deploy/gcp/02-secrets.sh $F
MSG
