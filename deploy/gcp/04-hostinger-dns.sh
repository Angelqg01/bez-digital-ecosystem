#!/usr/bin/env bash
# ============================================================================
# 04 — Apuntar bezhas.com (DNS en Hostinger) al balanceador de Google Cloud
# ============================================================================
# Usa la API de Hostinger (developers.hostinger.com, DNS v1):
#   1. Descarga la zona actual y guarda una COPIA DE SEGURIDAD local.
#   2. Elimina lo que choca con los registros nuevos: CNAME de www/api/mcp
#      (Hostinger crea `www CNAME bezhas.com` por defecto) y AAAA de esos
#      nombres (IPv6 del aparcamiento de Hostinger: los clientes IPv6 seguirían
#      yendo allí).
#   3. Si la zona tiene registros CAA, añade pki.goog y letsencrypt.org; sin
#      ellos Google no puede emitir el certificado gestionado.
#   4. Valida y escribe A @, www, api, mcp → IP del balanceador (TTL 300).
#
# No toca MX, TXT (SPF/DKIM/DMARC) ni nada más: el correo sigue igual.
#
# El token NUNCA se pasa como argumento ni se guarda en el repositorio. Se lee
# de HOSTINGER_API_TOKEN o se pide por teclado sin eco, y se entrega a curl
# por un fichero temporal con permisos 600 que se borra al salir.
#
# Uso:
#   export HOSTINGER_API_TOKEN=...        # o déjalo vacío y se pedirá
#   ./deploy/gcp/04-hostinger-dns.sh              # pide confirmación
#   DRY_RUN=1 ./deploy/gcp/04-hostinger-dns.sh    # solo muestra el plan
#   LB_IP=34.x.x.x ./deploy/gcp/04-hostinger-dns.sh   # sin gcloud
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env

API="https://developers.hostinger.com/api/dns/v1/zones/${DOMAIN}"
command -v jq >/dev/null || { echo "Falta jq" >&2; exit 1; }

LB_IP="${LB_IP:-$(gcloud compute addresses describe "$LB_IP_NAME" --global \
          --project="$PROJECT_ID" --format='value(address)')}"
[[ "$LB_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "IP del balanceador no válida: '$LB_IP'" >&2; exit 1; }

if [[ -z "${HOSTINGER_API_TOKEN:-}" ]]; then
  read -rsp "Token de la API de Hostinger: " HOSTINGER_API_TOKEN; echo
fi
CABECERAS=$(mktemp); chmod 600 "$CABECERAS"
trap 'rm -f "$CABECERAS"' EXIT
printf 'Authorization: Bearer %s\nAccept: application/json\nContent-Type: application/json\n' \
  "$HOSTINGER_API_TOKEN" > "$CABECERAS"
unset HOSTINGER_API_TOKEN

hapi() {  # hapi MÉTODO [RUTA] [CUERPO]
  local metodo="$1" ruta="${2:-}" cuerpo="${3:-}" salida codigo
  salida=$(mktemp)
  codigo=$(curl -sS -o "$salida" -w '%{http_code}' -X "$metodo" -H @"$CABECERAS" \
           ${cuerpo:+--data-binary "$cuerpo"} "${API}${ruta}")
  if [[ "$codigo" != 2* ]]; then
    echo "❌ Hostinger $metodo ${ruta:-/} → HTTP $codigo" >&2
    jq . "$salida" >&2 2>/dev/null || cat "$salida" >&2
    rm -f "$salida"; return 1
  fi
  cat "$salida"; rm -f "$salida"
}

echo "→ Descargando zona de $DOMAIN"
ZONA=$(hapi GET)
mkdir -p ./dns-backups && chmod 700 ./dns-backups
COPIA="./dns-backups/${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
printf '%s\n' "$ZONA" > "$COPIA"; chmod 600 "$COPIA"
echo "   Copia de seguridad: deploy/gcp/${COPIA#./}"

NOMBRES='["@","www","api","mcp"]'
echo "→ Registros actuales de @, www, api, mcp:"
jq -r --argjson n "$NOMBRES" '.[] | select(.name as $x | $n | index($x))
  | "   \(.name)\t\(.type)\t\(.ttl)\t\([.records[].content] | join(", "))"' <<< "$ZONA"

# Filtros de borrado: CNAME/ALIAS/AAAA en los cuatro nombres (si existen).
BORRAR=$(jq -c --argjson n "$NOMBRES" '[.[] | select((.name as $x | $n | index($x))
  and (.type == "CNAME" or .type == "ALIAS" or .type == "AAAA")) | {name, type}]' <<< "$ZONA")

# CAA: solo si ya hay alguno (sin CAA cualquier CA puede emitir).
CAA_NUEVOS='[]'
if jq -e 'any(.[]; .type == "CAA" and .name == "@")' <<< "$ZONA" >/dev/null; then
  CAA_NUEVOS=$(jq -c '[.[] | select(.type=="CAA" and .name=="@") | .records[].content] as $c
    | [ ("0 issue \"pki.goog\""), ("0 issue \"letsencrypt.org\"") ]
    | map(select(. as $v | $c | index($v) | not))
    | if length > 0 then [{name:"@", type:"CAA", ttl:3600, records: map({content: .})}] else [] end' <<< "$ZONA")
fi

CUERPO=$(jq -cn --arg ip "$LB_IP" --argjson caa "$CAA_NUEVOS" '{
  overwrite: true,
  zone: (([ "@", "www", "api", "mcp" ]
          | map({name: ., type: "A", ttl: 300, records: [{content: $ip}]})) + $caa)
}')
# overwrite:true solo sustituye los registros con el MISMO nombre y tipo que
# se envían; el resto de la zona no se toca. Para CAA eso significaría borrar
# los existentes, así que se reenvían junto con los nuevos.
if [[ "$CAA_NUEVOS" != '[]' ]]; then
  CUERPO=$(jq -c --argjson zona "$ZONA" '
    .zone |= map(if .type == "CAA" then
      .records = ([$zona[] | select(.type=="CAA" and .name=="@") | .records[] | {content}] + .records)
      else . end)' <<< "$CUERPO")
fi

echo
echo "Plan:"
echo "   borrar: $(jq -r 'map("\(.name) \(.type)") | join(", ") | if . == "" then "(nada)" else . end' <<< "$BORRAR")"
jq -r '.zone[] | "   poner:  \(.name)\t\(.type)\t\([.records[].content] | join(", "))"' <<< "$CUERPO"
echo

echo "→ Validando con Hostinger"
if hapi POST /validate "$CUERPO" >/dev/null; then
  echo "   Validación correcta"
elif [[ "$BORRAR" != '[]' ]]; then
  # Un A en `www` choca con el CNAME que aún existe; se borra justo antes de
  # escribir, así que aquí la validación puede fallar por eso y solo por eso.
  echo "   ⚠️  La validación falla, probablemente por los registros que se van a borrar (ver arriba)."
else
  exit 1
fi

if [[ "${DRY_RUN:-0}" == 1 ]]; then echo "DRY_RUN=1: no se ha cambiado nada."; exit 0; fi
if [[ "${ASSUME_YES:-0}" != 1 ]]; then
  read -rp "¿Aplicar estos cambios en el DNS de ${DOMAIN}? [s/N] " r
  [[ "$r" =~ ^[sSyY]$ ]] || { echo "Cancelado."; exit 0; }
fi

if [[ "$BORRAR" != '[]' ]]; then
  echo "→ Borrando registros en conflicto"
  hapi DELETE "" "$(jq -cn --argjson f "$BORRAR" '{filters: $f}')" >/dev/null
fi
echo "→ Escribiendo registros A"
hapi PUT "" "$CUERPO" >/dev/null

cat <<MSG

✅ DNS actualizado: ${DOMAIN}, ${WWW_HOST}, ${API_HOST}, ${MCP_HOST} → ${LB_IP}

Para deshacer, la zona anterior está en deploy/gcp/${COPIA#./}
Propagación: minutos (TTL 300); el certificado tarda 15–60 min más.
Comprobar: ./deploy/gcp/05-verify.sh
MSG
