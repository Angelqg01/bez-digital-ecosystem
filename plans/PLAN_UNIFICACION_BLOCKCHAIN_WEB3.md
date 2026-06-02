# Plan de Unificación: BeZhas-Blockchain ↔ BeZhas-Hub

## Fecha: 2026-04-01

---

## 1. INVENTARIO COMPARATIVO

### BeZhas-Blockchain (L2 OP Stack — Enterprise Core)
| Componente | Detalle |
|---|---|
| **Chain** | OP Stack L2 soberano (op-geth, op-node, op-batcher) |
| **Token** | BEZCoinV2 (ERC-20, 100M supply, **NO desplegado aún**) |
| **Contratos** | 78+ Solidity (Foundry) — 16 sectores + wallet + validación |
| **Backend** | Express API (:3001), 15 rutas, PostgreSQL + Redis |
| **AI** | Aegis (FastAPI :8001, 4 ML models) + AI-Engine MCP (:3002, 10 tools) |
| **Frontend** | Next.js 14 Control Center (:3000) — Dashboard B2B |
| **Infra** | 10 servicios Docker, Prometheus/Grafana/Loki, Nginx WAF |
| **Tests** | 1,073+ (931 Solidity + 130 API + 12 E2E) |
| **Foco** | B2B Enterprise, compliance, validación, edge nodes |

### BeZhas-Hub (Polygon L1 — Consumer Platform)
| Componente | Detalle |
|---|---|
| **Chain** | Polygon Mainnet (137) + Amoy testnet + Arbitrum + zkSync |
| **Token** | BezhasToken/BEZ-Coin (desplegado: `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`) + BZHToken |
| **Contratos** | 40+ Hardhat — social, NFT, marketplace, DeFi, DAO, bridge, RWA, quality oracle |
| **Backend** | Express API (:3001), **90+ rutas**, MongoDB + Redis |
| **AI** | BeZhas Intelligence MCP (:8080), Aegis, AI Chat, RAG, ML models |
| **Frontend** | React/Vite (:5173), **80+ páginas** — social, marketplace, DeFi, DAO, VIP |
| **Mobile** | React Native app |
| **SDK** | npm package publicado (marketplace, logistics, governance, staking, farming, payments) |
| **Deploy** | GCP (Cloud Build) |
| **Foco** | Consumer/Social, marketplace, pagos, DeFi, contenido |

---

## 2. SERVICIOS DUPLICADOS (Existen en ambos)

| Servicio | Blockchain | Web3 | Acción |
|---|---|---|---|
| **Aegis AI** | FastAPI, 4 ML models, DecisionEngine | FastAPI, safety service | **UNIFICAR** → Blockchain es master |
| **MCP Server** | ai-engine (:3002), 10 tools | packages/mcp-server (:8080) | **UNIFICAR** → Single MCP gateway |
| **API Backend** | Express (:3001), 15 rutas | Express (:3001), 90+ rutas | **SEPARAR** por dominio |
| **Wallet** | SmartWallet + MultiSig + Paymaster | wallet.routes + web3.service | **UNIFICAR** → Blockchain wallet infra |
| **Staking** | StakingPool + tier boost | StakingPoolV2.sol + staking.service | **UNIFICAR** → Blockchain contracts |
| **Governance** | GovernanceSystem + Timelock | GovernanceSystem.sol + DAO | **UNIFICAR** → Blockchain DAO |
| **Bridge** | L2 bridge contracts | CrossChainBridge (Polygon↔Arbitrum↔zkSync) | **COMBINAR** → Expand Cross-Chain |
| **Marketplace** | Sector contracts (NFTs/SBTs) | BeZhasMarketplace + NFTOffers + Rental | **SEPARAR** → Web3 consumer, Blockchain enterprise |
| **Logistics** | 5 contracts + 6 agents | logistics.routes + LogisticsShipment | **UNIFICAR** → Blockchain contracts |
| **Redis** | Cache + pub/sub + rate limit | Cache + queue + sessions | **COMPARTIR** → Single Redis cluster |
| **Event Listener** | eventListener.js | blockchain-listener.js + indexer | **UNIFICAR** → Single indexer |

---

## 3. ARQUITECTURA RECOMENDADA: 3 APPS

### App 1: **BeZhas-Core** (Blockchain Infrastructure) — Lo que ya tienes
> El corazón. NO debe tener UI consumer ni social features.

**Mantiene:**
- L2 OP Stack completo (geth, node, batcher)
- BEZCoinV2 como token nativo (gas + utility)
- 78+ smart contracts (16 sectores + wallet + validación)
- Aegis AI (master — ML, compliance, fraud, gas prediction)
- MCP Gateway unificado (todas las tools de AI)
- Edge Nodes + Validator Registry + Sequencer Rotation
- PostgreSQL + Redis (infraestructura core)
- Control Center (Next.js dashboard — solo para admins/operadores)
- CI/CD, Docker, monitoreo (Prometheus/Grafana/Loki)
- SDK Enterprise (CommercialAPIClient, contratos, wallet)

**Añadir desde Web3:**
- Cross-Chain Bridge expandido (Polygon ↔ L2 ↔ Arbitrum ↔ zkSync)
- Quality Oracle service (blockchain-listener + indexer unificado)
- Data Oracle service
- Token Distribution service
- Revenue monitoring

### App 2: **BeZhas-App** (Consumer Platform) — Refactor de Web3
> La cara pública. Social network + marketplace + content.

**Mantiene de Web3:**
- Frontend React/Vite (páginas consumer)
- Social Feed, Posts, Chat, Profiles, Contacts
- Marketplace consumer (NFT gallery, offers, rental, bundles)
- Content Management, Social Interactions
- Gamification, Rewards, VIP system
- Notifications, Groups, Share
- AI Chat interface (consume MCP de Core via API)
- Mobile app (React Native)
- Auth (2FA, WebAuthn)
- Ads system, Campaigns, Affiliate
- User Management, Uploads

**Backend reducido:**
- Express API con SOLO rutas consumer: auth, users, posts, feed, chat, marketplace, notifications, social, groups, profile, uploads, rewards, VIP, ads, gamification
- MongoDB (datos sociales, posts, profiles, chat — es correcto para este tipo de datos)
- Redis (sessions, cache de feed)
- Conecta al Core via SDK/API para operaciones blockchain

**QUITAR de Web3 (mover a Core o DeFi):**
- ❌ Staking, Farming, Governance, DAO → DeFi App
- ❌ Bridge, Cross-Chain → Core
- ❌ Logistics contracts → Core
- ❌ Real Estate contracts → Core
- ❌ Quality Oracle → Core
- ❌ Aegis AI engine → Core (consume via API)
- ❌ blockchain-listener, indexer → Core
- ❌ Token distribution, tokenomics logic → Core
- ❌ Developer Console, SDK Admin → Core Control Center
- ❌ Oracle, Data Oracle → Core
- ❌ All Solidity contracts → Core

### App 3: **BeZhas-DeFi** (Financial Services) — Nueva App
> Todo lo financiero que no es core infrastructure.

**Extraer de Web3:**
- DeFi Hub (Staking, Farming, Swap)
- DAO Governance (proposals, votes, treasury dashboard)
- DAO Funds por sector (Banca/Fintech, Energía, Salud, etc.)
- Bridge UI (cross-chain transfers)
- Wallet UI avanzada (portfolio, transactions, bridging)
- BezPay / Payment gateway
- Crypto payments, Fiat gateway (Stripe, MoonPay)
- Escrow system
- Treasury management
- Buy Tokens page
- Billing, Subscriptions

**Stack:**
- Frontend: React/Vite o Next.js (dedicado a DeFi UX)
- Backend ligero: Express API con rutas DeFi only
- Conecta al Core via SDK para contratos (staking, farming, governance, wallet, bridge)
- No necesita MongoDB propio — usa API del Core para datos on-chain

---

## 4. ESTRATEGIA DE TOKENS: BEZCoinV2 + BezhasToken

### Estado actual
| Token | Chain | Supply | Estado | Propósito |
|---|---|---|---|---|
| **BEZCoinV2** | L2 BeZhas (OP Stack) | 100M | NO desplegado | Gas nativo + utility |
| **BezhasToken** | Polygon Mainnet (137) | Variable (minteable) | DESPLEGADO ✅ | Deflación + LP rewards |
| **BZHToken** | Hardhat local | Variable | Solo dev/test | Propinas + recompensas |

### Estrategia de Unificación

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOKEN ARCHITECTURE                            │
│                                                                  │
│  ┌──────────────┐    Bridge     ┌──────────────────────┐        │
│  │  L2 BeZhas   │◄────────────►│  Polygon Mainnet     │        │
│  │              │   Lock/Mint   │                      │        │
│  │  BEZCoinV2   │   Burn/Unlock │  wBEZ (Wrapped BEZ) │        │
│  │  (CANONICAL) │              │  (ex-BezhasToken)    │        │
│  │  Gas + Utility│              │                      │        │
│  └──────┬───────┘              └──────────┬───────────┘        │
│         │                                  │                    │
│         │                      ┌───────────┼───────────┐       │
│         │                      │           │           │       │
│         │                 ┌────▼───┐  ┌────▼───┐  ┌────▼───┐  │
│         │                 │Arbitrum│  │ zkSync │  │  Base  │  │
│         │                 │ wBEZ   │  │ wBEZ   │  │ wBEZ   │  │
│         │                 └────────┘  └────────┘  └────────┘  │
│         │                                                      │
│  ┌──────▼───────────────────────────────────────────────┐      │
│  │              USOS DEL TOKEN                           │      │
│  │                                                       │      │
│  │  L2 (BEZCoinV2):                                     │      │
│  │  • Gas fees empresariales                             │      │
│  │  • Staking + Governance                               │      │
│  │  • Sector contract interactions                       │      │
│  │  • Edge node rewards                                  │      │
│  │  • Paymaster depositos                                │      │
│  │                                                       │      │
│  │  Polygon/L1 (wBEZ):                                  │      │
│  │  • Trading en DEXs (UniSwap, QuickSwap)              │      │
│  │  • Liquidity Pools / Farming                          │      │
│  │  • Consumer marketplace payments                      │      │
│  │  • Social tipping / rewards                           │      │
│  │  • VIP subscriptions                                  │      │
│  │  • Fiat on/off ramp                                   │      │
│  └───────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Plan de Ejecución Token:

1. **Fase 1 — Deploy BEZCoinV2 en L2** (pendiente)
   - Desplegar en L2 BeZhas como gas token nativo
   - 100M supply inicial al Treasury multisig

2. **Fase 2 — Upgrade BezhasToken → wBEZ** 
   - Crear contrato `BEZBridge.sol` en Polygon que:
     - Lock BEZCoinV2 en L2 → Mint wBEZ en Polygon
     - Burn wBEZ en Polygon → Unlock BEZCoinV2 en L2
   - Migrar holders de BezhasToken actual a wBEZ (snapshot + airdrop o swap 1:1)
   - **BZHToken queda deprecado** — fusionar utilidad en BEZCoinV2

3. **Fase 3 — Liquidez multi-chain**
   - Expandir bridge a Arbitrum y zkSync (ya tienen infra en Web3)
   - Crear pools wBEZ/MATIC, wBEZ/ETH, wBEZ/USDC en Polygon
   - LP farming rewards pagados en BEZCoinV2 (bridgeados)

4. **Fase 4 — Unificar Tokenomics**
   - Supply cap: 100M BEZCoinV2 (L2) = supply total cross-chain
   - Deflación: mantener mecanismo de BezhasToken (burn → treasury) pero en L2
   - El LP incentive multiplier (0.3x) se aplica via contract en L2
   - Staking tiers (del Blockchain) determinan beneficios en todas las apps

---

## 5. FLUJO DE COMUNICACIÓN ENTRE APPS

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                        ╔═══════════════╗                              │
│                        ║  BeZhas-Core  ║                              │
│                        ║  (L2 + API)   ║                              │
│                        ╚═══════╤═══════╝                              │
│                                │                                      │
│            ┌───────────────────┼───────────────────┐                  │
│            │                   │                   │                  │
│     ╔══════╧═══════╗    ╔═════╧══════╗    ╔═══════╧══════╗          │
│     ║  BeZhas-App  ║    ║ BeZhas-DeFi║    ║  3rd Party   ║          │
│     ║  (Consumer)  ║    ║ (Financial)║    ║  (SDK Users) ║          │
│     ╚══════════════╝    ╚════════════╝    ╚══════════════╝          │
│                                                                       │
│  Protocolo de comunicación:                                           │
│  ─────────────────────────                                            │
│  • REST API (Core :3001) — CRUD, queries, auth delegation            │
│  • WebSocket (Core) — Real-time events, SSE streams                  │
│  • SDK (@bezhas/sdk) — Client lib para integrar apps externas        │
│  • MCP Gateway (Core :3002) — AI tools (Aegis proxy)                 │
│  • Redis Pub/Sub — Event bus entre servicios internos                │
│  • Bridge Relayer — Cross-chain token transfers                       │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 6. SERVICIOS QUE DEBEN UNIFICARSE EN CORE

### Desde Web3 → Core (migrar)

| Servicio Web3 | Destino en Core | Justificación |
|---|---|---|
| `blockchain-listener.js` | `api/services/eventListener.js` | Un solo indexer para toda la cadena |
| `blockchain-indexer.service.js` | `api/services/eventListener.js` | Duplica funcionalidad |
| `blockchain.service.js` | `api/services/contractService.js` | Unificar acceso a contratos |
| `web3-core.init.js` | `api/services/contractService.js` | Provider management centralizado |
| `aegis.service.js` + `aegis-safety.service.js` | `aegis/` (FastAPI) | Aegis master en Core |
| `orchestrator.service.js` | `api/services/agentService.js` | Agent orchestration centralizado |
| `token-distribution.service.js` | Nuevo: `api/services/tokenDistribution.js` | Controla emisión desde L2 |
| `data-oracle.service.js` | Nuevo: `api/services/oracleService.js` | Oracles gestionados por Core |
| `farming.service.js` | Nuevo: `api/services/farmingService.js` | DeFi contracts en L2 |
| `governance.service.js` | Integrar en `api/routes/contracts.js` | Governance es contract call |
| `staking.service.js` | Integrar en `api/routes/contracts.js` | Staking es contract call |
| `crossChainBridge.service.js` | Nuevo: `api/services/bridgeService.js` | Bridge infra es Core |
| `revenue-event-listener.service.js` | `monitoring/` | Revenue tracking en monitoreo |
| `key-management.service.js` | `api/middleware/security.js` | Gestión de keys centralizada |
| `did.service.js` | Nuevo: `api/services/didService.js` | Identity en L2 |
| `quality-reputation.service.js` | `api/services/` | Quality oracle en Core |
| `prometheus-exporter.service.js` | `api/middleware/metrics.js` | Métricas ya existen en Core |

### Servicios que Web3-App conserva (NO migrar)

| Servicio | Razón |
|---|---|
| `feed-optimizer.service.js` | Lógica consumer de feed |
| `notification.service.js` | Notificaciones UI consumer |
| `email.service.js` | Email para users consumer |
| `ad.service.js`, `ad-rewards.service.js` | Sistema de ads = consumer |
| `chat/` | Chat social = consumer |
| `websocket-hub.service.js` | Real-time consumer features |
| `clothing-rental.service.js` | Nicho consumer |
| `lead-scraper.service.js`, `leadFinder.js` | Growth/marketing |
| `outbound-messaging.service.js` | Marketing |
| `ipfs.service.js` | Storage consumer assets |
| `ml.service.js`, `rag.service.js` | AI features consumer (consulta Aegis via API) |
| `stripe.service.js`, `fiat-gateway.service.js` | Pagos fiat = consumer |
| `vip.service.js`, `subscription.service.js` | Planes VIP = consumer |
| `bezpay.service.js` | Pagos in-app = consumer |

---

## 7. CONTRATOS: QUÉ VA DONDE

### Web3 contracts → Core (migrar/unificar)
- `BezhasToken.sol` → Upgrade a wBEZ (wrapped BEZCoinV2)
- `CrossChainBridge.sol` → `smart-contracts/src/core/CrossChainBridge.sol`
- `GovernanceSystem.sol` → Ya existe en Core (GovernanceSystem)
- `StakingPoolV2.sol` → Ya existe en Core (StakingPool)
- `LiquidityFarming.sol` → `smart-contracts/src/core/LiquidityFarming.sol`
- `DataOracle.sol` → `smart-contracts/src/core/DataOracle.sol`
- `QualityOracle.sol` → `smart-contracts/src/core/QualityOracle.sol`
- `SecurityManager.sol` → Ya existe en Core (SecurityModule)
- `AuthenticationManager.sol` → Core wallet system
- `BackupRecoverySystem.sol` → Core wallet system
- `CargoManifestNFT.sol` → Ya cubierto por logistics sector

### Web3 contracts → DeFi App (UI only, contracts en Core)
- `TokenSale.sol` → Deploy en Core, UI en DeFi
- `BeZhasVault.sol` → Deploy en Core, UI en DeFi

### Web3 contracts que se quedan en Web3-App
- `Post.sol` → Social content
- `SocialInteractions.sol` → Social features
- `UserProfile.sol` → User identity consumer
- `ContentValidator.sol` → Content moderation
- `PersonalizedFeed.sol` → Feed algorithm
- `ModerationSystem.sol` → Content moderation
- `GamificationSystem.sol` → Gamification consumer
- `BeZhasMarketplace.sol` + `NFTOffers.sol` + `NFTRental.sol` → Consumer marketplace
- `UserManagement.sol` → User auth/management
- `NotificationSystem.sol` → Consumer notifications
- `LazyNFT.sol`, `FractionalNFT.sol`, `NFTBundle.sol`, `NFTStaking.sol` → Consumer NFT features

> **Nota**: Los contratos consumer de Web3-App se despliegan en **Polygon** (como están ahora), pero interactúan con Core vía bridge cuando necesitan BEZ tokens.

---

## 8. ROADMAP DE IMPLEMENTACIÓN

### Fase 1: Token Foundation (Semanas 1-2)
- [ ] Desplegar BEZCoinV2 en L2 BeZhas (Anvil → testnet → mainnet)
- [ ] Crear `BEZBridge.sol` en Core (lock/unlock L2 ↔ Polygon)
- [ ] Plan de migración BezhasToken → wBEZ
- [ ] Deprecar BZHToken

### Fase 2: Core Consolidation (Semanas 3-4)
- [ ] Migrar blockchain-listener de Web3 → Core
- [ ] Migrar bridge service de Web3 → Core
- [ ] Migrar oracle services de Web3 → Core
- [ ] Unificar Aegis (Core como master, Web3 consume via API)
- [ ] Crear API Gateway en Core para apps externas

### Fase 3: App Separation (Semanas 5-6)
- [ ] Fork Web3 → crear BeZhas-App (solo consumer features)
- [ ] Eliminar de App: staking, farming, governance, bridge, blockchain-listener
- [ ] Conectar App al Core SDK para operaciones blockchain
- [ ] Crear BeZhas-DeFi (extraer DeFi pages de Web3)

### Fase 4: Cross-Chain Activation (Semanas 7-8)
- [ ] Activar bridge L2 ↔ Polygon con wBEZ
- [ ] Crear pools de liquidez wBEZ en Polygon
- [ ] Migrar holders de BezhasToken → wBEZ
- [ ] Expandir bridge a Arbitrum/zkSync

### Fase 5: Integration Testing (Semanas 9-10)
- [ ] E2E tests: App ↔ Core ↔ DeFi flow
- [ ] Load testing cross-chain bridge
- [ ] Security audit de bridge y token migration
- [ ] Documentación API Gateway para terceros

---

## 9. RESUMEN EJECUTIVO

```
ANTES (2 apps con todo duplicado):
├── BeZhas-Blockchain  →  Enterprise infra + contracts + AI + dashboard
└── BeZhas-Hub        →  Social + DeFi + marketplace + contracts + AI + EVERYTHING

DESPUÉS (3 apps especializadas):
├── BeZhas-Core        →  L2 chain + contracts + AI + bridge + SDK + admin
├── BeZhas-App         →  Social + marketplace + chat + content + mobile (consume Core API)
└── BeZhas-DeFi        →  Staking + farming + DAO + bridge UI + wallet (consume Core API)

TOKEN:
├── BEZCoinV2 (L2)    →  Canonical token, gas nativo, 100M supply cap
├── wBEZ (Polygon)     →  Wrapped representation = 1:1 con BEZCoinV2
├── wBEZ (Arbitrum)    →  Wrapped representation = 1:1 con BEZCoinV2
└── BezhasToken        →  DEPRECATED → migración a wBEZ
```

**Beneficios:**
1. **Rendimiento**: Cada app hace solo lo que necesita (no monolito de 90+ rutas)
2. **Escalabilidad**: Core escala independiente de consumer traffic
3. **Seguridad**: Contratos y AI compliance centralizados en Core
4. **Token unificado**: Un solo token (BEZCoinV2) con representación multi-chain
5. **Developer Experience**: SDK claro, API Gateway documentado
6. **Mantenimiento**: 3 codebases especializadas vs 2 monolitos que se pisan
