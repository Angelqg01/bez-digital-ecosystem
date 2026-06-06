#!/usr/bin/env bash
#
# deploy-energy.sh — one-shot deploy of the BeZhas VPP energy contracts
# (EnergyOracle + EnergyCAEToken + BeZhasVPP) and capture of the resulting
# backend env vars.
#
# Secrets are read from .env AT RUNTIME by you. This script NEVER prints the
# private key and NEVER commits it. It is the only thing you need to run.
#
# Usage:
#   bash scripts/deploy-energy.sh [amoy|polygon]      # default: amoy (testnet)
#
# Required in .env:
#   DEPLOYER_PRIVATE_KEY=0x...        # deployer (also becomes contracts admin)
# Optional in .env:
#   ENERGY_ADMIN=0x...                # separate admin (defaults to deployer)
#   POLYGON_AMOY_RPC_URL=...          # overrides default Amoy RPC
#   POLYGON_RPC_URL=...               # overrides default mainnet RPC
#   POLYGONSCAN_API_KEY=...           # enables --verify on the explorer
#   APPLY_ENV=true                    # also append addresses to api/.env
#
set -euo pipefail

NETWORK="${1:-amoy}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SC_DIR="$ROOT/smart-contracts"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

case "$NETWORK" in
  amoy)    DEFAULT_RPC="https://rpc-amoy.polygon.technology"; CHAIN_ID=80002 ;;
  polygon) DEFAULT_RPC="https://polygon-rpc.com";             CHAIN_ID=137   ;;
  *) echo "ERROR: unknown network '$NETWORK' (use: amoy | polygon)"; exit 1 ;;
esac

# ── Load .env without echoing its contents ──────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  set -a; # shellcheck disable=SC1090
  source "$ENV_FILE"; set +a
  echo "Loaded env from $ENV_FILE"
else
  echo "WARN: $ENV_FILE not found — relying on the current shell environment"
fi

# RPC: per-network override from .env, else default
if [[ "$NETWORK" == "amoy" ]]; then RPC="${POLYGON_AMOY_RPC_URL:-$DEFAULT_RPC}"; else RPC="${POLYGON_RPC_URL:-$DEFAULT_RPC}"; fi

# ── Validate the key is present (NEVER print it) ─────────────────────────────
if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  echo "ERROR: DEPLOYER_PRIVATE_KEY is not set (add it to $ENV_FILE)"; exit 1
fi
echo "Deployer private key: present (hidden)"

# ── Locate forge ────────────────────────────────────────────────────────────
FORGE="$(command -v forge 2>/dev/null || true)"
[[ -z "$FORGE" && -x "$HOME/.foundry/bin/forge.exe" ]] && FORGE="$HOME/.foundry/bin/forge.exe"
[[ -z "$FORGE" && -x "$HOME/.foundry/bin/forge" ]]     && FORGE="$HOME/.foundry/bin/forge"
[[ -z "$FORGE" ]] && { echo "ERROR: forge not found — install Foundry (foundryup)"; exit 1; }

echo "== Deploy BeZhas energy VPP → $NETWORK (chainId $CHAIN_ID) =="
echo "RPC:   $RPC"
echo "forge: $FORGE"

# ── Mainnet guard ───────────────────────────────────────────────────────────
if [[ "$NETWORK" == "polygon" ]]; then
  echo "!! This spends REAL funds (gas) on Polygon mainnet and is irreversible."
  read -r -p "   Type DEPLOY to continue: " CONFIRM
  [[ "$CONFIRM" == "DEPLOY" ]] || { echo "Aborted."; exit 1; }
fi

OUT_DIR="$ROOT/deploy-out"; mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/deploy-energy.$NETWORK.log"

# Optional explorer verification
VERIFY_FLAGS=()
if [[ -n "${POLYGONSCAN_API_KEY:-}" ]]; then
  VERIFY_FLAGS+=(--verify --etherscan-api-key "$POLYGONSCAN_API_KEY")
  echo "Explorer verification: enabled"
fi

# ── Deploy ──────────────────────────────────────────────────────────────────
( cd "$SC_DIR" && "$FORGE" script script/DeployEnergyVPP.s.sol \
    --rpc-url "$RPC" --broadcast ${VERIFY_FLAGS[@]+"${VERIFY_FLAGS[@]}"} ) | tee "$LOG"

# ── Parse deployed addresses from the script's console output ────────────────
ORACLE=$(grep -oE 'EnergyOracle: 0x[0-9a-fA-F]{40}'   "$LOG" | awk '{print $2}' | tail -1)
CAE=$(grep -oE 'EnergyCAEToken: 0x[0-9a-fA-F]{40}'    "$LOG" | awk '{print $2}' | tail -1)
VPP=$(grep -oE 'BeZhasVPP: 0x[0-9a-fA-F]{40}'         "$LOG" | awk '{print $2}' | tail -1)

if [[ -z "$ORACLE" || -z "$CAE" || -z "$VPP" ]]; then
  echo "ERROR: could not parse deployed addresses from $LOG"; exit 1
fi

# ── Emit backend env + deployment record ────────────────────────────────────
ENV_OUT="$OUT_DIR/energy-addresses.$NETWORK.env"
cat > "$ENV_OUT" <<EOF
# BeZhas energy VPP — $NETWORK (chainId $CHAIN_ID) — $(date -u +%FT%TZ)
CONTRACT_ENERGY_ORACLE=$ORACLE
CONTRACT_ENERGY_CAE_TOKEN=$CAE
CONTRACT_BEZHAS_VPP=$VPP
BEZHAS_VPP_ADDRESS=$VPP
VPP_RPC_URL=$RPC
# Set VPP_OPERATOR_PK separately (operator key used by the backend on-chain audit)
EOF

mkdir -p "$SC_DIR/deployments"
cat > "$SC_DIR/deployments/energy-vpp.$CHAIN_ID.json" <<EOF
{
  "network": "$NETWORK",
  "chainId": $CHAIN_ID,
  "deployedAt": "$(date -u +%FT%TZ)",
  "contracts": {
    "EnergyOracle": "$ORACLE",
    "EnergyCAEToken": "$CAE",
    "BeZhasVPP": "$VPP"
  }
}
EOF

# ── Optionally append to api/.env ───────────────────────────────────────────
if [[ "${APPLY_ENV:-}" == "true" ]]; then
  cat "$ENV_OUT" >> "$ROOT/api/.env"
  echo "Appended addresses to api/.env"
fi

echo
echo "== Deployment complete =="
echo "EnergyOracle:   $ORACLE"
echo "EnergyCAEToken: $CAE"
echo "BeZhasVPP:      $VPP"
echo
echo "Backend env written to: $ENV_OUT"
echo "Record:                 smart-contracts/deployments/energy-vpp.$CHAIN_ID.json"
if [[ "${APPLY_ENV:-}" != "true" ]]; then
  echo "To apply to the backend:  cat '$ENV_OUT' >> api/.env   (or re-run with APPLY_ENV=true)"
fi
echo "Remember: also set VPP_OPERATOR_PK in api/.env to enable on-chain SCADA audit,"
echo "and update the contract table in CLAUDE.md."
