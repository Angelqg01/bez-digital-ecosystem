# SDK: @bezhas/sdk

Librería JavaScript/Node para integrar pagos y settlement de BeZhas en cualquier aplicación.

## Instalación

```bash
npm install @bezhas/sdk
# o
yarn add @bezhas/sdk
# o
pnpm add @bezhas/sdk
```

## Inicialización

```javascript
import { BezhasClient } from '@bezhas/sdk';

const bez = new BezhasClient({
  apiKey: process.env.BEZHAS_API_KEY,        // De panel de desarrollador
  baseURL: 'https://api.bez.digital',
  webhookSecret: process.env.BEZHAS_WEBHOOK_SECRET,
  network: 'polygon',                        // polygon | bsc
});
```

## Casos de uso principales

### 1. Procesar un pago

```javascript
const payment = await bez.payments.create({
  orderId: 'order_12345',
  amount: 99.99,
  currency: 'EUR',
  merchant: {
    id: 'merchant_xyz',
    wallet: '0x...',
  },
  description: 'Producto X',
  metadata: { customerId: 'cust_123' },
});

// payment.id, payment.status, payment.txHash
```

### 2. Settlement automático

```javascript
const settlement = await bez.settlement.settle({
  paymentId: payment.id,
  // Automáticamente:
  // - Transfiere BEZ del treasury al merchant
  // - Si staking habilitado: 5% va a pool
  // - Emite evento on-chain
  // - Webhook a tu servidor
});
```

### 3. Escuchar webhooks

```javascript
bez.webhooks.onPaymentCompleted((event) => {
  console.log('Pago completado:', event);
  // event.paymentId, event.txHash, event.merchant
  updateYourDatabase(event);
});

bez.webhooks.onSettlementDone((event) => {
  console.log('Settlement completado:', event);
});
```

### 4. Autenticación SIWE (Sign In With Ethereum)

```javascript
const siweMessage = await bez.auth.createSIWEMessage({
  address: '0x...',
  statement: 'Conectar a BeZhas',
});

// Cliente firma en wallet (MetaMask, etc.)
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [siweMessage, address],
});

const session = await bez.auth.verifySIWE({
  message: siweMessage,
  signature,
  address,
});
```

### 5. Dashboard en tu app

```javascript
const stats = await bez.merchant.getStats('merchant_xyz');
// stats.totalRevenue, stats.totalSettled, stats.stakingRewards

const transactions = await bez.merchant.getTransactions('merchant_xyz', {
  limit: 50,
  offset: 0,
});
```

## Manejo de errores

```javascript
try {
  await bez.payments.create({...});
} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    // No hay BEZ en treasury
  } else if (error.code === 'INVALID_WEBHOOK_SECRET') {
    // Webhook signature inválida
  } else {
    console.error('Error desconocido:', error.message);
  }
}
```

## Verificar webhook (servidor)

```javascript
const isValid = bez.webhooks.verifySignature(
  req.body,           // Raw body como string
  req.headers['x-bez-signature']
);

if (!isValid) {
  res.status(401).json({ error: 'Webhook no válido' });
  return;
}

// Procesar evento
```

## Variables de entorno

```bash
BEZHAS_API_KEY=pk_live_xxx              # Clave pública (segura en cliente)
BEZHAS_API_SECRET=sk_live_yyy           # SECRETO (solo servidor)
BEZHAS_WEBHOOK_SECRET=whk_secret_zzz    # Para verificar webhooks
```

## Documentación completa

Más métodos disponibles:
- `bez.tokenomics.*` — Staking, farming, APY
- `bez.oracle.*` — Precio de BEZ
- `bez.escrow.*` — Multi-sig escrow para disputas
- `bez.audit.*` — Registros auditables on-chain

👉 [Repositorio npm](https://www.npmjs.com/package/@bezhas/sdk)
