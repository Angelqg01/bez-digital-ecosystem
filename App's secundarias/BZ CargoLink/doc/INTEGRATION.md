# BZ CargoLink — Integration Guide

> Connect any POS, logistics system, customs software or IoT device to the BeZhas network.  
> All validated events are reflected back to your platform via signed webhooks.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Authentication](#2-authentication)
3. [B-UID transaction lifecycle](#3-b-uid-transaction-lifecycle)
4. [API endpoints reference](#4-api-endpoints-reference)
5. [Real-time webhooks](#5-real-time-webhooks)
6. [IoT / hardware ingestion](#6-iot--hardware-ingestion)
7. [POS connector](#7-pos-connector)
8. [Escrow (BEZ Token V1)](#8-escrow-bez-token-v1)
9. [Error codes](#9-error-codes)
10. [Quick-start recipes](#10-quick-start-recipes)

---

## 1. Architecture overview

```
Your POS / platform
       │
       │  role-scoped API key  (bzk_live_…)
       ▼
┌─────────────────────────────────────────────────────────┐
│                    BZ CargoLink API                      │
│                                                          │
│  B-UID transaction object  ──  ONE shared lifecycle      │
│                                                          │
│  CREATED → CUSTOMS_CLEARED → STOWED → DEPARTED           │
│         → IN_TRANSIT → DELIVERED                         │
│                                                          │
│  4 validated actors:                                     │
│   • customs    – HS lane + duty estimate                 │
│   • carrier    – COG stowage + vessel departure          │
│   • logistics  – trackingRef / route                     │
│   • lastmile   – GPS / signature proof of delivery       │
│   • IoT devices – cold-chain, shock, RFID telemetry      │
└─────────────────────────────────────────────────────────┘
       │
       │  signed webhook (HMAC-SHA256)
       ▼
Your POS / callback URL  ←── ON_CUSTOMS_CLEARED
                         ←── ON_STOWAGE_COMPLETE
                         ←── ON_VESSEL_DEPARTURE
                         ←── ON_IN_TRANSIT
                         ←── ON_DELIVERY_PROOF
                         ←── ON_COLD_CHAIN_BREACH
```

**Key principle:** there is exactly **one B-UID object** per shipment. All four actors work on the same object — they don't have separate pipelines.

---

## 2. Authentication

### Role-scoped API keys

Every action requires a key issued to a specific role. Issue keys from your BeZhas_ID dashboard or via the API.

| Role | Can do |
|---|---|
| `pos` | Create transactions, link/sync POS, register IoT devices |
| `customs` | Advance CREATED → CUSTOMS_CLEARED |
| `carrier` | Advance CUSTOMS_CLEARED → STOWED, STOWED → DEPARTED |
| `logistics` | Advance DEPARTED → IN_TRANSIT |
| `lastmile` | Advance IN_TRANSIT → DELIVERED |
| `admin` | All of the above |

Pass the key as a Bearer token:

```http
Authorization: Bearer bzk_live_<your_key>
```

IoT devices use a separate `bzd_` key issued per device (see §6).

### Issue a key

```http
POST /api/cargolink/v1/keys
Content-Type: application/json

{
  "bezhasId": "BZ_YOUR_ID",
  "role": "pos",
  "label": "Shopify main store"
}
```

```json
{
  "success": true,
  "bezhas_id": "BZ_YOUR_ID",
  "role": "pos",
  "label": "Shopify main store",
  "apiKey": "bzk_live_a1b2c3..."
}
```

> ⚠️ The plaintext key is returned **once only**. Store it securely.

---

## 3. B-UID transaction lifecycle

### States

```
CREATED  ──(customs)──►  CUSTOMS_CLEARED
                 ──(carrier)──►  STOWED
                         ──(carrier)──►  DEPARTED
                                  ──(logistics)──►  IN_TRANSIT
                                           ──(lastmile)──►  DELIVERED  ✓
```

Each actor calls `POST /v1/tx/:bUid/advance` with the payload that proves their validation step. If validation fails (missing manifest, unbalanced COG, no delivery proof…) the transition is blocked with `422`.

### Validation per actor

| Transition | Actor | Required payload | Computed result |
|---|---|---|---|
| `→ CUSTOMS_CLEARED` | customs | `manifestId`, `declaredValue`, `hsCode` | `lane` (GREEN/ORANGE/RED), `dutyEstimate` |
| `→ STOWED` | carrier | `container`, `items[{x,y,weight}]` | `cog.x`, `cog.y`, `status` (VERIFIED/WARNING) |
| `→ DEPARTED` | carrier | `vessel`, `voyage` | `vessel`, `voyage`, `departurePort` |
| `→ IN_TRANSIT` | logistics | `trackingRef` or `routeId` | `routeId`, `carrier` |
| `→ DELIVERED` | lastmile | `signatureHash` **or** `lat`+`lng` | `proof` (SIGNATURE/GEO), `geoVerified` |

---

## 4. API endpoints reference

Base URL: `https://api.bez.digital:3001/api/cargolink`

### Keys

```
POST   /v1/keys                  Issue a role-scoped key
```

### Transactions (B-UID lifecycle)

```
POST   /v1/tx                    Create a B-UID transaction (pos/admin only)
GET    /v1/tx                    List your transactions
GET    /v1/tx/:bUid              Read transaction + full audit history
POST   /v1/tx/:bUid/advance      Advance to next state (role-gated + validated)
```

### POS connector

```
POST   /v1/pos/link              Link (or update) a POS adapter
GET    /v1/pos/link              Read current POS link
POST   /v1/pos/sync              Pull orders from POS API → create B-UIDs
```

### IoT / hardware

```
POST   /v1/iot/devices           Register a device (returns device key once)
POST   /v1/iot/telemetry         Push a telemetry batch
GET    /v1/iot/telemetry?bUid=   Read live hardware feed for a shipment
```

### Webhooks

```
POST   /v1/webhooks/register     Register a callback URL
```

### Health

```
GET    /health                   Service health + blockchain config
```

---

## 5. Real-time webhooks

### Register a callback

```http
POST /api/cargolink/v1/webhooks/register
Authorization: Bearer bzk_live_…

{
  "url": "https://your-platform.com/bezhas/hook",
  "events": [],
  "secret": "your_hmac_secret"
}
```

Set `events: []` to receive all events, or filter:

```json
{ "events": ["ON_CUSTOMS_CLEARED", "ON_DELIVERY_PROOF", "ON_COLD_CHAIN_BREACH"] }
```

### Webhook payload

```json
{
  "event": "ON_CUSTOMS_CLEARED",
  "bUid": "BZ-LOG-A1B2C3",
  "status": "CUSTOMS_CLEARED",
  "posRef": "ORDER-9001",
  "escrowStatus": "LOCKED",
  "at": "2024-06-06T10:32:00.000Z"
}
```

### Verify the signature

```http
X-BeZhas-Event:     ON_CUSTOMS_CLEARED
X-BeZhas-Signature: sha256=a1b2c3d4e5f6...
```

```js
const crypto = require('crypto');

function verifyWebhook(rawBody, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)         // raw bytes before JSON.parse
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

### Event catalogue

| Event | Fired when |
|---|---|
| `ON_TRANSACTION_CREATED` | POS creates a B-UID |
| `ON_CUSTOMS_CLEARED` | Customs approves clearance |
| `ON_STOWAGE_COMPLETE` | Carrier verifies COG |
| `ON_VESSEL_DEPARTURE` | Carrier logs vessel + voyage |
| `ON_IN_TRANSIT` | Logistics starts tracking |
| `ON_DELIVERY_PROOF` | Lastmile confirms delivery |
| `ON_COLD_CHAIN_BREACH` | IoT: temperature out of range |
| `ON_SHOCK_ALERT` | IoT: shock exceeds threshold |

---

## 6. IoT / hardware ingestion

### Register a device

```http
POST /api/cargolink/v1/iot/devices
Authorization: Bearer bzk_live_pos_key

{
  "type": "temp",
  "bUid": "BZ-LOG-A1B2C3",
  "label": "Freezer unit #3",
  "config": {
    "tempMin": 2,
    "tempMax": 8,
    "shockMax": 5
  }
}
```

```json
{
  "success": true,
  "device": { "device_id": "dev_abc123", "type": "temp", ... },
  "deviceKey": "bzd_a1b2c3..."
}
```

> ⚠️ Device key returned **once only**. Flash it to the device firmware.

### Push telemetry (flat fields)

```http
POST /api/cargolink/v1/iot/telemetry
Authorization: Bearer bzd_a1b2c3...

{ "temperature": 5.2, "humidity": 75 }
```

### Push telemetry (readings array)

```http
POST /api/cargolink/v1/iot/telemetry
Authorization: Bearer bzd_a1b2c3...

{
  "readings": [
    { "metric": "temperature", "value": 5.2, "unit": "°C" },
    { "metric": "gps", "lat": 39.47, "lng": -0.38 }
  ]
}
```

### Response — breach example

```json
{
  "success": true,
  "deviceId": "dev_abc123",
  "bUid": "BZ-LOG-A1B2C3",
  "stored": 1,
  "breaches": [
    { "metric": "temperature", "reason": "temperature 14°C outside [2,8]" }
  ],
  "webhookDeliveries": [
    { "url": "https://your-platform.com/hook", "status": "delivered", "code": 200 }
  ]
}
```

On any breach, `ON_COLD_CHAIN_BREACH` (or `ON_SHOCK_ALERT`) is fanned out to all webhook subscribers of the B-UID owner — including your POS callback.

### Supported device types

| Type | Metrics |
|---|---|
| `temp` | `temperature`, `humidity` |
| `gps` | `lat`, `lng` |
| `shock` | `shock` (g-force) |
| `rfid` | `rfid` (tag ID) |
| `multi` | all of the above |

---

## 7. POS connector

### Link your store

```http
POST /api/cargolink/v1/pos/link
Authorization: Bearer bzk_live_pos_key

{
  "provider": "shopify",
  "baseUrl": "https://your-store.myshopify.com",
  "ordersPath": "/admin/api/2024-01/orders.json",
  "apiKey": "shpat_xxxxxxxx"
}
```

Your POS API key is stored hashed and never returned after this call.

### Pull orders → B-UIDs

```http
POST /api/cargolink/v1/pos/sync
Authorization: Bearer bzk_live_pos_key
```

```json
{
  "success": true,
  "pulled": 5,
  "created": [
    { "bUid": "BZ-LOG-AA1B2", "posRef": "ORDER-4001" },
    { "bUid": "BZ-LOG-CC3D4", "posRef": "ORDER-4002" }
  ],
  "skipped": ["ORDER-3998", "ORDER-3999"]
}
```

Sync is **idempotent**: orders already imported are silently skipped (unique constraint on `owner_bezhas_id + pos_ref`). Safe to call on a cron.

### Supported POS providers

`generic` · `shopify` · `square` · `toast` · `sap`  
(All normalize to the same B-UID shape.)

### Order field normalization

CargoLink tolerates common field name variants from different POS systems:

| Canonical | Accepted variants |
|---|---|
| `posRef` | `id`, `orderId`, `reference`, `number` |
| `destination` | `shipTo`, `address` |
| `cargo.weight` | `weight`, `totalWeight` |
| `cargo.value` | `total`, `amount` |
| `cargo.items` | `items`, `lineItems` |

---

## 8. Escrow (BEZ Token V1)

When creating a transaction, pass `escrowAmountBez` to lock BEZ as settlement collateral.

```http
POST /api/cargolink/v1/tx
{
  "posRef": "ORDER-9001",
  "destination": "Valencia",
  "escrowAmountBez": 100
}
```

| Field | Value |
|---|---|
| Token contract | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` |
| Network | Polygon (chainId 137) |
| Standard | ERC-20 |

**Escrow states:**

| State | Meaning |
|---|---|
| `NONE` | No escrow for this shipment |
| `LOCKED` | BEZ held in custody on creation |
| `RELEASED` | Released automatically when `→ DELIVERED` |
| `DISPUTED` | Manually frozen pending resolution |

> **Note:** on-chain escrow contract deployment is pending. Current `LOCKED`/`RELEASED` state is tracked in the DB and will be wired to the smart contract once `BeZhasEscrow` is deployed at `smart-contracts/deployments/`.

---

## 9. Error codes

| HTTP | Meaning | Fix |
|---|---|---|
| `400` | Bad request — missing required field | Check the required fields listed for each endpoint |
| `401` | Unknown or missing API key | Issue a key via `POST /v1/keys` |
| `403` | Role not permitted for this action | Use a key with the correct role |
| `404` | B-UID not found | Check the bUid value |
| `409` | Transition conflict — already DELIVERED or wrong state | Transaction is in a terminal or incompatible state |
| `422` | Validation failed | Add the missing fields (manifestId, COG items, delivery proof, etc.) |
| `502` | POS API unreachable | Check `baseUrl` and the POS API credentials |

---

## 10. Quick-start recipes

### Recipe A — Full lifecycle (curl)

```bash
BASE=https://api.bez.digital:3001/api/cargolink
POS_KEY=bzk_live_your_pos_key
CUS_KEY=bzk_live_your_customs_key
CAR_KEY=bzk_live_your_carrier_key
LOG_KEY=bzk_live_your_logistics_key
LM_KEY=bzk_live_your_lastmile_key

# 1. POS creates shipment
BUID=$(curl -s -X POST $BASE/v1/tx \
  -H "Authorization: Bearer $POS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"posRef":"ORDER-1","destination":"Madrid","escrowAmountBez":50}' \
  | jq -r '.transaction.b_uid')

echo "B-UID: $BUID"

# 2. Customs clears
curl -s -X POST $BASE/v1/tx/$BUID/advance \
  -H "Authorization: Bearer $CUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"manifestId":"MAN-001","declaredValue":2500,"hsCode":"8471"}}' \
  | jq '.validation.result.lane'

# 3. Carrier stows
curl -s -X POST $BASE/v1/tx/$BUID/advance \
  -H "Authorization: Bearer $CAR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"container":{"length":12,"width":2.4},"items":[{"x":6,"y":1.2,"weight":500}]}}' \
  | jq '.validation.result.status'

# 4. Carrier departs
curl -s -X POST $BASE/v1/tx/$BUID/advance \
  -H "Authorization: Bearer $CAR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"vessel":"MSC VALENTINA","voyage":"AG241W"}}' | jq '.transition'

# 5. Logistics in transit
curl -s -X POST $BASE/v1/tx/$BUID/advance \
  -H "Authorization: Bearer $LOG_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"trackingRef":"TRK-2024-001"}}' | jq '.transition'

# 6. Lastmile delivers (GPS proof)
curl -s -X POST $BASE/v1/tx/$BUID/advance \
  -H "Authorization: Bearer $LM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"lat":40.4168,"lng":-3.7038,"geoVerified":true}}' \
  | jq '{proof: .validation.result.proof, escrowReleased: .escrowReleased}'

# 7. Read full audit trail
curl -s $BASE/v1/tx/$BUID \
  -H "Authorization: Bearer $POS_KEY" \
  | jq '.history[] | {step: .to_status, by: .role}'
```

### Recipe B — Shopify sync + webhook (Node.js)

```js
const BASE = 'https://api.bez.digital:3001/api/cargolink';
const POS_KEY = process.env.BEZHAS_POS_KEY;

// 1. Link your Shopify store once
await fetch(`${BASE}/v1/pos/link`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${POS_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'shopify',
    baseUrl: 'https://your-store.myshopify.com',
    ordersPath: '/admin/api/2024-01/orders.json',
    apiKey: process.env.SHOPIFY_API_KEY,
  }),
});

// 2. Register webhook callback
await fetch(`${BASE}/v1/webhooks/register`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${POS_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://your-platform.com/bezhas/hook',
    events: [],                // receive all lifecycle events
    secret: process.env.BEZHAS_WEBHOOK_SECRET,
  }),
});

// 3. Pull orders on a cron (idempotent — safe to call repeatedly)
const sync = await fetch(`${BASE}/v1/pos/sync`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${POS_KEY}` },
}).then(r => r.json());

console.log(`Imported ${sync.created.length} new, skipped ${sync.skipped.length}`);

// 4. Your webhook handler (Express example)
app.post('/bezhas/hook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-bezhas-signature'];
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.BEZHAS_WEBHOOK_SECRET)
    .update(req.body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return res.status(401).send('Bad signature');
  }

  const event = JSON.parse(req.body);
  console.log(`[BeZhas] ${event.event} — ${event.bUid} — status: ${event.status}`);

  // Update your order status in Shopify / your DB
  if (event.event === 'ON_DELIVERY_PROOF') {
    markOrderDelivered(event.posRef);
  }
  if (event.event === 'ON_COLD_CHAIN_BREACH') {
    alertFulfillmentTeam(event.bUid);
  }

  res.sendStatus(200);
});
```

---

*BZ CargoLink — BeZhas ecosystem*  
*Settlement token: BEZ Token V1 · Polygon · `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`*  
*API version: v1 · June 2026*
