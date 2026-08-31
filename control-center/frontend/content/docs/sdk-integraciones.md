# SDK e integraciones

`@bezhas/sdk` es el paquete oficial. Resuelve direcciones de contratos por red, entrega ABIs y expone helpers de pagos, créditos y BEZ-Coin, para que no tengas que mantener un registro propio que se desincronice.

## Instalación

```bash
pnpm add @bezhas/sdk
```

> El proyecto usa **pnpm v11+** como estándar. No mezcles gestores: `npm` y `yarn` generan lockfiles incompatibles con el monorepo.

## Registro de contratos

```js
const { getContract, getABI, listContracts } = require('@bezhas/sdk');

listContracts();                          // todos los contratos conocidos
getContract('BEZCoinV2', 'bezhas-l2');    // { address, ... } para esa red
getABI('BEZCoinV2');                      // ABI listo para ethers/viem
```

Esta es la forma correcta de obtener direcciones. Hardcodearlas rompe en cuanto cambias de red o se redespliega un contrato.

## Cliente de alto nivel

```js
import { BeZhasClient } from '@bezhas/sdk';

const client = new BeZhasClient({
  apiKey: process.env.BEZHAS_API_KEY,   // desde el backend, nunca en el navegador
  network: 'testnet',
});

const saldo = await client.tokens.getBalance('0xTuWallet');
```

Métodos habituales:

| Método | Devuelve |
| --- | --- |
| `tokens.getBalance(address)` | Saldo de BEZ |
| `shipments.create(data)` | Crea un envío logístico |
| `health.getRecords(address)` | Registros clínicos (requiere permisos) |
| `energy.getCredits(address)` | Créditos de carbono |

## Con ethers.js

```js
import { ethers } from 'ethers';
import { getContract, getABI } from '@bezhas/sdk';

const provider = new ethers.JsonRpcProvider(process.env.BEZHAS_L2_RPC_URL);
const signer   = await new ethers.BrowserProvider(window.ethereum).getSigner();

const info = getContract('BEZCoinV2', 'bezhas-l2');
const bez  = new ethers.Contract(info.address, getABI('BEZCoinV2'), signer);

const tx = await bez.transfer(destino, ethers.parseUnits('100', 18));
const receipt = await tx.wait();
```

## Escuchar eventos

Reaccionar a eventos es más fiable y barato que sondear:

```js
const nft = new ethers.Contract(addr, getABI('BeZhasLogisticsNFT'), provider);

nft.on('LogisticsManifestCreated', (tokenId, containerId, to, evento) => {
  console.log(containerId, '→', to, 'tx:', evento.log.transactionHash);
});
```

Para histórico, usa `queryFilter` con rangos de bloque acotados.

## Patrón de integración con un ERP

```
ERP / WMS
   │  (1) evento de negocio: envío creado
   ▼
Tu backend  ──(2) llama a la API Core / SDK──►  BeZhas L2
   ▲                                              │
   │  (4) actualiza estado en el ERP              │ (3) evento on-chain
   └──────────────  listener de eventos  ─────────┘
```

Recomendaciones:

1. **Idempotencia.** Usa una referencia propia (`ref`, `orderId`) para no duplicar operaciones si reintentas.
2. **Cola intermedia.** No llames a la cadena de forma síncrona desde el flujo de usuario; encola y confirma.
3. **Reconciliación.** Tu fuente de verdad del estado on-chain son los eventos, no el `txHash` que devolviste al enviar.
4. **Nunca muestres un `txHash`** si la transacción no se firmó y emitió realmente.

## IoT y oráculos

Los dispositivos no firman directamente contra la cadena. El patrón correcto es: el dispositivo reporta a un agente sectorial → el agente valida y agrega → el oráculo autorizado escribe on-chain. Así el dispositivo nunca custodia una clave con permisos de escritura.

## MCP

Para orquestación multi-agente entre empresas, ver [MCP](/docs/mcp).

## Pruebas

```bash
pnpm test
pnpm build
```

Prueba siempre contra la red local (`31337`) antes de apuntar a `2708`.

## Ver también

- [Referencia de API](/docs/api-reference)
- [RPC y endpoints](/docs/rpc-endpoints)
- [Smart contracts y ABIs](/docs/smart-contracts)
