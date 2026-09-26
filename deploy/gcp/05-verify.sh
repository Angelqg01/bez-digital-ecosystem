#!/usr/bin/env bash
# ============================================================================
# 05 — Comprobar DNS, certificados, salud y seguridad de la plataforma
# ============================================================================
# Uso:
#   ./deploy/gcp/05-verify.sh          # una pasada
#   ./deploy/gcp/05-verify.sh --wait   # espera (hasta 90 min) a que los
#                                      # certificados estén ACTIVE y verifica
set -uo pipefail
cd "$(dirname "$0")"
source ./config.env
source ./lib.sh

ESPERAR=0; [[ "${1:-}" == --wait ]] && ESPERAR=1
HOSTS=("$DOMAIN" "$WWW_HOST" "$API_HOST" "$MCP_HOST")

fallos=0
ok()     { echo "  ✅ $*"; }
mal()    { echo "  ❌ $*"; fallos=$((fallos + 1)); }
espera() { echo "  ⏳ $*"; }

LB_IP=$(gcloud compute addresses describe "$LB_IP_NAME" --global --project="$PROJECT_ID" \
          --format='value(address)' 2>/dev/null || echo "${LB_IP:-}")
echo "IP del balanceador: ${LB_IP:-desconocida}"

# ── DNS ─────────────────────────────────────────────────────────────────────
# Google valida los certificados con resolutores públicos. Se consulta a los
# servidores autoritativos (la verdad actual) y a Google/Cloudflare (lo que ve
# el mundo, con caché): si difieren, el TTL antiguo aún no ha caducado.
echo "DNS"
NS=$(dig +short NS "$DOMAIN" @1.1.1.1 | head -n1)
for h in "${HOSTS[@]}"; do
  auto=$( [[ -n "$NS" ]] && dig +short A "$h" "@${NS}" | tail -n1 )
  goog=$(dig +short A "$h" @8.8.8.8 | tail -n1)
  cf=$(dig +short A "$h" @1.1.1.1 | tail -n1)
  if [[ "$goog" == "$LB_IP" && "$cf" == "$LB_IP" ]]; then
    ok "$h → $LB_IP"
  elif [[ "$auto" == "$LB_IP" ]]; then
    ttl=$(dig +noall +answer A "$h" @8.8.8.8 | awk '{print $2}' | head -n1)
    espera "$h: Hostinger ya dice $LB_IP; Google DNS aún ${goog:-nada} (caché, caduca en ~${ttl:-?} s)"
  else
    mal "$h → ${auto:-(sin A)} en Hostinger (esperado $LB_IP): vuelve a ejecutar 04-hostinger-dns.sh"
  fi
  [[ -z "$(dig +short AAAA "$h" @8.8.8.8)" ]] || mal "$h tiene AAAA: los clientes IPv6 no llegarán al balanceador"
done
if [[ -n "$(dig +short DS "$DOMAIN" @8.8.8.8)" ]] && ! dig +dnssec A "$DOMAIN" @8.8.8.8 | grep -q 'flags:.* ad'; then
  mal "DNSSEC mal configurado en $DOMAIN: Google no podrá validar los certificados"
fi

# ── Certificados ────────────────────────────────────────────────────────────
estado_certs() {
  local h n
  for h in "${HOSTS[@]}"; do
    n=$(nombre_cert "$h")
    printf '%s %s %s\n' "$h" "$n" \
      "$(gcloud compute ssl-certificates describe "$n" --global --project="$PROJECT_ID" \
           --format="value(managed.domainStatus.\"$h\")" 2>/dev/null || true)"
  done
}

if ((ESPERAR)); then
  echo "Esperando a los certificados (máx. 90 min; Ctrl+C para salir)…"
  for i in $(seq 1 90); do
    pendientes=$(estado_certs | awk '$3 != "ACTIVE"' | wc -l)
    ((pendientes == 0)) && break
    printf '  %s  pendientes: %s\n' "$(date +%H:%M)" "$(estado_certs | awk '$3 != "ACTIVE" {printf "%s(%s) ", $1, $3}')"
    sleep 60
  done
fi

echo "Certificados"
declare -A CERT_OK=()
while read -r h n st; do
  case "$st" in
    ACTIVE) ok "$h ($n) ACTIVE"; CERT_OK[$h]=1 ;;
    PROVISIONING|FAILED_NOT_VISIBLE|"")
      espera "$h ($n) ${st:-sin estado} — Google reintenta solo; normal hasta 60 min tras el DNS" ;;
    FAILED_CAA_CHECKING|FAILED_CAA_FORBIDDEN)
      mal "$h: un registro CAA impide a Google emitir; vuelve a ejecutar 04-hostinger-dns.sh" ;;
    FAILED_RATE_LIMITED)
      mal "$h: límite de emisión alcanzado; espera unas horas" ;;
    *) mal "$h ($n) $st" ;;
  esac
done < <(estado_certs)

# ── Servicios de Cloud Run ──────────────────────────────────────────────────
# Si un servicio no existe, el balanceador responde 404 él mismo (sin pasar
# por nginx ni Express): eso es lo que se ve cuando deploy.sh no ha terminado.
echo "Servicios"
declare -A SVC_OK=()
for svc in "$FRONTEND_SERVICE" "$BACKEND_SERVICE" "$MCP_SERVICE"; do
  info=$(gcloud run services describe "$svc" --region="$REGION" --project="$PROJECT_ID" \
           --format='value(status.conditions[0].status,status.latestReadyRevisionName)' 2>/dev/null)
  listo=${info%%$'\t'*}; rev=${info#*$'\t'}
  if [[ -z "$info" ]]; then
    mal "$svc no existe: ejecuta ./deploy/gcp/deploy.sh (el balanceador da 404 mientras tanto)"
  elif [[ "$listo" != True ]]; then
    mal "$svc no está listo. Logs: gcloud run services logs read $svc --region=$REGION --limit=50"
  else
    ok "$svc ($rev)"; SVC_OK[$svc]=1
  fi
done
if gcloud run jobs describe bezhas-migrate --region="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  ult=$(gcloud run jobs executions list --job=bezhas-migrate --region="$REGION" --project="$PROJECT_ID" \
          --limit=1 --format='value(status.conditions[0].status)' 2>/dev/null)
  [[ "$ult" == True ]] && ok "migraciones aplicadas (bezhas-migrate)" \
    || mal "la última migración falló: gcloud run jobs executions list --job=bezhas-migrate --region=$REGION"
else
  mal "no hay job de migraciones: deploy.sh no ha llegado a ejecutarse"
fi

# ── HTTP ────────────────────────────────────────────────────────────────────
echo "HTTP"
comprobar() {  # comprobar HOST RUTA CÓDIGO [SERVICIO]
  local h="$1" url="https://$1$2" c
  if [[ -z "${CERT_OK[$h]:-}" ]]; then espera "$url (sin certificado activo todavía)"; return; fi
  if [[ -n "${4:-}" && -z "${SVC_OK[$4]:-}" ]]; then espera "$url (el servicio $4 no está desplegado)"; return; fi
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url")
  [[ "$c" == "$3" ]] && ok "$url → $c" || mal "$url → $c (esperado $3)"
}
comprobar "$WWW_HOST" /health 200 "$FRONTEND_SERVICE"
comprobar "$API_HOST" /api/health 200 "$BACKEND_SERVICE"
comprobar "$MCP_HOST" /api/mcp/health 200 "$MCP_SERVICE"
comprobar "$DOMAIN"   /       301
c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://$WWW_HOST/")
[[ "$c" == 301 ]] && ok "http://$WWW_HOST/ → 301 (redirige a HTTPS)" || mal "http://$WWW_HOST/ → $c (esperado 301)"

# ── Seguridad ───────────────────────────────────────────────────────────────
echo "Seguridad"
if [[ -n "${CERT_OK[$WWW_HOST]:-}" && -n "${SVC_OK[$FRONTEND_SERVICE]:-}" ]]; then
  cab=$(curl -sI --max-time 15 "https://$WWW_HOST/")
  grep -qi '^x-content-type-options: nosniff' <<< "$cab" && ok "X-Content-Type-Options" || mal "falta X-Content-Type-Options"
  grep -qi '^x-frame-options' <<< "$cab" && ok "X-Frame-Options" || mal "falta X-Frame-Options"
  proto=$(curl -s -o /dev/null -w '%{ssl_version}' --tlsv1.1 --tls-max 1.1 --max-time 10 "https://$WWW_HOST/" 2>/dev/null)
  [[ -z "$proto" || "$proto" == 0 ]] && ok "TLS 1.0/1.1 rechazados" || mal "acepta $proto"
else
  espera "cabeceras y TLS: se comprueban cuando ${WWW_HOST} tenga certificado y frontend"
fi
url=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null)
if [[ -n "$url" ]]; then
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url/api/health")
  [[ "$c" == 404 || "$c" == 403 ]] && ok "*.run.app cerrado al público ($c): no se puede saltar Cloud Armor" \
                                   || mal "$url responde $c: el ingress no está restringido al balanceador"
fi

echo
pend=$(( ${#HOSTS[@]} - ${#CERT_OK[@]} ))
if ((fallos > 0)); then
  echo "❌ $fallos comprobaciones fallidas"; exit 1
elif ((pend > 0)); then
  echo "⏳ Sin errores; faltan $pend certificado(s) por activarse. Repite con --wait."; exit 2
else
  echo "✅ Plataforma online: https://$WWW_HOST"
fi
