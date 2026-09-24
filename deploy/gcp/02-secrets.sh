#!/usr/bin/env bash
# ============================================================================
# 02 — Cargar los secretos en Secret Manager (idempotente)
# ============================================================================
# Lee un fichero .env LOCAL (que nunca se sube al repositorio), y para cada
# secreto de secrets.list:
#   - crea el secreto si no existe (replicación automática);
#   - añade una versión nueva SOLO si el valor ha cambiado;
#   - da `secretAccessor` únicamente a las cuentas de servicio que lo leen.
#
# Los valores no se imprimen nunca, ni se pasan por argumentos de línea de
# comandos (irían a `ps` y al historial): viajan por stdin.
#
# Uso:  ./deploy/gcp/02-secrets.sh ~/bezhas/.env.production
set -euo pipefail
if ((BASH_VERSINFO[0] < 4)); then
  echo "Hace falta bash ≥ 4 (en macOS: brew install bash, o usa Cloud Shell)." >&2; exit 1
fi
cd "$(dirname "$0")"
source ./config.env

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "Uso: $0 <fichero .env de producción>" >&2
  exit 2
fi
# Aviso si el fichero es legible por otros usuarios de la máquina.
if [[ "$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")" != 600 ]]; then
  echo "⚠️  $ENV_FILE no tiene permisos 600. Recomendado: chmod 600 $ENV_FILE" >&2
fi

gcloud config set project "$PROJECT_ID" >/dev/null

# Parser de .env sin `source`: un .env ejecutado como shell puede correr código.
declare -A VALORES=()
while IFS= read -r linea || [[ -n "$linea" ]]; do
  linea="${linea%$'\r'}"
  [[ "$linea" =~ ^[[:space:]]*(#|$) ]] && continue
  [[ "$linea" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
  clave="${BASH_REMATCH[2]}"; valor="${BASH_REMATCH[3]}"
  if [[ "$valor" =~ ^\"(.*)\"$ || "$valor" =~ ^\'(.*)\'$ ]]; then valor="${BASH_REMATCH[1]}"; fi
  VALORES["$clave"]="$valor"
done < "$ENV_FILE"

sa_de() {
  case "$1" in
    backend) echo "${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" ;;
    mcp)     echo "${SA_MCP}@${PROJECT_ID}.iam.gserviceaccount.com" ;;
    *) echo "servicio desconocido: $1" >&2; exit 1 ;;
  esac
}

faltan=()
while read -r nombre servicios requisito; do
  [[ -z "${nombre:-}" || "$nombre" == \#* ]] && continue

  if ! gcloud secrets describe "$nombre" >/dev/null 2>&1; then
    gcloud secrets create "$nombre" --replication-policy=automatic \
      --labels=app=bezhas >/dev/null
    echo "  + creado $nombre"
  fi

  valor="${VALORES[$nombre]:-}"
  actual=$(gcloud secrets versions access latest --secret="$nombre" 2>/dev/null || true)

  if [[ -n "$valor" ]]; then
    if [[ "$valor" != "$actual" ]]; then
      printf '%s' "$valor" | gcloud secrets versions add "$nombre" --data-file=- >/dev/null
      echo "  ↑ nueva versión de $nombre"
    else
      echo "  = $nombre sin cambios"
    fi
  elif [[ -z "$actual" ]]; then
    if [[ "$requisito" == obligatorio ]]; then
      faltan+=("$nombre")
    else
      # Sin versión = no se monta. El despliegue solo pasa a Cloud Run los
      # secretos con versión activa; un marcador tipo "unset" acabaría como
      # REDIS_URL=unset y el backend intentaría conectarse a eso.
      echo "  · $nombre opcional sin valor (no se montará)"
    fi
  fi

  IFS=',' read -ra lista <<< "$servicios"
  for s in "${lista[@]}"; do
    gcloud secrets add-iam-policy-binding "$nombre" --quiet \
      --member="serviceAccount:$(sa_de "$s")" \
      --role=roles/secretmanager.secretAccessor >/dev/null
  done
done < ./secrets.list


if ((${#faltan[@]})); then
  echo
  echo "❌ Faltan secretos obligatorios en $ENV_FILE:" >&2
  printf '   - %s\n' "${faltan[@]}" >&2
  exit 1
fi
echo
echo "✅ Secretos listos. Siguiente paso: ./deploy/gcp/deploy.sh"
