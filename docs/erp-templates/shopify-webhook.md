# Shopify — BeZhas Webhook Integration

> Template de integración para notarizar eventos Shopify en la blockchain BeZhas L2.

## Resumen

Configurar Shopify para enviar webhooks nativos al Edge Node de BeZhas. Cada evento de tienda (orden creada, pago procesado, envío completado) se notariza automáticamente en la blockchain para trazabilidad y auditoría.

## Arquitectura

```
Shopify Store  →  Webhook nativo  →  Middleware (adaptador)  →  BeZhas Edge Node  →  Blockchain L2
(evento)          (HTTP POST)         (firma + transform)        (notarización)       (inmutable)
```

## Requisitos

- Tienda Shopify (Basic plan o superior)
- Shopify Admin API access (API key + secret)
- Edge Node desplegado y accesible por HTTPS
- Credenciales BeZhas: `webhookSecret` del onboarding

## Opción A: Webhook Nativo de Shopify (Sin código)

### Configurar desde Admin

1. Ir a **Settings → Notifications → Webhooks**
2. Crear webhook para cada evento:

| Evento Shopify | URL Target | Formato |
|---|---|---|
| Order creation | `https://<edge-node>:4200/api/webhook/shopify` | JSON |
| Order payment | `https://<edge-node>:4200/api/webhook/shopify` | JSON |
| Order fulfillment | `https://<edge-node>:4200/api/webhook/shopify` | JSON |
| Refund creation | `https://<edge-node>:4200/api/webhook/shopify` | JSON |
| Product creation | `https://<edge-node>:4200/api/webhook/shopify` | JSON |
| Inventory level update | `https://<edge-node>:4200/api/webhook/shopify` | JSON |

3. Shopify firmará cada webhook con `X-Shopify-Hmac-SHA256`

### Middleware Adaptador (Node.js)

Necesitas un middleware que reciba el webhook de Shopify, verifique la firma, transforme al formato BeZhas, y reenvíe al Edge Node.

Crear `integrations/shopify-adapter.js`:

```javascript
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
const BEZHAS_EDGE_URL = process.env.EDGE_NODE_URL || 'https://localhost:4200/api/webhook/ingest';
const BEZHAS_WEBHOOK_SECRET = process.env.BEZHAS_WEBHOOK_SECRET;

// Raw body para verificación de firma
app.use('/api/webhook/shopify', express.raw({ type: 'application/json' }));

/**
 * Verificar firma Shopify HMAC-SHA256
 */
function verifyShopifySignature(rawBody, hmacHeader) {
    const hash = crypto
        .createHmac('sha256', SHOPIFY_SECRET)
        .update(rawBody)
        .digest('base64');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

/**
 * Generar firma BeZhas HMAC-SHA256
 */
function signForBeZhas(payload) {
    return crypto
        .createHmac('sha256', BEZHAS_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
}

/**
 * Mapear evento Shopify → formato BeZhas
 */
function mapShopifyEvent(topic, data) {
    const eventMap = {
        'orders/create':     { event: 'sales_order_created',  sector: 'Retail' },
        'orders/paid':       { event: 'payment_executed',     sector: 'Finanzas' },
        'orders/fulfilled':  { event: 'outbound_delivery',    sector: 'Logística' },
        'refunds/create':    { event: 'refund_processed',     sector: 'Finanzas' },
        'products/create':   { event: 'product_created',      sector: 'Retail' },
        'inventory_levels/update': { event: 'stock_movement', sector: 'Manufactura' },
    };

    const mapping = eventMap[topic] || { event: topic, sector: 'general' };

    return {
        event: mapping.event,
        documentId: data.id ? String(data.id) : 'unknown',
        amount: parseFloat(data.total_price || data.subtotal_price || '0'),
        currency: data.currency || 'USD',
        sector: mapping.sector,
        source: 'shopify',
        timestamp: new Date().toISOString(),
        metadata: {
            shopifyId: data.id,
            orderNumber: data.order_number || null,
            shopDomain: data.shop_domain || null,
            customerEmail: data.email ? '***' : null, // No enviar PII
            itemCount: data.line_items ? data.line_items.length : 0
        }
    };
}

app.post('/api/webhook/shopify', async (req, res) => {
    // 1. Verificar firma Shopify
    const hmac = req.headers['x-shopify-hmac-sha256'];
    if (!hmac || !verifyShopifySignature(req.body, hmac)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Parsear y transformar
    const topic = req.headers['x-shopify-topic'];
    const shopifyData = JSON.parse(req.body.toString());
    const bezhasPayload = mapShopifyEvent(topic, shopifyData);

    // 3. Firmar y enviar a Edge Node
    const payloadStr = JSON.stringify(bezhasPayload);
    const signature = signForBeZhas(payloadStr);

    try {
        const response = await axios.post(BEZHAS_EDGE_URL, bezhasPayload, {
            headers: {
                'Content-Type': 'application/json',
                'X-BeZhas-Signature': signature,
                'X-BeZhas-Timestamp': bezhasPayload.timestamp
            },
            timeout: 15000
        });

        console.log(`[BeZhas] ${topic} → txHash: ${response.data.txHash}`);
        res.status(200).json({ success: true, txHash: response.data.txHash });
    } catch (err) {
        console.error(`[BeZhas] Error: ${err.message}`);
        // Responder 200 a Shopify para evitar reintentos excesivos
        // El error se loguea y se puede reintentar internamente
        res.status(200).json({ success: false, error: 'Edge node unavailable' });
    }
});

const PORT = process.env.SHOPIFY_ADAPTER_PORT || 4201;
app.listen(PORT, () => console.log(`Shopify adapter on :${PORT}`));
```

## Opción B: Shopify App (Flow + Webhook)

Para tiendas que prefieren configuración visual:

1. Ir a **Shopify Flow** → Create Workflow
2. **Trigger**: "Order created" (o el evento deseado)
3. **Action**: "Send HTTP request"
   - URL: `https://<edge-node>:4200/api/webhook/ingest`
   - Method: POST
   - Headers:
     ```
     Content-Type: application/json
     X-BeZhas-Signature: {{hmac_sha256(body, "TU_WEBHOOK_SECRET")}}
     ```
   - Body:
     ```json
     {
       "event": "sales_order_created",
       "documentId": "{{order.name}}",
       "amount": {{order.totalPrice}},
       "currency": "{{order.currency}}",
       "sector": "Retail",
       "source": "shopify",
       "timestamp": "{{now | date: '%Y-%m-%dT%H:%M:%SZ'}}"
     }
     ```

> **Nota**: Shopify Flow no soporta HMAC nativo en actions, se recomienda Opción A para producción.

## Docker (Adaptador)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY integrations/shopify-adapter.js .
EXPOSE 4201
CMD ["node", "shopify-adapter.js"]
```

```yaml
# docker-compose.yml (añadir servicio)
shopify-adapter:
  build: ./integrations
  ports:
    - "4201:4201"
  environment:
    - SHOPIFY_WEBHOOK_SECRET=${SHOPIFY_WEBHOOK_SECRET}
    - BEZHAS_WEBHOOK_SECRET=${BEZHAS_WEBHOOK_SECRET}
    - EDGE_NODE_URL=http://bezhas-edge-node:4200/api/webhook/ingest
  depends_on:
    - bezhas-edge-node
```

## Eventos Shopify Recomendados

| Evento Shopify | Event Type (BeZhas) | Sector |
|---|---|---|
| `orders/create` | `sales_order_created` | `Retail` |
| `orders/paid` | `payment_executed` | `Finanzas` |
| `orders/fulfilled` | `outbound_delivery` | `Logística` |
| `orders/cancelled` | `order_cancelled` | `Retail` |
| `refunds/create` | `refund_processed` | `Finanzas` |
| `products/create` | `product_created` | `Retail` |
| `products/update` | `product_updated` | `Retail` |
| `inventory_levels/update` | `stock_movement` | `Manufactura` |

## Payload de Webhook (Referencia)

```json
{
  "event": "sales_order_created",
  "documentId": "#1042",
  "amount": 125.50,
  "currency": "USD",
  "sector": "Retail",
  "source": "shopify",
  "timestamp": "2025-01-15T14:30:00Z",
  "metadata": {
    "shopifyId": 5362871234,
    "orderNumber": 1042,
    "itemCount": 3
  }
}
```

## Seguridad

- **Shopify HMAC**: Verificar siempre `X-Shopify-Hmac-SHA256` antes de procesar
- **BeZhas HMAC**: Firmar payload transformado con `webhookSecret` de BeZhas
- **No PII**: No enviar emails, nombres o direcciones de clientes a la blockchain
- **TLS**: Shopify solo envía webhooks a URLs HTTPS
- **Retry**: Shopify reintenta webhooks por 48h si no recibe 200; el adaptador siempre responde 200

## Troubleshooting

| Problema | Solución |
|---|---|
| Shopify marca webhook como "failing" | Verificar que el adaptador responde 200; check logs |
| Firma inválida | Usar `raw body` (no parsed) para verificación HMAC |
| Eventos duplicados | Shopify puede reenviar; usar `documentId` como idempotency key |
| Edge Node timeout | Aumentar `timeout` en axios; considerar cola async |
| No llegan webhooks en dev local | Usar ngrok: `ngrok http 4201` y registrar URL de ngrok |
