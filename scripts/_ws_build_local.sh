#!/usr/bin/env bash
# Local workspace build check for one SubApp (no Cloud Build/deploy).
# Usage: _ws_build_local.sh "<App Folder>" [subdir] [sibling]
set -uo pipefail
APP="${1:?}"; SUBDIR="${2:-}"; SIBLING="${3:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEC="${ROOT}/App's secundarias"
SRC="${SEC}/${APP}${SUBDIR:+/$SUBDIR}"
ST="$(mktemp -d)"
copy_clean(){ mkdir -p "$2"; ( cd "$1" && tar -cf - --exclude=node_modules --exclude=.git ${3:-} . ) | ( cd "$2" && tar -xf - ); }
mkdir -p "$ST/app" "$ST/packages"
[ -d "${SEC}/_shared" ] && cp -r "${SEC}/_shared" "$ST/_shared" || mkdir -p "$ST/_shared"
for p in "${SEC}/packages"/*/; do copy_clean "$p" "$ST/packages/$(basename "$p")"; done
copy_clean "$SRC" "$ST/app" "--exclude=dist"
# Some apps import _shared as ../../_shared (app-root level) instead of ../../../_shared
[ -d "$ST/_shared" ] && cp -r "$ST/_shared" "$ST/app/_shared"
[ -n "$SIBLING" ] && copy_clean "${SEC}/${SIBLING}" "$ST/${SIBLING}" "--exclude=dist"
printf 'packages:\n  - "packages/*"\n  - "app"\n' > "$ST/pnpm-workspace.yaml"
printf '{"name":"r","private":true,"dependencies":{"ethers":"^6.16.0","react":"^18.2.0","react-dom":"^18.2.0","framer-motion":"^11.0.0","lucide-react":"^0.400.0","axios":"^1.7.0"}}' > "$ST/package.json"
echo "[local] install $APP ..."
pnpm -C "$ST" install --no-frozen-lockfile --ignore-scripts >/tmp/ws_install.log 2>&1 || { echo "INSTALL_FAIL"; tail -15 /tmp/ws_install.log; rm -rf "$ST"; exit 2; }
echo "[local] build $APP ..."
if pnpm -C "$ST/app" build >/tmp/ws_build.log 2>&1; then
  if [ -f "$ST/app/dist/index.html" ] || [ -f "$ST/app/build/index.html" ]; then echo "BUILD_OK $APP"; else echo "NO_DIST $APP"; fi
else
  echo "BUILD_FAIL $APP"; grep -iE "Could not resolve|failed to resolve|Cannot find|is not exported|error during build" /tmp/ws_build.log | sed 's/\x1b\[[0-9;]*m//g' | head -6
fi
rm -rf "$ST"
