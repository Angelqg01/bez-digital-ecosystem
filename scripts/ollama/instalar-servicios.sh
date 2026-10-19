#!/usr/bin/env bash
# Deja Ollama + pasarela con clave + túnel como servicios de USUARIO (systemd --user, sin sudo) que
# arrancan solos. Idempotente. Después de esto, OPERANT en Cloud Run usa tu IA local.
#
#   ./scripts/ollama/instalar-servicios.sh
#
# Para que sigan vivos con la sesión cerrada y tras reiniciar:  sudo loginctl enable-linger $USER
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
CFG="$HOME/.config/bezhas"; UNI="$HOME/.config/systemd/user"
mkdir -p "$CFG" "$UNI"
OLLAMA_BIN="$(command -v ollama)"; NODE_BIN="$(command -v node)"

# Clave de la pasarela: se genera una vez y vive en un fichero 0600 y en Secret Manager (OPERANT la lee de ahí).
if [[ ! -s "$CFG/ollama-gate.env" ]]; then
  CLAVE="$(openssl rand -hex 32)"
  ( umask 077; printf 'OLLAMA_GATE_KEY=%s\nOLLAMA_TARGET=http://172.17.0.1:11434\nOLLAMA_GATE_PORT=11436\n' "$CLAVE" > "$CFG/ollama-gate.env" )
  printf %s "$CLAVE" | { gcloud secrets create BC_OPERANT_OLLAMA_API_KEY --replication-policy=automatic --data-file=- >/dev/null 2>&1 \
     || gcloud secrets versions add BC_OPERANT_OLLAMA_API_KEY --data-file=- >/dev/null; }
  unset CLAVE
  echo "→ Clave de la pasarela creada (fichero 0600 + Secret Manager)."
fi

cat > "$UNI/bezhas-ollama.service" <<UNIT
[Unit]
Description=Ollama (IA local de BeZhas, sólo en la red de Docker)
After=network.target docker.service

[Service]
Environment=OLLAMA_HOST=172.17.0.1:11434
ExecStart=$OLLAMA_BIN serve
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT

cat > "$UNI/bezhas-ollama-gate.service" <<UNIT
[Unit]
Description=Pasarela con clave delante de Ollama
After=bezhas-ollama.service

[Service]
EnvironmentFile=$CFG/ollama-gate.env
ExecStart=$NODE_BIN $RAIZ/scripts/ollama/ollama-gate.cjs
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT

cat > "$UNI/bezhas-ollama-tunel.service" <<UNIT
[Unit]
Description=Túnel público (con clave) hacia la IA local
After=bezhas-ollama-gate.service network-online.target
Wants=network-online.target

[Service]
Environment=PATH=$HOME/google-cloud-sdk/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$RAIZ/scripts/ollama/ollama-tunel.sh
Restart=always
RestartSec=15

[Install]
WantedBy=default.target
UNIT

chmod +x "$RAIZ/scripts/ollama/ollama-tunel.sh"
systemctl --user daemon-reload
systemctl --user enable --now bezhas-ollama.service bezhas-ollama-gate.service bezhas-ollama-tunel.service
echo "✅ Servicios activos:  systemctl --user status bezhas-ollama bezhas-ollama-gate bezhas-ollama-tunel"
