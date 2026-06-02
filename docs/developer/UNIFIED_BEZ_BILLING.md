# Unified BEZ Billing

Sistema unico de pagos, creditos y consumo IA para BeZhas-Hub y todas las SubApp's.

## Principio

Todas las apps deben usar el gateway unificado:

- `GET /api/billing/core`
- `GET /api/billing/core/balance/:address`
- `GET /api/billing/packages`
- `POST /api/billing/packages/:id/checkout`
- `GET /api/billing/balance`
- `GET /api/billing/history`
- `GET /api/billing/ai/summary`
- `POST /api/billing/ai/estimate`
- `POST /api/billing/ai/charge`
- `POST /api/billing/add-fiat-funds`
- `POST /api/billing/add-bez-funds`
- `GET /api/mtfc/manifest`
- `POST /api/mtfc/evaluate`
- `POST /api/mtfc/batch`
- `POST /api/mtfc/estimate`

El gateway mantiene la conexion con BeZhas-Blockchain Core leyendo metadata de cadena, contrato `BEZCoinV2` y balances on-chain. BeZhas-Hub mantiene el ledger interno de creditos y consumos.

## Uso en SubApp's

```ts
import { createBillingClient } from '@bezhas/platform-sdk/billing';

const billing = createBillingClient({
  gatewayUrl: 'http://localhost:3001/api',
  token: jwt,
  walletAddress,
});

const packages = await billing.getCreditPackages();
const checkout = await billing.checkoutCreditPackage('growth');

const estimate = await billing.estimateAIUsage('gpt-4o-mini', {
  inputTokens: 12000,
  cachedInputTokens: 4000,
  outputTokens: 1800,
});

const result = await billing.chargeAIUsage({
  model: 'gpt-4o-mini',
  feature: 'ADS_AGENT',
  projectId: campaignId,
  usage: estimate.data.usage,
});
```

## M-TFC Lab

El motor M-TFC se integra como servicio computacional para SubApp's cientificas, IA y simulacion. El crate nativo vive en `services/mtfc-core` y la API expone un adaptador compatible para uso inmediato:

```js
const payments = new PaymentsManager({ apiUrl, apiKey });

const manifest = await payments.getMTFCManifest();
const quote = await payments.estimateMTFCCompute({
  operations: 100000,
  priority: 'bulk',
});

const result = await payments.evaluateMTFC({
  fidelidadMax: 1,
  tensionEstatica: 0.2,
  tensionDinamica: 0.3,
  tauBase: 10,
});
```

La blockchain Core no ejecuta simulaciones pesadas. Core debe usarse para pagos BEZ-Coin, certificacion, hashes de entrada/salida, propiedad de reportes y trazabilidad de resultados.

## Regla de producto

Las SubApp's no deben calcular precios finales por su cuenta. Pueden mostrar estimaciones, pero el cobro definitivo debe venir de `POST /api/billing/ai/charge`, porque ahi se aplican:

- coste real API/IA
- cache de tokens
- infraestructura
- margen
- IVA
- precio BEZ/EUR
- auditoria en ledger

## Relacion Core vs creditos internos

`BEZCoinV2` sigue siendo el token blockchain Core. El saldo interno de billing representa creditos operativos denominados en BEZ para consumir agentes y servicios. Las compras FIAT/Stripe, compras cripto y ajustes deben terminar en el mismo ledger para que admin pueda medir margen por usuario, modelo, feature y SubApp.
