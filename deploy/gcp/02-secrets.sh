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
# Los secretos se guardan como ${SECRET_PREFIX}CLAVE (config.env).
#
# Uso:  ./deploy/gcp/02-secrets.sh ~/bezhas-blockchain.env
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
[[ "$(v AUTH_BYPASS)" == true || "$(v AUTH_BYPASS_ENABLED)" == true ]] && errores+=("AUTH_BYPASS=true desactiva la autenticación: quítalo del .env")
[[ "$(v NODE_ENV)" == development ]] && errores+=("NODE_ENV=development: quítalo del .env (el despliegue fija production)")
[[ "$(v DB_MOCK_FALLBACK)" == true ]] && errores+=("DB_MOCK_FALLBACK=true serviría datos falsos si cae la base de datos: quítalo")
[[ -n "$(v DEPLOYER_PRIVATE_KEY)" ]] && avisos+=("DEPLOYER_PRIVATE_KEY está en el .env: NO se sube (la clave que despliega contratos no debe vivir en un servidor). Bórrala del fichero.")

for k in POLYGON_RPC_URL RPC_URL BEZHAS_L2_RPC_URL; do
  [[ "$(v "$k")" =~ amoy|mumbai|sepolia|goerli|testnet|localhost|127\.0\.0\.1 ]] && \
    errores+=("$k apunta a una testnet o a local; producción es mainnet")
done

# Secretos internos: largos, y distintos entre sí (un secreto reutilizado
# convierte la filtración de uno en la de todos).
declare -A visto=()
for k in JWT_SECRET INTERNAL_API_KEY WALLET_VAULT_SECRET SECRET_VAULT_KEY TELEMETRY_PSEUDONYM_KEY \
         MONITOR_ACCESS_TOKEN BRIDGE_API_KEY AGENT_RUNTIME_API_KEY EDGE_NODE_API_KEY CONTROL_JWT; do
  val=$(v "$k"); [[ -z "$val" ]] && continue
  ((${#val} >= 32)) || errores+=("$k tiene menos de 32 caracteres (usa 00-generar-env.sh)")
  if [[ -n "${visto[$val]:-}" ]]; then errores+=("$k y ${visto[$val]} tienen el mismo valor"); else visto[$val]=$k; fi
done
unset visto

# Wallets calientes: claves de verdad, y una por papel.
declare -A wallet=()
for k in OPERATOR_PRIVATE_KEY AGENT_PRIVATE_KEY EDGE_NODE_PRIVATE_KEY; do
  val=$(v "$k"); [[ -z "$val" ]] && continue
  es_clave_priv "$val" || { errores+=("$k no es una clave privada (64 hex)"); continue; }
  n=$(norm_clave "$val")
  [[ "$n" =~ ^0{63}[0-9a-f]$ ]] && errores+=("$k es una clave de juguete (0x…01)")
  [[ -n "$(v DEPLOYER_PRIVATE_KEY)" && "$n" == "$(norm_clave "$(v DEPLOYER_PRIVATE_KEY)")" ]] && \
    errores+=("$k es la clave del DEPLOYER de los contratos: usa una wallet caliente dedicada")
  if [[ -n "${wallet[$n]:-}" ]]; then errores+=("$k y ${wallet[$n]} son la misma wallet: una wallet dedicada por servicio"); else wallet[$n]=$k; fi
done
unset wallet
for k in TREASURY_WALLET; do
  val=$(v "$k"); [[ -z "$val" ]] && continue
  [[ "$val" =~ ^0x[0-9a-fA-F]{40}$ ]] || errores+=("$k debe ser una DIRECCIÓN 0x… (40 hex), nunca una clave")
done

ph=$(v ADMIN_PASSWORD_HASH)
[[ -n "$ph" && ! "$ph" =~ ^\$2[aby]\$[0-9]{2}\$ ]] && errores+=("ADMIN_PASSWORD_HASH no es un hash bcrypt (\$2a\$…): genéralo con 00-generar-env.sh, nunca pongas la contraseña en claro")

sk=$(v STRIPE_SECRET_KEY)
[[ -n "$sk" && ! "$sk" =~ ^(sk|rk)_(live|test)_ ]] && errores+=("STRIPE_SECRET_KEY no es una clave secreta de Stripe (sk_live_/rk_live_)")
[[ "$sk" =~ ^sk_test_ ]] && avisos+=("STRIPE_SECRET_KEY es de modo test: los pagos no serán reales")
wh=$(v STRIPE_WEBHOOK_SECRET)
[[ -n "$wh" && ! "$wh" =~ ^whsec_ ]] && errores+=("STRIPE_WEBHOOK_SECRET debe empezar por whsec_")
[[ -n "$sk" && -z "$wh" ]] && avisos+=("STRIPE_SECRET_KEY sin STRIPE_WEBHOOK_SECRET: los pagos no se confirmarán")

if ((${#avisos[@]})); then printf '⚠️  %s\n' "${avisos[@]}" >&2; fi
if ((${#errores[@]})); then
  echo "❌ El .env no es apto para producción; no se ha subido nada:" >&2
  printf '   - %s\n' "${errores[@]}" >&2
  exit 1
fi

sa_de() {
  case "$1" in
    api)             echo "${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" ;;
    web)             echo "${SA_FRONTEND}@${PROJECT_ID}.iam.gserviceaccount.com" ;;
    aegis|aigw|agent) echo "${SA_MCP}@${PROJECT_ID}.iam.gserviceaccount.com" ;;
    edge)            echo "${SA_EDGE}@${PROJECT_ID}.iam.gserviceaccount.com" ;;
    *) echo "servicio desconocido en secrets.list: $1" >&2; exit 1 ;;
  esac
}

faltan=()
while read -r clave servicios requisito _; do
  [[ -z "${clave:-}" || "$clave" == \#* ]] && continue
  nombre="${SECRET_PREFIX}${clave}"

  if ! gcloud secrets describe "$nombre" >/dev/null 2>&1; then
    gcloud secrets create "$nombre" --replication-policy=automatic \
      --labels=app=bezhas,platform=blockchain >/dev/null
    echo "  + creado $nombre"
  fi

  valor="${VALORES[$clave]:-}"
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
      faltan+=("$clave")
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
