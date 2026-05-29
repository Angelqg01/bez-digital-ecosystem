---
name: Blockchain Contracts
description: Smart contracts, ABIs, deployment procedures, and gas optimization for BeZhas
---

# Blockchain Contracts SKILL

## Contratos Desplegados

| Contrato | Dirección | Red | ABI |
|---|---|---|---|
| BEZ Token (ERC20) | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` | Polygon Amoy | `artifacts/contracts/BezCoin.sol/BezCoin.json` |
| BEZ Token BNB | `0x8a1e3930fde1f151471c368fdbb39f3f63a65b55` | BNB Chain | — |
| QualityEscrow | `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3` | Polygon | `artifacts/contracts/QualityEscrow.sol/` |
| StakingPool | `0x5c9bd3136fBAA3861DeAE71e689AD8792202c7Df` | Polygon | `artifacts/contracts/StakingPool.sol/` |
| LiquidityFarming | Sin deploy | — | `artifacts/contracts/LiquidityFarming.sol/` |
| GovernanceSystem | Sin deploy | — | `artifacts/contracts/GovernanceSystem.sol/` |

## Carpeta de Contratos
```
contracts/
├── BezCoin.sol          ← ERC20 token principal
├── QualityEscrow.sol    ← Garantía de calidad con penalizaciones
├── StakingPool.sol      ← Staking single-sided
├── LiquidityFarming.sol ← Farming con multiplicadores y lock
├── GovernanceSystem.sol ← DAO basado en OpenZeppelin Governor
└── interfaces/          ← Interfaces compartidas
```

## Comandos de Deployment
```bash
# Compilar
npx hardhat compile

# Deploy a localhost
npx hardhat run scripts/deploy.js --network localhost

# Deploy a Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network amoy

# Verificar en Polygonscan
npx hardhat verify --network amoy <ADDRESS> <CONSTRUCTOR_ARGS>
```

## ABI Location
Los ABIs compilados están en `artifacts/contracts/<nombre>.sol/<nombre>.json`
El SDK los consume desde `sdk/contracts.js` que exporta ABIs simplificados.

## Optimización de Gas
- QualityEscrow usa `gasLimit: 100_000` para transfers
- BEZ transfers tipicamente usan 60k-80k gas
- Para batch operations, usar multicall pattern
