# ERP Integration

Conecta BeZhas a tu ERP (SAP, Oracle, Odoo, Sage, NetSuite, etc.)

## Opciones de integración

### 1. API REST (recomendado)

Conecta directamente vía HTTP sin dependencias.

```bash
POST /api/v1/payments/create
GET /api/v1/merchants/{id}/transactions
POST /api/v1/settlement/execute
```

**Ventaja**: Simple, funciona en cualquier ERP
**Desventaja**: Requiere desarrollo personalizado

### 2. Adaptador ERP (SDK)

Usa `@bezhas/sdk` + adapters específicos:

```javascript
import { BezhasClient } from '@bezhas/sdk';
import { SAPAdapter } from '@bezhas/sdk/adapters/sap';

const bez = new BezhasClient({...});
const sap = new SAPAdapter(bez);

// Sincroniza órdenes SAP → pagos BeZhas
sap.syncOrders();
```

**Adapters disponibles**:
- SAP ECC / S/4HANA
- Oracle EBS / Fusion
- Odoo / OpenERP
- Sage 100 / 300
- NetSuite
- Genérico (SOAP/REST)

### 3. Middleware (n8n/Zapier)

Crea workflow sin código:

```
SAP (Order Created) 
  → n8n (extract data)
  → BeZhas API (create payment)
  → SAP (update order status)
```

## Caso de uso: SAP → BeZhas

**Instalación del adapter**:
```bash
npm install @bezhas/sdk @bezhas/sap-adapter
```

**Código**:
```javascript
const BezhasClient = require('@bezhas/sdk').BezhasClient;
const SAPAdapter = require('@bezhas/sap-adapter');

const bez = new BezhasClient({
  apiKey: process.env.BEZHAS_API_KEY,
});

const sap = new SAPAdapter(bez, {
  sapSystem: 'ERP',
  username: 'SAP_USER',
  password: 'SAP_PASS',
  host: 'sap.empresa.com',
});

// Cada vez que SAP crea una orden de venta:
sap.on('salesOrder.created', async (order) => {
  const payment = await bez.payments.create({
    orderId: order.id,
    amount: order.totalAmount,
    currency: 'EUR',
    merchantId: 'sap_main',
  });
  
  // Actualiza SAP con el hash de la transacción
  await sap.updateOrder(order.id, {
    bezhasPaymentId: payment.id,
    blockchainTx: payment.txHash,
  });
});

sap.connect();
```

## Campos mapeados automáticos

| SAP | BeZhas |
|---|---|
| Order ID | orderId |
| Customer | merchantId |
| Amount | amount |
| Currency | currency |
| Payment Date | timestamp |
| Document | metadata |

## Sincronización de datos

```javascript
// Sincronizar órdenes cada 5 minutos
setInterval(async () => {
  const orders = await sap.getUnpaidOrders();
  
  for (const order of orders) {
    const payment = await bez.payments.create({...});
    await sap.markOrderAsPaid(order.id, payment.txHash);
  }
}, 5 * 60 * 1000);
```

## Auditoría y cumplimiento

Todas las transacciones quedan en blockchain (immutable):
- Fecha/hora exacta
- Montos
- Participantes
- Estado final

Acceso vía:
```javascript
const auditLog = await bez.audit.getTransactions({
  merchantId: 'sap_main',
  from: '2026-01-01',
  to: '2026-12-31',
});
```

## Soporte por ERP

- **SAP**: Adapter nativo + Docs
- **Oracle**: Adapter nativo + Docs
- **Odoo**: Módulo comunitario + API REST
- **Sage**: API REST + Postman collection
- **NetSuite**: SuiteScript adapter
- **Otros**: Documentación genérica API REST

## Contacto

Email: enterprise@bez.digital
Slack: https://bez.digital/community
