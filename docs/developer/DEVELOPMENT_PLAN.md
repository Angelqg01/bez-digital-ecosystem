# Plan de Desarrollo BeZhas Blockchain
# Fase 3 en adelante — Post-Expansión Multi-Sector
> Creado: 2026-03-18 | Actualizado: 2026-04-06

---

## Resumen Ejecutivo

Las Fases 1 (Arquitectura), 2 (Smart Contracts × 16 sectores), 3 (Infraestructura), 4 (API Real), 4B (Wallet System), 5 (Frontend), 6 (Aegis AI), 7 (E2E Testing), 8 (DevOps), 9 (Blockchain Deployment), 10 (Sistema de Validación), 11 (Integración), 12 (SDK/Onboarding/ERP) y 13 (Testnet Deployment) están **completadas**.

El proyecto tiene **78+ contratos**, **1,020+ tests** (89 core + 931 previos), 69 agentes UI, API modular con 15 rutas + 11 servicios, PostgreSQL, Redis, Docker 10 servicios, CI/CD, monitoring, y un **sistema de validación corporativo completo** (PoA + PoS + Proof of Contribution).

**Estado actual:** Todos los contratos compilados y testeados. Fases 3-13 completadas. Fase 13A (security audit: Slither + Mythril + gas report + invariant fuzz tests), Fase 13B (deploy tooling: DeployAll script, seed validators, sequencer epoch simulation, slashing simulation, deployment publisher), Fase 13C (monitoring: Prometheus scrape targets para edge-node/geth/op-node, Grafana dashboard 13 panels, Alertmanager con 11 alert rules + Slack/webhook routing). Frontend 0 errores TypeScript. 27 dashboard pages + 8 DeFi pages + 8 landing pages conectados a APIs reales. Siguiente: Fase 14 (Mainnet & Producción — requiere auditoría externa + 30 días testnet sin incidentes).

**La cadena de dependencias completa:**

```
✅ Contratos (78+)  → ✅ Backend API   → ✅ Wallet System → ✅ Frontend      → ✅ IA Aegis      → ✅ E2E Tests
   FASE 2+3A            FASE 4             FASE 4B           FASE 5             FASE 6            FASE 7

→ ✅ DevOps/Prod    → ✅ Deploy L2     → ✅ Validación     → ✅ Integración   → ✅ SDK/Onboard   → ✅ Testnet       → 🔲 Mainnet
     FASE 8              FASE 9            FASE 10            FASE 11            FASE 12           FASE 13           FASE 14
```

---

## FASE 10: Sistema de Validación Corporativa ✅ COMPLETADA
> **Objetivo:** Implementar sistema PoA + PoS + Proof of Contribution para empresas validadoras
> **Estado:** ✅ COMPLETADA (2026-03-23)
> **Contratos nuevos/modificados (7):** ValidatorRegistry, EdgeNodeRewards, SequencerRotation, SlashingManager (nuevos); BEZCoinV2, StakingPool, GovernanceSystem (upgrades)
> **Tests nuevos:** 89 tests en 6 suites (todos passing)
> **Documentación:** docs/VALIDATION_SYSTEM.md

### 10.1 — Contratos Nuevos

| Contrato | Archivo | Tests | Descripción |
|----------|---------|-------|-------------|
| ValidatorRegistry | `src/core/ValidatorRegistry.sol` | 19/19 ✅ | Registro central con tiers Bronze/Silver/Gold/Platinum, heartbeats, contribuciones, slashing hooks |
| EdgeNodeRewards | `src/core/EdgeNodeRewards.sol` | 11/11 ✅ | DePIN mining — recompensas por procesamiento de datos IoT/compliance con boost por tier |
| SequencerRotation | `src/core/SequencerRotation.sol` | 11/11 ✅ | Rotación de sequencer entre Gold/Platinum, epochs de 7200 bloques, 50% fee share |
| SlashingManager | `src/core/SlashingManager.sol` | 17/17 ✅ | 5 tipos de infracciones (1-10%), cooldown 24h, max 25%/30d, apelaciones |

### 10.2 — Contratos Upgrades

| Contrato | Cambio | Tests |
|----------|--------|-------|
| BEZCoinV2 | +ERC20Votes, +clock()/CLOCK_MODE() timestamp, +_update override | 14/14 ✅ |
| StakingPool | +validatorRegistry param, +tier boost en getReward(), +getStakerInfo() | 10/10 ✅ |
| GovernanceSystem | +GovernorTimelockControl, +ValidatorRegistry ref, +clock overrides | 7/7 ✅ |

### 10.3 — Deploy Scripts Actualizados

- `script/DeployCore.s.sol` — Despliega ValidatorRegistry, EdgeNodeRewards, SequencerRotation, SlashingManager; asigna roles ORACLE/SLASHER; fondea reward pools
- `script/DeployAll.s.sol` — Mismos cambios, conteo actualizado a 78 contratos

### 10.4 — Tier System

| Tier | BEZ Stake | Reward Boost | Sequencer | Gobernanza |
|------|-----------|-------------|-----------|------------|
| Bronze | 10K | 1.0x | No | No |
| Silver | 50K | 1.25x | No | Sí |
| Gold | 250K | 1.5x | **Sí** | Sí |
| Platinum | 1M | **2.0x** | **Sí** (prioridad) | Sí |

---

## FASE 4B: Wallet System & Security ✅ COMPLETADA
> **Objetivo:** Sistema de wallets non-custodial con Account Abstraction, multiSig empresarial, gasless B2B, seguridad avanzada
> **Estado:** ✅ COMPLETADA (2026-03-19)
> **Contratos creados (6):** SmartWallet.sol, SmartWalletFactory.sol, MultiSigWallet.sol, Paymaster.sol, SecurityModule.sol, WalletGuardian.sol
> **Tests:** 115 nuevos (33+21+18+27+16), todos pasando
> **API:** walletService.js + wallet.js routes (12 endpoints)
> **SDK:** 15 nuevos métodos wallet en bezhas-sdk.js
> **SKILL System:** 26 archivos de knowledge base en SKILL/

### 4B.1 — SmartWallet (Account Abstraction)
- Non-custodial: owner controla 100%, ni factory ni protocolo pueden intervenir
- execute/executeBatch para transacciones directas
- executeBySignature para meta-transacciones (gasless via EIP-712)
- Sessions: delegación temporal con expiración y límite de valor
- Social Recovery: 72h delay via guardians verificados
- Daily limits: configurable hasta 1M ETH
- Lock/Unlock instantáneo por owner

### 4B.2 — SmartWalletFactory (CREATE2)
- Deterministic addresses via CREATE2 con salt
- walletsByOwner tracking
- isBeZhasWallet registry
- Zero control retained over created wallets

### 4B.3 — MultiSigWallet (Enterprise)
- M-of-N firmas (2-20 signers)
- Roles: ADMIN/OPERATOR/VIEWER
- Auto-timelock 48h para operaciones > threshold
- Solo self-call puede cambiar signers/threshold
- Emergency pause

### 4B.4 — Paymaster (Gas Sponsorship B2B)
- Empresas depositan BEZ → usuarios ejecutan sin gas
- Whitelist de usuarios Y contratos destino
- Daily limits + max gas per tx
- RELAYER_ROLE para gas sponsorship
- Non-custodial: empresas retiran fondos libremente

### 4B.5 — SecurityModule (Central Hub)
- Global pause (guardian activa, solo owner desactiva)
- Contract-level pause granular
- Timelock operations (24h min → 30 days max, 14 days grace)
- Circuit breakers (threshold + window → auto-pause)
- Guardian management (M-of-N)
- Immutable on-chain audit log

### 4B.6 — WalletGuardian (Social Recovery)
- Guardian registry (designate/revoke)
- Trust scores (0-100, min 50 para verified)
- Bidirectional lookups (wallet→guardians, guardian→wallets)
- Recovery tracking por protocolo

### 4B.7 — SKILL Knowledge Base
- config/ (4): blockchain, contracts, infrastructure, security
- runbooks/ (4): deploy, monitor, incident-response, wallet-operations
- solutions/ (4): compilation-errors, test-failures, deployment-issues, runtime-errors
- patterns/ (3): solidity, api, testing
- cli/ (3): forge, docker, sdk-cli
- training/ (3): architecture, contracts-catalog, security-playbook
- feedback/ (3): log, metrics, improvements

---

## FASE 3: Fundación de Datos e Infraestructura Local ✅ COMPLETADA
> **Objetivo:** Desplegar contratos en nodo local y configurar persistencia
> **Estado:** ✅ COMPLETADA (2026-03-18)
> **Archivos creados:** DeployCore.s.sol, DeploySectors.s.sol, DeployAll.s.sol, parse-deployment.js, schema.sql, pool.js, migrate.js, seed.js, redis.js, .env.example

### 3A — Scripts de Deployment (Foundry)

Los **59 contratos** existen pero no hay scripts para desplegarlos. Sin contratos en blockchain, nada funciona.

| # | Tarea | Archivo | Prioridad |
|---|-------|---------|-----------|
| 3A.1 | Script de deploy para contratos **core** (BEZCoinV2, BeZhasLogisticsNFT, QualityEscrow, Bridge, Governance, Staking, Farming) | `smart-contracts/script/DeployCore.s.sol` | CRÍTICA |
| 3A.2 | Script de deploy para contratos **sectoriales** (genérico — recibe sector como param) | `smart-contracts/script/DeploySector.s.sol` | CRÍTICA |
| 3A.3 | Registro de addresses post-deploy (JSON con todas las direcciones) | `smart-contracts/script/addresses.json` | CRÍTICA |
| 3A.4 | Script maestro que despliega TODO en orden + asigna roles | `smart-contracts/script/DeployAll.s.sol` | ALTA |
| 3A.5 | Configuración de roles (MINTER_ROLE, BRIDGE_ROLE, etc.) post-deploy | Dentro de DeployAll | ALTA |

**Orden de deploy:**
```
1. BEZCoinV2 (token nativo — gas)
2. BeZhasLogisticsNFT (primer NFT)
3. QualityEscrow (necesita NFT address)
4. BeZhasBridgeL2 (necesita BEZ address)
5. GovernanceSystem, StakingPool, LiquidityFarming
6. Contratos sectoriales (health → otros) — cada grupo de 4
```

**Comando de ejecución:**
```bash
# Local (Anvil)
forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast

# Testnet (Sepolia L2)
forge script script/DeployAll.s.sol --rpc-url $SEPOLIA_RPC --private-key $DEPLOYER_KEY --broadcast --verify
```

### 3B — Base de Datos (PostgreSQL)

El `docker-compose.yml` ya tiene PostgreSQL pero **no existe schema**. La API importa Mongoose (MongoDB) pero no lo usa.

| # | Tarea | Archivo | Prioridad |
|---|-------|---------|-----------|
| 3B.1 | Schema SQL inicial: users, enterprises, transactions, audit_logs, gas_tanks | `api/db/schema.sql` | CRÍTICA |
| 3B.2 | Pool de conexión PostgreSQL (reemplazar mongoose por pg/knex) | `api/db/pool.js` | CRÍTICA |
| 3B.3 | Seed data: empresa demo "Global Logistics S.A.", admin user | `api/db/seed.sql` | ALTA |
| 3B.4 | Migrations runner (versionado de schema) | `api/db/migrate.js` | MEDIA |

**Schema propuesto:**
```sql
-- Core tables
enterprises (id, name, wallet, plan, gas_balance, created_at)
users (id, enterprise_id, wallet, role, email, jwt_refresh, created_at)
transactions (id, enterprise_id, tx_hash, contract, method, status, gas_used, block, created_at)
audit_logs (id, enterprise_id, action, actor, metadata, severity, created_at)

-- Sector-specific (expandible)
deployed_contracts (id, enterprise_id, sector, contract_name, address, chain_id, deployed_at)
gas_recharges (id, enterprise_id, amount_bez, amount_usd, tx_hash, created_at)
mcp_tool_calls (id, enterprise_id, tool_name, input, output, confidence, latency_ms, created_at)
```

### 3C — Redis Cache

| # | Tarea | Archivo | Prioridad |
|---|-------|---------|-----------|
| 3C.1 | Cliente Redis con retry/reconnect | `api/db/redis.js` | ALTA |
| 3C.2 | Cache para gas prices, contract ABIs, session tokens | Config en redis.js | ALTA |
| 3C.3 | BullMQ queues: tx_processing, notifications, ai_analysis | `api/queues/index.js` | MEDIA |

### 3D — Environment & Config

| # | Tarea | Archivo | Prioridad |
|---|-------|---------|-----------|
| 3D.1 | `.env.example` con todas las variables documentadas | Raíz del proyecto | ALTA |
| 3D.2 | Config centralizado que valide env vars al arranque | `api/config.js` | ALTA |
| 3D.3 | Actualizar docker-compose.yml con volúmenes para schema init | `docker-compose.yml` | MEDIA |

---

## FASE 4: Backend Real (API ↔ Blockchain ↔ DB) ✅ COMPLETADA
> **Objetivo:** Reemplazar TODOS los mocks con lógica real
> **Estado:** ✅ COMPLETADA (2026-03-18)
> **Archivos creados/reescritos:**
> - Servicios: contractService.js, txService.js, eventListener.js, gasMonitor.js, aegisService.js
> - Middleware: security.js (JWT auth, wallet verification, RBAC, rate limiting, audit)
> - Rutas (12): auth, users, nfts, analytics, contracts, transactions, gas, sectors, gamification, aegis, notifications, market
> - index.js reescrito como hub modular Express
> **Stack:** Express 4.22 + ethers 6.16 + PostgreSQL (pg) + Redis 4 + JWT
> **Verificación:** API arranca en puerto 3099, conecta Redis, inicializa GasMonitor y EventListener

### 4A — Capa de Blockchain (ethers v5 → contratos reales)

| # | Tarea | Detalle | Prioridad |
|---|-------|---------|-----------|
| 4A.1 | `contractService.js` — carga de ABIs y conexión a contratos desplegados | Lee `addresses.json` generado en Fase 3A | CRÍTICA |
| 4A.2 | `txService.js` — envío de transacciones con retry, nonce management, gas estimation | Patrón: estimate → sign → send → wait(1) → log | CRÍTICA |
| 4A.3 | `eventListener.js` — escucha de eventos on-chain (Transfer, Mint, Escrow, etc.) | WebSocket provider + fallback polling | ALTA |
| 4A.4 | Integrar gasMonitor.js con contratos reales (BEZCoinV2.transfer) | Reemplazar mock en `services/gasMonitor.js` | ALTA |
| 4A.5 | Integrar aegisService.js: mint NFT real + IPFS real (Pinata/Infura) | Reemplazar fake txHash + ipfs:// | ALTA |

### 4B — Rutas API Reales (reemplazar mocks)

| # | Ruta | Acción | Prioridad |
|---|------|--------|-----------|
| 4B.1 | `GET /api/user/profile/:address` | Query DB `users` + on-chain BEZ balance | CRÍTICA |
| 4B.2 | `PUT /api/user/profile` | UPDATE en DB `users` table | CRÍTICA |
| 4B.3 | `GET /api/nfts` | Query `deployed_contracts` + `totalSupply()` on-chain | ALTA |
| 4B.4 | `GET /api/nfts/:id` | `tokenURI(id)` on-chain + metadata | ALTA |
| 4B.5 | `GET /api/market/stats` | Aggregate de `transactions` table + on-chain TVL | ALTA |
| 4B.6 | `GET /api/analytics/platform` | Query `transactions`, `gas_recharges`, `mcp_tool_calls` | ALTA |
| 4B.7 | `GET /api/analytics/user/:address` | Portfolio: BEZ balance + staked + NFTs owned | ALTA |
| 4B.8 | `POST /api/upload/ipfs` | Integración real con Pinata/Infura IPFS gateway | MEDIA |
| 4B.9 | `POST /api/email/send` | Nodemailer con SMTP real (ya importado en package.json) | MEDIA |
| 4B.10 | `GET /api/gamification/*` | Query de puntos/leaderboard desde DB | BAJA |

### 4C — Nuevas Rutas Necesarias

| # | Ruta | Propósito |
|---|------|-----------|
| 4C.1 | `GET /api/contracts` | Lista de contratos desplegados por sector |
| 4C.2 | `GET /api/contracts/:sector` | Contratos + ABIs + addresses de un sector |
| 4C.3 | `POST /api/contracts/:sector/:contract/call` | Llamada genérica read a contrato (view functions) |
| 4C.4 | `POST /api/contracts/:sector/:contract/send` | Transacción write (requiere auth + role check) |
| 4C.5 | `GET /api/transactions` | Historial de transacciones de la enterprise |
| 4C.6 | `GET /api/gas/status` | Balance de gas tank + historial de recargas |
| 4C.7 | `GET /api/sectors` | Lista de sectores activos con métricas |

### 4D — Seguridad & Middleware

| # | Tarea | Detalle |
|---|-------|---------|
| 4D.1 | Validación de wallet ownership (message signing verification) | Asegurar que solo el dueño firma |
| 4D.2 | Role-based access: admin, operator, viewer por enterprise | Middleware JWT + DB lookup |
| 4D.3 | Rate limiting por enterprise (no global) | Redis-based, configurable por plan |
| 4D.4 | Audit logging automático en cada mutación | Middleware que inserta en `audit_logs` |

---

## FASE 5: Frontend Corporativo Multi-Página ✅ COMPLETADA
> **Objetivo:** Dashboard completo con rutas por sector y datos reales
> **Estado:** ✅ COMPLETADA (2026-03-19)
> **Archivos:** 13 rutas dashboard, SWR hooks, recharts, Sidebar/Header, AgentDataProvider

### 5A — Layout & Navegación

| # | Tarea | Detalle |
|---|-------|---------|
| 5A.1 | Sidebar con navegación por sector (16 sectores + core) | Layout compartido `app/dashboard/layout.tsx` |
| 5A.2 | Header con enterprise name, BEZ balance, notifications | Componente `Header.tsx` |
| 5A.3 | Auth flow: login con wallet + JWT | `app/login/page.tsx` + auth context |
| 5A.4 | Protected routes middleware | `middleware.ts` Next.js |

### 5B — Páginas Core

| # | Ruta | Contenido |
|---|------|-----------|
| 5B.1 | `/dashboard` | Overview: gas balance, txs recientes, status L2, sectores activos |
| 5B.2 | `/dashboard/transactions` | Tabla paginada de todas las transacciones |
| 5B.3 | `/dashboard/contracts` | Grid de contratos desplegados con status |
| 5B.4 | `/dashboard/gas` | Gas tank: balance, historial recargas, configurar auto-recharge |
| 5B.5 | `/dashboard/analytics` | Gráficas: volumen, usuarios, gas, revenue por sector |
| 5B.6 | `/dashboard/settings` | Enterprise config, API keys, webhooks, roles |

### 5C — Páginas por Sector

| # | Ruta | Contenido |
|---|------|-----------|
| 5C.1 | `/dashboard/sector/[slug]` | Página dinámica que carga el agente JSX correspondiente |
| 5C.2 | Integración de los 69 agentes existentes con datos reales | Reemplazar MOCK_DATA con fetch a API |
| 5C.3 | Acciones on-chain desde agentes (botones que llaman `POST /api/contracts/.../send`) | Forms con validación |

### 5D — Componentes Reutilizables

| # | Componente | Uso |
|---|------------|-----|
| 5D.1 | `<TransactionTable />` | Listado paginado de txs con filtros |
| 5D.2 | `<ContractCard />` | Card de contrato con address, balance, functions |
| 5D.3 | `<GasGauge />` | Indicador visual de gas tank |
| 5D.4 | `<SectorGrid />` | Grid de 16 sectores con status badge |
| 5D.5 | `<ChartWidget />` | Wrapper para charts (recharts o chart.js) |

---

## FASE 6: Motor de IA Aegis (Implementación Real) ✅ COMPLETADA
> **Objetivo:** Activar los módulos ML + decision engine
> **Estado:** ✅ COMPLETADA (2026-03-20)
> **Archivos:** 4 ML models, DecisionEngine, AutoHealer, Monitor, MCP tools, asyncpg

### 6A — Modelos ML

| # | Modelo | Función | Archivo |
|---|--------|---------|---------|
| 6A.1 | AnomalyDetector | Detectar telemetría fuera de rango (temp, ubicación, timing) | `aegis/models/anomaly_detector.py` |
| 6A.2 | SentimentAnalyzer | Análisis de feedback en disputes/reviews | `aegis/models/sentiment_analyzer.py` |
| 6A.3 | UXOptimizer | Sugerir optimizaciones de UI basadas en patrones de uso | `aegis/models/ux_optimizer.py` |
| 6A.4 | GasPredictor | Predicción de gas price para timing óptimo de txs | `aegis/models/gas_predictor.py` (nuevo) |

### 6B — Decision Engine

| # | Tarea | Detalle |
|---|-------|---------|
| 6B.1 | Implementar `core/decision_engine.py` | Evalúa eventos → ejecuta acciones o sugiere |
| 6B.2 | Implementar `core/auto_healer.py` | Reactiva nodos caídos, rebalancea gas tanks |
| 6B.3 | Implementar `core/monitor.py` | Watch de métricas L2: block time, gas usage, TPS |
| 6B.4 | Pipeline: Ingest → Detect → Decide → Act → Log | Flujo end-to-end documentado |

### 6C — Almacenamiento Aegis

| # | Tarea | Detalle |
|---|-------|---------|
| 6C.1 | Conectar `utils/database.py` a PostgreSQL real | Pool asyncpg |
| 6C.2 | Conectar `utils/redis_manager.py` a Redis real | Cache de modelos + pubsub de eventos |
| 6C.3 | Descomentar imports en `main.py` y activar startup | Lifespan con carga de modelos |

### 6D — AI Engine MCP (Node.js — respuestas reales)

| # | Tarea | Detalle |
|---|-------|---------|
| 6D.1 | `analyze_gas_strategy` con datos reales de la L2 | Query gas history del nodo |
| 6D.2 | `verify_regulatory_compliance` llamando a Aegis Python real | Proxy a `/aegis/v1/ingest/telemetry` |
| 6D.3 | `calculate_smart_swap` con liquidez real de pools | Query de StakingPool + LiquidityFarming |
| 6D.4 | Nuevos tools: `audit_contract`, `predict_demand`, `score_supplier` | Expandir la lista de 3 → 10+ tools reales |

---

## FASE 7: Integración End-to-End y Testing ✅ COMPLETADA
> **Objetivo:** Verificar que el flujo completo funciona
> **Estado:** ✅ COMPLETADA (2026-03-20)
> **Tests:** 72 unit/integration + 12 Playwright + k6 load (100 VUs, p95=11.2ms, 0% errors)

### 7A — Flujos E2E a validar

| # | Flujo | Pasos |
|---|-------|-------|
| 7A.1 | **Webhook → Mint** | ERP envía webhook → Edge Node → MCP compliance check → API → Mint NFT → DB log |
| 7A.2 | **Gas Auto-Recharge** | Monitor detecta balance bajo → cobra USD → transfiere BEZ → actualiza DB |
| 7A.3 | **Dashboard Live** | Frontend carga datos → API query DB + blockchain → muestra en tiempo real |
| 7A.4 | **AI Anomaly** | Telemetría anómala → Aegis detecta → alerta en dashboard → admin aprueba/rechaza |
| 7A.5 | **Sector Operation** | Usuario abre sector → ve contratos → ejecuta función → tx on-chain → evento → log |

### 7B — Test Suites

| # | Tipo | Herramienta | Alcance |
|---|------|-------------|---------|
| 7B.1 | Unit tests API | Jest | Cada ruta con mocks de DB/blockchain |
| 7B.2 | Unit tests Aegis | Pytest | Cada modelo ML + endpoints |
| 7B.3 | Integration tests | Supertest + Anvil | API ↔ contratos en nodo local |
| 7B.4 | E2E tests | Playwright | Frontend → API → Blockchain (happy path) |
| 7B.5 | Load tests | k6 / Artillery | 100 concurrent users, 1000 txs |

---

## FASE 8: DevOps & Producción ✅ COMPLETADA
> **Objetivo:** Deploy real de la L2 y todos los servicios
> **Estado:** ✅ COMPLETADA (2026-03-20)
> **CI/CD:** GitHub Actions 6 jobs, Docker multi-stage, Nginx WAF, Monitoring (Prometheus+Grafana+Loki)

### 8A — Deployment

| # | Tarea | Detalle |
|---|-------|---------|
| 8A.1 | Deploy contratos core en Sepolia L2 | forge script + verify en Blockscout |
| 8A.2 | CI/CD pipeline (GitHub Actions) | Build → Test → Deploy (contracts + services) |
| 8A.3 | Docker registry (push a DockerHub/ECR) | Tag por versión |
| 8A.4 | Kubernetes / Docker Swarm (producción) | Scaling horizontal de API + Aegis |
| 8A.5 | Monitoring: Grafana + Prometheus | Métricas de L2, API, gas, TPS |
| 8A.6 | Logging centralizado: ELK / Loki | Todos los servicios → dashboard de logs |

### 8B — Seguridad de Producción

| # | Tarea | Detalle |
|---|-------|---------|
| 8B.1 | Auditoría de smart contracts (Slither, Mythril) | Antes de mainnet |
| 8B.2 | Secrets management (HashiCorp Vault / AWS Secrets) | No más private keys en .env |
| 8B.3 | SSL/TLS en todos los endpoints | Nginx reverse proxy con Let's Encrypt |
| 8B.4 | WAF (Web Application Firewall) | Rate limiting avanzado + IP filtering |

---

---

## FASE 9: Blockchain Deployment ✅ COMPLETADA
> **Objetivo:** Deploy de 66+ contratos en Anvil local + live-chain tests
> **Estado:** ✅ COMPLETADA (2026-03-20)
> **Archivos:** scripts/verify-deployment.js, scripts/bootstrap-local.ps1, api/db/seed-contracts.js
> **Resultado:** 66 contratos desplegados en Anvil:31337, 31 live-chain tests passing, pipeline automatizado

---

## ═══════════════════════════════════════════════════════════════════
## FASES PENDIENTES — Lo que falta por desarrollar
## ═══════════════════════════════════════════════════════════════════

---

## FASE 11: Integración del Sistema de Validación con Stack Existente ✅ COMPLETADO
> **Objetivo:** Conectar los 7 contratos de validación con API, Frontend, Aegis AI y Edge Node
> **Dependencia:** Fase 10 (contratos listos y testeados)
> **Prioridad:** CRÍTICA — Sin esto, la validación solo existe en smart contracts

### 11A — API Backend: Endpoints de Validación ✅ COMPLETADO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 11A.1 | Servicio `validatorService.js` — lee ValidatorRegistry, EdgeNodeRewards, SequencerRotation on-chain | `api/services/validatorService.js` | ✅ |
| 11A.2 | Ruta `GET /api/validators` — lista de validadores activos con tier, stake, uptime | `api/routes/validators.js` | ✅ |
| 11A.3 | Ruta `GET /api/validators/:address` — info detallada de un validador | `api/routes/validators.js` | ✅ |
| 11A.4 | Ruta `POST /api/validators/register` — registro de validador (firma wallet + stake) | `api/routes/validators.js` | ✅ |
| 11A.5 | Ruta `POST /api/validators/heartbeat` — proxy de heartbeat desde Edge Node | `api/routes/validators.js` | ✅ |
| 11A.6 | Ruta `GET /api/validators/rewards/:address` — recompensas acumuladas + historial | `api/routes/validators.js` | ✅ |
| 11A.7 | Ruta `POST /api/validators/claim` — reclamar recompensas DePIN | `api/routes/validators.js` | ✅ |
| 11A.8 | Ruta `GET /api/sequencer/current` — sequencer activo, epoch, bloques restantes | `api/routes/validators.js` | ✅ |
| 11A.9 | Ruta `GET /api/slashing/:address` — historial de penalidades del validador | `api/routes/validators.js` | ✅ |
| 11A.10 | Ruta `GET /api/governance/proposals` — propuestas DAO activas | `api/routes/validators.js` | ✅ |
| 11A.11 | Tabla SQL `validators` (address, company_name, tier, stake, status, registered_at) | `api/db/migrations/003_validator_management.sql` | ✅ |
| 11A.12 | Tabla SQL `validator_rewards` (id, address, points, amount_bez, claimed_at) | `api/db/migrations/003_validator_management.sql` | ✅ |
| 11A.13 | Tabla SQL `slash_events` (id, address, type, amount, evidence, appealed, reversed) | `api/db/migrations/003_validator_management.sql` | ✅ |

### 11B — Frontend: Dashboard de Validadores ✅ COMPLETADO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 11B.1 | Página `/dashboard/validators` — tabla de todos los validadores con tier badge, stake, uptime | `app/dashboard/validators/page.tsx` | ✅ |
| 11B.2 | Página `/dashboard/validators/[address]` — detalle de validador con gráficas de contribución, historial | `app/dashboard/validators/[address]/page.tsx` | ✅ |
| 11B.3 | Página `/dashboard/validators/register` — formulario para registrarse como validador (connect wallet + approve + register) | `app/dashboard/validators/register/page.tsx` | ✅ |
| 11B.4 | Página `/dashboard/sequencer` — estado del sequencer actual, cola, historial de epochs | `app/dashboard/sequencer/page.tsx` | ✅ |
| 11B.5 | Widget en `/dashboard` — card con info de tu nodo validador (tier, stake, recompensas pending) | `app/dashboard/page.tsx` | ✅ |
| 11B.6 | Componente `<ValidatorTierBadge />` — badge visual Bronze/Silver/Gold/Platinum | `components/ValidatorTierBadge.tsx` | ✅ |
| 11B.7 | Componente `<RewardsChart />` — gráfica de recompensas ganadas por día/semana | Integrado en `[address]/page.tsx` | ✅ |
| 11B.8 | Hook `useValidator(address)` — SWR hook para datos del validador desde API | `lib/hooks.ts` | ✅ |
| 11B.9 | Hook `useSequencer()` — SWR hook para datos del sequencer actual | `lib/hooks.ts` | ✅ |

### 11C — Edge Node: Integración con Validación ✅ COMPLETADO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 11C.1 | Agregar heartbeat automático en `server.js` (intervalo 3h) | `bezhas-edge-node/server.js` | ✅ |
| 11C.2 | Endpoint `POST /webhook/generic` — acepta datos de cualquier sector (no solo logistics) | `bezhas-edge-node/server.js` | ✅ |
| 11C.3 | Integrar `auto-signer.js` con EdgeNodeRewards (registrar puntos después de cada validación) | `bezhas-edge-node/auto-signer.js` | ✅ |
| 11C.4 | Endpoint `GET /validator/status` — info local del nodo (tier, stake, rewards pending, uptime) | `bezhas-edge-node/server.js` | ✅ |
| 11C.5 | Health check mejorado: incluir heartbeat status, last validation timestamp | `bezhas-edge-node/server.js` | ✅ |
| 11C.6 | Logging estructurado de validaciones (JSON, rotación de logs) | `bezhas-edge-node/logger.js` | ✅ |

### 11D — Aegis AI: Monitoreo de Validadores ✅ COMPLETADO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 11D.1 | Modelo `ValidatorMonitor` — detectar downtime, anomalías de heartbeat | `aegis/models/validator_monitor.py` | ✅ |
| 11D.2 | AutoHealer: reactivar alertas si validador pierde heartbeat | `aegis/core/auto_healer.py` | ✅ |
| 11D.3 | MCP tool `monitor-validator` — status y métricas de un validador | `ai-engine/server.js` | ✅ |
| 11D.4 | MCP tool `slash-check` — verificar si un validador merece penalidad | `ai-engine/server.js` | ✅ |
| 11D.5 | Integrar SlashingManager con Aegis: `AEGIS_AI_ROLE` para `slashForFraudulentData()` automático | `aegis/core/decision_engine.py` | ✅ |
| 11D.6 | Dashboard de Aegis: panel de salud de validadores en Grafana | `monitoring/grafana/dashboards/bezhas-validators.json` | ✅ |

---

## FASE 12: SDK de Validación y Onboarding B2B ✅ COMPLETADA
> **Objetivo:** Facilitar que empresas se registren como validadoras con SDK y documentación
> **Dependencia:** Fase 11 (API endpoints listos)
> **Prioridad:** ALTA

### 12A — SDK JavaScript ✅ COMPLETADO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 12A.1 | Clase `ValidatorClient` — register, addStake, heartbeat, claimRewards, getInfo, sequencer, slashing, governance | `sdk/modules/ValidatorClient.js` | ✅ |
| 12A.2 | Governance integrado en ValidatorClient (castVote, getProposalState, getProposalVotes) | `sdk/modules/ValidatorClient.js` | ✅ |
| 12A.3 | ABIs de contratos de validación en `sdk/artifacts/contracts/` | ValidatorRegistry, EdgeNodeRewards, SequencerRotation, SlashingManager, GovernanceSystem, TimelockController | ✅ |
| 12A.4 | Exportar ValidatorClient desde `sdk/index.js` | `sdk/index.js` | ✅ |
| 12A.5 | Script CLI `register-validator.js` | `scripts/register-validator.js` | ✅ |
| 12A.6 | Script CLI `validator-status.js` | `scripts/validator-status.js` | ✅ |
| 12A.7 | Forge script `DeployValidation.s.sol` (standalone) | `smart-contracts/script/DeployValidation.s.sol` | ✅ |
| 12A.8 | Parse script `parse-deployment-validation.js` (merge addresses) | `smart-contracts/script/parse-deployment-validation.js` | ✅ |
| 12A.9 | Deploy automation `deploy-validation.ps1` | `scripts/deploy-validation.ps1` | ✅ |
| 12A.10 | Event listeners: SlashingManager + GovernanceSystem events | `api/services/eventListener.js` | ✅ |
| 12A.11 | Bootstrap updated with validation deploy step | `scripts/bootstrap-local.ps1` | ✅ |

### 12B — Onboarding Flow ✅ COMPLETADO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 12B.1 | Página `/onboarding` — wizard 5 pasos con stepper, progreso, navegación | `app/onboarding/page.tsx` | ✅ |
| 12B.2 | Paso 1: Crear wallet empresarial (SmartWalletFactory) — company name, guardian, daily limit | `app/onboarding/steps/Step1Wallet.tsx` | ✅ |
| 12B.3 | Paso 2: Adquirir BEZ (bridge L1→L2 o faucet testnet) — balance display, tier reference | `app/onboarding/steps/Step2BezTokens.tsx` | ✅ |
| 12B.4 | Paso 3: Registrar como validador — tier selection, stake amount, CLI fallback | `app/onboarding/steps/Step3Validator.tsx` | ✅ |
| 12B.5 | Paso 4: Instalar Edge Node — Docker/npm commands, health check, requisitos hw | `app/onboarding/steps/Step4EdgeNode.tsx` | ✅ |
| 12B.6 | Paso 5: Configurar ERP webhook — 6 ERP types, 16 sectors, test webhook, payload example | `app/onboarding/steps/Step5ErpWebhook.tsx` | ✅ |
| 12B.7 | Email/notificación cuando el nodo empieza a validar | API notification service | 🔲 (Fase 13) |

### 12C — Templates de Integración ERP ✅ COMPLETADO

| # | Template | Archivo | Estado |
|---|---------|---------|--------|
| 12C.1 | SAP S/4HANA — ABAP webhook class + BAdI examples | `docs/erp-templates/sap-webhook.md` | ✅ |
| 12C.2 | Oracle NetSuite — SuiteScript 2.x UserEvent + RESTlet | `docs/erp-templates/oracle-webhook.md` | ✅ |
| 12C.3 | Shopify — Webhook nativo + adapter middleware Node.js | `docs/erp-templates/shopify-webhook.md` | ✅ |
| 12C.4 | Generic HTTP — curl, Python, PHP, Go examples | `docs/erp-templates/generic-webhook.md` | ✅ |

---

## FASE 13: Testnet Deployment ✅ COMPLETADA
> **Objetivo:** Deploy de todos los contratos en Sepolia L2 real (no Anvil local)
> **Dependencia:** Fase 12 completada + auditoría de contratos
> **Prioridad:** ALTA

### 13A — Pre-Deploy ✅ COMPLETADO

| # | Tarea | Detalle | Estado |
|---|-------|---------|--------|
| 13A.1 | Auditoría Slither de los 7 contratos de validación | `scripts/security-audit.sh` | ✅ |
| 13A.2 | Auditoría Mythril (symbolic execution) | `scripts/mythril-audit.sh` | ✅ |
| 13A.3 | Gas optimization review + contract sizes | `scripts/gas-report.sh` (gas-report, snapshot, sizes) | ✅ |
| 13A.4 | Fuzz testing con Foundry: invariant tests para ValidatorRegistry, SlashingManager | `test/invariant/ValidatorRegistryInvariant.t.sol`, `test/invariant/SlashingManagerInvariant.t.sol` | ✅ |

### 13B — Deploy Testnet ✅ COMPLETADO (tooling ready, pending actual deploy)

| # | Tarea | Detalle | Estado |
|---|-------|---------|--------|
| 13B.1 | Deploy contratos core + validación en Sepolia L2 | `smart-contracts/script/DeployAll.s.sol` + `.env.testnet` template | ✅ |
| 13B.2 | Verificar contratos en Blockscout explorer | `--verify` flag en forge script | ✅ |
| 13B.3 | Registrar 3-5 validadores de prueba (diferentes tiers) | `scripts/seed-validators.js` (Bronze/Silver/Gold/Platinum/Bronze) | ✅ |
| 13B.4 | Simular epoch completo de sequencer rotation | `scripts/simulate-sequencer-epoch.js` | ✅ |
| 13B.5 | Simular slashing + appeal + reversal | `scripts/simulate-slashing.js` | ✅ |
| 13B.6 | Publicar deployment addresses en `deployments/{chainId}.json` | `scripts/publish-deployment.js` | ✅ |

### 13C — Testnet Monitoring ✅ COMPLETADO

| # | Tarea | Detalle | Estado |
|---|-------|---------|--------|
| 13C.1 | Prometheus scrape targets: Edge Node, geth, op-node | `monitoring/prometheus.yml` (3 new jobs + rule_files + alerting) | ✅ |
| 13C.2 | Dashboard Grafana: validadores activos, stake total, epochs, slashes | `monitoring/grafana/dashboards/bezhas-validators.json` (13 panels) | ✅ |
| 13C.3 | Alertas: validador inactivo >2h, slash ejecutado, sequencer fallo | `monitoring/alert-rules.yml` + `monitoring/alertmanager.yml` + docker service | ✅ |

---

## FASE 14: Mainnet & Producción 🔲 PENDIENTE (FUTURO)
> **Objetivo:** Launch de la L2 BeZhas en producción con empresas reales
> **Dependencia:** Fase 13 completada + 30 días sin incidentes en testnet
> **Prioridad:** FUTURA

### 14A — Seguridad Pre-Mainnet

| # | Tarea | Detalle |
|---|-------|---------|
| 14A.1 | Auditoría externa de smart contracts (CertiK / OpenZeppelin / Trail of Bits) |
| 14A.2 | Bug bounty program (Immunefi o similar) |
| 14A.3 | Secrets management: migrar de .env a HashiCorp Vault / AWS Secrets Manager |
| 14A.4 | HSM (Hardware Security Module) para claves de admin/deployer |
| 14A.5 | Multi-sig para admin roles: DEFAULT_ADMIN_ROLE controlado por MultiSigWallet |

### 14B — Mainnet Deploy

| # | Tarea | Detalle |
|---|-------|---------|
| 14B.1 | Deploy L2 en mainnet (OP Stack fork con L1=Ethereum mainnet) |
| 14B.2 | Deploy de 78+ contratos con verification on Blockscout |
| 14B.3 | Configurar bridge L1↔L2 con BeZhasBridgeL2 |
| 14B.4 | Primer validador (BeZhas oficial) como Platinum anchor |
| 14B.5 | Onboarding de 5-10 empresas piloto como validadores |

### 14C — Operaciones

| # | Tarea | Detalle |
|---|-------|---------|
| 14C.1 | SLA interno: 99.9% uptime del sequencer |
| 14C.2 | Runbook de incidentes: qué hacer si sequencer falla, si hay doble firma, etc. |
| 14C.3 | Plan de upgrade: proceso para actualizar contratos (proxy pattern o governance) |
| 14C.4 | Token economics: modelo de distribución de BEZ para ecosistema |
| 14C.5 | Documentación legal: términos para validadores, compliance regulatorio |

---

## FASE 15: Expansión del Ecosistema 🔲 PENDIENTE (FUTURO)
> **Objetivo:** Funcionalidades avanzadas post-launch
> **Dependencia:** Fase 14 (mainnet estable)

### 15A — Cross-Chain & Interoperabilidad

| # | Tarea | Detalle |
|---|-------|---------|
| 15A.1 | Bridge a múltiples L1s (Polygon, Arbitrum, BSC) |
| 15A.2 | Interoperabilidad con otros L2 (Layerzero / Hyperlane) |
| 15A.3 | Oracle integration (Chainlink / Pyth) para datos de precios y clima |

### 15B — Validador Marketplace

| # | Tarea | Detalle |
|---|-------|---------|
| 15B.1 | Delegated staking: empresas pueden delegar stake a validadores profesionales |
| 15B.2 | Validator rating system: scoring público basado en uptime, contribuciones, slashes |
| 15B.3 | Liquid staking token (stBEZ): representación líquida del stake |

### 15C — IA Avanzada

| # | Tarea | Detalle |
|---|-------|---------|
| 15C.1 | Aegis AI auto-slash: detección completamente autónoma de fraude sin intervención humana |
| 15C.2 | Predictive validator scoring: ML que predice qué validadores tendrán downtime |
| 15C.3 | AI-powered governance: sugerencias automáticas de propuestas basadas en métricas de red |

---

## Orden de Ejecución Recomendado (Fases Pendientes)

```
PRÓXIMA PRIORIDAD:
  FASE 11A → API endpoints de validación (validatorService, rutas, tablas SQL)
  FASE 11C → Edge Node heartbeat automático + webhook genérico

SIGUIENTE:
  FASE 11B → Frontend: páginas de validadores, register wizard, dashboard widgets
  FASE 11D → Aegis AI: monitoreo de validadores, integración AEGIS_AI_ROLE

DESPUÉS:
  FASE 12A → SDK ValidatorClient + GovernanceClient
  FASE 12B → ✅ Onboarding wizard 5 pasos (wallet, BEZ, validator, edge node, ERP)
  FASE 12C → Templates ERP (SAP, Oracle, Shopify)

PRE-PRODUCCIÓN:
  FASE 13A → Auditoría de seguridad (Slither, Mythril, fuzz tests)
  FASE 13B → Deploy en Sepolia L2 testnet
  FASE 13C → Monitoring de validadores en testnet

FUTURO:
  FASE 14  → Mainnet launch con empresas piloto
  FASE 15  → Cross-chain, delegated staking, IA avanzada
```

---

## Métricas de Éxito por Fase

| Fase | Criterio de Completado |
|------|----------------------|
| 3 ✅ | `forge script DeployAll` despliega contratos en Anvil local + DB tiene schema + Redis responde |
| 4 ✅ | 0 rutas con mock data. Todas leen de DB/blockchain. `GET /api/health` reporta "fully_operational" |
| 4B ✅ | 6 contratos wallet desplegados, 115 tests passing, SDK con 15 métodos wallet |
| 5 ✅ | 13 páginas en frontend. Login funcional. Los 16 sectores accesibles con datos reales |
| 6 ✅ | Aegis detecta anomalía en telemetría < 2s. MCP tools usan datos on-chain |
| 7 ✅ | 5 flujos E2E passing. >80% coverage. Load test 100 concurrent |
| 8 ✅ | CI/CD green. Docker multi-stage. Nginx WAF. Monitoring Prometheus+Grafana |
| 9 ✅ | 66 contratos en Anvil:31337, 31 live-chain tests passing |
| 10 ✅ | 7 contratos de validación, 89 test passing, docs/VALIDATION_SYSTEM.md |
| 11 🔲 | API 10+ rutas validación, frontend dashboard, Edge Node heartbeat auto |
| 12 🔲 | SDK ValidatorClient, onboarding wizard, templates ERP |
| 13 🔲 | Contratos verificados en Blockscout testnet. 5 validadores de prueba |
| 14 🔲 | L2 mainnet. Bridge activo. 5+ empresas validando |
| 15 🔲 | Cross-chain. Liquid staking. AI auto-governance |

---

## Primera Acción Inmediata

**Empezar por FASE 11A.1** — `validatorService.js`

Es el servicio que conecta los contratos de validación (ya compilados y testeados) con el API backend. Sin este servicio, el frontend no puede mostrar datos de validadores, y las empresas no pueden registrarse ni reclamar recompensas desde la interfaz web.

```javascript
// api/services/validatorService.js
// Lee: ValidatorRegistry, EdgeNodeRewards, SequencerRotation, SlashingManager on-chain
// Expone: getValidators(), getValidatorInfo(), getRewards(), getSequencerStatus()
// Cachea: Redis para queries frecuentes (tier, stake, uptime)
```
