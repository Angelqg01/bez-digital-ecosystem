#!/usr/bin/env bash
# Entorno de DEMOSTRACIÓN del vídeo «Tokenización de propiedades»: una cadena local con el mismo chain id que Polygon (137),
# BEZ y USDC simulados en sus direcciones reales, la fábrica RWA, la venta primaria y el reparto de rentas desplegados,
# y una API de prueba con el código de este repositorio. NADA toca Polygon ni usa claves reales: las cuentas son las
# públicas de anvil. Hecho para grabar; no sirve como entorno de pruebas de nadie más.
#
#   demo_env.sh up      arranca todo (idempotente) y deja los datos en ~/.cache/bz-video-tokenizacion/
#   demo_env.sh down    lo para
#   demo_env.sh status
#
# Cuentas (anvil): 0 desplegador/propietario de la fábrica (verifica el KYC) · 1 emisor · 2 Ana · 3 Luis
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
STATE="${DEMO_STATE:-$HOME/.cache/bz-video-tokenizacion}"; mkdir -p "$STATE"; chmod 700 "$STATE"
RPC=http://127.0.0.1:8545; API_PORT=3021
BEZ=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
USDC=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
TREASURY=0x89c23890c742d710265dD61be789C71dC8999b12   # Treasury DAO (CLAUDE.md): recibe las comisiones
PK0=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
A1=0x70997970C51812dc3A010C7d01b50e0d17dc79C8; A2=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; A3=0x90F79bf6EB2c4f870365E785982E1f101E93b906
SALE_FEE_BPS=250; RENT_FEE_BPS=100   # sólo de demostración: las comisiones reales se fijan al desplegar en Polygon

parar() { for p in "$STATE/anvil.pid" "$STATE/api.pid"; do [[ -f $p ]] && kill "$(cat "$p")" 2>/dev/null || true; rm -f "$p"; done; fuser -k "$API_PORT"/tcp 8545/tcp 2>/dev/null || true; }

up() {
  parar; sleep 1
  command -v anvil >/dev/null || { echo "Falta anvil (Foundry)" >&2; exit 1; }
  ( cd "$ROOT/smart-contracts" && [[ -f out/RWARentDistributor.t.sol/MockToken.json ]] || forge build >/dev/null )
  setsid nohup anvil --chain-id 137 --port 8545 --auto-impersonate --silent </dev/null >"$STATE/anvil.log" 2>&1 & echo $! >"$STATE/anvil.pid"
  for _ in $(seq 30); do cast chain-id --rpc-url $RPC >/dev/null 2>&1 && break; sleep 0.5; done
  CODE=$(python3 -c "import json;print(json.load(open('$ROOT/smart-contracts/out/RWARentDistributor.t.sol/MockToken.json'))['deployedBytecode']['object'])")
  cast rpc anvil_setCode $BEZ "$CODE" --rpc-url $RPC >/dev/null
  cast rpc anvil_setCode $USDC "$CODE" --rpc-url $RPC >/dev/null
  cd "$ROOT/smart-contracts"
  # forge create: --constructor-args tiene que ir el último, porque se come todo lo que le sigue.
  dep() { local c=$1; shift; forge create "$c" --private-key $PK0 --rpc-url $RPC --broadcast ${1:+--constructor-args "$@"} 2>&1 | grep -oE "Deployed to: 0x[0-9a-fA-F]{40}" | awk '{print $3}'; }
  FACT=$(dep src/finance/BeZhasRWAFactory.sol:BeZhasRWAFactory)
  SALE=$(dep src/finance/RWAPrimarySale.sol:RWAPrimarySale "$FACT" $BEZ $TREASURY $SALE_FEE_BPS)
  RENT=$(dep src/finance/RWARentDistributor.sol:RWARentDistributor "$FACT" $TREASURY $RENT_FEE_BPS)
  [[ -n $FACT && -n $SALE && -n $RENT ]] || { echo "Falló el despliegue (FACT=$FACT SALE=$SALE RENT=$RENT)" >&2; exit 1; }
  mint() { cast send "$1" "mint(address,uint256)" "$2" "$3" --private-key $PK0 --rpc-url $RPC >/dev/null; }
  mint $BEZ $A1 10000000000000000000000        # emisor: 10.000 BEZ (la tarifa de tokenización es 100)
  mint $USDC $A1 100000000000                  # emisor: 100.000 USDC (6 decimales) para las rentas
  mint $BEZ $A2 20000000000000000000000000     # Ana: 20.000.000 BEZ
  mint $BEZ $A3 20000000000000000000000000     # Luis: 20.000.000 BEZ
  cast rpc anvil_mine 200 --rpc-url $RPC >/dev/null   # el corte del reparto es cabeza−128
  printf 'FACT=%s\nSALE=%s\nRENT=%s\nBEZ=%s\nUSDC=%s\n' "$FACT" "$SALE" "$RENT" $BEZ $USDC >"$STATE/demo.env"
  JWT_SECRET="video-demo-secret-$(head -c12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')xxxxxxxxxx"
  ( cd "$ROOT/api" && setsid nohup env PORT=$API_PORT NODE_ENV=development JWT_SECRET="$JWT_SECRET" POLYGON_RPC_URL=$RPC BEZCOIN_ADDRESS=$BEZ \
      RWA_FACTORY_ADDRESS="$FACT" RWA_PRIMARY_SALE_ADDRESS="$SALE" RWA_RENT_DISTRIBUTOR_ADDRESS="$RENT" node index.js </dev/null >"$STATE/api.log" 2>&1 & echo $! >"$STATE/api.pid" )
  ( cd "$ROOT/api" && JWT_SECRET="$JWT_SECRET" A1=$A1 A2=$A2 A3=$A3 STATE="$STATE" node -e "
    const jwt=require('jsonwebtoken'),fs=require('fs');
    const W={emisor:process.env.A1,ana:process.env.A2,luis:process.env.A3};
    const out=Object.fromEntries(Object.entries(W).map(([k,a])=>[k,{address:a,jwt:jwt.sign({address:a,userId:1,role:'user'},process.env.JWT_SECRET,{expiresIn:'12h',algorithm:'HS256'})}]));
    fs.writeFileSync(process.env.STATE+'/jwts.json',JSON.stringify(out),{mode:0o600});" )
  for _ in $(seq 60); do curl -sf -m 2 "http://localhost:$API_PORT/api/health" >/dev/null && break; sleep 1; done
  echo "Entorno listo · chain 137 · API :$API_PORT · estado en $STATE"; cat "$STATE/demo.env"
}

case "${1:-}" in
  up) up ;;
  down) parar; echo "parado" ;;
  status) echo "anvil: $(cast chain-id --rpc-url $RPC 2>/dev/null || echo parado) · api: $(curl -s -m 2 -o /dev/null -w '%{http_code}' http://localhost:$API_PORT/api/health || echo parada)"; cat "$STATE/demo.env" 2>/dev/null || true ;;
  *) echo "uso: $0 up|down|status" >&2; exit 2 ;;
esac
