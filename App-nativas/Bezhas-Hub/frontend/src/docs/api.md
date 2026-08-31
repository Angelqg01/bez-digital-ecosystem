# REST API — api.bez.digital

Endpoints HTTP para integración sin SDK. Base URL: `https://api.bez.digital`

## Autenticación

```bash
Authorization: Bearer YOUR_API_KEY
```

Obtén tu clave en: https://bez.digital/developers/keys

## Endpoints principales

### Pagos

**POST** `/api/v1/payments/create`
```json
{
  "orderId": "order_123",
  "amount": 99.99,
  "currency": "EUR",
  "merchantId": "merchant_xyz",
  "description": "Descripción"
}
```

**GET** `/api/v1/payments/{paymentId}`
```json
{
  "id": "pay_abc123",
  "status": "settled",
  "txHash": "0x123...",
  "timestamp": "2026-06-19T10:00:00Z"
}
```

### Settlement

**POST** `/api/v1/settlement/execute`
```json
{
  "paymentId": "pay_abc123",
  "includeStaking": true
}
```

### Merchant Stats

**GET** `/api/v1/merchants/{merchantId}/stats`
```json
{
  "totalRevenue": 5000.00,
  "totalSettled": 450.50,
  "pendingSettlement": 200.00,
  "stakingRewards": 12.50
}
```

### Webhooks

**GET** `/api/v1/webhooks/events`

**POST** `/api/v1/webhooks/register`
```json
{
  "url": "https://tu-app.com/webhooks/bez",
  "events": ["payment.completed", "settlement.done"]
}
```

### Transacciones

**GET** `/api/v1/transactions?merchantId=xyz&limit=50&offset=0`

## Rate limits

- 1000 req/min por API key
- 100 webhooks/seg por merchant

## Errores

```
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
429 Too Many Requests
500 Server Error
```

## Ejemplo con curl

```bash
curl -X POST https://api.bez.digital/api/v1/payments/create \
  -H "Authorization: Bearer pk_live_xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "amount": 99.99,
    "currency": "EUR",
    "merchantId": "merchant_xyz"
  }'
```

## Postman Collection

Descargar: https://bez.digital/developers/postman-collection.json

## Documentación OpenAPI/Swagger

Interactiva: https://api.bez.digital/docs
