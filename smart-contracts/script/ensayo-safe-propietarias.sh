#!/usr/bin/env bash
# ============================================================================
# Ensayo del cambio de propietarias del Safe de BeZhas, sobre un fork LOCAL de
# Polygon (anvil). No envía nada a la red real ni necesita ninguna clave: las
# firmas se simulan con approveHash desde las cuentas impersonadas.
#
#   1. swapOwner: sale la Hot Wallet 0x52Df…, entra la wallet nueva. Firma 0x89c2.
#   2. changeThreshold(2). Firma 0xC0ec.
#   3. Comprueba que una sola firma ya no basta.
#
# Uso (el fork debe ser reciente: los RPC públicos no sirven estado antiguo):
#   anvil --fork-url https://polygon.drpc.org --port 8649 &
#   NEW=0x<wallet nueva> ./smart-contracts/script/ensayo-safe-propietarias.sh
# Ensayado el 2026-11-05 con una dirección de marcador: los tres pasos, bien.
# ============================================================================
set -euo pipefail
R=${FORK_RPC:-http://127.0.0.1:8649}
SAFE=0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
HOT=0x52Df82920CBAE522880dD7657e43d1A754eD044E
DAO=0x89c23890c742d710265dD61be789C71dC8999b12
C0=0xC0ec3b1fCb7Dc0c764371919837C13b58cDc330A
NEW=${NEW:?Indica NEW=0x… la wallet de firma nueva que sustituye a la Hot Wallet}
SENT=0x0000000000000000000000000000000000000001
Z=0x0000000000000000000000000000000000000000

firmar_y_ejecutar() {  # $1 firmante  $2 calldata
  local f=$1 data=$2 nonce h sig
  nonce=$(cast call $SAFE "nonce()(uint256)" --rpc-url $R)
  h=$(cast call $SAFE "getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256)(bytes32)" \
      $SAFE 0 $data 0 0 0 0 $Z $Z $nonce --rpc-url $R)
  cast rpc anvil_setBalance $f 0x8AC7230489E80000 --rpc-url $R >/dev/null
  cast rpc anvil_impersonateAccount $f --rpc-url $R >/dev/null
  cast send $SAFE "approveHash(bytes32)" $h --from $f --unlocked --rpc-url $R >/dev/null
  # Firma «pre-validada» de Safe: r = propietaria, s = 0, v = 1.
  sig=0x000000000000000000000000${f:2}$(printf '0%.0s' {1..64})01
  cast send $SAFE "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)" \
      $SAFE 0 $data 0 0 0 0 $Z $Z $sig --from $f --unlocked --rpc-url $R >/dev/null
}

echo "Antes:   owners=$(cast call $SAFE 'getOwners()(address[])' --rpc-url $R) umbral=$(cast call $SAFE 'getThreshold()(uint256)' --rpc-url $R)"
# 1) Sustituir la Hot Wallet (primera de la lista → prevOwner = centinela). Firma 0x89c2: prueba que su clave sirve.
firmar_y_ejecutar $DAO "$(cast calldata 'swapOwner(address,address,address)' $SENT $HOT $NEW)"
echo "Paso 1:  owners=$(cast call $SAFE 'getOwners()(address[])' --rpc-url $R) umbral=$(cast call $SAFE 'getThreshold()(uint256)' --rpc-url $R)"
# 2) Umbral 2. Firma 0xC0ec: prueba la segunda clave.
firmar_y_ejecutar $C0 "$(cast calldata 'changeThreshold(uint256)' 2)"
echo "Paso 2:  owners=$(cast call $SAFE 'getOwners()(address[])' --rpc-url $R) umbral=$(cast call $SAFE 'getThreshold()(uint256)' --rpc-url $R)"
echo "¿La Hot Wallet sigue siendo propietaria? $(cast call $SAFE 'isOwner(address)(bool)' $HOT --rpc-url $R)"
# 3) Comprobación: una sola firma ya no basta.
if firmar_y_ejecutar $DAO "$(cast calldata 'changeThreshold(uint256)' 1)" 2>/dev/null; then echo "MAL: una sola firma bastó"; else echo "Paso 3:  con una sola firma, revierte (correcto)"; fi
