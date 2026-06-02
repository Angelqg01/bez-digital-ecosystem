# BeZhas Global Kinetics - Logistics Protocol

## Scope

This protocol covers SKU tokenization, supplier reputation, warehouse state, customs clearance, shipment checkpoints and instant settlement for ports, hubs and enterprise supply chains.

## Contract Map

- `SupplyTracker`: shipment lifecycle and state transitions.
- `WarehouseManager`: stock, warehouse events and custody records.
- `ProcurementNFT`: purchase order and procurement evidence.
- `SupplierScoreOracle`: supplier risk and performance score.
- `CustomsClearanceOracle`: customs decision attestations.
- `ClearanceCertificateNFT`: clearance certificate evidence.
- `TrackingIntegrationGateway`: external tracking ingestion.
- `TrackingToCustomsGateway`: tracking-to-customs bridge.
- `BeZhasPayment`: settlement.
- `QualityEscrow`: disputes and quality holds.

## Flow

1. Manufacturer creates a procurement or SKU event.
2. Warehouse operator confirms custody and quantity.
3. Tracking gateway posts checkpoint evidence from logistics systems.
4. Supplier score oracle updates risk state when thresholds change.
5. Customs oracle posts clearance status and mints certificate evidence.
6. Buyer acceptance releases payment through `BeZhasPayment`.
7. If quality evidence conflicts, funds move into `QualityEscrow`.

## Permissions

- Manufacturer and buyer: create orders, accept goods, trigger settlement.
- Warehouse operator: attest inventory and custody events.
- Logistics provider: submit tracking checkpoints through an approved gateway.
- Customs oracle: write clearance attestations.
- Auditor: read evidence and export chain proofs.
- Treasury: configure settlement fees and paymaster policy.

## Oracle Requirements

- Tracking events must include carrier ID, shipment ID, timestamp, location hash and signature.
- Customs events must include jurisdiction, status, document hash and expiry.
- Supplier scoring must include score, source model version, freshness window and audit hash.

## Tests and Deploy

```powershell
node script\validate-vertical-protocols.js
forge test --match-path test/supplychain/*.t.sol
forge test --match-path test/core/QualityEscrow.t.sol
node script\deploy-protocol.js logistics-global-kinetics
```

## CTO/CISO Notes

No commercial invoice, customer PII or sensitive route details should be stored directly on-chain. Store only hashes, token IDs, state transitions and signed oracle attestations. Emergency pause must disable oracle writes first, then settlement, while preserving read access for audit continuity.
