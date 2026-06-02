# BeZhas Industrial Manufacturing Protocol

## Scope

This protocol covers digital twins, material planning tokens, predictive maintenance logs, quality certificates and escrowed dispute handling for industrial plants and supplier networks.

## Contract Map

- `DigitalTwinRegistry`: machine, asset and production-line identity.
- `MaterialTokenMRP`: material planning and inventory token flow.
- `PredictiveMaintenanceLog`: maintenance event evidence.
- `QualityCertificateNFT`: inspection and quality certificates.
- `QualityEscrow`: buyer/supplier dispute handling.

## Flow

1. Plant operator registers a digital twin for equipment or production line.
2. ERP or MES event enters through the Edge Node and is schema-validated.
3. Material planning event updates tokenized MRP state.
4. IoT or maintenance oracle posts maintenance evidence.
5. Quality auditor mints a certificate after inspection.
6. Buyer acceptance releases settlement; failed inspection routes payment to escrow.

## Permissions

- Plant operator: registers assets and production events.
- Supplier: receives orders and responds to quality disputes.
- Maintenance oracle: posts predictive maintenance evidence.
- Quality auditor: issues certificate NFTs.
- Buyer: accepts goods or opens dispute.
- Auditor: exports evidence for ISO, SOC or internal review.

## Oracle Requirements

- IoT machine oracle must sign device ID, metric hash, threshold, timestamp and firmware version.
- Quality inspection oracle must include standard, certificate hash and inspector identity.
- Maintenance prediction oracle must include model version, confidence and recommended action.

## Tests and Deploy

```powershell
node script\validate-vertical-protocols.js
forge test --match-path test/manufacturing/*.t.sol
forge test --match-path test/core/QualityEscrow.t.sol
node script\deploy-protocol.js industrial-manufacturing
```

## CTO/CISO Notes

ERP, MES and IoT raw data remain off-chain. On-chain writes must be event hashes, certificates, dispute states and signed maintenance attestations. Any oracle key tied to plant equipment must be revocable without redeploying the full protocol.
