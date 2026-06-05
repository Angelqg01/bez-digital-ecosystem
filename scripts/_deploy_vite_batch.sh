#!/usr/bin/env bash
# Orchestrator: deploy the 9 clean Vite SubApps in parallel via deploy-subapp.sh.
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
RESULTS=/tmp/sa_results.txt
: > "$RESULTS"

# folder|service
APPS=(
  "bez-wallet|bezhas-wallet"
  "gas-tank-manager|bezhas-gas"
  "edge-node-manager|bezhas-edge"
  "BZ Prestige|bezhas-prestige"
  "bezhas-pay-manager|bezhas-pay"
  "BZ PureScan|bezhas-purescan"
  "BZ Sphere|bezhas-sphere"
  "bez-energy|bezhas-energy"
  "BZ Genesis|bezhas-genesis"
)

run_one() {
  local folder="$1" svc="$2"
  local log="/tmp/sa_${svc}.log"
  if bash "${ROOT}/scripts/deploy-subapp.sh" "$folder" "$svc" > "$log" 2>&1; then
    local url; url="$(grep -E '^URL=' "$log" | tail -1 | cut -d= -f2-)"
    echo "${svc}|OK|${url}" >> "$RESULTS"
  else
    echo "${svc}|FAIL|see ${log}" >> "$RESULTS"
  fi
}

# Launch in parallel
for entry in "${APPS[@]}"; do
  folder="${entry%%|*}"; svc="${entry##*|}"
  run_one "$folder" "$svc" &
done
wait
echo "ALL_DONE" >> "$RESULTS"
