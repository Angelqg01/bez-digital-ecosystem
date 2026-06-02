# BeZhas Bio-Agent and Nexus - Health/Bio Protocol

## Scope

This protocol anchors health records, anonymized clinical datasets, pharma custody and insurance escrow without placing PHI or PII directly on-chain.

## Contract Map

- `HealthRecordSBT`: non-transferable health evidence anchor.
- `ClinicalDataMarketplace`: dataset listing and controlled access.
- `PharmaTracker`: batch custody and provenance.
- `HealthInsuranceEscrow`: insured settlement workflow.
- `BeZhasWorkflowRegistry`: lifecycle state coordination.
- `AegisSecurityProvider`: risk and security control surface.

## Flow

1. Patient or institution signs a consent policy off-chain.
2. Edge Node anonymizes PHI/PII and anchors only hash evidence.
3. Lab or hospital mints/updates `HealthRecordSBT` evidence.
4. Research dataset is listed with access policy and audit hash.
5. DAO or compliance approver authorizes research access.
6. Pharma custody events are posted by approved supply-chain writers.
7. Insurance escrow releases only after policy, claim and evidence checks pass.

## Permissions

- Patient: consent owner and revocation initiator.
- Hospital/lab: evidence issuer.
- Researcher: dataset requester.
- Bio oracle: anonymization and dataset verification writer.
- Insurer: escrow counterparty.
- Compliance auditor: read and evidence export.

## Oracle Requirements

- Anonymization gateway must output dataset hash, consent hash and policy version.
- Dataset verifier must assert schema, source institution and access tier.
- Pharma custody oracle must include batch ID, custody event, timestamp and signer.
- Consent policy oracle must reject stale, revoked or mismatched consent.

## Tests and Deploy

```powershell
node script\validate-vertical-protocols.js
forge test --match-path test/health/*.t.sol
node script\deploy-protocol.js bio-health-nexus
```

## CTO/CISO Notes

Treat all PHI/PII as off-chain regulated data. On-chain evidence must be irreversible hashes or non-sensitive references only. Any AI research agent must run behind approval gates for dataset access, with logs retained for compliance review.
