# Integracion real con BeZhas Core

Todas las apps del ecosistema deben usar el Core Gateway como punto unico para pagos, contratos, wallet, SSO, staking, farming, DAO, bridge y trading.

## URL base

- Desarrollo: `http://localhost:3001/api/gateway/v1`
- Produccion: `https://api.bez.digital/api/gateway/v1`

## SDK recomendado

```js
const { GatewayClient } = require('../sdk/gateway-client');

const core = new GatewayClient({
  gatewayUrl: process.env.BEZHAS_CORE_GATEWAY_URL,
  apiKey: process.env.BEZHAS_APP_API_KEY,
  accessToken: userAccessToken,
});
```

## Capacidades disponibles

- `core.sso`: login, refresh, logout y perfil compartido.
- `core.wallet`: balances e historial.
- `core.payments`: compra, venta, BezPay, historial y settlement.
- `core.staking`: posiciones on-chain y transacciones unsigned para staking.
- `core.farming`: posiciones on-chain y transacciones unsigned para depositos.
- `core.governance`: propuestas y votos DAO.
- `core.contracts`: direcciones y ABIs reales por red.
- `core.dex`: pools, quotes, swaps y liquidez mediante BeZhasDEX.
- `core.bridge`: transferencias cross-chain y fees.
- `core.treasury`: tokenomics y tesoreria.

## Regla de integracion

Las apps no deben duplicar pagos ni contratos. Deben pedir datos al Core Gateway y, cuando una operacion mueva fondos, recibir una `txRequest` para que la wallet del usuario firme la transaccion.

## Variables comunes

```env
BEZHAS_CORE_GATEWAY_URL=http://localhost:3001/api/gateway/v1
BEZHAS_APP_API_KEY=defi-dev-key
BEZHAS_CHAIN_ID=31337
BEZHAS_L2_RPC_URL=http://localhost:8545
```

## Flujo para operaciones con fondos

1. La app consulta contratos y ABIs con `core.contracts.get(name, chainId, true)`.
2. La app solicita quote o tx unsigned al Gateway.
3. La wallet del usuario aprueba el token si hace falta.
4. La wallet firma y envia la transaccion.
5. La app consulta `/transactions/:hash` o el historial del modulo correspondiente.
