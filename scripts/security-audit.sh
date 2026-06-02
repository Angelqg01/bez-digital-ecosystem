#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
#  BeZhas — Smart Contract Security Audit
#  Runs Slither static analysis on all Solidity contracts
#
#  Prerequisites:
#    pip install slither-analyzer
#    (or use the GitHub Actions CI/CD pipeline)
#
#  Usage: bash scripts/security-audit.sh
# ─────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/smart-contracts"
REPORT_DIR="$PROJECT_ROOT/reports/security"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

header() { echo -e "\n\033[1;36m═══ $1 ═══\033[0m"; }
ok()     { echo -e "  ✅ $1"; }
fail()   { echo -e "  ❌ $1"; }

mkdir -p "$REPORT_DIR"

# ── 1. Check tools ──────────────────────────────────
header "Checking tools"

if command -v slither &>/dev/null; then
  ok "slither $(slither --version 2>&1 | head -1)"
else
  fail "slither not found — install: pip install slither-analyzer"
  exit 1
fi

if command -v forge &>/dev/null; then
  ok "forge $(forge --version 2>&1 | head -1)"
elif [ -f "$USERPROFILE/.foundry/bin/forge" ]; then
  export PATH="$USERPROFILE/.foundry/bin:$PATH"
  ok "forge (from .foundry/bin)"
else
  fail "forge not found"
  exit 1
fi

# ── 2. Compile contracts ───────────────────────────
header "Compiling contracts"
cd "$CONTRACTS_DIR"
forge build --force 2>&1 | tail -3

# ── 3. Run Slither ─────────────────────────────────
header "Running Slither analysis"

SLITHER_REPORT="$REPORT_DIR/slither-$TIMESTAMP.json"

slither . \
  --json "$SLITHER_REPORT" \
  --exclude-dependencies \
  --filter-paths "test/|script/|lib/" \
  --compile-force-framework foundry \
  2>&1 | tee "$REPORT_DIR/slither-$TIMESTAMP.log" || true

# ── 4. Summary ─────────────────────────────────────
header "Summary"

if [ -f "$SLITHER_REPORT" ]; then
  HIGH=$(grep -c '"impact": "High"' "$SLITHER_REPORT" 2>/dev/null || echo 0)
  MEDIUM=$(grep -c '"impact": "Medium"' "$SLITHER_REPORT" 2>/dev/null || echo 0)
  LOW=$(grep -c '"impact": "Low"' "$SLITHER_REPORT" 2>/dev/null || echo 0)
  INFO=$(grep -c '"impact": "Informational"' "$SLITHER_REPORT" 2>/dev/null || echo 0)

  echo -e "  🔴 High:          $HIGH"
  echo -e "  🟠 Medium:        $MEDIUM"
  echo -e "  🟡 Low:           $LOW"
  echo -e "  🔵 Informational: $INFO"
  echo ""
  echo "  Full report: $SLITHER_REPORT"
  echo "  Log:         $REPORT_DIR/slither-$TIMESTAMP.log"

  if [ "$HIGH" -gt 0 ]; then
    fail "High-severity issues found — review before deployment"
    exit 1
  else
    ok "No high-severity issues"
  fi
else
  fail "No Slither report generated"
  exit 1
fi
