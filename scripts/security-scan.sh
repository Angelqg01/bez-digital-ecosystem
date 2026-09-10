#!/usr/bin/env bash
#
# security-scan.sh — lanza HawkScan (DAST) contra la API de BeZhas.
#
# ═══════════════════════════════════════════════════════════════════════════
#  POR QUÉ UN GUION Y NO "docker run stackhawk/hawkscan" A PELO
# ═══════════════════════════════════════════════════════════════════════════
#
# Porque el comando a pelo se equivoca de tres formas y las tres son caras:
#
#   1. Se lanza sin que la API esté arriba, el escáner no encuentra nada y el
#      informe sale limpio. Un informe limpio por no haber mirado es peor que
#      no tener informe: se archiva como si significara algo.
#   2. Se lanza SIN clave de escaneo, así que sólo ve lo público —y el 90% de
#      la superficie de BeZhas está detrás de x-api-key—. Mismo problema.
#   3. Se lanza apuntando a producción sin querer. El escáner manda peticiones
#      hostiles de verdad contra el sistema que usan los clientes.
#
# Este guion comprueba las tres cosas ANTES de arrancar nada y se niega a seguir
# si alguna falla.
#
# Uso:
#   export HAWK_API_KEY="hawk.xxxx"      # de app.stackhawk.com → API keys
#   export HAWK_APP_ID="uuid"            # de la aplicación creada allí
#   ./scripts/security-scan.sh
#
#   ./scripts/security-scan.sh --check   # sólo comprueba requisitos, no escanea

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOLO_COMPROBAR=false
[[ "${1:-}" == "--check" ]] && SOLO_COMPROBAR=true

HOST="${HAWK_HOST:-http://localhost:3001}"

err() { printf '\033[31m✗\033[0m %s\n' "$1" >&2; }
ok()  { printf '\033[32m✓\033[0m %s\n' "$1"; }
avi() { printf '\033[33m!\033[0m %s\n' "$1"; }

fallos=0

# ── 1. La credencial de StackHawk ────────────────────────────────────────────
# No se puede generar aquí: es una credencial de su cuenta.
if [[ -z "${HAWK_API_KEY:-}" ]]; then
    err "Falta HAWK_API_KEY."
    cat >&2 <<'AYUDA'

     La clave la emite StackHawk, no este repositorio. Para obtenerla:

       1. Entra en https://app.stackhawk.com
       2. Settings → API keys → Create API key
       3. export HAWK_API_KEY="hawk.xxxxxxxxxxxx"

     Y el identificador de la aplicación:

       1. Applications → Add application (o abre la que ya exista)
       2. export HAWK_APP_ID="<el uuid que aparece en la URL>"

     No las metas en el .env versionado: son credenciales de cuenta.

AYUDA
    fallos=$((fallos + 1))
else
    ok "HAWK_API_KEY presente (${HAWK_API_KEY:0:9}…)"
fi

if [[ -z "${HAWK_APP_ID:-}" ]]; then
    err "Falta HAWK_APP_ID (identificador de la aplicación en StackHawk)."
    fallos=$((fallos + 1))
else
    ok "HAWK_APP_ID presente"
fi

# ── 2. Nunca contra producción ───────────────────────────────────────────────
# El escáner manda peticiones hostiles reales. Contra api.bez.digital eso es un
# ataque a los clientes, aunque lo lancemos nosotros.
if [[ "$HOST" == *"bez.digital"* && "${HAWK_ALLOW_PROD:-}" != "yes-lo-se" ]]; then
    err "HAWK_HOST apunta a producción ($HOST)."
    echo "     HawkScan manda peticiones hostiles de verdad: contra producción eso" >&2
    echo "     es un ataque a tus propios clientes. Escanea en local o en staging." >&2
    echo "     Si es un entorno de pruebas con ese dominio: HAWK_ALLOW_PROD=yes-lo-se" >&2
    fallos=$((fallos + 1))
else
    ok "Objetivo: $HOST"
fi

# ── 3. La API tiene que estar respondiendo ───────────────────────────────────
SALUD="${HAWK_HEALTH_PATH:-/api/health}"
if curl -sf -m 5 "${HOST}${SALUD}" >/dev/null 2>&1; then
    ok "La API responde en ${HOST}${SALUD}"
else
    err "La API no responde en ${HOST}${SALUD}."
    echo "     Un escaneo contra algo apagado no encuentra nada y el informe sale" >&2
    echo "     limpio por no haber mirado. Levántala: docker compose up -d api" >&2
    fallos=$((fallos + 1))
fi

# ── 4. Clave de escaneo, para ver más que las rutas públicas ─────────────────
if [[ -z "${HAWK_SCAN_API_KEY:-}" ]]; then
    avi "Sin HAWK_SCAN_API_KEY: el escaneo sólo verá las rutas públicas."
    echo "     El 90% de la superficie de BeZhas está detrás de x-api-key. Crea una" >&2
    echo "     clave de SANDBOX para esto y revócala después:" >&2
    echo "       node api/scripts/provision-gateway-keys.js --app bezhas-app --out /tmp/scan.key" >&2
    echo "     Nunca uses una clave de producción ni la de un cliente: el escáner escribe." >&2
else
    ok "Clave de escaneo presente: se cubrirán también las rutas autenticadas"
fi

# ── 5. Runtime ───────────────────────────────────────────────────────────────
if command -v hawk >/dev/null 2>&1; then
    RUNTIME="cli"; ok "HawkScan CLI disponible"
elif docker info >/dev/null 2>&1; then
    RUNTIME="docker"; ok "Docker disponible (se usará stackhawk/hawkscan)"
else
    err "Ni la CLI de HawkScan ni Docker están disponibles."
    fallos=$((fallos + 1))
fi

if (( fallos > 0 )); then
    err "$fallos requisito(s) sin cumplir. No se escanea."
    exit 1
fi

$SOLO_COMPROBAR && { ok "Todo listo para escanear."; exit 0; }

# ── Escaneo ──────────────────────────────────────────────────────────────────
echo
echo "▶ Escaneando $HOST …"
cd "$RAIZ"

if [[ "$RUNTIME" == "cli" ]]; then
    exec hawk scan stackhawk.yml
fi

# --network=host para que localhost dentro del contenedor sea el de la máquina.
exec docker run --rm --network=host \
    -e HAWK_API_KEY \
    -e HAWK_APP_ID \
    -e HAWK_ENV \
    -e HAWK_HOST \
    -e HAWK_SCAN_API_KEY \
    -e HAWK_OPENAPI \
    -v "$RAIZ:/hawk:ro" \
    -t stackhawk/hawkscan:latest \
    /hawk/stackhawk.yml
