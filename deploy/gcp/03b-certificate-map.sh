#!/usr/bin/env bash
# ============================================================================
# 03b — Certificado comodín (*.bezhas.com) con Certificate Manager
# ============================================================================
# Sustituye los certificados clásicos (uno por dominio) por UN certificado
# comodín servido desde un mapa de certificados. Motivo: el proyecto está en
# su límite de certificados clásicos y gas/genesis/prestige no caben.
#
# Límites medidos el 2026-10-27 en el proyecto (`./03b-certificate-map.sh test`):
#   Clásico (compute ssl-certificates): 10 por proyecto (10/10 en uso) y 15
#     por proxy HTTPS como máximo aunque se amplíe la cuota. Cada SubApp nueva
#     gasta uno, o hay que rehacer un certificado compartido.
#   Certificate Manager: 1.000 certificados, 100 mapas y 5.000 entradas por
#     proyecto. Un comodín cubre TODOS los subdominios: añadir una SubApp ya
#     no toca certificados, solo DNS y url-map.
#
# Pasos (cada uno es idempotente; ejecutar en este orden):
#   test     Muestra los límites de las dos opciones y el estado actual. No cambia nada.
#   prepare  Crea autorización DNS, certificado comodín y mapa. NO toca el proxy.
#   dns      Escribe en Hostinger el CNAME de la autorización (y los A de NUEVOS_SUBS).
#   attach   Solo si el comodín está ACTIVE: engancha el mapa al proxy HTTPS.
#   verify   Comprueba que cada dominio sirve ya el comodín (tarda minutos tras attach).
#   cleanup  Solo cuando verify salga todo ✅: quita y borra los certificados clásicos.
#
# Volver atrás tras `attach`:
#   gcloud compute target-https-proxies update bezhas-lb-https --global --clear-certificate-map
# (los certificados clásicos siguen enganchados hasta `cleanup`, así que vuelven a servirse).
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
existe() { "$@" >/dev/null 2>&1; }
P=(--project "$PROJECT_ID")
PROXY="${LB_NAME}-https"
DNSAUTH="${CERT_MAP}-dnsauth"
CERT_WILD="${CERT_NAME}-wildcard"

estado_comodin() {
  gcloud certificate-manager certificates describe "$CERT_WILD" "${P[@]}" \
    --format='value(managed.state)' 2>/dev/null || echo "NO_EXISTE"
}

paso_test() {
  echo "→ Certificados clásicos (compute ssl-certificates)"
  gcloud compute project-info describe "${P[@]}" --format=json \
    | jq -r '.quotas[] | select(.metric=="SSL_CERTIFICATES") | "   cuota del proyecto: \(.usage|floor)/\(.limit|floor) en uso"'
  echo "   máximo por proxy HTTPS: 15 (límite fijo de Google, no ampliable)"
  local n; n=$(gcloud compute target-https-proxies describe "$PROXY" --global "${P[@]}" \
    --format=json | jq '.sslCertificates | length')
  echo "   enganchados en $PROXY: $n"
  echo "→ Certificate Manager"
  gcloud services enable certificatemanager.googleapis.com "${P[@]}" >/dev/null
  curl -sS -H @<(printf 'Authorization: Bearer %s\n' "$(gcloud auth print-access-token)") \
    "https://serviceusage.googleapis.com/v1beta1/projects/${PROJECT_ID}/services/certificatemanager.googleapis.com/consumerQuotaMetrics" \
    | jq -r '.metrics[] | select(.displayName | test("^(Managed certificates|Certificate maps|Certificate map entries|Dns authorizations)$"))
             | "   \(.displayName): \(.consumerQuotaLimits[0].quotaBuckets[0].effectiveLimit)"'
  echo "→ Capacidad para SubApps (subdominios con HTTPS)"
  local libres; libres=$(gcloud compute project-info describe "${P[@]}" --format=json \
    | jq -r '.quotas[] | select(.metric=="SSL_CERTIFICATES") | (.limit - .usage)|floor')
  echo "   clásico, uno por dominio:          $libres más (con cuota ampliada, tope de 15 por proxy)"
  echo "   clásico, compartido (100 SAN):     hasta 100 dominios por certificado, pero cada alta rehace el certificado"
  echo "   comodín en Certificate Manager:    ilimitados (*.${DOMAIN}), sin rehacer nada"
  echo "→ Estado actual del comodín: $(estado_comodin)"
  local mapa; mapa=$(gcloud compute target-https-proxies describe "$PROXY" --global "${P[@]}" --format='value(certificateMap)')
  echo "→ Mapa enganchado al proxy: ${mapa:-ninguno}"
}

paso_prepare() {
  gcloud services enable certificatemanager.googleapis.com "${P[@]}"
  echo "→ Autorización DNS para ${DOMAIN}"
  existe gcloud certificate-manager dns-authorizations describe "$DNSAUTH" "${P[@]}" || \
    gcloud certificate-manager dns-authorizations create "$DNSAUTH" --domain="$DOMAIN" "${P[@]}"
  echo "→ Certificado comodín ${CERT_WILD} (${DOMAIN}, *.${DOMAIN})"
  existe gcloud certificate-manager certificates describe "$CERT_WILD" "${P[@]}" || \
    gcloud certificate-manager certificates create "$CERT_WILD" \
      --domains="${DOMAIN},*.${DOMAIN}" --dns-authorizations="$DNSAUTH" "${P[@]}"
  echo "→ Mapa ${CERT_MAP} y sus entradas"
  existe gcloud certificate-manager maps describe "$CERT_MAP" "${P[@]}" || \
    gcloud certificate-manager maps create "$CERT_MAP" "${P[@]}"
  existe gcloud certificate-manager maps entries describe apex --map="$CERT_MAP" "${P[@]}" || \
    gcloud certificate-manager maps entries create apex --map="$CERT_MAP" \
      --hostname="$DOMAIN" --certificates="$CERT_WILD" "${P[@]}"
  existe gcloud certificate-manager maps entries describe comodin --map="$CERT_MAP" "${P[@]}" || \
    gcloud certificate-manager maps entries create comodin --map="$CERT_MAP" \
      --hostname="*.${DOMAIN}" --certificates="$CERT_WILD" "${P[@]}"
  echo
  echo "Registro que hay que crear en el DNS (o ejecutar el paso 'dns'):"
  gcloud certificate-manager dns-authorizations describe "$DNSAUTH" "${P[@]}" \
    --format='value(dnsResourceRecord.name,dnsResourceRecord.type,dnsResourceRecord.data)' \
    | awk '{printf "   %s  %s  %s\n", $1, $2, $3}'
}

paso_dns() {
  # Mismo patrón de token que 04-hostinger-dns.sh: nunca en argumentos ni en disco.
  local api="https://developers.hostinger.com/api/dns/v1/zones/${DOMAIN}" nombre data
  read -r nombre _ data < <(gcloud certificate-manager dns-authorizations describe "$DNSAUTH" "${P[@]}" \
    --format='value(dnsResourceRecord.name,dnsResourceRecord.type,dnsResourceRecord.data)')
  [[ -n "${data:-}" ]] || { echo "❌ Falta la autorización DNS: ejecuta antes 'prepare'." >&2; exit 1; }
  nombre="${nombre%.${DOMAIN}.}"   # _acme-challenge
  local lb_ip; lb_ip=$(gcloud compute addresses describe "$LB_IP_NAME" --global "${P[@]}" --format='value(address)')
  if [[ -z "${HOSTINGER_API_TOKEN:-}" ]]; then read -rsp "Token de la API de Hostinger: " HOSTINGER_API_TOKEN; echo; fi
  HOSTINGER_API_TOKEN="$(printf '%s' "$HOSTINGER_API_TOKEN" | tr -d '[:space:]')"
  local cab; cab=$(mktemp); chmod 600 "$cab"; trap 'rm -f "$cab"' RETURN
  printf 'Authorization: Bearer %s\nAccept: application/json\nContent-Type: application/json\n' "$HOSTINGER_API_TOKEN" > "$cab"
  unset HOSTINGER_API_TOKEN
  # NUEVOS_SUBS: subdominios que aún no resuelven al balanceador (p. ej. "genesis prestige").
  local cuerpo; cuerpo=$(jq -cn --arg n "$nombre" --arg d "$data" --arg ip "$lb_ip" --arg subs "${NUEVOS_SUBS:-}" '{
    overwrite: true,
    zone: ([{name: $n, type: "CNAME", ttl: 300, records: [{content: $d}]}]
           + ($subs | split(" ") | map(select(length > 0)) | map({name: ., type: "A", ttl: 300, records: [{content: $ip}]})))
  }')
  echo "Plan:"; jq -r '.zone[] | "   poner: \(.name)\t\(.type)\t\(.records[0].content)"' <<< "$cuerpo"
  if [[ "${DRY_RUN:-0}" == 1 ]]; then echo "DRY_RUN=1: no se ha cambiado nada."; return; fi
  if [[ "${ASSUME_YES:-0}" != 1 ]]; then
    read -rp "¿Aplicar en el DNS de ${DOMAIN}? [s/N] " r; [[ "$r" =~ ^[sSyY]$ ]] || { echo "Cancelado."; return; }
  fi
  local codigo; codigo=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT -H @"$cab" --data-binary "$cuerpo" "$api")
  [[ "$codigo" == 2* ]] || { echo "❌ Hostinger PUT → HTTP $codigo" >&2; exit 1; }
  echo "✅ DNS escrito. El comodín suele pasar a ACTIVE en 15-60 min: ./03b-certificate-map.sh test"
}

paso_attach() {
  local st; st=$(estado_comodin)
  [[ "$st" == ACTIVE ]] || { echo "❌ El comodín está en '$st', no ACTIVE. Engancharlo ahora dejaría sin HTTPS los dominios." >&2; exit 1; }
  echo "→ Enganchando ${CERT_MAP} a ${PROXY} (los certificados clásicos se quedan como respaldo)"
  gcloud compute target-https-proxies update "$PROXY" --global "${P[@]}" --certificate-map="$CERT_MAP"
  paso_verify
}

# Comprueba que cada dominio sirve EL COMODÍN (no basta con que el certificado
# mencione el dominio: los clásicos también lo hacen). Google tarda en aplicar
# el mapa (≈15-60 min); hasta entonces se siguen sirviendo los clásicos.
paso_verify() {
  echo "→ Comprobando que cada dominio sirve *.${DOMAIN}"
  local fallos=0 san
  for h in "$DOMAIN" "$WWW_HOST" "$API_HOST" "$MCP_HOST" $(for s in "${SUBAPPS[@]}"; do echo "${s%%:*}.${DOMAIN}"; done); do
    san=$(echo | timeout 10 openssl s_client -connect "${h}:443" -servername "$h" 2>/dev/null | openssl x509 -noout -ext subjectAltName 2>/dev/null)
    if grep -qF "*.${DOMAIN}" <<< "$san"; then
      echo "   ✅ $h"
    else
      echo "   ⏳ $h (aún sirve: $(tail -1 <<< "$san" | tr -d ' ' | cut -c1-60))"; fallos=$((fallos + 1))
    fi
  done
  if ((fallos == 0)); then
    echo "Todos sirven el comodín: ya se puede ejecutar 'cleanup'."
  else
    echo "⚠️  $fallos dominios aún sin el comodín. Repite '$0 verify' en unos minutos; NO ejecutes 'cleanup' hasta que todos salgan ✅."
  fi
}

paso_cleanup() {
  local mapa; mapa=$(gcloud compute target-https-proxies describe "$PROXY" --global "${P[@]}" --format='value(certificateMap)')
  [[ -n "$mapa" ]] || { echo "❌ El proxy no tiene mapa: no se quitan los certificados clásicos." >&2; exit 1; }
  local certs; certs=$(gcloud compute target-https-proxies describe "$PROXY" --global "${P[@]}" \
    --format=json | jq -r '.sslCertificates[]? | split("/") | last')
  [[ -n "$certs" ]] || { echo "No quedan certificados clásicos en el proxy."; return; }
  echo "Se quitarán del proxy y se borrarán:"; sed 's/^/   /' <<< "$certs"
  if [[ "${ASSUME_YES:-0}" != 1 ]]; then
    read -rp "¿Seguir? [s/N] " r; [[ "$r" =~ ^[sSyY]$ ]] || { echo "Cancelado."; return; }
  fi
  # Nunca sin que todos los dominios sirvan ya el comodín: si no, se quedarían sin HTTPS.
  local pendientes; pendientes=$(paso_verify | grep -c "⏳" || true)
  ((pendientes == 0)) || { echo "❌ $pendientes dominios aún no sirven el comodín: no se borra nada." >&2; exit 1; }
  # La API no deja vaciar la lista con un mapa enganchado salvo con --clear-ssl-certificates.
  gcloud compute target-https-proxies update "$PROXY" --global "${P[@]}" --clear-ssl-certificates
  for c in $certs; do gcloud compute ssl-certificates delete "$c" --global "${P[@]}" --quiet; done
  echo "✅ Cuota de certificados clásicos liberada."
}

case "${1:-test}" in
  test) paso_test ;; prepare) paso_prepare ;; dns) paso_dns ;;
  attach) paso_attach ;; verify) paso_verify ;; cleanup) paso_cleanup ;;
  *) echo "Uso: $0 {test|prepare|dns|attach|verify|cleanup}" >&2; exit 1 ;;
esac
