# BeZhas RWA, Finance and Fiscality Protocol

## Scope

This protocol covers real-world asset registration, document anchoring, fractional access, invoice factoring, RWA-backed lending, treasury policy, paymaster gas sponsorship and fiscal audit evidence.

## Contract Map

- `LandCadastralRegistry` and `LandTitleNFT`: land and title evidence.
- `VehicleIdentityNFT` and `FleetLeaseEscrow`: fleet identity and leasing.
- `DigitalTwinRegistry` and `QualityCertificateNFT`: industrial asset evidence.
- `EvidenceVault` and `IPRegistryNFT`: legal and IP documents.
- `CreditScoreOracle`, `InvoiceFactoring`, `MicroLendingPool`, `TreasuryVault`: finance.
- `MultiSigWallet` and `Paymaster`: institutional custody and gas policy.

## Flow

1. Asset owner registers off-chain legal documentation through a notary/custodian.
2. Evidence hash is anchored in the matching asset contract.
3. Valuation oracle posts valuation, confidence and expiry.
4. KYC eligibility oracle verifies investor access rules.
5. Treasury or market operator opens escrow, lending or factoring flow.
6. MultiSig approves sensitive movements, collateral locks and reserve changes.
7. Tax evidence pack is exported from transaction hashes, oracle attestations and treasury logs.

## Permissions

- Asset owner: initiates registration and transfer.
- Notary/custodian: validates legal existence and custody.
- Valuation oracle: posts pricing evidence.
- Investor/lender: participates only when eligible.
- Treasury admin: controls reserve, lending and fee policy.
- Tax auditor: read-only evidence export.

## Oracle Requirements

- Valuation oracle must include asset ID, method, value, currency, confidence, expiry and evidence hash.
- Legal oracle must include jurisdiction, document type, notary signer and document hash.
- KYC oracle must never reveal personal data on-chain; it writes eligibility status and policy hash only.
- FX/tax oracle must version every rule set used for fiscal exports.

## Tests and Deploy

```powershell
node script\validate-vertical-protocols.js
forge test --match-path test/finance/*.t.sol
forge test --match-path test/government/LandCadastralRegistry.t.sol
forge test --match-path test/legal/*.t.sol
forge test --match-path test/automotive/VehicleIdentityNFT.t.sol
forge test --match-path test/automotive/FleetLeaseEscrow.t.sol
node script\deploy-protocol.js rwa-asset-marketplace
node script\deploy-protocol.js institutional-finance-tax
```

## CTO/CISO Notes

This vertical is high custody and high compliance. Require HSM/KMS-ready keys, separation of duties, treasury MultiSig, timelocks for parameter changes and signed runbooks before production deployment.
