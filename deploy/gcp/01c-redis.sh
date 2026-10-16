#!/usr/bin/env bash
# ============================================================================
# 01c — Redis gestionado (Memorystore) con IP PRIVADA (idempotente)
# ============================================================================
#   - Redis 7.2, tier BASIC de 1 GB (≈35 USD/mes), en la misma VPC que Cloud SQL
#     y por el mismo Private Service Access: sin IP pública.
#   - AUTH activado; la URL completa (con la contraseña) va DIRECTA a Secret
#     Manager (${SECRET_PREFIX}REDIS_URL) y no se imprime nunca.
#   - Cloud Run llega por Direct VPC egress (private-ranges-only), como a Cloud SQL.
#
# Hasta el 2026-10-16 ${SECRET_PREFIX}REDIS_URL valía redis://localhost:6379: en Cloud
# Run no hay nada ahí, así que la api funcionaba sin caché compartida, sin el
# límite global del chat entre instancias y con /api/health en `redis: down`.
#
# Después de ejecutarlo hay que crear una revisión nueva para que la api lea el
# secreto (ver el final del script).
#
# Uso:  ./deploy/gcp/01c-redis.sh          (REDIS_TIER=standard para alta disponibilidad)
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
gcloud config set project "$PROJECT_ID" >/dev/null

INSTANCIA="${REDIS_INSTANCE:-bezhas-redis}"
TIER="${REDIS_TIER:-basic}"
existe() { "$@" >/dev/null 2>&1; }

echo "→ Activando la API de Memorystore"
gcloud services enable redis.googleapis.com --quiet

if ! existe gcloud redis instances describe "$INSTANCIA" --region="$REGION"; then
  echo "→ Creando $INSTANCIA ($TIER, 1 GB, Redis 7.2) — tarda unos minutos"
  gcloud redis instances create "$INSTANCIA" --region="$REGION" \
    --tier="$TIER" --size=1 --redis-version=redis_7_2 \
    --network="projects/${PROJECT_ID}/global/networks/${VPC_NETWORK}" \
    --connect-mode=PRIVATE_SERVICE_ACCESS \
    --enable-auth \
    --labels=app=bezhas --quiet
fi

HOST=$(gcloud redis instances describe "$INSTANCIA" --region="$REGION" --format='value(host)')
PORT=$(gcloud redis instances describe "$INSTANCIA" --region="$REGION" --format='value(port)')
echo "→ $INSTANCIA en ${HOST}:${PORT} (IP privada)"

# La contraseña sólo pasa por una tubería hacia Secret Manager.
SECRETO="${SECRET_PREFIX}REDIS_URL"
existe gcloud secrets describe "$SECRETO" || gcloud secrets create "$SECRETO" --replication-policy=automatic
gcloud redis instances get-auth-string "$INSTANCIA" --region="$REGION" --format='value(authString)' \
  | python3 -c 'import sys,urllib.parse as u; a=sys.stdin.read().strip(); sys.stdout.write(f"redis://:{u.quote(a, safe=str())}@{sys.argv[1]}:{sys.argv[2]}")' "$HOST" "$PORT" \
  | gcloud secrets versions add "$SECRETO" --data-file=- >/dev/null
echo "→ ${SECRETO} actualizado (nueva versión)"

cat <<EOF

✅ Redis listo. Para que la api lo use, nueva revisión (no cambia nada más):
   gcloud run services update ${BACKEND_SERVICE} --region ${REGION} --update-secrets REDIS_URL=${SECRETO}:latest
   curl -s https://${API_HOST}/api/health   # services.redis = "up"
EOF
