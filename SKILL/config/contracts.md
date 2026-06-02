# Contract Addresses & Configuration
> Deploy info and contract registry

## Contract Registry Structure
All deployed contracts stored in DB table `contract_addresses`:
```sql
CREATE TABLE contract_addresses (
  name VARCHAR(100),
  category VARCHAR(50),
  address VARCHAR(42),
  chain_id INTEGER,
  deployed_at TIMESTAMP
);
```

## Categories
| Category | Contracts |
|---|---|
| `core` | BEZCoinV2, StakingPool, LiquidityFarming, GovernanceSystem, QualityEscrow |
| `bridge` | BeZhasBridgeL2 |
| `nft` | BeZhasLogisticsNFT |
| `wallet` | SmartWalletFactory, Paymaster, SecurityModule, WalletGuardian |
| `sector-*` | 60 sector contracts (health, energy, automotive, etc.) |

## ABI Loading
ABIs loaded from Foundry artifacts: `smart-contracts/out/{ContractName}.sol/{ContractName}.json`

## Contract Roles (AccessControl)
### BEZCoinV2
- `DEFAULT_ADMIN_ROLE` → DAO MultiSig
- `MINTER_ROLE` → Staking, Farming, Bridge
- `BRIDGE_ROLE` → BeZhasBridgeL2

### Wallet Contracts
- SmartWallet: `owner` (user), `guardian` (recovery)
- MultiSigWallet: `ADMIN`, `OPERATOR`, `VIEWER`
- Paymaster: `owner` (admin), `relayers` (gas relay)
- SecurityModule: `owner` (admin), `guardians` (emergency)

## Contract Sizes (verified)
- SmartWallet: ~8KB bytecode (within 24KB limit)
- MultiSigWallet: ~7KB bytecode
- SecurityModule: ~9KB bytecode
- All contracts optimize with via_ir=true, runs=200
