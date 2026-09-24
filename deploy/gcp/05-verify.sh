#!/usr/bin/env bash
# ============================================================================
# 05 — Comprobar DNS, certificado, cabeceras y salud de los servicios
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")"
source ./config.env

fallos=0
ok()   { echo "  ✅ $*"; }
mal()  { echo "  ❌ $*"; fallos=$((fallos + 1)); }

LB_IP=$(gcloud compute addresses describe "$LB_IP_NAME" --global --project="$PROJECT_ID" --format='value(address)' 2>/dev/null || echo "${LB_IP:-}")
echo "IP del balanceador: ${LB_IP:-desconocida}"

echo "DNS"
for h in "$DOMAIN" "$WWW_HOST" "$API_HOST" "$MCP_HOST"; do
  ip=$(dig +short A "$h" @1.1.1.1 | tail -n1)
  [[ "$ip" == "$LB_IP" ]] && ok "$h → $ip" || mal "$h → ${ip:-(sin A)} (esperado $LB_IP)"
  [[ -z "$(dig +short AAAA "$h" @1.1.1.1)" ]] || mal "$h tiene AAAA: los clientes IPv6 no llegarán al balanceador"
done

echo "Certificado"
estado=$(gcloud compute ssl-certificates describe "$CERT_NAME" --global --project="$PROJECT_ID" --format='value(managed.status)' 2>/dev/null)
[[ "$estado" == ACTIVE ]] && ok "$CERT_NAME ACTIVE" || mal "$CERT_NAME ${estado:-no encontrado} (PROVISIONING es normal la primera hora)"

echo "HTTP"
comprobar() {  # comprobar URL código-esperado
  local c; c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1")
  [[ "$c" == "$2" ]] && ok "$1 → $c" || mal "$1 → $c (esperado $2)"
}
comprobar "https://${WWW_HOST}/health" 200
comprobar "https://${API_HOST}/api/health" 200
comprobar "https://${MCP_HOST}/api/mcp/health" 200
comprobar "https://${DOMAIN}/" 301
comprobar "http://${WWW_HOST}/" 301

echo "Seguridad"
h=$(curl -sI --max-time 15 "https://${WWW_HOST}/")
grep -qi '^x-content-type-options: nosniff' <<< "$h" && ok "nosniff" || mal "falta X-Content-Type-Options"
grep -qi '^x-frame-options' <<< "$h" && ok "X-Frame-Options" || mal "falta X-Frame-Options"
url=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null)
if [[ -n "$url" ]]; then
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url/api/health")
  [[ "$c" == 404 || "$c" == 403 ]] && ok "*.run.app cerrado al público ($c): no se puede saltar Cloud Armor" \
                                   || mal "$url responde $c: el ingress no está restringido al balanceador"
fi

echo
((fallos == 0)) && echo "✅ Todo correcto" || { echo "❌ $fallos comprobaciones fallidas"; exit 1; }
