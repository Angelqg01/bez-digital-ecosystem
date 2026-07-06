# MCP Server — Model Context Protocol

Integración para plataformas de automatización: n8n, Zapier, Make, Pabbly.

## Instalación

### En n8n

1. Ir a **Settings > Nodes > Community Nodes**
2. Instalar: `@bezhas/n8n-nodes-bez`
3. Reiniciar n8n

### En Zapier

1. **My Apps > Connect a new app**
2. Buscar: "BeZhas API"
3. Autorizar con tu API Key

### En Make

1. **Modules > Add a module**
2. Seleccionar "BeZhas"
3. Ingresar credenciales

## Herramientas disponibles

### n8n Nodes

**BezhasPayment** — Procesar pago
```
Entradas:
  - Order ID
  - Amount
  - Currency
  - Merchant ID
  
Salida:
  - Payment ID
  - Status
  - TX Hash
```

**BezhasSettlement** — Liquidar
```
Entradas:
  - Payment ID
  - Include Staking?

Salida:
  - Settlement ID
  - Confirmación
```

**BezhasWebhook** — Escuchar eventos
```
Triggeado por:
  - payment.completed
  - settlement.done
```

**BezhasMerchantStats** — Obtener estadísticas
```
Entrada: Merchant ID
Salida: Revenue, Settled, Pending, Rewards
```

## Ejemplo de workflow (n8n)

```
Trigger: Webhook de Shopify (nueva orden)
  ↓
Node: Extract Order Data
  ↓
Node: BezhasPayment (amount, orderId)
  ↓
Node: BezhasSettlement (paymentId)
  ↓
Node: Shopify Update Order (mark as paid)
  ↓
Node: Send Slack Notification
```

## Ejemplo de workflow (Zapier)

```
Trigger: New order en WooCommerce
  ↓
Action: BeZhas Create Payment
  ↓
Action: Wait 5 seconds
  ↓
Action: BeZhas Execute Settlement
  ↓
Action: Send email confirmation
```

## Autenticación

API Key en el panel de desarrollador:
https://bez.digital/developers/keys

## Límites

- 100 acciones/minuto
- 1000 webhooks/día

## Documentación

- n8n: https://bez.digital/docs/n8n
- Zapier: https://bez.digital/docs/zapier
- Make: https://bez.digital/docs/make
