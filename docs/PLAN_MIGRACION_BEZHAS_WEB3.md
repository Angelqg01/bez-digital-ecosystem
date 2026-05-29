# Plan de Migración: BeZhas Web3 → Compatibilidad con BeZhas Blockchain Core

**Fecha:** 2026-04-04  
**Objetivo:** Alinear el stack tecnológico de `bezhas-web3` con el stack del Core Blockchain para máxima compatibilidad, reutilización de código y mantenibilidad unificada.

---

## 1. Inventario Comparativo de Tecnologías

| Componente | BeZhas Web3 (Actual) | BeZhas Blockchain Core (Referencia) | ¿Requiere Cambio? |
|---|---|---|---|
| **Smart Contracts — Framework** | Hardhat 3.1.10 | Foundry (forge) | ✅ SÍ — CRÍTICO |
| **Smart Contracts — Solidity** | ^0.8.24 | ^0.8.20 / ^0.8.24 / 0.8.34 | ⚠️ MENOR — unificar a 0.8.24 |
| **Smart Contracts — OZ** | @openzeppelin/contracts ^5.4.0 | OpenZeppelin v5 (lib/) | ✅ SÍ — cambiar de npm a git submodule |
| **Frontend — Framework** | Vite 5 + React 18 (SPA) | Next.js 16.2.1 + React 18 (SSR/App Router) | ✅ SÍ — CRÍTICO |
| **Frontend — Lenguaje** | JavaScript (.jsx) | TypeScript (.tsx) | ✅ SÍ — CRÍTICO |
| **Frontend — CSS** | Tailwind CSS 3 | Tailwind CSS 3 | ✅ Compatible |
| **Frontend — State** | Zustand + React Query | SWR + React hooks | ⚠️ EVALUAR — Zustand es aceptable |
| **Frontend — Web3** | wagmi + viem + WalletConnect | ethers.js 6.16 directo | ⚠️ EVALUAR |
| **Backend — Framework** | Express 4.22 (JS) | Express 4.18 (JS) | ✅ Compatible |
| **Backend — DB** | MongoDB (Mongoose) + Prisma | PostgreSQL (pg) + Redis | ✅ SÍ — CRÍTICO |
| **Backend — Auth** | JWT + speakeasy + WebAuthn | JWT + bcrypt + SIWE + nonce | ⚠️ PARCIAL |
| **Backend — AI Providers** | OpenAI + Anthropic + Google AI | Aegis (FastAPI/Python) proxy | ⚠️ EVALUAR |
| **Mobile** | React Native 0.72 (JS, ethers v5) | No existe en Core | ⚠️ ACTUALIZAR ethers a v6 |
| **SDK** | JS (bezhas-sdk, MCP) | JS (ES Modules, multi-chain) | ✅ SÍ — unificar con @bezhas/sdk v3 |
| **AI/ML Service (Aegis)** | Python + FastAPI | Python + FastAPI | ✅ Compatible |
| **Tests — Contracts** | Hardhat test (Mocha/Ethers) | Foundry test (forge test, Solidity) | ✅ SÍ — CRÍTICO |
| **Tests — Backend** | Jest | Jest | ✅ Compatible |
| **Tests — Frontend** | Vitest | Playwright E2E | ⚠️ AÑADIR Playwright |
| **Package Manager** | pnpm (root), npm (backend) | npm (todo) | ⚠️ MENOR — estandarizar npm |

---

## 2. Cambios CRÍTICOS (Prioridad Alta)

### 2.1 Smart Contracts: Hardhat → Foundry

**Impacto: ALTO** — Afecta compilación, testing, deploy, y CI/CD.

| Paso | Acción | Detalle |
|---|---|---|
| 2.1.1 | Crear estructura Foundry | `foundry.toml`, `src/`, `test/`, `script/`, `lib/` |
| 2.1.2 | Migrar contratos | Mover `contracts/*.sol` → `src/` |
| 2.1.3 | Instalar OZ como submodule | `forge install OpenZeppelin/openzeppelin-contracts` |
| 2.1.4 | Remapear imports | `@openzeppelin/contracts/` → `lib/openzeppelin-contracts/contracts/` |
| 2.1.5 | Reescribir tests en Solidity | Cada test JS → test Solidity con forge-std `Test` |
| 2.1.6 | Convertir scripts de deploy | JS/Hardhat → Solidity Scripts (`script/*.s.sol`) + parse JS |
| 2.1.7 | Actualizar CI/CD | GitHub Actions: `forge build`, `forge test`, `forge script` |
| 2.1.8 | Eliminar Hardhat | Remover `hardhat.config.js`, `@nomicfoundation/*`, `hardhat` deps |

**Configuración foundry.toml recomendada (alineada con Core):**
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
via_ir = true
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
localhost = "http://127.0.0.1:8545"
polygon = "${POLYGON_RPC_URL}"
amoy = "${AMOY_RPC_URL}"
```

### 2.2 Frontend: Vite + React (JSX) → Next.js + React (TSX)

**Impacto: ALTO** — Reescritura completa del frontend.

| Paso | Acción | Detalle |
|---|---|---|
| 2.2.1 | Crear proyecto Next.js 16 | `npx create-next-app@latest` con TypeScript, App Router, Tailwind |
| 2.2.2 | Migrar rutas | `pages/*.jsx` (React Router) → `app/*/page.tsx` (Next.js App Router) |
| 2.2.3 | Convertir JSX → TSX | Renombrar archivos, añadir tipos, interfaces, Props |
| 2.2.4 | Migrar components | `src/components/*.jsx` → `components/*.tsx` con tipos |
| 2.2.5 | Migrar hooks | `src/hooks/*.js` → `hooks/*.ts` o `lib/*.ts` |
| 2.2.6 | Migrar stores/context | Zustand stores → mantener (compatible) pero en TypeScript |
| 2.2.7 | Adaptar servicios | `src/services/*.js` → `lib/*.ts` con tipos de retorno |
| 2.2.8 | Config Tailwind | `postcss.config.js` (NO .mjs), `tailwind.config.cjs` |
| 2.2.9 | Config Next.js | `next.config.mjs` (NO .ts — Next.js 16 lo requiere) |
| 2.2.10 | Integrar SDK | Usar `@bezhas/sdk` v3 (link npm o junction) |
| 2.2.11 | Wagmi/viem → ethers.js 6 | Evaluar: wagmi es válido para dApps. Si se mantiene, tiparlo en TS |
| 2.2.12 | Añadir E2E tests | Playwright (proyecto separado como en Core) |

**Nota sobre wagmi/viem:** El Core usa ethers.js directamente porque es un panel de control. Para una dApp social con conexión de wallets, wagmi/viem es técnicamente superior. **Decisión recomendada:** mantener wagmi/viem en Web3 frontend pero tipar todo en TypeScript y compartir tipos con el SDK.

### 2.3 Base de Datos: MongoDB → PostgreSQL

**Impacto: ALTO** — Requiere reescritura completa de la capa de datos.

| Paso | Acción | Detalle |
|---|---|---|
| 2.3.1 | Diseñar schema SQL | Convertir modelos Mongoose → tablas PostgreSQL |
| 2.3.2 | Crear migraciones | `db/migrations/*.sql` (patrón del Core) |
| 2.3.3 | Reescribir modelos | Mongoose models → funciones pg con `pool.query()` |
| 2.3.4 | Migrar Prisma → pg | Eliminar Prisma, usar pg directamente (como el Core) |
| 2.3.5 | Migrar datos | Script de exportación MongoDB → importación PostgreSQL |
| 2.3.6 | Adaptar servicios | Cada `*.service.js` que usa Mongoose → pg queries |
| 2.3.7 | Añadir Redis cache | Usar patrón `api/cache/redis.js` del Core |
| 2.3.8 | Docker compose | PostgreSQL + Redis containers (copiar patrón Core) |

### 2.4 SDK: Unificar con @bezhas/sdk v3

| Paso | Acción | Detalle |
|---|---|---|
| 2.4.1 | Eliminar SDK local | Remover `sdk/` propio de Web3 |
| 2.4.2 | Usar @bezhas/sdk v3 | npm link o junction desde Blockchain Core SDK |
| 2.4.3 | Adaptar contract-addresses | Usar `sdk/contracts.js` multi-chain del Core |
| 2.4.4 | Migrar módulos custom | Cualquier módulo no existente en SDK v3 → contribuir al SDK central |

---

## 3. Cambios MODERADOS (Prioridad Media)

### 3.1 Mobile: Actualizar ethers v5 → v6

| Paso | Acción |
|---|---|
| 3.1.1 | Actualizar `ethers` de ^5.7.2 → ^6.16.0 |
| 3.1.2 | Adaptar API: `ethers.providers.*` → `ethers.*Provider` |
| 3.1.3 | BigNumber → BigInt nativo |
| 3.1.4 | `Contract` API changes (interface → abi) |

### 3.2 Auth: Añadir SIWE (Sign-In With Ethereum)

| Paso | Acción |
|---|---|
| 3.2.1 | Instalar `siwe` en backend |
| 3.2.2 | Endpoint `/auth/siwe/nonce` + `/auth/siwe/verify` |
| 3.2.3 | Mantener OAuth/WebAuthn como métodos adicionales |

### 3.3 Package Manager: Estandarizar npm

| Paso | Acción |
|---|---|
| 3.3.1 | Reemplazar `pnpm` por `npm` en todos los scripts |
| 3.3.2 | Eliminar `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc` (pnpm-specific) |
| 3.3.3 | Generar `package-lock.json` en cada sub-proyecto |

---

## 4. Cambios MENORES / Compatibles

| Componente | Estado | Acción |
|---|---|---|
| Backend Express 4 | ✅ Compatible | Solo actualizar a 4.22+ |
| Tailwind CSS 3 | ✅ Compatible | Mantener |
| Aegis (Python/FastAPI) | ✅ Compatible | Ya alineado |
| Jest (backend tests) | ✅ Compatible | Mantener |
| Docker setup | ⚠️ Adaptar | Alinear con patrón Core (compose dev/prod) |
| CI/CD | ⚠️ Adaptar | Alinear workflows con Core (.github/workflows/) |
| Monitoring | ⚠️ Añadir | Prometheus (prom-client), Grafana (copiar de Core) |

---

## 5. Orden de Ejecución (Fases)

### FASE 1: Fundaciones (Smart Contracts + SDK)
1. Migrar Hardhat → Foundry (2.1)
2. Unificar SDK (2.4)
3. Estandarizar package manager a npm (3.3)

### FASE 2: Backend (Base de Datos + Auth)
4. MongoDB → PostgreSQL (2.3)
5. Añadir SIWE auth (3.2)
6. Alinear Docker compose con Core

### FASE 3: Frontend (Reescritura)
7. Crear nuevo frontend Next.js 16 + TypeScript (2.2)
8. Migrar componentes JSX → TSX
9. Integrar con SDK v3 y nueva DB

### FASE 3.5: DeFi / Tokenomics Integration (NUEVO — Abril 2026)

> **Fuente:** Análisis de `bezhas-defi/` + `TOKENOMICS_FINANCIAL_IMPACT_REPORT.md` + contratos core

#### 3.5.1 Tokenomics Reforma — Parámetros On-Chain Actualizados

Los siguientes cambios están implementados en los contratos del Core y deben ser reflejados en el frontend:

| Contrato | Parámetro | Valor Anterior | Valor Actual |
|----------|-----------|---------------|--------------|
| StakingPool | rewardRate | 100 BEZ/s | **0.05 BEZ/s** |
| StakingPool | DAILY_EMISSION_CAP | ∞ | **50,000 BEZ** |
| StakingPool | MAX_REWARD_RATE | 1000 BEZ/s | **1 BEZ/s** |
| LiquidityFarming | bezPerBlock | 100 BEZ | **0.5 BEZ** |
| LiquidityFarming | DAILY_EMISSION_CAP | ∞ | **25,000 BEZ** |
| LiquidityFarming | MAX_BEZ_PER_BLOCK | ∞ | **5 BEZ** |
| EdgeNodeRewards | rewardPerPoint | 1 BEZ | **0.0075 BEZ** |
| BeZhasPayment | platformFeeBps | 10 (0.1%) | **250 (2.5%)** |
| BEZPolygonBridge | bridgeFeeRate | 10 (0.1%) | **50 (0.5%)** |
| BEZPolygonBridge | minimumFee | 0 | **10 BEZ** |
| FreelanceMarketplace | platformFeeBps | 0 | **750 (7.5%)** |
| MicroLendingPool | originationFeeBps | 0 | **100 (1%)** |
| InvoiceFactoring | platformFeeBps | 0 | **100 (1%)** |

**Impacto económico:** Déficit diario −$1.3M → Ingreso neto +$1.7K/día

#### 3.5.2 Páginas DeFi — Frontend Next.js (Estado: ✅ IMPLEMENTADO)

| # | Ruta | Archivo | Estado | Descripción |
|---|------|---------|--------|-------------|
| 1 | `/tokenomics` | `app/tokenomics/page.tsx` | ✅ Creado | Dashboard central: supply, distribución, emisiones, fees, validadores |
| 2 | `/staking` | `app/staking/page.tsx` | ✅ Creado | Stake/Unstake BEZ + validator tier boosts + emission cap tracking |
| 3 | `/farming` | `app/farming/page.tsx` | ✅ Creado | Yield farming con LP pools + time-lock multipliers (7d→3x) |
| 4 | `/dao` | `app/dao/page.tsx` | ✅ Creado | Governance: propuestas, votación 3-way, parámetros GovernanceSystem |
| 5 | `/bridge` | `app/bridge/page.tsx` | ✅ Creado | Cross-chain bridge BEZ↔wBEZ, fee calculator (0.5% + 10 BEZ min), step tracker |
| 6 | `/treasury` | `app/treasury/page.tsx` | ✅ Creado | TreasuryVault multi-sig, fund allocation, withdrawal requests, activity feed |

#### 3.5.3 Validator Tier System (ValidatorRegistry.sol)

Frontend implementa visualización de los 4 tiers:

| Tier | Stake Mínimo | Reward Boost | Beneficios |
|------|-------------|-------------|------------|
| Bronze | 10,000 BEZ | 1x | Edge Node rewards base |
| Silver | 50,000 BEZ | 1.25x | + DAO voting + tx priority |
| Gold | 250,000 BEZ | 1.5x | + Sequencer candidate |
| Platinum | 1,000,000 BEZ | 2x | + Active sequencer + council |

#### 3.5.4 Navegación DeFi (Estado: ✅ IMPLEMENTADO)

- Navbar: Link "DeFi" → `/tokenomics` (gradient amber/orange)
- User Dropdown: Links directos a Staking, Farming, DAO Governance, Bridge, Treasury

#### 3.5.5 Contratos Integrados (Estado: ✅ IMPLEMENTADO)

| Contrato | ABI | Archivo Frontend | Estado |
|----------|-----|-------------------|--------|
| BEZCoinV2 | balanceOf, totalSupply, MAX_SUPPLY, getVotes, delegate, approve | `lib/contracts.ts` | ✅ |
| StakingPool | stake, withdraw, claimReward, totalStaked, rewardRate, DAILY_EMISSION_CAP | `lib/contracts.ts` | ✅ |
| LiquidityFarming | deposit, withdraw, pendingBez, poolInfo, userInfo | `lib/contracts.ts` | ✅ |
| ValidatorRegistry | validators, getRewardBoost, registerValidator | `lib/contracts.ts` | ✅ |
| TreasuryVault | getVaultBalance, getDailyRemaining, requestWithdrawal, approveWithdrawal | `lib/contracts.ts` | ✅ |
| BeZhasPayment | platformFeeBps, accruedFees, processPayment | `lib/contracts.ts` | ✅ |
| WrappedBEZ (wBEZ) | bridgeMint, bridgeBurn, burnForBridge | Página Bridge ✅ |
| QualityEscrow / EdgeNodeRewards | submitProof, claimRewards, activeNodesCount | Página Edge Node ✅ |

### FASE 4: Mobile + QA
10. Actualizar ethers v5 → v6 en mobile (3.1)
11. Añadir Playwright E2E
12. Alinear CI/CD y monitoring

---

## 6. Archivos a Eliminar Post-Migración

```
hardhat.config.js
hardhat.admin.config.js  
hardhat.escrow.config.js
truffle-config.js
pnpm-lock.yaml (todas las copias)
pnpm-workspace.yaml
frontend/vite.config.js
frontend/vitest.config.js
frontend/.eslintrc.cjs (reemplazar por eslint.config.js)
sdk/ (reemplazar por @bezhas/sdk v3)
artifacts/ (Hardhat → Foundry usa out/)
artifacts-admin/
contracts_temp/
*.deployment.json (root level — mover a smart-contracts/deployments/)
```

---

## 7. Resumen de Impacto

| Área | Archivos Afectados (est.) | Complejidad |
|---|---|---|
| Smart Contracts (Hardhat→Foundry) | ~50 contratos + ~30 tests + scripts | Alta |
| Frontend (Vite/JSX→Next.js/TSX) | ~100+ componentes, páginas, hooks | Muy Alta |
| Backend DB (Mongo→PostgreSQL) | ~80 servicios + modelos + routes | Alta |
| SDK Unificación | ~15 archivos | Baja |
| Mobile (ethers v5→v6) | ~10-15 archivos | Media |
| Config/DevOps | ~20 archivos | Baja |

**Total estimado: ~300+ archivos a modificar/reescribir.**
