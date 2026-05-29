# BeZhas Skill: Shopify Webhook Integration
## Overview
Shopify uses JSON webhooks with an `X-Shopify-Topic` header. The most important event for the BeZhas bridge is `orders/paid`.

## Webhook Pattern (orders/paid)
- **Topic Header**: `orders/paid`
- **Confirmation Field**: `financial_status: "paid"`
- **Total Field**: `total_price` or `current_total_price`
- **Currency Field**: `currency`
- **Customer ID**: `customer.id`

## JSON Schema Example
```json
{
  "id": 123456789,
  "admin_graphql_api_id": "gid://shopify/Order/123456789",
  "total_price": "250.00",
  "currency": "USD",
  "financial_status": "paid",
  "fulfillment_status": null,
  "line_items": [ ... ],
  "customer": {
    "id": 987654321
  }
}
```

## BeZhas Logic Mapping
1. **BeZhas Order ID**: `BZH-SHP-` + `order_number`
2. **External ID**: `id`
3. **Amount**: `parseFloat(total_price)`
4. **Currency**: `currency.toUpperCase()`
5. **Auto-Reputation**: +15 RP for orders > $100.

## Security (HMAC)
Shopify includes an `X-Shopify-Hmac-Sha256` header. The system should verify this against the `SHOPIFY_API_SECRET` to prevent fraud.

## AI Hint
If the payload contains `admin_graphql_api_id` and `financial_status: "paid"`, classify it as a confirmed SHOPIFY payment.
