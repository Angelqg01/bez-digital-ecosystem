# BeZhas Energy and ESG Protocol

## Scope

This protocol covers renewable asset tokenization, peer-to-peer energy settlement, carbon credit evidence and ESG score attestations.

## Contract Map

- `SolarFarmToken`: renewable asset participation.
- `P2PEnergyMarket`: local market energy settlement.
- `CarbonCreditToken`: carbon credit issuance and transfer.
- `ESGScoreOracle`: ESG score attestations.

## Flow

1. Renewable asset operator registers solar asset evidence.
2. Metering oracle posts production or consumption readings.
3. P2P market matches producer and consumer settlement.
4. Carbon registry oracle verifies eligible credits.
5. ESG oracle updates score based on approved evidence.
6. Treasury or DAO adjusts incentives and reserve policy.

## Permissions

- Producer: registers generation and offers energy.
- Consumer: buys energy and settles invoices.
- Grid or metering oracle: posts readings.
- ESG auditor: validates ESG score inputs.
- Market operator: configures market parameters.
- Treasury: controls incentives and fee policy.

## Oracle Requirements

- Metering oracle must include meter ID, reading hash, period, unit and signer.
- Carbon registry oracle must include registry ID, vintage, volume, status and retirement hash when applicable.
- ESG oracle must include scoring model version, evidence hash and expiry.

## Tests and Deploy

```powershell
node script\validate-vertical-protocols.js
forge test --match-path test/energy/*.t.sol
node script\deploy-protocol.js energy-esg
```

## CTO/CISO Notes

Energy and ESG data must be traceable to regulated meters, registries or certified auditors. The protocol should reject stale metering data and prevent double counting of carbon credits through registry-linked evidence hashes.
