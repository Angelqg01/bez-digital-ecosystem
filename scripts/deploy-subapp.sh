#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  scripts/deploy-subapp.sh — Build & deploy one secondary SPA to Cloud Run.
#
#  These SubApps live under "App's secundarias/<App>" and share code from
#  "App's secundarias/_shared" via relative imports (../../../_shared/...), so
#  they cannot build in isolation. This script stages the app + _shared into a
#  space-free build dir, generates an nginx static Dockerfile, builds via Cloud
#  Build and deploys to Cloud Run (public).
#
#  Usage:
#    scripts/deploy-subapp.sh "<App Folder>" <service-name> [build-subdir]
#  Example:
#    scripts/deploy-subapp.sh "BZ CargoLink" bezhas-cargolink
#    scripts/deploy-subapp.sh "bez-vision-scan" bezhas-vision frontend
#
#  Prints "URL=<run.app url>" on success.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_FOLDER="${1:?app folder required}"
SERVICE="${2:?service name required}"
SUBDIR="${3:-}"   # optional subdir within the app that holds package.json (e.g. frontend)

PROJECT="${GCP_PROJECT_ID:-totemic-bonus-479312-c6}"
REGION="${GCP_REGION:-europe-west1}"
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT}/bezhas-services"
TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE="${IMAGE_BASE}/${SERVICE}:${TAG}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECDIR="${ROOT}/App's secundarias"
SRC="${SECDIR}/${APP_FOLDER}${SUBDIR:+/$SUBDIR}"
STAGE="$(mktemp -d)"

echo "[deploy-subapp] app='${APP_FOLDER}' subdir='${SUBDIR}' service='${SERVICE}'"
echo "[deploy-subapp] staging -> ${STAGE}"

mkdir -p "${STAGE}/app"
# Shared libs at the parent level so ../../../_shared/... resolves from app/src/*
if [ -d "${SECDIR}/_shared" ]; then
  cp -r "${SECDIR}/_shared" "${STAGE}/_shared"
else
  mkdir -p "${STAGE}/_shared"
fi
# App source without heavy/local dirs
( cd "${SRC}" && tar -cf - --exclude=node_modules --exclude=dist --exclude=build --exclude=.git --exclude='*.log' . ) | ( cd "${STAGE}/app" && tar -xf - )

# nginx config (SPA fallback)
cat > "${STAGE}/app/nginx.conf" <<'NGINX'
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}
NGINX

# Generic Dockerfile (Vite build -> nginx). Output dir auto-detected (dist or build).
cat > "${STAGE}/Dockerfile" <<'DOCKER'
FROM node:22-alpine AS build
WORKDIR /repo
RUN npm install -g pnpm
COPY _shared ./_shared
COPY app ./app
# _shared/*.{js,jsx} live one level above the app and import npm packages
# (ethers, react, framer-motion, lucide-react). Since Node/Vite resolve bare
# imports for /repo/_shared from /repo/node_modules, provide them at the root.
RUN printf '{"name":"repo-shared-deps","private":true}' > /repo/package.json \
 && pnpm add -C /repo ethers react react-dom framer-motion lucide-react
WORKDIR /repo/app
RUN (pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts)
RUN pnpm build
# Normalize output to /repo/app/out
RUN if [ -d dist ]; then cp -r dist /repo/out; elif [ -d build ]; then cp -r build /repo/out; else echo "no dist/build output" && exit 1; fi

FROM nginx:alpine
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/out /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
DOCKER

cat > "${STAGE}/.dockerignore" <<'IGN'
**/node_modules
**/dist
**/build
**/*.log
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
