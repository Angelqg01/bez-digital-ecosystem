# SDK & Integraciones

> El SDK de BeZhas permite interactuar con contratos, APIs y agentes sectoriales de forma sencilla y segura.

## Descarga del SDK
Node.js:
```bash
pnpm add @bezhas/sdk
```

Para instalarlo desde el monorepo y ejecutar pruebas: [API, SDK, Nodos y RPC](api-sdk-nodos-rpc.md).

## Métodos Principales
- `tokens.getBalance(address)` — Consultar saldo de BEZCoin
- `shipments.create(data)` — Crear un envío logístico
- `health.getRecords(address)` — Consultar registros médicos (requiere permisos)
- `energy.getCredits(address)` — Consultar créditos de carbono

## Ejemplo de uso
```js
import { BeZhasClient } from '@bezhas/sdk';
const client = new BeZhasClient({ apiKey: 'TU_API_KEY', network: 'testnet' });
const balance = await client.tokens.getBalance('0xTuWallet');
console.log('Saldo BEZ:', balance);
```

## Integración con Oráculos, IoT y Wallets
- Compatible con Web3/Ethers.js para firmar transacciones
- Soporte para integración con dispositivos IoT vía agentes sectoriales
- Ejemplo de integración con Metamask y hardware wallets en la documentación avanzada

> Nunca expongas claves privadas ni API Keys en código público.
