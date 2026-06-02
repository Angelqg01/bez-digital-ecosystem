# 🔗 Blockchain & Smart Contracts Guide

## 🏛️ DAO Governance System
**State**: ✅ Implemented (v2.0)

The Bezhas DAO manages the treasury, protocol parameters, and upgrades.
- **Token**: `BEZ` (Governance + Utility)
- **Model**: Proposal -> Vote (on-chain) -> Timelock -> Execution

### Key Contracts
| Contract | Description |
|----------|-------------|
| `PluginManager.sol` | Core immutable permissions system. |
| `TreasuryPlugin.sol` | Manages assets (BEZ, USDC, ETH). Auto-rebalances risk. |
| `GovernancePlugin.sol` | Voting logic (Quorum 10%, Threshold 51%). |
| `HumanResourcesPlugin.sol` | Vesting schedules for team/contributors. |
| `AdvertisingPlugin.sol` | Tokenizes ad spaces as NFTs. |

### DAO Workflows
1. **Create Proposal**: Requires 1,000 BEZ stake.
2. **Vote**: 3 options (For, Against, Abstain).
3. **Execute**: After 48h Timelock if successful.

---

## 🌾 Yield Farming & DeFi
**State**: ✅ Implemented

- **Contract**: `LiquidityFarming.sol`
- **Features**: 
    - Stake LP Tokens / BEZ.
    - Earn BEZ rewards.
    - Time multipliers (lock for longer = higher APY).
- **Frontend**: `/defi`

---

## 🔮 Quality Oracle
**State**: ✅ Implemented

A decentralized system to validate content quality before minting/publishing.
- **Contract**: `BeZhasQualityEscrow.sol`
- **Flow**: User Post -> Staked BEZ -> Validators Vote -> Approved/Rejected.
- **Slashing**: Validators who vote against consensus or malicious posters lose stake.

---

## 📦 Deployment Guide

### Environment Setup
Create a `.env` file in root:
```env
PRIVATE_KEY=your_wallet_private_key
INFURA_API_KEY=your_infura_key
ETHERSCAN_API_KEY=your_etherscan_key
```

### Deployment Scripts
Located in `/scripts` folder.

**1. Localhost (Dev)**
```bash
npx hardhat node
npx hardhat run scripts/deploy-dao.js --network localhost
```

**2. Polygon Amoy (Testnet)**
```bash
npx hardhat run scripts/deploy-dao.js --network amoy
```
*Note: Ensure you have MATIC for gas.*

**3. Mainnet**
```bash
npx hardhat run scripts/deploy-dao.js --network polygon
```

### Verification
```bash
npx hardhat verify --network polygon <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

---

## 🛠️ Security Settings
- **ReentrancyGuard**: Applied to all transfer functions.
- **AccessControl**: `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `EXECUTOR_ROLE`.
- **Pausable**: Emergency stop functionality for all plugins.
