#!/usr/bin/env bash
# Publica la pasarela de Ollama (127.0.0.1:11436) por un túnel de Cloudflare y le dice a OPERANT
# (Cloud Run) cuál es la URL. Sin cuenta de Cloudflare el túnel es «rápido»: la URL
# *.trycloudflare.com es aleatoria y cambia en cada arranque, así que cada vez que arranca se guarda
# en Secret Manager (BC_OPERANT_OLLAMA_URL) y se fuerza una revisión nueva de bezhas-operant.
#
# Lo arranca systemd (bezhas-ollama-tunel.service); no hace falta lanzarlo a mano.
set -uo pipefail
CF="${CLOUDFLARED:-$HOME/.local/bin/cloudflared}"
REGION="${REGION:-us-central1}"
PROYECTO="${PROYECTO:-project-a2f60001-ecbb-49af-8c2}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"; kill 0 2>/dev/null' EXIT

"$CF" tunnel --no-autoupdate --url http://127.0.0.1:11436 >"$LOG" 2>&1 &
CF_PID=$!

URL=""
for _ in $(seq 1 60); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)
  [[ -n "$URL" ]] && break
  kill -0 "$CF_PID" 2>/dev/null || { echo "cloudflared terminó antes de dar una URL" >&2; cat "$LOG" >&2; exit 1; }
  sleep 1
done
[[ -n "$URL" ]] || { echo "cloudflared no dio URL en 60 s" >&2; exit 1; }
echo "túnel: $URL"

{ printf %s "$URL" | gcloud secrets versions add BC_OPERANT_OLLAMA_URL --project "$PROYECTO" --data-file=- >/dev/null 2>&1 \
    || printf %s "$URL" | gcloud secrets create BC_OPERANT_OLLAMA_URL --project "$PROYECTO" --replication-policy=automatic --data-file=- >/dev/null; } \
  && gcloud secrets add-iam-policy-binding BC_OPERANT_OLLAMA_URL --project "$PROYECTO" \
       --member="serviceAccount:bezhas-backend-run@${PROYECTO}.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor --quiet >/dev/null \
  && gcloud run services update bezhas-operant --project "$PROYECTO" --region "$REGION" \
       --update-labels="ia_tunel=$(date +%s)" --quiet >/dev/null \
  && echo "OPERANT apunta ahora a $URL" \
  || echo "⚠ No se pudo avisar a OPERANT (¿gcloud sin sesión?); la IA local no estará disponible hasta entonces." >&2

wait "$CF_PID"
