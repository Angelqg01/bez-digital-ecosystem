#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
#  BeZhas — Mythril Symbolic Execution Audit
#  Runs Mythril analysis on validation contracts
#
#  Prerequisites:
#    pip install mythril
#    (or docker pull mythril/myth)
#
#  Usage: bash scripts/mythril-audit.sh
# ─────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/smart-contracts/src/core"
REPORT_DIR="$PROJECT_ROOT/reports/security"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

header() { echo -e "\n\033[1;35m═══ $1 ═══\033[0m"; }
ok()     { echo -e "  ✅ $1"; }
fail()   { echo -e "  ❌ $1"; }
warn()   { echo -e "  ⚠️  $1"; }

mkdir -p "$REPORT_DIR/mythril"

# Contracts to audit (validation system + core financial)
CONTRACTS=(
  "ValidatorRegistry"
  "SlashingManager"
  "SequencerRotation"
  "EdgeNodeRewards"
  "GovernanceSystem"
  "StakingPool"
  "BEZPolygonBridge"
)

# ── 1. Check Mythril ───────────────────────────────
header "Checking Mythril"

USE_DOCKER=false
if command -v myth &>/dev/null; then
  ok "mythril $(myth version 2>&1 | head -1)"
elif command -v docker &>/dev/null; then
  warn "myth CLI not found, using Docker image"
  docker pull mythril/myth:latest 2>/dev/null || true
  USE_DOCKER=true
else
  fail "Neither myth CLI nor Docker found"
  echo "  Install: pip install mythril"
  echo "  Or:      docker pull mythril/myth"
  exit 1
fi

run_myth() {
  local contract_path="$1"
  local output_file="$2"

  if [ "$USE_DOCKER" = true ]; then
    docker run --rm \
      -v "$PROJECT_ROOT/smart-contracts:/src" \
      mythril/myth \
      analyze "/src/src/core/$(basename "$contract_path")" \
      --solc-json /src/remappings.json \
      --execution-timeout 300 \
      --max-depth 30 \
      -o json \
      2>&1 > "$output_file" || true
  else
    myth analyze "$contract_path" \
      --solc-remaps "@openzeppelin/contracts/=$PROJECT_ROOT/smart-contracts/lib/openzeppelin-contracts/contracts/" \
      --execution-timeout 300 \
      --max-depth 30 \
      -o json \
      2>&1 > "$output_file" || true
  fi
}

# ── 2. Compile first ──────────────────────────────
header "Compiling contracts"
cd "$PROJECT_ROOT/smart-contracts"
forge build --force 2>&1 | tail -3

# ── 3. Run Mythril per contract ───────────────────
header "Running Mythril symbolic execution"

TOTAL_ISSUES=0
declare -A CONTRACT_ISSUES

for CONTRACT in "${CONTRACTS[@]}"; do
  CONTRACT_FILE="$CONTRACTS_DIR/$CONTRACT.sol"
  REPORT_FILE="$REPORT_DIR/mythril/${CONTRACT}-${TIMESTAMP}.json"
  LOG_FILE="$REPORT_DIR/mythril/${CONTRACT}-${TIMESTAMP}.log"

  if [ ! -f "$CONTRACT_FILE" ]; then
    warn "$CONTRACT.sol not found, skipping"
    continue
  fi

  echo -e "\n  🔍 Analyzing $CONTRACT..."

  run_myth "$CONTRACT_FILE" "$REPORT_FILE" 2>&1 | tee "$LOG_FILE"

  # Count issues
  if [ -f "$REPORT_FILE" ]; then
    ISSUES=$(grep -c '"swc_id"' "$REPORT_FILE" 2>/dev/null || echo 0)
    CONTRACT_ISSUES[$CONTRACT]=$ISSUES
    TOTAL_ISSUES=$((TOTAL_ISSUES + ISSUES))

    if [ "$ISSUES" -gt 0 ]; then
      warn "$CONTRACT: $ISSUES issue(s) found"
    else
      ok "$CONTRACT: Clean"
    fi
  else
    warn "$CONTRACT: No report generated"
  fi
done

# ── 4. Summary ────────────────────────────────────
header "Mythril Summary"

echo ""
printf "  %-25s %s\n" "Contract" "Issues"
printf "  %-25s %s\n" "-------------------------" "------"
for CONTRACT in "${CONTRACTS[@]}"; do
  ISSUES=${CONTRACT_ISSUES[$CONTRACT]:-"N/A"}
  printf "  %-25s %s\n" "$CONTRACT" "$ISSUES"
done
echo ""
echo "  Total issues: $TOTAL_ISSUES"
echo "  Reports: $REPORT_DIR/mythril/"
echo ""

if [ "$TOTAL_ISSUES" -gt 0 ]; then
  warn "Review Mythril findings before testnet deployment"
else
  ok "No symbolic execution issues detected"
fi
