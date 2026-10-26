#!/usr/bin/env bash
# Despliegue de los contratos de wallet en Polygon Amoy (80002), la red de PRUEBAS.
#
#   DEPLOYER_PRIVATE_KEY=0x… scripts/deploy-wallet-amoy.sh              # solo simula; no envía nada
#   DEPLOYER_PRIVATE_KEY=0x… scripts/deploy-wallet-amoy.sh --broadcast  # envía, tras pedir confirmación escrita
#
# La clave es SOLO de pruebas: una cuenta nueva (`cast wallet new`) con POL de grifo. Nunca la Hot Wallet, la Treasury, la
# clave del KMS ni la clave pública de Anvil. Se lee de la variable de entorno y no se imprime ni se guarda en ningún fichero.
set -euo pipefail

BROADCAST=0; [ "${1:-}" = "--broadcast" ] && BROADCAST=1
RPC="${AMOY_RPC:-https://polygon-amoy-bor-rpc.publicnode.com}"   # rpc-amoy.polygon.technology ya no resuelve
MIN_POL="0.8"                                                      # la simulación estima ~0,47 POL a 30 gwei
export PATH="$PATH:$HOME/.foundry/bin"
cd "$(dirname "$0")/../smart-contracts"

[[ "${DEPLOYER_PRIVATE_KEY:-}" =~ ^0x[0-9a-fA-F]{64}$ ]] || { echo "Falta DEPLOYER_PRIVATE_KEY (0x + 64 hex). Genera una nueva con: cast wallet new"; exit 1; }
DEPLOYER="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"

# Direcciones que NO pueden ser el deployer de pruebas (minúsculas para comparar).
case "$(echo "$DEPLOYER" | tr 'A-F' 'a-f')" in
  0x52df82920cbae522880dd7657e43d1a754ed044e) echo "Esa es la Hot Wallet de producción. Usa una clave nueva de pruebas."; exit 1;;
  0x89c23890c742d710265dd61be789c71dc8999b12) echo "Esa es la Treasury DAO. Usa una clave nueva de pruebas."; exit 1;;
  0x80b8e2bff10623c65e3a000a3ec649b6767a5c7c) echo "Esa es la firmante del paymaster (KMS). Usa una clave nueva de pruebas."; exit 1;;
  0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266) echo "Esa es la clave pública de Anvil: cualquiera la conoce. Usa una clave nueva de pruebas."; exit 1;;
esac

[ "$(cast chain-id --rpc-url "$RPC")" = "80002" ] || { echo "El RPC $RPC no es Polygon Amoy (80002)."; exit 1; }
BAL="$(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether)"
echo "Deployer: $DEPLOYER   Saldo: $BAL POL   Red: Amoy (80002)"
if ! python3 -c "import sys; sys.exit(0 if float('$BAL') >= float('$MIN_POL') else 1)"; then
  echo "Saldo insuficiente (hace falta >= $MIN_POL POL). Pide POL de prueba en https://faucet.polygon.technology (red Amoy) para $DEPLOYER"
  exit 1
fi

# Valores por defecto de prueba: el propio deployer es admin y único guardián. En Amoy se despliega además un BEZCoinV2 de prueba.
export WALLET_ADMIN="${WALLET_ADMIN:-$DEPLOYER}"
export GUARDIANS="${GUARDIANS:-$WALLET_ADMIN}"
if [ -z "${MULTISIG_SIGNERS:-}" ]; then
  echo "AVISO: sin MULTISIG_SIGNERS el multisig lleva admin + la cuenta de Anvil #1 (clave pública): vale solo para probar. Define 2 o más firmantes propios."
fi

echo; echo "── SIMULACIÓN (fork de Amoy, no se envía nada) ──"
forge script script/DeployWallet.s.sol --fork-url "$RPC" 2>&1 | grep -E "chainId|deployer|admin|BEZ|SmartWalletFactory|Paymaster|WalletGuardian|SecurityModule|MultiSigWallet|IdentityRegistry|gas used|Estimated amount|Error|error" || true

if [ "$BROADCAST" != "1" ]; then
  echo; echo "Solo simulación. Para desplegar de verdad: añade --broadcast."; exit 0
fi

echo; read -r -p "Se van a ENVIAR transacciones a Amoy desde $DEPLOYER. Escribe DESPLEGAR EN AMOY para continuar: " OK
[ "$OK" = "DESPLEGAR EN AMOY" ] || { echo "Cancelado: no se ha enviado nada."; exit 1; }

forge script script/DeployWallet.s.sol --rpc-url "$RPC" --broadcast --slow
echo
echo "Hecho. Siguiente paso (a mano): copiar las direcciones del bloque de arriba a smart-contracts/deployments/80002.json,"
echo "sección \"wallet\" (y \"core\".BEZCoinV2 si se desplegó el token de prueba), y ejecutar: node sync-daemon.js --once"
