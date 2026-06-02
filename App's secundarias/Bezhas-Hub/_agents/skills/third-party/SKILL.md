# BeZhas Skill: Third-Party & E-commerce Integration
## Overview
This skill covers the integration of external e-commerce and booking platforms into the BeZhas blockchain ecosystem through the Universal Bridge.

## Platforms Covered
1. **Shopify**: [shopify.md](shopify.md)
2. **WooCommerce**: [woocommerce.md](woocommerce.md)
3. **Airbnb**: [airbnb.md](airbnb.md)

## Integration Patterns
- **Webhooks**: Preferred method for real-time sales capture.
- **REST API Sync**: Fallback for platforms without real-time hooks.
- **HMAC Verification**: Mandatory for all incoming third-party data to ensure authenticity.

## Common Field Mapping
| BeZhas Field | Shopify | WooCommerce | Airbnb |
|---|---|---|---|
| totalAmount | total_price | total | amount |
| currency | currency | currency | currency |
| externalId | id | order_key | reservation_id |

## Security Best Practices
1. **Validate SHA256 signatures** for all webhooks.
2. **Use idempotency keys** to prevent double-minting the reputation points or BEZ tokens.
3. **Log every delivery** to the Feedback Loop for AI troubleshooting.
