# API, SDK, Nodos y RPC

Guia practica para instalar y usar la capa de integracion BeZhas en un entorno real o local. Esta pagina consolida los enlaces que antes estaban repartidos entre `sdk/`, `enterprise-node/`, `bezhas-edge-node/` y `docs/`.

## Estado actual

- API Core: Express en `http://localhost:3001/api`.
- SDK oficial: paquete Node `@bezhas/sdk` en `sdk/`.
- Nodo empresarial: paquete distribuible en `enterprise-node/`, API local en `http://localhost:4100`.
- Edge Node: servicio de validacion en `bezhas-edge-node/`, API local en `http://localhost:4000`.
- RPC local: `http://localhost:8545` cuando Anvil o geth estan levantados.
- RPC WebSocket: `ws://localhost:8546` cuando el nodo expone WS.

## Requisitos

- Node.js 20 o superior.
- pnpm 11 o superior.
- Docker Desktop para Postgres, Redis y nodos contenedorizados.
- Foundry para desarrollo local de contratos: `forge`, `anvil`, `cast`.
- Wallet EVM para firmas de usuario.

## Instalacion del SDK

```bash
pnpm add @bezhas/sdk
```

Para desarrollo local desde este monorepo:

```bash
cd D:\BeZhas-Blockchain\sdk
pnpm install
pnpm test
pnpm build
```

Uso basico:

```js
const { getContract, getABI, listContracts } = require('@bezhas/sdk');

const contracts = listContracts();
const bez = getContract('BEZCoinV2', 'localhost');
const abi = getABI('BEZCoinV2');

console.log({ contracts: contracts.length, address: bez?.address, abi: abi.length });
```

## API Core

Base local:

```text
http://localhost:3001/api
```

Autenticacion:

```http
Authorization: Bearer <API_KEY>
```

Endpoints de entrada:

- `GET /api/health` - salud del Core.
- `GET /api/gateway/v1/*` - gateway unificado.
- `GET /api/contracts-abi/*` - ABIs y contratos.
- `POST /api/cargolink/v1/*` - integraciones CargoLink reales contra Core.
- `POST /api/ai-billing/*` - billing, creditos y consumo unificado.

Prueba local:

```powershell
Invoke-WebRequest http://localhost:3001/api/health -UseBasicParsing
```

## RPC local

Para desarrollo local con Anvil:

```powershell
cd D:\BeZhas-Blockchain\smart-contracts
anvil --chain-id 31337 --port 8545
```

Variables recomendadas para entorno local:

```env
BEZHAS_L2_RPC_URL=http://localhost:8545
BEZHAS_CHAIN_ID=31337
```

Validacion RPC:

```powershell
Invoke-WebRequest `
  -Uri http://localhost:8545 `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' `
  -UseBasicParsing
```

Para testnet o produccion, usar `BEZHAS_CHAIN_ID=2708` y un RPC de BeZhas L2 con contratos desplegados para esa red.

## Nodos

### Enterprise Node

Ubicacion:

```text
enterprise-node/
```

Instalacion y validacion:

```powershell
cd D:\BeZhas-Blockchain\enterprise-node
npm run validate
```

Variables principales:

```env
PORT=4100
API_KEY=<clave_b2b>
BEZHAS_L2_RPC_URL=http://localhost:8545
CHAIN_ID=31337
PUBLIC_RPC_URL=http://localhost:8545
BEZHAS_SDK_PATH=../sdk
```

Arranque local:

```powershell
npm start
```

Arranque con Docker:

```powershell
cd D:\BeZhas-Blockchain\enterprise-node
copy .env.example .env
docker compose up -d
```

Endpoints utiles:

- `GET /health`
- `GET /network/stats`
- `GET /sdk/frontend-config`
- `GET /sdk/status`
- `GET /sdk/contracts`
- `GET /validator/status`
- `GET /profitability/report`

### Edge Node

Ubicacion:

```text
bezhas-edge-node/
```

Variables principales:

```env
PORT=4000
RPC_URL=http://localhost:8545
EDGE_NODE_PRIVATE_KEY=<private_key>
EDGE_NODE_ADDRESS=<address>
EDGE_NODE_API_KEY=<api_key>
```

Arranque:

```powershell
cd D:\BeZhas-Blockchain\bezhas-edge-node
npm start
```

Health:

```powershell
Invoke-WebRequest http://localhost:4000/health -UseBasicParsing
```

## Pruebas necesarias

SDK:

```powershell
cd D:\BeZhas-Blockchain\sdk
pnpm test
pnpm build
node test\smoke.test.js
node test\payments.unit.test.js
```

Nodos:

```powershell
cd D:\BeZhas-Blockchain\enterprise-node
npm run validate

cd D:\BeZhas-Blockchain\bezhas-edge-node
node --check server.js
node --check auto-signer.js
```

Contratos y RPC:

```powershell
cd D:\BeZhas-Blockchain\smart-contracts
forge test

cd D:\BeZhas-Blockchain
node scripts\verify-deployment.js 31337
node scripts\validator-status.js --chainId 31337 --rpcUrl http://localhost:8545 --operator <wallet>
```

## Reglas de produccion

- No publicar `PRIVATE_KEY`, `VALIDATOR_PRIVATE_KEY`, `EDGE_NODE_PRIVATE_KEY` ni API keys.
- Exponer RPC en `127.0.0.1` por defecto; usar `0.0.0.0` solo detras de firewall, VPN o reverse proxy.
- Separar red local `31337` de BeZhas L2 `2708`.
- No mostrar `txHash` si la transaccion no fue firmada y emitida realmente.
- Todas las SubApps deben consumir el mismo Core API, sistema de billing, creditos y BEZ-Coin.
