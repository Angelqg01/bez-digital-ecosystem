#!/usr/bin/env bash
# ============================================================================
# 03 — Balanceador HTTPS global + certificado gestionado + Cloud Armor
# ============================================================================
#   bezhas.com       ─┐
#   www.bezhas.com   ─┼─> bezhas-frontend      (bezhas.com redirige a www)
#   api.bezhas.com   ───> bezhas-backend       (REST + WebSocket)
#   mcp.bezhas.com   ───> bezhas-intelligence
#   http://*         ───> 301 a https
#
# Cloud Armor delante de todo: reglas OWASP preconfiguradas (SQLi, XSS, LFI,
# RCE, escáner, protocolo) y limitación por IP. Idempotente.
#
# Requiere que los servicios de Cloud Run existan (deploy.sh).
# Uso: ./deploy/gcp/03-load-balancer.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
gcloud config set project "$PROJECT_ID" >/dev/null

existe() { "$@" >/dev/null 2>&1; }

echo "→ IP estática global"
existe gcloud compute addresses describe "$LB_IP_NAME" --global || \
  gcloud compute addresses create "$LB_IP_NAME" --global --ip-version=IPV4
LB_IP=$(gcloud compute addresses describe "$LB_IP_NAME" --global --format='value(address)')
echo "   IP: $LB_IP"

echo "→ Cloud Armor: $ARMOR_POLICY"
if ! existe gcloud compute security-policies describe "$ARMOR_POLICY"; then
  gcloud compute security-policies create "$ARMOR_POLICY" \
    --description="WAF BeZhas: OWASP + rate limit"
  # Reglas OWASP preconfiguradas (sensibilidad 1 = pocos falsos positivos).
  # ARMOR_PREVIEW=1 las crea en modo «solo registrar»: útil los primeros días
  # para revisar falsos positivos en los logs antes de bloquear.
  PREVIEW=(); [[ "${ARMOR_PREVIEW:-0}" == 1 ]] && PREVIEW=(--preview)
  prio=1000
  for regla in sqli-v33-stable xss-v33-stable lfi-v33-stable rfi-v33-stable \
               rce-v33-stable scannerdetection-v33-stable protocolattack-v33-stable \
               sessionfixation-v33-stable; do
    gcloud compute security-policies rules create "$prio" --security-policy="$ARMOR_POLICY" \
      --expression="evaluatePreconfiguredWaf('${regla}', {'sensitivity': 1})" \
      --action=deny-403 --description="OWASP ${regla}" ${PREVIEW[@]+"${PREVIEW[@]}"}
    prio=$((prio + 10))
  done
  # Los webhooks (Stripe, Telegram) envían JSON arbitrario que puede disparar
  # falsos positivos de las reglas de arriba; se permiten antes. Su
  # autenticidad la comprueba el backend con la firma del emisor.
  gcloud compute security-policies rules create 900 --security-policy="$ARMOR_POLICY" \
    --expression="request.headers['host'] == '${API_HOST}' && (request.path == '/api/stripe/webhook' || request.path == '/api/telegram/webhook')" \
    --action=allow --description="Webhooks firmados"
  # Limitación por IP: 600 peticiones/min; al pasarse, 10 min de bloqueo.
  gcloud compute security-policies rules create 2000 --security-policy="$ARMOR_POLICY" \
    --src-ip-ranges='*' --action=rate-based-ban \
    --rate-limit-threshold-count=600 --rate-limit-threshold-interval-sec=60 \
    --ban-duration-sec=600 --conform-action=allow --exceed-action=deny-429 \
    --enforce-on-key=IP --description="Rate limit por IP"
  # Protección adaptativa (detección de DDoS L7).
  gcloud compute security-policies update "$ARMOR_POLICY" --enable-layer7-ddos-defense
fi

crear_backend() {
  local servicio="$1" neg="${1}-neg" bs="${1}-bs"
  existe gcloud compute network-endpoint-groups describe "$neg" --region="$REGION" || \
    gcloud compute network-endpoint-groups create "$neg" --region="$REGION" \
      --network-endpoint-type=serverless --cloud-run-service="$servicio"
  if ! existe gcloud compute backend-services describe "$bs" --global; then
    gcloud compute backend-services create "$bs" --global \
      --load-balancing-scheme=EXTERNAL_MANAGED \
      --enable-logging --logging-sample-rate=1.0
    gcloud compute backend-services add-backend "$bs" --global \
      --network-endpoint-group="$neg" --network-endpoint-group-region="$REGION"
  fi
  gcloud compute backend-services update "$bs" --global --security-policy="$ARMOR_POLICY" >/dev/null
}

echo "→ Backends serverless"
crear_backend "$FRONTEND_SERVICE"
crear_backend "$BACKEND_SERVICE"
crear_backend "$MCP_SERVICE"

echo "→ URL map"
MAPA=$(mktemp)
cat > "$MAPA" <<YAML
name: ${LB_NAME}
defaultService: https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/global/backendServices/${FRONTEND_SERVICE}-bs
hostRules:
  - hosts: ['${WWW_HOST}']
    pathMatcher: web
  - hosts: ['${DOMAIN}']
    pathMatcher: apex
  - hosts: ['${API_HOST}']
    pathMatcher: api
  - hosts: ['${MCP_HOST}']
    pathMatcher: mcp
pathMatchers:
  - name: web
    defaultService: https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/global/backendServices/${FRONTEND_SERVICE}-bs
  - name: apex
    defaultUrlRedirect:
      hostRedirect: ${WWW_HOST}
      httpsRedirect: true
      redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
      stripQuery: false
  - name: api
    defaultService: https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/global/backendServices/${BACKEND_SERVICE}-bs
  - name: mcp
    defaultService: https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/global/backendServices/${MCP_SERVICE}-bs
YAML
gcloud compute url-maps import "$LB_NAME" --global --source="$MAPA" --quiet
rm -f "$MAPA"

echo "→ Certificado gestionado por Google"
existe gcloud compute ssl-certificates describe "$CERT_NAME" --global || \
  gcloud compute ssl-certificates create "$CERT_NAME" --global \
    --domains="${DOMAIN},${WWW_HOST},${API_HOST},${MCP_HOST}"

echo "→ Política TLS (mínimo TLS 1.2, perfil MODERN)"
existe gcloud compute ssl-policies describe bezhas-tls || \
  gcloud compute ssl-policies create bezhas-tls --profile=MODERN --min-tls-version=1.2

echo "→ Proxy y regla HTTPS"
existe gcloud compute target-https-proxies describe "${LB_NAME}-https" --global || \
  gcloud compute target-https-proxies create "${LB_NAME}-https" --global \
    --url-map="$LB_NAME" --ssl-certificates="$CERT_NAME" --ssl-policy=bezhas-tls
existe gcloud compute forwarding-rules describe "${LB_NAME}-https" --global || \
  gcloud compute forwarding-rules create "${LB_NAME}-https" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED --address="$LB_IP_NAME" \
    --target-https-proxy="${LB_NAME}-https" --ports=443

echo "→ Redirección HTTP → HTTPS"
if ! existe gcloud compute url-maps describe "${LB_NAME}-redirect" --global; then
  REDIR=$(mktemp)
  cat > "$REDIR" <<YAML
name: ${LB_NAME}-redirect
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
YAML
  gcloud compute url-maps import "${LB_NAME}-redirect" --global --source="$REDIR" --quiet
  rm -f "$REDIR"
fi
existe gcloud compute target-http-proxies describe "${LB_NAME}-http" --global || \
  gcloud compute target-http-proxies create "${LB_NAME}-http" --global --url-map="${LB_NAME}-redirect"
existe gcloud compute forwarding-rules describe "${LB_NAME}-http" --global || \
  gcloud compute forwarding-rules create "${LB_NAME}-http" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED --address="$LB_IP_NAME" \
    --target-http-proxy="${LB_NAME}-http" --ports=80

cat <<MSG

✅ Balanceador creado. IP pública: ${LB_IP}

Siguiente paso (DNS en Hostinger):
  HOSTINGER_API_TOKEN=... ./deploy/gcp/04-hostinger-dns.sh

El certificado pasa a ACTIVE entre 15 y 60 min después de que el DNS apunte
a ${LB_IP}. Estado:
  gcloud compute ssl-certificates describe ${CERT_NAME} --global --format='yaml(managed)'
MSG
