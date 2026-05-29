# BeZhas Skill: WooCommerce Webhook Integration
## Overview
WooCommerce sends JSON webhooks with an `X-WC-Webhook-Topic` header. The most important event for BeZhas is `action.woocommerce_payment_complete`.

## Webhook Pattern (order.created / order.updated)
- **Topic Header**: `action.woocommerce_payment_complete`
- **Confirmation Field**: `status: "processing"` or `status: "completed"`
- **Total Field**: `total`
- **Currency Field**: `currency`
- **Customer ID**: `customer_id`

## JSON Schema Example
```json
{
  "id": 100,
  "parent_id": 0,
  "order_key": "wc_order_12345",
  "status": "processing",
  "currency": "EUR",
  "total": "45.00",
  "line_items": [ ... ],
  "billing": { "first_name": "John", "last_name": "Doe" },
  "date_created": "2026-03-28T11:00:00"
}
```

## BeZhas Logic Mapping
1. **BeZhas Order ID**: `BZH-WOC-` + `id`
2. **External ID**: `order_key`
3. **Amount**: `parseFloat(total)`
4. **Currency**: `currency.toUpperCase()`
5. **Auto-Reputation**: +10 RP for orders > $50.

## Security (HMAC/Secret)
WooCommerce uses a pre-shared secret in the webhook settings. The system should verify the incoming hash against `WOOCOMMERCE_WEBHOOK_SECRET`.

## AI Hint
If the payload contains `order_key` starting with `wc_order_` and `status` is `processing` or `completed`, classify it as a confirmed WOOCOMMERCE payment.
