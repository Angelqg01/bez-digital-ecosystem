#!/usr/bin/env bash
# ============================================================================
# 02 — Cargar los secretos en Secret Manager (idempotente)
# ============================================================================
# Lee un fichero .env LOCAL (que nunca se sube al repositorio), y para cada
# secreto de secrets.list:
#   - crea el secreto si no existe (replicación automática);
#   - añade una versión nueva SOLO si el valor ha cambiado;
#   - da `secretAccessor` únicamente a las cuentas de servicio que lo leen.
#
# Los valores no se imprimen nunca, ni se pasan por argumentos de línea de
# comandos (irían a `ps` y al historial): viajan por stdin.
#
# Uso:  ./deploy/gcp/02-secrets.sh ~/bezhas/.env.production
set -euo pipefail
if ((BASH_VERSINFO[0] < 4)); then
  echo "Hace falta bash ≥ 4 (en macOS: brew install bash, o usa Cloud Shell)." >&2; exit 1
fi
cd "$(dirname "$0")"
source ./config.env

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "Uso: $0 <fichero .env de producción>" >&2
  exit 2
fi
# Aviso si el fichero es legible por otros usuarios de la máquina.
if [[ "$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")" != 600 ]]; then
  echo "⚠️  $ENV_FILE no tiene permisos 600. Recomendado: chmod 600 $ENV_FILE" >&2
fi

gcloud config set project "$PROJECT_ID" >/dev/null

# Parser de .env sin `source`: un .env ejecutado como shell puede correr código.
declare -A VALORES=()
while IFS= read -r linea || [[ -n "$linea" ]]; do
  linea="${linea%$'\r'}"
  [[ "$linea" =~ ^[[:space:]]*(#|$) ]] && continue
  [[ "$linea" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
  clave="${BASH_REMATCH[2]}"; valor="${BASH_REMATCH[3]}"
  if [[ "$valor" =~ ^\"(.*)\"$ || "$valor" =~ ^\'(.*)\'$ ]]; then valor="${BASH_REMATCH[1]}"; fi
  VALORES["$clave"]="$valor"
done < "$ENV_FILE"

# ── Validación ANTES de subir nada ──────────────────────────────────────────
# Un .env de desarrollo copiado a producción es el fallo más caro y más fácil
# de cometer: tokens de ejemplo, AUTH_BYPASS, la RPC de testnet, o la clave de
# la wallet del tesoro usada como wallet caliente del servidor. Se rechaza.
errores=(); avisos=()
v() { printf '%s' "${VALORES[$1]:-}"; }
es_clave_priv() { [[ "$1" =~ ^(0x)?[0-9a-fA-F]{64}$ ]]; }
norm_clave() { local k="${1#0x}"; printf '%s' "${k,,}"; }

for k in "${!VALORES[@]}"; do
  val="${VALORES[$k]}"; [[ -z "$val" ]] && continue
  if [[ "$val" =~ (^dev-|change-me|change-in-production|CHANGE_ME|YOUR_[A-Z_]*_HERE|_HERE$|^default_secret$|supersecret_fallback) ]]; then
    errores+=("$k tiene un valor de desarrollo/ejemplo")
  fi
done
[[ "$(v AUTH_BYPASS_ENABLED)" == true ]] && errores+=("AUTH_BYPASS_ENABLED=true desactiva la autenticación: quítalo del .env")
[[ "$(v NODE_ENV)" == development ]] && errores+=("NODE_ENV=development: quítalo del .env (el despliegue fija production)")

rpc=$(v POLYGON_RPC_URL)
[[ "$rpc" =~ amoy|mumbai|testnet|localhost|127\.0\.0\.1 ]] && errores+=("POLYGON_RPC_URL apunta a una testnet o a local; producción es Polygon mainnet (chain 137)")

for k in RELAYER_PRIVATE_KEY HOT_WALLET_PRIVATE_KEY AUTOMATION_PRIVATE_KEY; do
  val=$(v "$k"); [[ -z "$val" ]] && continue
  es_clave_priv "$val" || { errores+=("$k no es una clave privada (64 hex)"); continue; }
  [[ "$(norm_clave "$val")" =~ ^0{63}[0-9a-f]$ ]] && errores+=("$k es una clave de juguete (0x…01)")
done
r=$(v RELAYER_PRIVATE_KEY); h=$(v HOT_WALLET_PRIVATE_KEY)
if [[ -n "$r" && -n "$h" && "$(norm_clave "$r")" == "$(norm_clave "$h")" ]]; then
  errores+=("RELAYER_PRIVATE_KEY y HOT_WALLET_PRIVATE_KEY son la misma wallet: usa dos wallets dedicadas")
fi
for k in TREASURY_WALLET COMMUNITY_WALLET SAFE_ADDRESS; do
  val=$(v "$k"); [[ -z "$val" ]] && continue
  [[ "$val" =~ ^0x[0-9a-fA-F]{40}$ ]] || errores+=("$k debe ser una DIRECCIÓN 0x… (40 hex), nunca una clave")
done
IFS=',' read -ra lista_admin <<< "$(v SUPER_ADMIN_WALLETS),$(v ADMIN_WALLETS)"
for a in "${lista_admin[@]}"; do
  a="${a// /}"; [[ -z "$a" ]] && continue
  [[ "$a" =~ ^0x[0-9a-fA-F]{40}$ ]] || errores+=("SUPER_ADMIN_WALLETS/ADMIN_WALLETS: '${a:0:6}…' no es una dirección 0x…")
done

sk=$(v STRIPE_SECRET_KEY)
[[ -n "$sk" && ! "$sk" =~ ^(sk|rk)_(live|test)_ ]] && errores+=("STRIPE_SECRET_KEY no es una clave secreta de Stripe (sk_live_/rk_live_)")
[[ "$sk" =~ ^sk_test_ ]] && avisos+=("STRIPE_SECRET_KEY es de modo test: los pagos no serán reales")
pk=$(v STRIPE_PUBLISHABLE_KEY)
if [[ "$sk" =~ _live_([A-Za-z0-9]{14}) && "$pk" =~ _live_([A-Za-z0-9]{14}) ]]; then
  [[ "${sk:8:14}" == "${pk:8:14}" ]] || errores+=("STRIPE_SECRET_KEY y STRIPE_PUBLISHABLE_KEY son de cuentas de Stripe distintas")
fi
wh=$(v STRIPE_WEBHOOK_SECRET)
[[ -n "$wh" && ! "$wh" =~ ^whsec_ ]] && errores+=("STRIPE_WEBHOOK_SECRET debe empezar por whsec_")
dw=$(v DISCORD_WEBHOOK_URL)
[[ -n "$dw" && ! "$dw" =~ ^https://(discord\.com|discordapp\.com)/api/webhooks/ ]] && \
  errores+=("DISCORD_WEBHOOK_URL no es un webhook (debe ser https://discord.com/api/webhooks/…; un enlace de invitación no sirve)")
[[ "$(v ALLOWED_ORIGINS)" =~ localhost|127\.0\.0\.1 ]] && errores+=("ALLOWED_ORIGINS incluye localhost: en producción solo https://www.bezhas.com,https://bezhas.com")
em=$(v ENCRYPTION_MASTER_KEY)
[[ -n "$em" && ! "$em" =~ ^[0-9a-fA-F]{64}$ ]] && errores+=("ENCRYPTION_MASTER_KEY debe ser 64 caracteres hex (openssl rand -hex 32)")

if ((${#avisos[@]})); then printf '⚠️  %s\n' "${avisos[@]}" >&2; fi
if ((${#errores[@]})); then
  echo "❌ El .env no es apto para producción; no se ha subido nada:" >&2
  printf '   - %s\n' "${errores[@]}" >&2
  exit 1
fi

sa_de() {
  case "$1" in
    backend) echo "${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" ;;
    mcp)     echo "${SA_MCP}@${PROJECT_ID}.iam.gserviceaccount.com" ;;
    *) echo "servicio desconocido: $1" >&2; exit 1 ;;
  esac
}

faltan=()
while read -r nombre servicios requisito; do
  [[ -z "${nombre:-}" || "$nombre" == \#* ]] && continue

  if ! gcloud secrets describe "$nombre" >/dev/null 2>&1; then
    gcloud secrets create "$nombre" --replication-policy=automatic \
      --labels=app=bezhas >/dev/null
    echo "  + creado $nombre"
  fi

  valor="${VALORES[$nombre]:-}"
  actual=$(gcloud secrets versions access latest --secret="$nombre" 2>/dev/null || true)

  if [[ -n "$valor" ]]; then
    if [[ "$valor" != "$actual" ]]; then
      printf '%s' "$valor" | gcloud secrets versions add "$nombre" --data-file=- >/dev/null
      echo "  ↑ nueva versión de $nombre"
    else
      echo "  = $nombre sin cambios"
    fi
  elif [[ -z "$actual" ]]; then
    if [[ "$requisito" == obligatorio ]]; then
      faltan+=("$nombre")
    else
      # Sin versión = no se monta. El despliegue solo pasa a Cloud Run los
      # secretos con versión activa; un marcador tipo "unset" acabaría como
      # REDIS_URL=unset y el backend intentaría conectarse a eso.
      echo "  · $nombre opcional sin valor (no se montará)"
    fi
  fi

  IFS=',' read -ra lista <<< "$servicios"
  for s in "${lista[@]}"; do
    gcloud secrets add-iam-policy-binding "$nombre" --quiet \
      --member="serviceAccount:$(sa_de "$s")" \
      --role=roles/secretmanager.secretAccessor >/dev/null
  done
done < ./secrets.list


if ((${#faltan[@]})); then
  echo
  echo "❌ Faltan secretos obligatorios en $ENV_FILE:" >&2
  printf '   - %s\n' "${faltan[@]}" >&2
  exit 1
fi
echo
echo "✅ Secretos listos. Siguiente paso: ./deploy/gcp/deploy.sh"
