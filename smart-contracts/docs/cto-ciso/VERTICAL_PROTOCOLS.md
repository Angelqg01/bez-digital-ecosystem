# BeZhas Vertical Protocols - CTO/CISO Control Pack

## Purpose

This control pack turns the BeZhas industrial thesis into operational protocols that can be deployed, tested and audited by vertical. Each protocol is mapped in `protocols/vertical-protocols.json` and bound to existing contracts, test files, deploy scripts, permission actors and oracle dependencies.

## Shared Architecture

1. Enterprise systems emit operational events through the customer Edge Node.
2. The Edge Node validates schema, policy, AI risk signals and oracle evidence.
3. Smart Wallet policy checks apply daily limits, session permissions and paymaster rules.
4. MultiSig approval is required for sensitive treasury, custody, oracle and admin actions.
5. Sector contracts record hashes, attestations, token IDs, certificates and escrow states.
6. Dashboards consume deployment artifacts and event logs for audit evidence.

## Shared Permissions

- `DEFAULT_ADMIN_ROLE`: protocol configuration and emergency governance.
- `OPERATOR_ROLE`: day-to-day execution by approved systems or users.
- `ORACLE_ROLE`: writes external attestations into protocol contracts.
- `TREASURY_ROLE`: controls settlement, fees, reserves and paymaster sponsorship.
- `PAUSER_ROLE`: activates protocol pause or circuit breaker controls.
- `AUDITOR_ROLE`: reads audit evidence and compliance state.
- `EDGE_NODE_ROLE`: submits signed enterprise events from approved infrastructure.

## Oracle Model

Oracles are treated as permissioned enterprise services until a vertical can safely decentralize them. Every oracle integration must provide:

- Source identity and signing address.
- Data schema version.
- Freshness window and replay protection.
- Confidence score or deterministic validation rule.
- Fallback behavior when data is stale, contradictory or unavailable.
- Audit hash linking the off-chain evidence bundle to the on-chain write.

## Testing Standard

Before a vertical release:

```powershell
node script\validate-vertical-protocols.js
forge test --match-path test/<vertical>/*.t.sol
forge test --match-path test/core/*.t.sol
```

High-risk releases also require wallet tests:

```powershell
forge test --match-path test/SmartWalletTest.t.sol
forge test --match-path test/MultiSigWalletTest.t.sol
forge test --match-path test/PaymasterTest.t.sol
forge test --match-path test/SecurityModuleTest.t.sol
```

## Deployment Standard

1. Rotate deployment keys and load secrets from the approved secret manager.
2. Run `node script\validate-vertical-protocols.js`.
3. Run `node script\deploy-protocol.js <protocol-id>` to print the validated deploy command.
4. Broadcast with Foundry only after environment variables and treasury addresses are reviewed.
5. Run `node script\parse-deployment.js <chainId>`.
6. Store deployment JSON, forge output, test output and oracle configuration in the evidence package.

## Incident Controls

- Pause affected protocol contracts through the authorized pauser.
- Disable impacted Edge Node keys and oracle writers.
- Require MultiSig approval before unpause or migration.
- Preserve logs from API, Edge Node, wallet, oracle and chain indexer.
- Publish post-incident evidence with affected contract addresses and transaction hashes.
