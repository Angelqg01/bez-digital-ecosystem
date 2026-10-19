#!/usr/bin/env bash
# Carga en memoria los modelos que usa OPERANT y los deja cargados (keep_alive), para que la primera
# pregunta de un cliente no pague los ~30 s de carga. Se lanza solo tras arrancar Ollama.
set -uo pipefail
BASE="${OLLAMA_BASE:-http://172.17.0.1:11434}"
for _ in $(seq 1 30); do curl -fs -m 2 "$BASE/api/tags" >/dev/null 2>&1 && break; sleep 1; done
for m in ${OLLAMA_PRECALENTAR:-qwen2.5:3b qwen2.5:7b}; do
  curl -fs -m 180 "$BASE/api/generate" -d "{\"model\":\"$m\",\"prompt\":\"hola\",\"stream\":false,\"keep_alive\":\"24h\",\"options\":{\"num_predict\":1}}" >/dev/null 2>&1 \
    && echo "precalentado $m" || echo "no se pudo precalentar $m"
done
exit 0
