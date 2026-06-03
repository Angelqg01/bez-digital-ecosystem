#!/usr/bin/env bash
# Deploy the 7 workspace-fixed Vite SubApps in parallel.
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
RESULTS=/tmp/ws_results.txt
: > "$RESULTS"

# folder|service|subdir|sibling
APPS=(
  "bez-wallet|bezhas-wallet||"
  "gas-tank-manager|bezhas-gas||"
  "edge-node-manager|bezhas-edge||"
  "BZ Prestige|bezhas-prestige||"
  "bez-energy|bezhas-energy||"
  "BZ PureScan|bezhas-purescan||BZ CargoLink"
  "bez-vision-scan|bezhas-vision|frontend|"
)

run_one() {
  local folder="$1" svc="$2" subdir="$3" sibling="$4"
  local log="/tmp/ws_${svc}.log"
  if bash "${ROOT}/scripts/deploy-subapp.sh" "$folder" "$svc" "$subdir" "$sibling" > "$log" 2>&1; then
    local url; url="$(grep -E '^URL=' "$log" | tail -1 | cut -d= -f2-)"
    echo "${svc}|OK|${url}" >> "$RESULTS"
  else
    echo "${svc}|FAIL|see ${log}" >> "$RESULTS"
  fi
}

for entry in "${APPS[@]}"; do
  IFS='|' read -r folder svc subdir sibling <<< "$entry"
  run_one "$folder" "$svc" "$subdir" "$sibling" &
done
wait
echo "ALL_DONE" >> "$RESULTS"
