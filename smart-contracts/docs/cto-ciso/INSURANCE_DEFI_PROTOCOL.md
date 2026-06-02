# BeZhas Smart Insurance and DeFi Risk Vaults Protocol

## Scope

This protocol covers policy NFTs, parametric insurance, claims adjustment, reinsurance pools, staking and yield vault controls.

## Contract Map

- `PolicyNFT`: policy identity and ownership evidence.
- `ParametricInsurance`: automated event-based claim execution.
- `ClaimAdjuster`: human or oracle-assisted claim review.
- `ReinsurancePool`: reserve and reinsurance capital.
- `LiquidityFarming` and `StakingPool`: yield and incentive layer.
- `TreasuryVault`: reserve and treasury operations.

## Flow

1. Insurer issues policy NFT with coverage parameters and exclusions hash.
2. Event oracle reports parametric trigger evidence.
3. Contract evaluates threshold, freshness and policy eligibility.
4. Claim adjuster reviews non-parametric or disputed evidence.
5. Reinsurance pool covers eligible reserve obligations.
6. Treasury and vault managers rebalance reserves by approved policy.
7. DAO or MultiSig approves material risk model changes.

## Permissions

- Policyholder: owns policy and initiates claims.
- Insurer: issues policies and manages coverage.
- Event oracle: posts parametric evidence.
- Claim adjuster: resolves non-automatic claims.
- Reinsurer: supplies pool capital.
- Vault manager: manages strategy within policy limits.
- Auditor: reviews reserves, claims and oracle evidence.

## Oracle Requirements

- Parametric oracle must include event ID, source, threshold, timestamp, jurisdiction and confidence.
- Claims evidence oracle must include evidence hash, reviewer ID and dispute window.
- Risk model oracle must include model version, parameters and governance approval hash.
- Yield source oracle must include source, APY, risk tier and freshness.

## Tests and Deploy

```powershell
node script\validate-vertical-protocols.js
forge test --match-path test/insurance/*.t.sol
forge test --match-path test/core/StakingPool.t.sol
node script\deploy-protocol.js insurance-defi-risk
```

## CTO/CISO Notes

The protocol must fail closed. If an oracle is stale or contradictory, automated payouts stop and claims move to manual adjustment. Yield strategies must be capped by treasury policy and cannot override insurance reserve requirements.
