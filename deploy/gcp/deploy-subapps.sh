#!/usr/bin/env bash
# ============================================================================
# Desplegar las SubApps nativas en Cloud Run del proyecto actual.
# ============================================================================
# Uso:  ./deploy/gcp/deploy-subapps.sh [hub defi purescan energy cargolink]
#       (sin argumentos despliega las cinco)
#
# Cada app se construye con Cloud Build (su propio Dockerfile) y se publica como un servicio
# `bezhas-<app>` en Cloud Run. Son páginas PÚBLICAS (--allow-unauthenticated): la sesión y los
# permisos los comprueba cada app/la API, nunca la URL.
#
# Los servicios se llaman bezhas-<app> y se publican en <subdominio>.bezhas.com por el balanceador
# (deploy/gcp/03-load-balancer.sh, lista SUBAPPS en config.env). Su ingress de Cloud Run es
# `internal-and-cloud-load-balancing`: la dirección *.run.app queda cerrada, como la de la api.
# El chat (api/services/ai-workspace/actions.js) ya apunta a esos subdominios y marca «Próximamente»
# las que no respondan (sondeo cada 5 min).
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
cd ../..

# app → directorio:puerto
declare -A DIR=(  [hub]="App-nativas/Bezhas-Hub/frontend-next" [defi]="App-nativas/BZ Capital/frontend"
                  [purescan]="App-nativas/BZ PureScan"          [energy]="App-nativas/bez-energy"
                  [cargolink]="App-nativas/BZ CargoLink" )
# Tipo de build: «mono» = contexto raíz del repo con Dockerfile propio (deploy/gcp/subapps/), «dir» = su carpeta.
declare -A BUILD=( [hub]="mono:Dockerfile.hub" [purescan]="mono:Dockerfile.vite" [energy]="mono:Dockerfile.vite"
                   [cargolink]="mono:Dockerfile.vite" [defi]="dir" )
declare -A PORT=( [hub]=8080 [defi]=5174 [purescan]=8080 [energy]=8080 [cargolink]=8080 )

APPS=("$@"); ((${#APPS[@]})) || APPS=(hub defi purescan energy cargolink)
TAG="$(git rev-parse --short=12 HEAD)"
declare -A URL
FALLOS=()

desplegar() {
  local app="$1" dir="${DIR[$1]}"
  local img="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/bezhas-${app}:${TAG}"
  echo "→ [$app] construyendo $dir"
  if [[ "${BUILD[$app]}" == mono:* ]]; then
    # Estas apps importan carpetas hermanas (_shared, packages, sdk): el contexto es la raíz del repo, filtrada.
    gcloud builds submit . --project "$PROJECT_ID" --region "$REGION" --quiet \
      --config deploy/gcp/subapps/cloudbuild-subapp.yaml --ignore-file deploy/gcp/subapps/.gcloudignore \
      --substitutions "^~^_DOCKERFILE=${BUILD[$app]#mono:}~_APP_DIR=${dir}~_IMAGE=${img}" || return 1
  else
    gcloud builds submit "$dir" --project "$PROJECT_ID" --region "$REGION" --tag "$img" --quiet || return 1
  fi
  echo "→ [$app] desplegando en Cloud Run (bezhas-${app})"
  gcloud run deploy "bezhas-${app}" --project "$PROJECT_ID" --region "$REGION" --image "$img" \
    --port "${PORT[$app]}" --allow-unauthenticated --ingress internal-and-cloud-load-balancing --min-instances 0 --max-instances 3 \
    --memory 512Mi --cpu 1 --quiet || return 1
  URL[$app]="$(gcloud run services describe "bezhas-${app}" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
}

for app in "${APPS[@]}"; do
  [[ -n "${DIR[$app]:-}" ]] || { echo "❌ App desconocida: $app" >&2; exit 1; }
  # Un fallo en una app no detiene las demás: se anota y se resume al final.
  if ! desplegar "$app"; then FALLOS+=("$app"); echo "❌ [$app] falló; sigo con las demás" >&2; fi
done

echo; echo "✅ SubApps desplegadas (solo accesibles por el balanceador, no por *.run.app):"
for app in "${APPS[@]}"; do
  [[ -n "${URL[$app]:-}" ]] || continue
  sub=""; for par in "${SUBAPPS[@]}"; do [[ "${par#*:}" == "bezhas-${app}" ]] && sub="${par%%:*}"; done
  path=""; [[ "$app" == defi ]] && path=/defi
  code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "https://${sub}.${DOMAIN}${path}" || true)"
  echo "   $app → https://${sub}.${DOMAIN}${path} (HTTP $code)"
done
if ((${#FALLOS[@]})); then echo; echo "⚠️  Fallaron: ${FALLOS[*]} (repite: ./deploy/gcp/deploy-subapps.sh ${FALLOS[*]})" >&2; exit 1; fi
