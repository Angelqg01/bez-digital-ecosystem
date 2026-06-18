# BeZhas connectors — meeting each platform in its own language

The JS `@bezhas/connect` is the reference. These clients give the **same** surface
(Pay + CargoLink + signed-webhook verify) to the runtimes that dominate the
shipping, customs, and institutional world. All four wrap the identical real
endpoints (`/api/gateway/v1/payments/*`, `/api/cargolink/*`) and the same auth
(`x-api-key` / `Authorization: Bearer`, CargoLink role-key as bearer).

| Client | Runtime | Typical platforms it embeds into |
| ------ | ------- | -------------------------------- |
| `@bezhas/connect` (JS) | Node 18+ / browser | WooCommerce, Shopify, custom web |
| `clients/java` | JDK 11+ | **SAP TM**, **Oracle OTM**, **CargoWise**, customs-broker middleware, SWIFT/SEPA back-office |
| `clients/dotnet` | .NET 6+ / Framework 4.7.2+ | **CargoWise** add-ins, Windows customs-broker software, ERP back-office |
| `clients/python` | Python 3.8+ | logistics data pipelines, customs middleware, ERP glue |

Each client is **zero-dependency** on purpose — customs and banking environments
frequently forbid pulling packages from public registries.

## How the message-format world maps onto the API

Naval/customs/institutional systems don't speak REST natively — they speak
**EDIFACT**, **AEAT XML/SOAP**, and **ISO 20022**. The connector's job is to
translate those messages into B-UID lifecycle calls. The mapping is stable:

### Customs — UN/EDIFACT & AEAT (Spain / EU)

| Incoming message | Meaning | BeZhas call |
| ---------------- | ------- | ----------- |
| `CUSDEC` (Customs Declaration) | declaration lodged | `cargolink.createTx({ posRef, origin, destination, cargo })` |
| `CUSRES` / AEAT `levante` (release) | goods cleared, GREEN_LANE | `cargolink.advanceTx(bUid, { result })` → `ON_CUSTOMS_CLEARED` |
| `CUSCAR` (Cargo Report) | manifest filed | telemetry / metadata on the B-UID |
| AEAT ENS / ICS2 filing | entry summary | precedes `createTx`; carried as metadata |

The connector parses the EDIFACT/AEAT envelope (with the broker's existing
parser), extracts the declaration reference as `posRef`, and drives the B-UID.
The signed status webhook (`X-BeZhas-Signature: sha256=…`) reflects each customs
state change back into the broker's own screen — no app switch.

### Ports / liner — EDIFACT shipping set

Implemented in `clients/python/edifact_adapter.py` via one dispatcher,
`submit_edifact(client, edi, role_key, b_uid=None)`, which routes by UNH type:

| Message | Meaning | role key | BeZhas call → resulting event |
| ------- | ------- | -------- | ----------------------------- |
| `CUSDEC` / `IFTMIN` | declaration / booking | pos | `createTx` → `ON_TRANSACTION_CREATED` |
| `COPARN` | container announcement (EQD+MEA) | carrier | `advanceTx` (STOWED) → `ON_STOWAGE_COMPLETE` |
| `CODECO` / `COARRI` | gate-out / loaded (TDT vessel+voyage, LOC port) | carrier | `advanceTx` (DEPARTED) → `ON_VESSEL_DEPARTURE` |
| `IFTSTA` (in transit) | status report (RFF+TDT) | logistics | `advanceTx` (IN_TRANSIT) → `ON_IN_TRANSIT` |
| `IFTSTA` (status 7/POD) | delivered | lastmile | `advanceTx` (DELIVERED) → `ON_DELIVERY_PROOF` (releases BEZ escrow) |

`advanceTx` auto-advances to the next lifecycle state, so send messages in order
and use the role key the table names; an out-of-order message is rejected (422)
by the server-side validator, which is the desired safety behavior.

### Institutions — SWIFT / SEPA (settlement)

Settlement uses BEZ-Coin v1 (Polygon `0xEcBa…11A8`) as the currency.

| Message | Meaning | BeZhas call |
| ------- | ------- | ----------- |
| ISO 20022 `camt.054` / `pain.001` / SEPA | fiat credit | `iso20022_adapter.parse_camt` → `to_bank_event` → bank webhook → mint |
| SWIFT MT103 | cross-border fiat in | `iso20022_adapter.parse_mt103` → `to_bank_event` (+ `sign_bank_event`) |
| Stripe card | card in | `pay.buy({ paymentMethod: "card" })` → checkoutUrl |

`clients/python/iso20022_adapter.py` parses the institutional message and emits
the `{ iban, amountCents, currency, reference, walletAddress, eventId }` payload
the BeZhas bank webhook expects, signed with the backend's bare-hex HMAC over the
compact JSON body. (The live bank webhook gates on USD until an FX oracle lands;
the parser preserves the real currency — gate before submitting.)

> The authoritative settlement (mint) happens on the BeZhas side from the
> Stripe/bank webhook; the connector reconciles via `pay.history()`.

## Build / test

```bash
# Python
cd python && python -m unittest -v

# .NET
cd dotnet && dotnet build

# Java (needs a JDK 11+; no third-party deps)
cd java && javac digital/bez/connect/BeZhasConnect.java   # adjust to your src layout
```

## Parity

Every client exposes: `pay.buy / send / history / price`, `cargolink.health /
linkPos / syncOrders / createTx / advanceTx / registerWebhook` (+ `withRoleKey`),
and a `verifyWebhook` helper using the exact `sha256=<hex>` HMAC scheme of
`api/services/cargoLinkLifecycle.js`.
