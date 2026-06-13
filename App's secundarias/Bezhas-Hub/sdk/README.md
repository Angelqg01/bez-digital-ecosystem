# @bezhas/sdk

Cliente oficial del **BeZhas Hub** para integraciones externas (instituciones, holdings, partners).

- **Zero dependencias** — `fetch` nativo (Node 18+ y navegadores).
- **Espejo del contrato** — la superficie se genera del manifest `ENDPOINTS`, sincronizado con el contrato OpenAPI del Hub (`backend/openapi.json`). El test `backend/tests/sdk-contract-sync.test.js` falla en CI si divergen.
- **Tipado** — `index.d.ts` incluido.

## Instalación

```bash
pnpm add @bezhas/sdk
```

## Uso

```js
const { BezhasHubClient } = require('@bezhas/sdk');

const hub = new BezhasHubClient({
    apiKey: process.env.BEZHAS_API_KEY,   // X-API-Key del Developer Portal
    // baseUrl: 'http://localhost:3001/api', // para desarrollo local
});

// Estado del Hub
const health = await hub.health.get();

// Auditoría on-chain (due diligence): eventos indexados con filtros
const { events } = await hub.web3.indexerEvents({
    query: { contractName: 'BezhasToken', eventName: 'Transfer', limit: 25 },
});

// Quality Oracle / Escrow
const service = await hub.escrow.get('42');
await hub.escrow.create({ body: { clientWallet: '0x…', collateralAmount: '…' } });
```

## Manejo de errores

Todas las respuestas no-2xx lanzan `BezhasHubError` con `status`, `body` y `path`:

```js
const { BezhasHubError } = require('@bezhas/sdk');
try {
    await hub.escrow.get('999');
} catch (e) {
    if (e instanceof BezhasHubError && e.status === 404) { /* … */ }
}
```

## Superficie disponible

| Namespace | Métodos |
|---|---|
| `health` | `get` · `live` · `ready` |
| `escrow` | `create` · `get` · `finalize` · `dispute` · `stats` |
| `developers` | `register` · `keys` · `generate` · `playground` |
| `clothingRental` | `create` · `byCustomer` · `byMerchant` · `get` · `initiateAegis` · `aegisStatus` · `merchantDecision` · `recordPayment` · `processReturn` · `addReview` · `pendingAegis` · `stats` · `categories` |
| `web3` | `health` · `status` · `indexerStats` · `indexerEvents` · `queueStats` |

La referencia completa (parámetros, esquemas, respuestas) vive en el Swagger del Hub: `/api-docs`.

## Tests

```bash
pnpm test   # smoke sin red (fetch inyectado)
```

La sincronía SDK ↔ contrato se valida en el CI del Hub (`backend/tests/sdk-contract-sync.test.js`).
