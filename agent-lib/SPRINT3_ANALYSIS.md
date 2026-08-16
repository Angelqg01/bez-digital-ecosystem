# 🔷 Sprint 3 — Análisis Tokenómico BeZhas
## Arquitectura Completa `smart-contracts/` → SDK → Agent Runtime → Frontend
**Fecha:** 2025-04-25 | Pre-desarrollo

---

## 🏗️ MAPA TOKENÓMICO REAL (basado en smart-contracts/)

```
                        ┌─────────────────────────────────────┐
                        │         BEZCoinV2.sol                │
                        │   Supply Total: configurable         │
                        │   ERC-20 + Burnable + Pausable       │
                        │   Polygon: 0xEcBa873B...            │
                        │   BNB Chain: 0x8a1e39...            │
                        └──────────────┬──────────────────────┘
                                       │ BEZ fluye hacia:
          ┌─────────┬──────────────────┼──────────────────┬──────────┐
          ↓         ↓                  ↓                  ↓          ↓
   StakingPool  LiquidityFarming  BeZhasPayment    GovernanceSystem  BridgeL2
   .sol         .sol              .sol             .sol              .sol
   (Lock BEZ)   (LP → BEZ yield) (Fee en BEZ)     (Vote con BEZ)   (Cross-chain)
          │         │                  │                  │          │
          ↓         ↓                  ↓                  ↓          ↓
   ValidatorRegistry  EdgeNodeRewards  QualityEscrow  TreasuryVault  WrappedBEZ
   .sol                .sol            .sol           (finance/)     .sol
   (Validators stake)  (Node rewards)  (Escrow B2B)   (DAO funds)   (wBEZ ERC-20)
```

---

## 📦 CONTRATOS TOKENÓMICOS — ANÁLISIS DETALLADO

### CAPA 1: TOKEN BASE

| Contrato | Rol | Red | Dirección |
|----------|-----|-----|-----------|
| `BEZCoinV2.sol` | Token principal ERC-20 | Polygon | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` |
| `BEZCoinV2.sol` | Token principal ERC-20 | BNB Chain | `0x8a1e3930fde1f151471c368fdbb39f3f63a65b55` |
| `WrappedBEZ.sol` | wBEZ (wrapped para DeFi) | L2 BeZhas | deployments/31337.json |
| `BeZhasPartnerSBT.sol` | SBT de socios (no transferible) | Multi-chain | — |
| `BeZhasLogisticsNFT.sol` | NFT logístico (sectorial) | Multi-chain | — |

### CAPA 2: STAKING & VALIDACIÓN

| Contrato | Función Tokenómica |
|----------|-------------------|
| `StakingPool.sol` | Lock BEZ → earn yield. Epochs, APY variable, cooldown |
| `ValidatorRegistry.sol` | Validators registran stake mínimo en BEZ para operar L2 |
| `SlashingManager.sol` | Quema BEZ de validators maliciosos (deflacionario) |
| `SequencerRotation.sol` | Rotación de sequencers por stake ponderado |
| `L2Sequencer.sol` | Sequencer de la L2 — cobra fees en BEZ |
| `EdgeNodeRewards.sol` | Recompensas en BEZ por aportar edge computing |

### CAPA 3: LIQUIDEZ & FARMING

| Contrato | Pools | APY Estimado |
|----------|-------|-------------|
| `LiquidityFarming.sol` | BEZ/USDT, BEZ/BNB, BEZ/ETH, BEZ/MATIC, BEZ/USDC | Variable |

### CAPA 4: UTILIDAD & PAGOS

| Contrato | Fee en BEZ | Función |
|----------|-----------|---------|
| `BeZhasPayment.sol` | % en BEZ | Pagos B2B dentro de la plataforma |
| `QualityEscrow.sol` | Depósito BEZ | Garantía de calidad en transacciones |
| `BeZhasWorkflowRegistry.sol` | Gas en BEZ | Registro y ejecución de workflows |
| `SubscriptionManager.sol` | Suscripción en BEZ | Planes de suscripción SaaS |

### CAPA 5: GOBERNANZA & TREASURY

| Contrato | Función |
|----------|---------|
| `GovernanceSystem.sol` | Propuestas y votaciones (BEZ = poder de voto) |
| `TreasuryVault.sol` | Bóveda del DAO (0x89c23890...) |
| `PublicBudgetDAO.sol` | Presupuesto público descentralizado |

### CAPA 6: BRIDGES (CROSS-CHAIN)

| Contrato | Ruta | Dirección |
|----------|------|-----------|
| `BeZhasL1Bridge.sol` | Ethereum ↔ L2 BeZhas | src/bridges/ |
| `BeZhasBridgeL2.sol` | L2 BeZhas ↔ BNB Chain | src/core/ |
| `BEZPolygonBridge.sol` | Polygon ↔ L2 BeZhas | src/core/ |

### CAPA 7: SECTOR TOKENS (16 sectores — BEZ como fee layer)

Todos usan BEZ como token de acceso/fee:
- **Supplychain:** SupplyTracker, CustomsClearanceOracle, WarehouseManager
- **Salud:** HealthRecordSBT, ClinicalDataMarketplace
- **Real Estate:** (vía RealEstateModule.js en SDK)
- **Energía:** CarbonCreditToken, P2PEnergyMarket, SolarFarmToken
- **Legal:** IPRegistryNFT, ArbitrationDAO
- **Educación:** CourseTokenNFT, ScholarshipPool

---

## 🔄 FLUJOS DE BEZ — ECONOMÍA DEL TOKEN

### Flujo de Entrada (Demand-side):
```
1. Empresas pagan fees en BEZ para usar la plataforma
2. Developers pagan BEZ para desplegar en L2
3. LPs depositan BEZ en pools de farming
4. Validators compran BEZ para hacer stake
5. Edge nodes compran BEZ para participar
6. Usuarios compran BEZ para votar en governance
```

### Flujo de Salida (Supply-side):
```
1. Staking rewards → BEZ emitido a stakers
2. Farming rewards → BEZ emitido a LPs
3. Edge node rewards → BEZ emitido a nodes
4. Validator rewards → BEZ emitido a validators
```

### Mecanismos Deflacionarios:
```
1. SlashingManager → quema BEZ de validators maliciosos
2. BeZhasPayment → % de fees va al burning address
3. QualityEscrow → penalizaciones van a Treasury
```

---

## 📊 SDK EXISTENTE — GAP ANALYSIS

| Módulo SDK | Archivo | Estado |
|-----------|---------|--------|
| Token BEZ | `contracts.js` | ✅ Referencias |
| Staking | `sdk/staking.js` | ✅ Existe, sin unificar |
| Farming | `sdk/farming.js` | ✅ Existe, sin unificar |
| Governance | `sdk/governance.js` | ✅ Existe, sin unificar |
| Payments | `sdk/payments.js` | ✅ Existe, sin unificar |
| VIP Subscription | `sdk/vip.js` | ✅ Existe |
| RWA | `sdk/rwa.js` | ✅ Existe |
| Validators | `sdk/modules/ValidatorClient.js` | ✅ Existe |
| **TokenomicsEngine** | `sdk/tokenomics-engine.js` | ❌ **CREAR** |
| **BridgeManager** | `sdk/bridge-manager.js` | ❌ **CREAR** |
| **RewardsTracker** | `sdk/rewards-tracker.js` | ❌ **CREAR** |

---

## 🎯 PLAN SPRINT 3

### S3.1: `sdk/tokenomics-engine.js` — Motor unificado
Agrega staking.js + farming.js + governance.js + payments.js en una API única.

### S3.2: `sdk/bridge-manager.js` — Gestión de bridges
Unifica BeZhasL1Bridge + BeZhasBridgeL2 + BEZPolygonBridge.

### S3.3: `sdk/rewards-tracker.js` — Tracking de recompensas
Consolida StakingPool + LiquidityFarming + EdgeNodeRewards + ValidatorRegistry.

### S3.4: `agent-runtime/connectors/TokenomicsConnector.js`
Lee estado on-chain de todos los contratos tokenómicos en tiempo real.

### S3.5: `agent-runtime/agents/TokenomicsAgent.js`
Agente que monitorea APY, supply, bridges, detecta anomalías tokenómicas.

### S3.6: Frontend — 4 páginas
- `TokenomicsDashboard.jsx` — Vista 360° del ecosistema BEZ
- `StakingPage.jsx` — Stake/unstake BEZ + historial de rewards
- `FarmingPage.jsx` — Pools de liquidez + farm rewards
- `BridgePage.jsx` — Cross-chain BEZ (Polygon ↔ BNB ↔ L2)

### S3.7: `hooks/useTokenomics.js` — Hook React unificado

---

*Análisis completado — iniciando desarrollo*
