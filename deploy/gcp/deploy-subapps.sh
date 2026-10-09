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
# Los servicios se llaman bezhas-<app>; su URL de Cloud Run (bezhas-<app>-afi7mfxzxa-uc.a.run.app) es la que el
# chat ya trae por defecto (api/services/ai-workspace/actions.js), así que NO hace falta reconfigurar nada: el
# chat las marca «Próximamente» mientras no respondan y se activan solas (sondeo cada 5 min).
# Si alguna acaba con otra URL, el script imprime el NATIVE_APP_URLS que hay que dar a la api.
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
cd ../..

# app → directorio:puerto
declare -A DIR=(  [hub]="App-nativas/Bezhas-Hub/frontend-next" [defi]="App-nativas/BZ Capital/frontend"
                  [purescan]="App-nativas/BZ PureScan"          [energy]="App-nativas/bez-energy"
                  [cargolink]="App-nativas/BZ CargoLink" )
declare -A PORT=( [hub]=8080 [defi]=5174 [purescan]=8080 [energy]=8080 [cargolink]=8080 )

APPS=("$@"); ((${#APPS[@]})) || APPS=(hub defi purescan energy cargolink)
TAG="$(git rev-parse --short=12 HEAD)"
declare -A URL
for app in "${APPS[@]}"; do
  [[ -n "${DIR[$app]:-}" ]] || { echo "❌ App desconocida: $app" >&2; exit 1; }
  dir="${DIR[$app]}"; img="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/bezhas-${app}:${TAG}"
  echo "→ [$app] construyendo $dir"
  gcloud builds submit "$dir" --project "$PROJECT_ID" --region "$REGION" --tag "$img" --quiet
  echo "→ [$app] desplegando en Cloud Run (bezhas-${app})"
  gcloud run deploy "bezhas-${app}" --project "$PROJECT_ID" --region "$REGION" --image "$img" \
    --port "${PORT[$app]}" --allow-unauthenticated --min-instances 0 --max-instances 3 \
    --memory 512Mi --cpu 1 --quiet
  URL[$app]="$(gcloud run services describe "bezhas-${app}" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
done

echo; echo "✅ SubApps desplegadas:"
json="{"; sep=""
for app in "${APPS[@]}"; do
  code="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "${URL[$app]}" || true)"
  echo "   $app → ${URL[$app]} (HTTP $code)"
  json+="${sep}\"${app}\":\"${URL[$app]}\""; sep=","
done
echo; echo "NATIVE_APP_URLS='${json}}'"
