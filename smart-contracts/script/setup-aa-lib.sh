#!/usr/bin/env bash
# Baja eth-infinitism/account-abstraction v0.8.0 (EntryPoint, SimpleAccount) a lib/account-abstraction
# para las pruebas del perfil `aa`. Fija el commit: si el tag cambiara, el script falla.
set -euo pipefail
cd "$(dirname "$0")/.."
PIN=4cbc06072cdc19fd60f285c5997f4f7f57a588de
if [ ! -d lib/account-abstraction/.git ]; then
  git clone -q --depth 1 --branch v0.8.0 https://github.com/eth-infinitism/account-abstraction.git lib/account-abstraction
fi
GOT=$(git -C lib/account-abstraction rev-parse HEAD)
[ "$GOT" = "$PIN" ] || { echo "commit inesperado: $GOT (esperaba $PIN)" >&2; exit 1; }
echo "account-abstraction v0.8.0 listo ($PIN). Ejecuta: FOUNDRY_PROFILE=aa forge test"
