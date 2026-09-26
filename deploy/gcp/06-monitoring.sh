#!/usr/bin/env bash
# ============================================================================
# 06 — Monitorización: comprobaciones de disponibilidad y aviso por email
# ============================================================================
# Con clientes reales, la caída hay que saberla antes que ellos. Crea (o deja
# como está, si ya existe):
#   - un canal de aviso por email;
#   - una comprobación de disponibilidad cada minuto, desde varias regiones del
#     mundo, para www (/), api (/api/health) y mcp (metadatos OAuth);
#   - una alerta por dominio: si falla durante 5 min, llega un email (y otro
#     cuando se recupera).
# Usa la API REST de Cloud Monitoring con tu sesión de gcloud. Idempotente:
# lo que ya existe (mismo nombre) no se duplica.
#
# Uso:  ALERT_EMAIL=tu@correo ./deploy/gcp/06-monitoring.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
command -v jq >/dev/null || { echo "Falta jq" >&2; exit 1; }

if [[ -z "${ALERT_EMAIL:-}" ]]; then
  read -rp "Email que recibirá los avisos: " ALERT_EMAIL
fi
[[ "$ALERT_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || { echo "Email no válido" >&2; exit 2; }

gcloud services enable monitoring.googleapis.com --project="$PROJECT_ID" >/dev/null
API="https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}"
TOKEN=$(gcloud auth print-access-token)
# El token viaja en una cabecera leída de un fichero temporal, no en la línea
# de comandos (que se vería en `ps`).
CAB=$(mktemp); trap 'rm -f "$CAB"' EXIT
printf 'Authorization: Bearer %s\nContent-Type: application/json\n' "$TOKEN" > "$CAB"
llamar() {  # llamar MÉTODO RUTA [JSON]
  local r
  r=$(curl -sS -X "$1" -H @"$CAB" ${3:+--data "$3"} "${API}$2")
  if jq -e '.error' >/dev/null 2>&1 <<< "$r"; then
    echo "❌ Cloud Monitoring: $(jq -r '.error.message' <<< "$r")" >&2; exit 1
  fi
  printf '%s' "$r"
}

echo "→ Canal de aviso: $ALERT_EMAIL"
CANAL=$(llamar GET "/notificationChannels?filter=$(jq -rn --arg e "$ALERT_EMAIL" '"type=\"email\" AND labels.email_address=\"\($e)\""|@uri')" \
          | jq -r '.notificationChannels[0].name // empty')
if [[ -z "$CANAL" ]]; then
  CANAL=$(llamar POST "/notificationChannels" "$(jq -n --arg e "$ALERT_EMAIL" \
    '{type:"email", displayName:"BeZhas — \($e)", labels:{email_address:$e}}')" | jq -r '.name')
fi

vigilar() {  # vigilar HOST RUTA
  local host="$1" ruta="$2" nombre="bezhas ${1}" check id politica
  echo "→ $host$ruta"
  check=$(llamar GET "/uptimeCheckConfigs?pageSize=100" \
            | jq -r --arg n "$nombre" '.uptimeCheckConfigs[]? | select(.displayName == $n) | .name' | head -n1)
  if [[ -z "$check" ]]; then
    check=$(llamar POST "/uptimeCheckConfigs" "$(jq -n --arg n "$nombre" --arg h "$host" --arg p "$ruta" --arg pr "$PROJECT_ID" '{
      displayName: $n,
      monitoredResource: {type: "uptime_url", labels: {project_id: $pr, host: $h}},
      httpCheck: {path: $p, port: 443, useSsl: true, validateSsl: true, requestMethod: "GET"},
      period: "60s", timeout: "10s"}')" | jq -r '.name')
  fi
  id=${check##*/}

  politica="BeZhas caído: ${host}"
  if [[ -z "$(llamar GET "/alertPolicies?pageSize=100" | jq -r --arg n "$politica" '.alertPolicies[]? | select(.displayName == $n) | .name')" ]]; then
    llamar POST "/alertPolicies" "$(jq -n --arg n "$politica" --arg id "$id" --arg c "$CANAL" --arg h "$host" --arg p "$ruta" '{
      displayName: $n,
      combiner: "OR",
      conditions: [{
        displayName: "La comprobación de \($h) falla",
        conditionThreshold: {
          filter: "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"\($id)\"",
          aggregations: [{alignmentPeriod: "300s", perSeriesAligner: "ALIGN_NEXT_OLDER",
                          crossSeriesReducer: "REDUCE_COUNT_FALSE", groupByFields: ["resource.label.host"]}],
          comparison: "COMPARISON_GT", thresholdValue: 1, duration: "300s", trigger: {count: 1}}}],
      notificationChannels: [$c],
      alertStrategy: {autoClose: "1800s"},
      documentation: {mimeType: "text/markdown", content:
        "https://\($h)\($p) no responde desde varias regiones.\n\n1. ./deploy/gcp/05-verify.sh\n2. gcloud run services logs read <servicio> --region=us-central1 --limit=100\n3. Volver a la revisión anterior: ver deploy/gcp/README.md → Operación"}}')" >/dev/null
  fi
}

vigilar "$WWW_HOST" /
vigilar "$API_HOST" /api/health
vigilar "$MCP_HOST" /.well-known/oauth-authorization-server

cat <<MSG

✅ Monitorización activa. Si www, api o mcp fallan 5 min seguidos, llega un
   email a ${ALERT_EMAIL} (y otro al recuperarse).
   Panel: https://console.cloud.google.com/monitoring/uptime?project=${PROJECT_ID}
MSG
