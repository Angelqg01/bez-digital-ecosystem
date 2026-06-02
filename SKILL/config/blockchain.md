# Blockchain Configuration
> BeZhas L2 Chain Parameters

## Chain Identity
- **Chain ID**: 2708
- **Name**: BeZhas L2
- **Type**: OP Stack Rollup (Optimistic)
- **Native Token**: BEZ (BeZhas Coin)
- **Block Time**: ~2 seconds
- **Finality**: ~7 days (L1 disputes)

## Genesis Config
- File: `deploy-config.json` (root)
- Pre-minted: 100,000,000 BEZ to admin
- Gas limit: Standard OP Stack defaults

## RPC Endpoints
| Environment | URL | Use |
|---|---|---|
| Local Dev | `http://localhost:8545` | Development |
| Testnet | TBD | Staging |
| Mainnet | TBD | Production |

## Key Addresses (Development)
- **Deployer**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Hardhat #0)
- **Private Key**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- ⚠️ SOLO PARA DESARROLLO LOCAL — nunca usar en producción

## Foundry Config
```toml
[profile.default]
src = "src"
out = "out" 
libs = ["lib"]
via_ir = true
optimizer = true
optimizer_runs = 200
```

## Dependencies
- OpenZeppelin Contracts v5 (via lib/)
- forge-std (via lib/)
- Solidity 0.8.20 / 0.8.24 / 0.8.34
