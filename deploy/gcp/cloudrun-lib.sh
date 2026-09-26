# Funciones para los pasos de despliegue de cloudbuild.yaml (se cargan con
# `source` dentro de Cloud Build; necesitan PROJECT_ID en el entorno o usan el
# proyecto activo de gcloud).
PREFIJO="${SECRET_PREFIX:-BC_}"
LISTA="$(dirname "${BASH_SOURCE[0]}")/secrets.list"

# secretos_de <servicio>: "VAR=BC_NOMBRE:latest,…" con los secretos de
# secrets.list que lee ese servicio y tienen al menos una versión activa. Solo
# consulta metadatos; nunca lee un valor. Un opcional sin versión no se monta.
secretos_de() {
  local out=() n s _r vars v
  while read -r n s _r vars; do
    [[ -z "${n:-}" || "$n" == \#* ]] && continue
    [[ ",$s," == *",$1,"* ]] || continue
    if [[ -n "$(gcloud secrets versions list "${PREFIJO}${n}" --filter=state=ENABLED --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
      IFS=',' read -ra lista <<< "${vars:-$n}"
      for v in "${lista[@]}"; do out+=("${v}=${PREFIJO}${n}:latest"); done
    fi
  done < "$LISTA"
  (IFS=,; echo "${out[*]}")
}

# flag_secretos <servicio>: el argumento --set-secrets=… o nada si no hay
# ninguno (gcloud rechaza --set-secrets vacío).
flag_secretos() {
  local s; s=$(secretos_de "$1")
  [[ -n "$s" ]] && echo "--set-secrets=$s" || true
}

url_de() {
  gcloud run services describe "$1" --region="${REGION:-us-central1}" --format='value(status.url)'
}

invocador() {  # invocador <servicio> <cuenta de servicio>
  gcloud run services add-iam-policy-binding "$1" --region="${REGION:-us-central1}" \
    --member="serviceAccount:$2" --role=roles/run.invoker --quiet >/dev/null
}
