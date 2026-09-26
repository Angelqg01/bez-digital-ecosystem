#!/usr/bin/env bash
# ============================================================================
# 00 — Generar el .env de producción (en Cloud Shell, nunca en el repositorio)
# ============================================================================
# Crea o COMPLETA ~/bezhas-blockchain.env (permisos 600):
#
#   1. Secretos internos: los genera al azar con openssl. Nunca se imprimen y
#      nadie tiene que verlos ni copiarlos (JWT, clave interna, claves de los
#      vaults, seudónimos, edge node…).
#   2. Par ES256 del servidor OAuth del MCP (PEM en base64, una línea).
#   3. Usuario del panel de administración: contraseña al azar + su hash
#      bcrypt. Solo el hash se sube; la contraseña se queda en este fichero.
#   4. Claves de terceros (Stripe, IA, RPC…): deja la línea vacía para que la
#      rellenes tú con `nano`.
#
# Solo AÑADE las claves que falten: si el fichero ya existe, lo que tenga se
# conserva tal cual. Así se puede volver a ejecutar tras cada cambio de la
# plataforma sin perder nada ni rotar secretos sin querer (rotar las claves de
# los vaults haría ilegible lo ya cifrado).
#
# Uso:  ./deploy/gcp/00-generar-env.sh [fichero]   (por defecto ~/bezhas-blockchain.env)
set -euo pipefail
F="${1:-$HOME/bezhas-blockchain.env}"
umask 077
touch "$F"; chmod 600 "$F"

tiene() { grep -qE "^[[:space:]]*(export[[:space:]]+)?$1=" "$F"; }
valor() { grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$F" | tail -n1 | cut -d= -f2-; }
poner() {  # poner CLAVE VALOR — solo si la clave no existe
  if tiene "$1"; then return; fi
  printf '%s=%s\n' "$1" "$2" >> "$F"; nuevas+=("$1")
}
nuevas=()
hex() { openssl rand -hex "${1:-32}"; }
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# ── 1. Secretos internos (al azar, 64 caracteres hex) ──────────────────────
for k in JWT_SECRET INTERNAL_API_KEY WALLET_VAULT_SECRET SECRET_VAULT_KEY \
         TELEMETRY_PSEUDONYM_KEY MONITOR_ACCESS_TOKEN BRIDGE_API_KEY \
         AGENT_RUNTIME_API_KEY EDGE_NODE_API_KEY CONTROL_JWT; do
  poner "$k" "$(hex 32)"
done

# ── 2. Par ES256 del servidor OAuth ────────────────────────────────────────
if ! tiene OAUTH_JWT_PRIVATE_KEY || ! tiene OAUTH_JWT_PUBLIC_KEY \
   || [[ -z "$(valor OAUTH_JWT_PRIVATE_KEY)" || -z "$(valor OAUTH_JWT_PUBLIC_KEY)" ]]; then
  openssl ecparam -name prime256v1 -genkey -noout 2>/dev/null \
    | openssl pkcs8 -topk8 -nocrypt > "$TMP/priv.pem"
  openssl ec -in "$TMP/priv.pem" -pubout > "$TMP/pub.pem" 2>/dev/null
  # Se regeneran los dos juntos: una privada sin su pública no arranca.
  sed -i '/^OAUTH_JWT_PRIVATE_KEY=/d; /^OAUTH_JWT_PUBLIC_KEY=/d' "$F"
  poner OAUTH_JWT_PRIVATE_KEY "$(base64 -w0 "$TMP/priv.pem")"
  poner OAUTH_JWT_PUBLIC_KEY  "$(base64 -w0 "$TMP/pub.pem")"
fi

# ── 3. Administrador del panel ─────────────────────────────────────────────
poner ADMIN_USERNAME "admin"
poner ADMIN_PASSWORD "$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
if [[ -z "$(valor ADMIN_PASSWORD_HASH)" ]]; then
  # bcrypt con la misma librería que usa la api (bcryptjs), instalada en un
  # directorio temporal. La contraseña viaja por variable de entorno, no por
  # argumentos (que se verían en `ps`).
  if npm install --silent --no-audit --no-fund --prefix "$TMP/bc" bcryptjs@2 >/dev/null 2>&1 \
     && H=$(ADMIN_PASSWORD="$(valor ADMIN_PASSWORD)" NODE_PATH="$TMP/bc/node_modules" \
              node -e 'process.stdout.write(require("bcryptjs").hashSync(process.env.ADMIN_PASSWORD, 12))') \
     && [[ "$H" == \$2* ]]; then
    sed -i '/^ADMIN_PASSWORD_HASH=/d' "$F"
    poner ADMIN_PASSWORD_HASH "$H"
  else
    echo "⚠️  No se pudo calcular ADMIN_PASSWORD_HASH (¿sin node/npm?). Vuelve a ejecutar este script en Cloud Shell." >&2
    poner ADMIN_PASSWORD_HASH ""
  fi
fi

# ── 4. Claves de terceros: vacías, para rellenar a mano ────────────────────
for k in POLYGON_RPC_URL RPC_URL BEZHAS_L2_RPC_URL TREASURY_WALLET \
         OPERATOR_PRIVATE_KEY AGENT_PRIVATE_KEY EDGE_NODE_PRIVATE_KEY \
         STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET BANK_WEBHOOK_SECRET \
         GEMINI_API_KEY DEEPSEEK_API_KEY ANTHROPIC_API_KEY PINATA_JWT SMTP_PASS \
         TELEGRAM_BOT_TOKEN TELEGRAM_SECURITY_CHAT_ID DISCORD_BOT_TOKEN REDIS_URL; do
  poner "$k" ""
done

echo "Fichero: $F (permisos 600)"
if ((${#nuevas[@]})); then
  echo "Añadidas ${#nuevas[@]} claves: ${nuevas[*]}"
else
  echo "No faltaba ninguna clave; no se ha cambiado nada."
fi
vacias=$(grep -cE '^[A-Z_0-9]+=$' "$F" || true)
cat <<MSG

Siguiente paso: rellena las ${vacias} claves vacías que uses (las de terceros):
  nano $F
Todas son opcionales: sin ellas la plataforma arranca y esa función queda
desactivada (sin OPERATOR_PRIVATE_KEY, por ejemplo, en modo solo lectura).

Reglas para las wallets (02-secrets.sh las comprueba):
  - OPERATOR_PRIVATE_KEY, AGENT_PRIVATE_KEY, EDGE_NODE_PRIVATE_KEY: wallets
    NUEVAS y distintas entre sí, con saldo mínimo de gas y sin roles de admin.
    NUNCA la del tesoro, la del deployer de los contratos ni la de la multisig.
  - TREASURY_WALLET: solo la DIRECCIÓN 0x…, nunca una clave.

Usuario del panel: $(valor ADMIN_USERNAME)   contraseña:  grep ^ADMIN_PASSWORD= $F

Cuando esté completo:  ./deploy/gcp/02-secrets.sh $F
MSG
