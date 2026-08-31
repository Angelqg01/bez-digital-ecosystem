# RPC y endpoints

## Redes y chain IDs

| Red | Chain ID | Notas |
| --- | --- | --- |
| BeZhas L2 | `2708` | Red del protocolo, gas en BEZ, bloque de 2 s |
| Local (Anvil) | `31337` | Desarrollo con Foundry |
| Polygon | `137` | BEZ ERC-20 |
| BNB Chain | `56` | BEZ BEP-20 |

Las direcciones de contrato **no coinciden entre redes**. Resuélvelas siempre por SDK o por API, nunca hardcodeadas.

## Desarrollo local

```bash
anvil --chain-id 31337 --port 8545
```

```env
BEZHAS_L2_RPC_URL=http://127.0.0.1:8545
BEZHAS_CHAIN_ID=31337
```

Comprobar que responde:

```bash
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

WebSocket, cuando el nodo lo expone: `ws://127.0.0.1:8546`.

## Métodos JSON-RPC

La L2 es EVM-compatible: funcionan los métodos estándar de Ethereum.

| Método | Uso |
| --- | --- |
| `eth_chainId` | Verificar a qué red estás conectado |
| `eth_blockNumber` | Altura de bloque actual |
| `eth_getBalance` | Saldo nativo de una dirección |
| `eth_call` | Lectura de contrato sin transacción |
| `eth_estimateGas` | Estimar coste antes de firmar |
| `eth_sendRawTransaction` | Enviar transacción firmada |
| `eth_getLogs` | Consultar eventos históricos |
| `eth_subscribe` | Suscripción a eventos (solo WS) |

## Conectar desde tu aplicación

**ethers.js v6**

```js
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.BEZHAS_L2_RPC_URL);
const red = await provider.getNetwork();
console.log('chainId:', red.chainId);
```

**viem**

```js
import { createPublicClient, http, defineChain } from 'viem';

export const bezhasL2 = defineChain({
  id: 2708,
  name: 'BeZhas L2',
  nativeCurrency: { name: 'BeZhas Coin', symbol: 'BEZ', decimals: 18 },
  rpcUrls: { default: { http: [process.env.BEZHAS_L2_RPC_URL] } },
});

const client = createPublicClient({ chain: bezhasL2, transport: http() });
```

## Añadir la red a una wallet

```js
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0xA94',                 // 2708
    chainName: 'BeZhas L2',
    nativeCurrency: { name: 'BeZhas Coin', symbol: 'BEZ', decimals: 18 },
    rpcUrls: ['<RPC público de BeZhas L2>'],
    blockExplorerUrls: ['<explorador de BeZhas L2>'],
  }],
});
```

Consulta los endpoints públicos vigentes en la página [RPC & Nodos](/rpc) del portal — se actualizan ahí antes que en cualquier copia.

## Opciones de acceso

| Modo | Para qué | Consideraciones |
| --- | --- | --- |
| **RPC público** | Pruebas, lecturas, volumen bajo | Rate limit compartido |
| **RPC dedicado** | Producción con carga sostenida | Cuota propia y SLA |
| **Nodo propio** | Máxima privacidad y control | Ver [Nodos](/docs/nodos-enterprise-edge) |

Si tus consultas revelan patrones de negocio (qué contenedores rastreas, con qué contrapartes operas), un RPC público las expone a quien opere ese endpoint. Para operación real, nodo propio o RPC dedicado.

## Buenas prácticas

- **No expongas tu RPC a Internet sin autenticación ni rate limiting.**
- Usa siempre HTTPS/WSS fuera de `localhost`.
- Reintenta con backoff exponencial: un RPC puede devolver 429 bajo carga.
- Prefiere `eth_getLogs` con rangos acotados y filtros por dirección y topic; las consultas de rango abierto son lentas y suelen recortarse.
- Verifica `eth_chainId` al arrancar: es la forma más barata de detectar que apuntas a la red equivocada antes de firmar algo.
- Para eventos en tiempo real usa WebSocket con reconexión automática, no sondeo agresivo.

## Ver también

- [Nodos Enterprise y Edge](/docs/nodos-enterprise-edge)
- [Referencia de API](/docs/api-reference)
- [SDK e integraciones](/docs/sdk-integraciones)
