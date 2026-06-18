# Changelog — @bezhas/connect

All notable changes to the outward-facing BeZhas integration SDK.
Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: SemVer.

## [0.1.0] — 2026-06-18

Initial release. Outward-facing ("extension API") layer for embedding BeZhas
**Pay** and **CargoLink** into third-party platforms.

### Added
- Core JS SDK (`@bezhas/connect`): `BeZhasConnect` client, `pay.*`, `cargolink.*`
  (with `withRoleKey`), and `webhooks.verify` — zero dependencies, framework-agnostic.
  8 tests (`node --test`).
- WooCommerce payment-gateway plugin (`plugins/woocommerce/bezhas-pay.php`).
- Signed-webhook verification matching the backend fan-out
  (`X-BeZhas-Signature: sha256=<hex>`).
- Multi-language clients (`clients/`), same surface, zero-dependency:
  - `clients/python` (3.8+) + `edifact_adapter.py`: working UN/EDIFACT translator
    — `CUSDEC`/`IFTMIN` → createTx, `COPARN`/`CODECO`/`COARRI`/`IFTSTA` → advanceTx.
  - `clients/python/iso20022_adapter.py`: institutions connector — SEPA `camt.054`
    + SWIFT `MT103` → bank-webhook settlement payload, signed (bank HMAC scheme).
    Python suite: 21 tests (`python -m unittest`).
  - `clients/dotnet` (.NET 6+): `BeZhasConnect.cs` + `.csproj`, builds clean.
  - `clients/java` (JDK 11+): `BeZhasConnect.java`.
- `clients/CONNECTORS.md`: EDIFACT / AEAT / SWIFT-SEPA message-to-endpoint mapping.

### Notes
- Pay→merchant outbound webhook is not yet emitted by the backend; the WooCommerce
  handler is forward-compatible and reconciles via `pay.history()` meanwhile.
