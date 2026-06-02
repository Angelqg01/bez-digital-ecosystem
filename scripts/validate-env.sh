#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
#  BeZhas — Validate .env secrets before deployment
#  Usage: bash scripts/validate-env.sh [.env-file]
# ─────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${1:-.env}"
ERRORS=0

header() { echo -e "\n\033[1;36m▸ $1\033[0m"; }
ok()     { echo -e "  ✅ $1"; }
fail()   { echo -e "  ❌ $1"; ERRORS=$((ERRORS + 1)); }
warn()   { echo -e "  ⚠️  $1"; }

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example → .env first."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

# ── Required variables ───────────────────────────────
header "Checking required variables"

REQUIRED=(
  POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL
  REDIS_URL
  JWT_SECRET
  BATCHER_PRIVATE_KEY DEPLOYER_PRIVATE_KEY EDGE_NODE_PRIVATE_KEY
  EDGE_NODE_API_KEY
  BEZHAS_L2_RPC_URL BEZHAS_CHAIN_ID
)

for var in "${REQUIRED[@]}"; do
  if [ -z "${!var:-}" ]; then
    fail "$var is not set"
  else
    ok "$var"
  fi
done

# ── Check for placeholder / insecure defaults ───────
header "Checking for insecure defaults"

if [ "${JWT_SECRET:-}" = "bezhas-local-dev-secret" ]; then
  fail "JWT_SECRET is still the dev placeholder"
fi

if [ "${POSTGRES_PASSWORD:-}" = "TuPasswordSeguro" ]; then
  fail "POSTGRES_PASSWORD is still the default placeholder"
fi

if [ "${EDGE_NODE_API_KEY:-}" = "bezhas-edge-dev-key" ]; then
  fail "EDGE_NODE_API_KEY is still the dev placeholder"
fi

if [[ "${DEPLOYER_PRIVATE_KEY:-}" == "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" ]]; then
  warn "DEPLOYER_PRIVATE_KEY is the Hardhat/Anvil default key (OK for dev, not for prod)"
fi

# ── Validate private key format ──────────────────────
header "Validating private key format"

for key_var in BATCHER_PRIVATE_KEY DEPLOYER_PRIVATE_KEY EDGE_NODE_PRIVATE_KEY; do
  val="${!key_var:-}"
  if [[ "$val" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    ok "$key_var format OK"
  elif [ -n "$val" ]; then
    fail "$key_var invalid format (expected 0x + 64 hex chars)"
  fi
done

# ── Summary ──────────────────────────────────────────
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "\033[1;31m✗ $ERRORS error(s) found. Fix before deploying.\033[0m"
  exit 1
else
  echo -e "\033[1;32m✓ All secrets validated.\033[0m"
  exit 0
fi
