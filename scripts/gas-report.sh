#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
#  BeZhas — Gas Optimization Report
#  Runs forge test --gas-report and forge snapshot
#
#  Usage: bash scripts/gas-report.sh
# ─────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/smart-contracts"
REPORT_DIR="$PROJECT_ROOT/reports/gas"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

header() { echo -e "\n\033[1;33m═══ $1 ═══\033[0m"; }
ok()     { echo -e "  ✅ $1"; }

mkdir -p "$REPORT_DIR"

cd "$CONTRACTS_DIR"

# ── 1. Gas Report (per-function breakdown) ────────
header "Gas Report — Per Function"

REPORT_FILE="$REPORT_DIR/gas-report-$TIMESTAMP.txt"

forge test --gas-report 2>&1 | tee "$REPORT_FILE"

ok "Gas report saved: $REPORT_FILE"

# ── 2. Gas Snapshot (per-test gas usage) ──────────
header "Gas Snapshot"

SNAPSHOT_FILE="$REPORT_DIR/gas-snapshot-$TIMESTAMP.txt"

forge snapshot 2>&1 | tee "$SNAPSHOT_FILE"

ok "Snapshot saved: $SNAPSHOT_FILE"

# ── 3. Snapshot Diff (if previous exists) ─────────
PREV_SNAPSHOT="$CONTRACTS_DIR/.gas-snapshot"
if [ -f "$PREV_SNAPSHOT" ]; then
  header "Snapshot Diff (vs previous)"
  forge snapshot --diff "$PREV_SNAPSHOT" 2>&1 | tee "$REPORT_DIR/gas-diff-$TIMESTAMP.txt" || true
fi

# ── 4. Key Metrics Summary ───────────────────────
header "Summary"

echo ""
echo "  📊 Reports generated:"
echo "    Gas Report:   $REPORT_FILE"
echo "    Snapshot:     $SNAPSHOT_FILE"
echo ""
echo "  ⚡ Review high-gas functions for optimization before mainnet."
echo "  Target: All core functions < 100,000 gas per call."
echo ""

# ── 5. Size Report ────────────────────────────────
header "Contract Sizes"

forge build --sizes 2>&1 | tee "$REPORT_DIR/contract-sizes-$TIMESTAMP.txt"

ok "Size report saved"

echo ""
echo "  ⚠️  Contracts > 24,576 bytes cannot be deployed on mainnet (EIP-170)."
echo ""
