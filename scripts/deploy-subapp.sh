#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  scripts/deploy-subapp.sh — Build & deploy one secondary SPA to Cloud Run.
#
#  The SubApps under "App's secundarias/<App>" are pnpm workspace members that:
#   - share code via relative imports from "App's secundarias/_shared"
#   - depend on internal workspace packages (@bezhas/contracts, @bezhas/platform-sdk,
#     @bezhas/ui-components) that live in "App's secundarias/packages/*"
#  so they cannot build in isolation. This script stages the app + _shared + the
#  internal packages + a minimal pnpm workspace into a space-free build dir,
#  generates an nginx static Dockerfile, builds via Cloud Build and deploys to
#  Cloud Run (public).
#
#  Usage:
#    scripts/deploy-subapp.sh "<App Folder>" <service-name> [build-subdir] [extra-sibling-folder]
#  Examples:
#    scripts/deploy-subapp.sh "bez-wallet" bezhas-wallet
#    scripts/deploy-subapp.sh "bez-vision-scan" bezhas-vision frontend
#    scripts/deploy-subapp.sh "BZ PureScan" bezhas-purescan "" "BZ CargoLink"
#
#  Prints "URL=<run.app url>" on success.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_FOLDER="${1:?app folder required}"
SERVICE="${2:?service name required}"
SUBDIR="${3:-}"          # optional subdir holding package.json (e.g. frontend)
EXTRA_SIBLING="${4:-}"   # optional other app folder copied as a sibling (cross-app imports)

PROJECT="${GCP_PROJECT_ID:-totemic-bonus-479312-c6}"
REGION="${GCP_REGION:-europe-west1}"
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT}/bezhas-services"
TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE="${IMAGE_BASE}/${SERVICE}:${TAG}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECDIR="${ROOT}/App's secundarias"
SRC="${SECDIR}/${APP_FOLDER}${SUBDIR:+/$SUBDIR}"
STAGE="$(mktemp -d)"

echo "[deploy-subapp] app='${APP_FOLDER}' subdir='${SUBDIR}' sibling='${EXTRA_SIBLING}' service='${SERVICE}'"
echo "[deploy-subapp] staging -> ${STAGE}"

copy_clean() { # src dst  (copy excluding node_modules/.git/build, KEEP dist for packages)
  local s="$1" d="$2" extra="${3:-}"
  mkdir -p "$d"
  ( cd "$s" && tar -cf - --exclude=node_modules --exclude=.git ${extra} . ) | ( cd "$d" && tar -xf - )
}

mkdir -p "${STAGE}/app" "${STAGE}/packages"
# _shared (relative ../../../_shared from app/src/*)
[ -d "${SECDIR}/_shared" ] && cp -r "${SECDIR}/_shared" "${STAGE}/_shared" || mkdir -p "${STAGE}/_shared"
# internal workspace packages (keep their prebuilt dist/)
for p in "${SECDIR}/packages"/*/; do [ -d "$p" ] && copy_clean "$p" "${STAGE}/packages/$(basename "$p")"; done
# Optionally include the repo-root SDK (@bezhas/sdk) as a workspace package
# (Bezhas-Hub frontend depends on it via file:../../../sdk).
if [ -n "${INCLUDE_ROOT_SDK:-}" ] && [ -d "${ROOT}/sdk" ]; then
  copy_clean "${ROOT}/sdk" "${STAGE}/packages/sdk"
fi
# the app (drop its dist so it is rebuilt)
copy_clean "${SRC}" "${STAGE}/app" "--exclude=dist"
# Some apps import _shared as ../../_shared (app-root level) instead of ../../../_shared
[ -d "${STAGE}/_shared" ] && cp -r "${STAGE}/_shared" "${STAGE}/app/_shared"
# Hub frontend references @bezhas/sdk via file:../../../sdk -> use the staged workspace pkg
if [ -n "${INCLUDE_ROOT_SDK:-}" ]; then
  sed -i 's#"file:\.\./\.\./\.\./sdk"#"workspace:*"#' "${STAGE}/app/package.json" || true
fi
# optional cross-app sibling (e.g. PureScan imports ../../../BZ CargoLink/...)
[ -n "${EXTRA_SIBLING}" ] && copy_clean "${SECDIR}/${EXTRA_SIBLING}" "${STAGE}/${EXTRA_SIBLING}" "--exclude=dist"

# minimal pnpm workspace so @bezhas/*@workspace:* resolves to packages/*
printf 'packages:\n  - "packages/*"\n  - "app"\n' > "${STAGE}/pnpm-workspace.yaml"
# root deps that _shared/*.{js,jsx} import (resolved from /repo/node_modules)
cat > "${STAGE}/package.json" <<'PKG'
{
  "name": "subapp-build-root",
  "private": true,
  "dependencies": {
    "ethers": "^6.16.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.400.0",
    "axios": "^1.7.0"
  }
}
PKG

cat > "${STAGE}/app/nginx.conf" <<'NGINX'
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    # Lightweight liveness endpoint for the watchdog (scripts/subapp-watchdog.cjs)
    # and Cloud Run health checks — answers instantly without serving the SPA
    # bundle, so a broken JS build still reports "container is up" separately
    # from "app actually renders".
    location = /health {
        default_type text/plain;
        return 200 'ok';
    }
    location / { try_files $uri $uri/ /index.html; }
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}
NGINX

cat > "${STAGE}/Dockerfile" <<'DOCKER'
FROM node:22-alpine AS build
WORKDIR /repo
RUN npm install -g pnpm
COPY pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY _shared ./_shared
COPY app ./app
RUN pnpm install --no-frozen-lockfile --ignore-scripts
WORKDIR /repo/app
RUN pnpm build
RUN if [ -d dist ]; then cp -r dist /repo/out; elif [ -d build ]; then cp -r build /repo/out; else echo "no dist/build output" && exit 1; fi

FROM nginx:alpine
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/out /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
DOCKER

# If a cross-app sibling was staged, make it available at the repo root too.
if [ -n "${EXTRA_SIBLING}" ]; then
  cp -r "${STAGE}/${EXTRA_SIBLING}" "${STAGE}/app/../${EXTRA_SIBLING}" 2>/dev/null || true
  # adjust Dockerfile to copy the sibling next to app
  sed -i "s#COPY app ./app#COPY [\"${EXTRA_SIBLING}\", \"./${EXTRA_SIBLING}\"]\nCOPY app ./app#" "${STAGE}/Dockerfile"
fi

cat > "${STAGE}/.dockerignore" <<'IGN'
**/node_modules
**/.git
**/*.log
app/dist
app/build
IGN

echo "[deploy-subapp] building image ${IMAGE} ..."
gcloud builds submit --tag "${IMAGE}" "${STAGE}" --project "${PROJECT}" --quiet

echo "[deploy-subapp] deploying ${SERVICE} ..."
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --port 8080 \
  --memory 256Mi --cpu 1 \
  --max-instances 5 --min-instances 0 \
  --allow-unauthenticated --quiet

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT}" --format 'value(status.url)')"
echo "URL=${URL}"
rm -rf "${STAGE}"
