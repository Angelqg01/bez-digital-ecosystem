# @bezhas/connect

The **outward-facing** BeZhas SDK — the "extension API" a third-party platform
installs to embed BeZhas services inside its own UI, without the customer ever
leaving. Same idea as a VSCode extension: the host app stays in control, the
extension brings the service.

> Internal BeZhas sub-apps use [`@bezhas/platform-sdk`](../platform-sdk) (React
> hooks). **This** package is for everyone *outside* the ecosystem. Zero
> dependencies, framework-agnostic, runs on Node ≥ 18 and in the browser.

## Install

```bash
pnpm add @bezhas/connect
```

## Quick start — Pay

```js
import { BeZhasConnect } from '@bezhas/connect';

const bezhas = new BeZhasConnect({ apiKey: process.env.BEZHAS_API_KEY });

// Card: returns a Stripe checkoutUrl you embed/redirect to from your own checkout.
const order = await bezhas.pay.buy({ amountUSD: 49.9, paymentMethod: 'card', email });
// → { paymentId, checkoutUrl, nextAction: 'redirect_to_checkout', ... }

// Bank (SEPA/SWIFT): returns IBAN transfer instructions.
const bank = await bezhas.pay.buy({ amountUSD: 1000, paymentMethod: 'bank' });

await bezhas.pay.history('0xCustomerWallet', { limit: 20 });
```

## Quick start — CargoLink

```js
// Link the client's existing POS once, then pull orders into B-UID transactions.
const pos = bezhas.cargolink.withRoleKey(process.env.BEZHAS_POS_KEY);
await pos.linkPos({ baseUrl: 'https://shop.example/api', provider: 'shopify' });
const { created } = await pos.syncOrders();      // idempotent

// Or drive the lifecycle directly.
await pos.createTx({ posRef: 'ORD-1001', origin: 'Algeciras', destination: 'Tánger' });
await pos.advanceTx('B-abc123', { note: 'cleared customs' });
```

## Verify status webhooks

BeZhas signs deliveries with HMAC-SHA256 over the raw body (same scheme as the
backend). Verify before trusting:

```js
import { webhooks } from '@bezhas/connect';

app.post('/bezhas-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const payload = webhooks.verifyAndParse(
    req.body,                              // raw Buffer
    req.headers['x-bezhas-signature'],
    process.env.BEZHAS_WEBHOOK_SECRET,
  );                                       // throws on bad signature
  // ... update order ...
  res.json({ received: true });
});
```

## Integration surfaces

| Surface            | What it is                                  | Endpoint base        |
| ------------------ | ------------------------------------------- | -------------------- |
| `bezhas.pay`       | Buy/sell/send BEZ, history, price, fees     | `/api/gateway/v1`    |
| `bezhas.cargolink` | POS bridge + B-UID lifecycle + IoT          | `/api/cargolink`     |
| `webhooks`         | HMAC verification of inbound status         | (your callback URL)  |

## Auth

- `apiKey` → gateway `x-api-key` (registered, scoped app — server-to-server).
- `userToken` → `Authorization: Bearer` (optional SSO user context).
- CargoLink `roleKey` → the bearer for a role-scoped actor (pos / customs /
  carrier / logistics / lastmile). Pass per call or via `withRoleKey()`.

## Bundled plugin

- `plugins/woocommerce/bezhas-pay.php` — a working WooCommerce payment gateway
  that uses the same HTTPS surface (no PHP build step). Drop into
  `wp-content/plugins/`, set API key + webhook secret.

## Other-language clients

Same Pay + CargoLink + `verifyWebhook` surface, zero-dependency, for the runtimes
that dominate shipping/customs/banking. See [`clients/CONNECTORS.md`](clients/CONNECTORS.md).

- `clients/java` — JDK 11+ (SAP TM, Oracle OTM, CargoWise, customs brokers, SWIFT/SEPA).
- `clients/dotnet` — .NET 6+ (CargoWise add-ins, Windows customs software).
- `clients/python` — Python 3.8+ (logistics pipelines, ERP glue), plus
  [`edifact_adapter.py`](clients/python/edifact_adapter.py): a working
  EDIFACT **CUSDEC → B-UID** translator so customs brokers can feed declarations
  straight into the lifecycle (`submit_cusdec(client, edi, role_key)`).

## Test

```bash
node --test test/connect.test.js
```
