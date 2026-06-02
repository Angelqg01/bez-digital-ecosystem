# BeZhas Blockchain — Architecture Overview
> Documento de entrenamiento: Arquitectura completa del ecosistema

## Visión General
BeZhas es una blockchain L2 soberana basada en OP Stack, diseñada para empresas B2B con integración de IA y sistema DePIN. Chain ID: 2708. Token nativo: BEZ.

## Capas de la Arquitectura

### Capa 1: Blockchain (OP Stack L2)
- **op-geth**: Cliente de ejecución customizado con inyección de IA
- **Chain ID**: 2708
- **Consensus**: OP Stack (rollup a Ethereum L1)
- **RPC**: http://localhost:8545
- **Block Explorer**: Blockscout (http://localhost:4000)
- **Smart Contracts**: 72+ contratos Solidity organizados en módulos

### Capa 2: Smart Contracts (Solidity)
```
smart-contracts/src/
├── core/           # BEZCoinV2 (token), BeZhasBridge, CorporateGasTank
├── defi/           # BeZhasLending, DefiHub, DEX, LiquidityPool, YieldOptimizer
├── depin/          # EdgeNodeRewards, HardwareRegistry, NodeOperator, QualityOracle
├── farming/        # YieldFarming, FarmingRewards, LiquidityMining
├── governance/     # GovernanceSystem, ProposalManager, VotingPower, Treasury
├── marketplace/    # ServiceMarketplace, NFTMarketplace, DataMarketplace
├── staking/        # StakingPool, StakingRewards, ValidatorRegistry
├── supply-chain/   # TraceabilityEngine, CertificationManager, IoTDataBridge
├── wallet/         # SmartWallet, SmartWalletFactory, MultiSigWallet,
│                   # Paymaster, SecurityModule, WalletGuardian
├── extras/         # Cross-module integrations
└── interfaces/     # Shared interfaces
```

### Capa 3: Backend API (Node.js)
- **Framework**: Express 4.22
- **Puerto**: 3001
- **Rutas**: /api/network, /api/contracts, /api/staking, /api/farming, /api/governance, /api/bridge, /api/depin, /api/marketplace, /api/ecosystem, /api/edge-nodes, /api/wallet
- **Servicios**: contractService, stakingService, farmingService, governanceService, bridgeService, depinService, marketplaceService, ecosystemService, walletService
- **DB**: PostgreSQL 16 (pool.js, migrate.js, seed.js)
- **Cache**: Redis 7 (cache/redis.js)
- **Auth**: JWT (middleware/auth.js)

### Capa 4: Aegis AI Engine (Python)
- **Framework**: FastAPI
- **Puerto**: 8001
- **Funciones**: Análisis de anomalías, optimización de gas, predicción de congestión, detección de fraude
- **Modelos**: scikit-learn, pandas, numpy

### Capa 5: AI Engine (Node.js)
- **Puerto**: 3003
- **Funciones**: Orquestación de IA, integración MCP

### Capa 6: Frontend Dashboard (Next.js)
- **Framework**: Next.js 14.2.3 (App Router)
- **UI**: TailwindCSS, shadcn/ui
- **Puerto**: 3000
- **Secciones**: Dashboard, Staking, Farming, Governance, Bridge, DePIN, Marketplace, Wallets

### Capa 7: SDK
- **Archivo**: sdk/bezhas-sdk.js
- **Tipo**: JavaScript module (CommonJS)
- **Métodos**: 40+ métodos cubriendo todos los módulos
- **Uso**: Integración B2B, scripts, frontend

### Capa 8: Edge Nodes (DePIN)
- **Servidor**: bezhas-edge-node/server.js
- **Auto-signer**: auto-signer.js
- **Función**: Nodos de infraestructura descentralizada

## Flujo de Datos
```
[Usuario/Empresa]
       ↓
[Frontend (Next.js :3000)]
       ↓
[API (Express :3001)] ←→ [Redis Cache]
       ↓                        ↓
[Smart Contracts (op-geth :8545)]  [PostgreSQL]
       ↓
[Aegis AI (:8001)] — Análisis y optimización
```

## Seguridad (7 Capas)
1. **Smart Contract**: AccessControl, ReentrancyGuard, Pausable
2. **Wallet**: Account Abstraction, MultiSig, Daily Limits, Timelocks
3. **Guardian**: Social Recovery, Trust Scores, WalletGuardian
4. **Paymaster**: Gas Sponsorship controlado, whitelists, daily limits
5. **SecurityModule**: Global pause, circuit breakers, on-chain audit log
6. **API**: JWT auth, rate limiting, input validation
7. **Infrastructure**: Docker isolation, env vars, no secrets in code
