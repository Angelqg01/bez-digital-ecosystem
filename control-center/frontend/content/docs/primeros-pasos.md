# Primeros pasos

Guía mínima para pasar de cero a tu primera lectura on-chain en BeZhas.

## Requisitos

- **Node.js** >= 20
- **pnpm** >= 11 (estándar del proyecto — no uses `npm` ni `yarn`)
- **Foundry** (`forge`, `anvil`, `cast`) si vas a trabajar con contratos
- **Docker** para levantar servicios locales (Postgres, Redis, nodos)
- Una **wallet EVM** (MetaMask, Rabby, Ledger…)

## 1. Instala el SDK

```bash
pnpm add @bezhas/sdk
```

## 2. Consulta contratos y ABIs

El SDK expone el registro de contratos desplegados por red, sin que tengas que copiar direcciones a mano:

```js
const { getContract, getABI, listContracts } = require('@bezhas/sdk');

const contratos = listContracts();
const bez = getContract('BEZCoinV2', 'localhost');
const abi = getABI('BEZCoinV2');

console.log({ total: contratos.length, address: bez?.address, funciones: abi.length });
```

## 3. Lee un balance on-chain

```js
import { ethers } from 'ethers';
import { getContract, getABI } from '@bezhas/sdk';

const provider = new ethers.JsonRpcProvider(process.env.BEZHAS_L2_RPC_URL);
const info = getContract('BEZCoinV2', 'bezhas-l2');

const bez = new ethers.Contract(info.address, getABI('BEZCoinV2'), provider);

console.log('Símbolo:', await bez.symbol());
console.log('Supply :', ethers.formatUnits(await bez.totalSupply(), 18));
console.log('Balance:', ethers.formatUnits(await bez.balanceOf('0xTuWallet'), 18));
```

## 4. Levanta un entorno local (opcional)

Para desarrollar sin depender de la red pública:

```bash
anvil --chain-id 31337 --port 8545
```

Variables de entorno para ese entorno:

```env
BEZHAS_L2_RPC_URL=http://127.0.0.1:8545
BEZHAS_CHAIN_ID=31337
```

Comprueba que responde:

```bash
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

## 5. Conecta con la API Core

La API Core unifica wallet, billing, créditos, contratos e integraciones sectoriales:

```bash
curl -H "Authorization: Bearer $BEZHAS_API_KEY" \
  https://api.bez.digital/api/gateway/v1/token/info
```

Detalle completo de endpoints en la [Referencia de API](/docs/api-reference).

## Reglas desde el minuto uno

- Nunca pongas una clave privada, mnemónico o API key en el código, en el frontend ni en un commit. Usa variables de entorno o un gestor de secretos.
- Separa siempre el entorno local (`31337`) del de la L2 (`2708`). Las direcciones de contrato **no** coinciden entre redes.
- No muestres un `txHash` en tu UI si la transacción no se firmó y emitió realmente.

## Siguientes pasos

- [SDK e integraciones](/docs/sdk-integraciones)
- [RPC y endpoints](/docs/rpc-endpoints)
- [Tokenización de activos](/docs/tokenizacion-activos)
- [Seguridad y buenas prácticas](/docs/seguridad)
