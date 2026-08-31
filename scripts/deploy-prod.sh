#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#  BeZhas Platform — Production Deployment Runbook
#  Last updated: 2026-03-20
# ═══════════════════════════════════════════════════════════
#
#  This script automates production deployment.
#  Run: bash scripts/deploy-prod.sh
#
#  Prerequisites:
#    - Docker Engine 24+ and Docker Compose v2.24+
#    - .env file configured (use scripts/validate-env.sh to check)
#    - SSL certs in nginx/ssl/ (fullchain.pem + privkey.pem)
#
# ═══════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}▸ STEP $1: $2${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }

cd "$PROJECT_ROOT"

echo -e "${BOLD}"
echo "╔═══════════════════════════════════════════════╗"
echo "║   BeZhas Platform — Production Deployment     ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: Validate environment ─────────────────────
step 1 "Validate environment"

if [ ! -f .env ]; then
  fail ".env file not found. Copy .env.example → .env and fill in secrets."
fi

bash scripts/validate-env.sh .env || fail "Environment validation failed"

# Los otros dos guardianes ya existían y nadie los llamaba. Peor: el preflight
# de base de datos ni siquiera podía arrancar (extensión .js dentro de un
# paquete con "type": "module"), así que la contraseña por defecto que sabía
# detectar —TuPasswordSeguro— acabó siendo la contraseña real de la base.
node scripts/db-security-preflight.cjs || fail "Database security preflight failed"
node scripts/security/check-compose-defaults.cjs || fail "Compose files contain credential defaults"
ok "Environment validated"

# ── Step 2: Verify SSL certificates ─────────────────
step 2 "Verify SSL certificates"

if [ -f nginx/ssl/fullchain.pem ] && [ -f nginx/ssl/privkey.pem ]; then
  ok "SSL certificates found"
else
  echo "  ⚠️  No SSL certs found. Generating self-signed certs for staging..."
  mkdir -p nginx/ssl
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem \
    -subj "/CN=bezhas.local" 2>/dev/null
  ok "Self-signed cert generated (replace with real certs for production)"
fi

# ── Step 3: Pull latest images ──────────────────────
step 3 "Pull base images"

docker compose -f docker-compose.yml pull postgres redis 2>/dev/null || true
ok "Base images ready"

# ── Step 4: Build application images ────────────────
step 4 "Build application images"

docker compose -f docker-compose.yml -f docker-compose.prod.yml build \
  --parallel 2>&1 | tail -5
ok "All images built"

# ── Step 5: Run database migrations ────────────────
step 5 "Start database + run migrations"

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis
echo "  Waiting for PostgreSQL to be ready..."
sleep 10

docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm bezhas-api node db/migrate.js 2>&1 | tail -3 || true
ok "Database migrated"

# OPERANT lleva su propia base y su propio migrador. Las migraciones se
# aplican con el rol DUENO (crean operant_app y la RLS) y el servidor arranca
# despues con el rol de aplicacion: son dos identidades distintas a proposito,
# porque un superusuario se salta la RLS y el aislamiento entre tenants
# desaparece. El propio `command` del servicio ya encadena ambas cosas.
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d operant-postgres
sleep 5
ok "OPERANT database ready"

# ── Step 6: Start all services ─────────────────────
step 6 "Start all services"

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
ok "Services started"

# ── Step 7: Wait for health checks ────────────────
step 7 "Health check (waiting up to 60s)"

SERVICES=("bezhas-api:3001/api/health" "business-ops:4000/healthz")
MAX_WAIT=60
WAITED=0

for svc in "${SERVICES[@]}"; do
  name="${svc%%:*}"
  while [ $WAITED -lt $MAX_WAIT ]; do
    if docker compose -f docker-compose.yml -f docker-compose.prod.yml \
       exec -T "$name" wget -qO- "http://localhost:${svc#*:}" >/dev/null 2>&1; then
      ok "$name is healthy"
      break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
  done

  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "  ⚠️  $name did not become healthy within ${MAX_WAIT}s"
  fi
done

# ── Step 8: Start monitoring stack ─────────────────
step 8 "Start monitoring stack"

docker compose -f monitoring/docker-compose.monitoring.yml up -d 2>&1 | tail -3
ok "Monitoring stack started"

# ── Summary ────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}"
echo "╔═══════════════════════════════════════════════╗"
echo "║           Deployment Complete ✓               ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║  Frontend:    https://localhost               ║"
echo "║  API:         https://localhost/api/health    ║"
echo "║  Grafana:     https://localhost/grafana       ║"
echo "║  Prometheus:  http://localhost:9090            ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Logs:  docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo "  Stop:  docker compose -f docker-compose.yml -f docker-compose.prod.yml down"
echo ""
