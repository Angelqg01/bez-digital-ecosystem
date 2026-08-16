# BeZhas Blockchain: AI Agent Context Guide
> [!IMPORTANT]
> **PROJECT STANDARD: PNPM v11+**. NEVER use `npm` or `yarn`.
> All `package-lock.json` files have been removed. Use `pnpm` exclusively.


Welcome, AI Developer Agent. This is the ROOT-LEVEL context file for the BeZhas Blockchain monorepo.
Read this FIRST before making any changes. It is the single source of truth for navigating the codebase.

---

## 1. Project Mission

BeZhas is a multi-sector Enterprise Web3 platform built on a sovereign L2 (OP Stack fork).
- **Native Gas Token:** BEZCoinV2 (ERC-20 with ERC20Permit for gasless meta-transactions)
- **AI Compliance Layer:** Aegis (Python FastAPI) + MCP Servers (Node.js)
- **Corporate Dashboard:** Next.js 14 Web2.5 UI hiding blockchain complexity
- **Target:** B2B enterprises across 16 industry sectors
- **Chain ID:** 2708 (local Anvil) / Sepolia L2 (testnet)

---

## 2. Logical Workflow — How the System Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENTRY POINTS (External)                          │
│  Telegram Bot ─┐  ERP Webhook ─┐  Frontend ─┐  SDK/API Client ─┐  │
└────────────────┼───────────────┼────────────┼──────────────────┼──┘
                 ▼               ▼            ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LAYER 1: SECURITY (AEGIS)                              │
│  index.js → AEGISSecurityManager                                    │
│  ├─ Rate Limiting (Redis sorted sets, 20/min per user)              │
│  ├─ Authorization (ADMIN/OPERATOR/VIEWER/BOT roles)                 │
│  ├─ Audit Logging (Redis list, last 10K entries)                    │
│  └─ Pass/Reject decision                                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LAYER 2: ORCHESTRATION                                 │
│  core/OpenClawOrchestrator.js                                       │
│  ├─ Intent Classification (LLM-powered)                             │
│  ├─ Agent Routing (orchestration-manifest.json)                     │
│  ├─ Model Selection (core/ModelRouter.js)                           │
│  │   └─ Fallback: Claude → Gemini → GPT-4o → DeepSeek → LLaMA     │
│  ├─ Memory (core/RedisMemoryManager.js)                             │
│  └─ Human-in-Loop (core/HumanInLoopManager.js)                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LAYER 3: AGENT RUNTIME                                 │
│  agent-lib/                                                     │
│  ├─ Agents: Security, Compliance, Tokenomics, Trading, Workflow     │
│  ├─ Tools: blockchain-validator, gas-analytics, bridge-health, etc. │
│  ├─ Core: ToolRegistry, PermissionEngine, CircuitBreaker            │
│  ├─ Channels: Telegram, Discord, WhatsApp adapters                  │
│  └─ 23 test suites (Jest)                                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LAYER 4: API BACKEND                                   │
│  api/ (Express :3001)                                               │
│  ├─ 35 route files (auth, wallet, blockchain, energy, gateway...)   │
│  ├─ 19 service modules (contract, tx, event, gas, validator...)     │
│  ├─ Middleware: security.js, metrics.js, gateway-auth.js            │
│  ├─ Database: PostgreSQL (schema, migrations, seeds)                │
│  ├─ Cache: Redis                                                    │
│  └─ Jest test suites in __tests__/                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LAYER 5: SMART CONTRACTS                               │
│  smart-contracts/ (Foundry project)                                 │
│  ├─ src/core/     — BEZCoinV2, QualityEscrow, Bridge, Governance,   │
│  │                  Staking, Farming, ValidatorRegistry,             │
│  │                  EdgeNodeRewards, SequencerRotation, Slashing     │
│  ├─ src/wallet/   — SmartWallet, Factory, MultiSig, Paymaster,      │
│  │                  SecurityModule, WalletGuardian                   │
│  ├─ src/{sector}/ — 16 sectors × 4 contracts each                   │
│  ├─ test/         — 1,020+ tests (mirrors src/ structure)           │
│  ├─ script/       — DeployCore, DeploySectors, DeployAll            │
│  └─ deployments/  — Chain addresses (31337.json, 137.json)          │
│                                                                      │
│  BUILD: forge build --sizes                                          │
│  TEST:  forge test -vvv                                              │
│  NOTE:  forge path = C:\Users\yoela\.foundry\bin\forge.exe           │
└─────────────────────────────────────────────────────────────────────┘
```

### Boot Sequence (Order of Startup)

```
1. Redis          — Cache, queues, session store
2. PostgreSQL     — Persistent data
3. Aegis (Python) — AI brain, ML models (:8001)
4. AI Engine      — MCP Server, proxies to Aegis (:3002)
5. API            — Express backend (:3001)
6. Edge Node      — B2B webhook listener (:4000)
7. index.js       — AEGIS Security + Orchestrator + Telegram bots
8. Frontend       — Next.js control center (:3000)
```

### Data Flow: Webhook → Blockchain

```
ERP sends webhook → Edge Node (:4000)
  → MCP compliance check (AI Engine)
  → API validates & signs tx
  → Smart Contract executes on L2
  → Event emitted → EventListener captures
  → DB updated → WebSocket pushes to Frontend
  → Audit log in Redis (AEGIS)
```

---

## 3. Repository Map (Where Everything Lives)

```
BeZhas-Blockchain/                     ← MONOREPO ROOT
│
│── CONTEXT & CONFIG ──
├── AI_CONTEXT.md                      ← THIS FILE (read first)
├── CLAUDE.md                          ← Supplementary context (commercial, fiscal)
├── index.js                           ← Bootstrap: AEGIS + Orchestrator + Bots
├── package.json                       ← Root dependencies (ESM)
├── deploy-config.json                 ← Genesis config (Chain ID 2708)
├── .env / .env.example                ← Environment variables
│
│── CORE MODULES (imported by index.js) ──
├── core/                              ← Runtime modules
│   ├── OpenClawOrchestrator.js        ← Multi-LLM orchestrator
│   ├── ModelRouter.js                 ← LLM fallback chain
│   ├── RedisMemoryManager.js          ← Conversation memory
│   ├── HumanInLoopManager.js          ← Approval workflows
│   ├── OllamaProvider.js              ← Local LLM gateway
│   ├── AgentToolRegistry.js           ← Tool definitions
│   ├── telegram.js                    ← Telegram bot client
│   ├── tools.js                       ← MCP tool definitions
│   └── ollama-status.js               ← Ollama health check
│
│── DOCKER ORCHESTRATION ──
├── docker-compose.yml                 ← Base: 11 services
├── docker-compose.dev.yml             ← Dev override
├── docker-compose.prod.yml            ← Prod: Nginx + limits
│
│── SERVICES ──
├── api/                               ← WEB2 BACKEND (Express :3001)
│   ├── routes/ (35 files)             ← REST endpoints
│   ├── services/ (19 files)           ← Business logic
│   ├── middleware/                     ← Security, metrics
│   ├── db/                            ← PostgreSQL (schema, migrations)
│   └── __tests__/                     ← Jest tests
│
├── aegis/                             ← AI BRAIN (FastAPI :8001)
│   ├── core/                          ← DecisionEngine, AutoHealer, Monitor
│   ├── models/                        ← 5 ML models
│   └── routers/                       ← API routes
│
├── ai-engine/                         ← MCP SERVER (Node.js :3002)
│   └── server.js                      ← 12 AI tools
│
├── agent-lib/                     ← AGENT SYSTEM
│   ├── agents/ (5)                    ← Security, Compliance, Tokenomics, Trading, Workflow
│   ├── tools/ (10)                    ← Blockchain, gas, bridge, sector tools
│   ├── core/ (14)                     ← UnifiedAgent, ToolRegistry, Permissions, CircuitBreaker
│   ├── channels/                      ← Telegram, Discord, WhatsApp adapters
│   └── tests/ (23)                    ← Jest test suites
│
├── bezhas-edge-node/                  ← B2B RELAY (Node.js :4000)
├── control-center/frontend/           ← ADMIN DASHBOARD (Next.js 14 :3000)
│
│── BLOCKCHAIN & CONTRACTS ──
├── smart-contracts/                   ← FOUNDRY PROJECT (78+ contracts)
│   ├── src/                           ← Source (core/, wallet/, 16 sectors)
│   ├── test/                          ← Mirrors src/ (1,020+ tests)
│   ├── script/                        ← Deploy scripts (Solidity)
│   └── deployments/                   ← Chain addresses
│
├── sdk/                               ← @bezhas/sdk v3.0.0
│   ├── contracts.js                   ← Multi-chain contract registry
│   ├── modules/                       ← Sector-specific SDK modules
│   └── dist/                          ← Webpack bundle
│
│── AI KNOWLEDGE & SKILLS ──
├── SKILL/                             ← AI KNOWLEDGE BASE
│   ├── config/                        ← Blockchain, contracts, infra, security
│   ├── runbooks/                      ← Deploy, monitor, incident, wallet ops
│   ├── solutions/                     ← Error fixes by category
│   ├── patterns/                      ← Solidity, API, testing patterns
│   └── feedback/                      ← Session log, metrics, improvements
│
├── openclaw/                          ← @bezhas/openclaw-unified v2.0.0
├── openclaw-skills/                   ← Commercial skills (SDR, growth, deals)
│
│── ORCHESTRATION ──
├── orchestration/
│   ├── orchestration-manifest.json    ← Department routing, KPIs, approval policies
│   └── README.md
│
│── INFRASTRUCTURE ──
├── nginx/                             ← Reverse proxy (TLS, WAF, rate limit)
├── monitoring/                        ← Prometheus + Grafana + Loki
├── scripts/                           ← 50+ operational scripts
├── .github/workflows/                 ← CI/CD (6 jobs)
│
│── DOCUMENTATION ──
├── docs/
│   ├── developer/                     ← Dev plans, structure, status, tech stack
│   ├── developer-portal/              ← SDK docs, API ref, whitepaper
│   ├── security/                      ← Security playbooks
│   └── landing/                       ← Marketing page
├── plans/                             ← 16 integration plans & roadmaps
└── status/                            ← 5 workflow status snapshots
```

---

## 4. Expansion Status (16/16 Sectors COMPLETE)

| # | Sector | Agents | Contracts | Tests | Status |
|---|--------|--------|-----------|-------|--------|
| 1 | Logistica | 6 | 5 (core+tokens) | 7 | Done |
| 2 | Bienes Raices | 4 | 4 | — | Done |
| 3 | Salud | 4 | 4 | 33 | Done |
| 4 | Energia | 4 | 4 | 34 | Done |
| 5 | Automotriz | 4 | 4 | 37 | Done |
| 6 | Manufactura | 4 | 4 | 39 | Done |
| 7 | Agricultura | 4 | 4 | 40 | Done |
| 8 | Seguros | 4 | 4 | 45 | Done |
| 9 | Educacion | 4 | 4 | 43 | Done |
| 10 | Entretenimiento | 4 | 4 | 56 | Done |
| 11 | Legal | 4 | 4 | 58 | Done |
| 12 | Supply Chain | 4 | 4 | 69 | Done |
| 13 | Gobierno | 4 | 4 | 65 | Done |
| 14 | Finanzas | 4 | 4 | ~64 | Done |
| 15 | Servicios | 4 | 4 | ~80 | Done |
| 16 | Otros | 4 | 4 | 72 | Done |

**Totals:** 73+ agents JSX | 78+ contracts | 1,020+ tests | 381+ MCP tools

### Wallet System
| Contract | Tests | Description |
|----------|-------|-------------|
| SmartWallet + Factory | 33 | Non-custodial AA wallet (Account Abstraction) |
| MultiSigWallet | 21 | M-of-N enterprise multi-sig |
| Paymaster | 18 | Gas sponsorship for B2B |
| SecurityModule | 27 | Central security hub |
| WalletGuardian | 16 | Guardian registry for social recovery |
| **Total** | **115** | **All passing** |

---

## 5. Infrastructure & Docker

| Service | Port | Role |
|---------|------|------|
| postgres | 5432 | Database |
| redis | 6379 | Cache & queues |
| ai-gateway | 3002 | MCP Server (ai-engine) |
| bezhas-geth | 8545 | OP Stack execution node |
| bezhas-node | 5052 | OP Stack consensus node |
| bezhas-batcher | — | L2 transaction batcher |
| api | 3001 | Web2 backend proxy |
| aegis | 8001 | AI brain (FastAPI) |
| bezhas-edge-node | 4000 | B2B webhook → L2 signer |
| control-center | 3000 | Corporate dashboard |

---

## 6. Key Patterns for AI Automation

### 6.1 Build & Test Commands

```bash
# Foundry (NOT Hardhat — project migrated to Foundry)
cd smart-contracts
C:\Users\yoela\.foundry\bin\forge.exe build --sizes
C:\Users\yoela\.foundry\bin\forge.exe test -vvv

# API tests
cd api && pnpm test

# Agent Runtime tests
cd agent-lib && pnpm test

# PowerShell exit code 1 is EXPECTED (nightly Solc warning on stderr)
# Check for "Compiler run successful" or "tests passed" in output text
```

### 6.2 Adding a New Sector (Standard Pattern)

Each new sector requires exactly **4 deliverables**:

1. **4 JSX Agent UIs** in `modules/agents-ui/`
2. **4 Solidity Contracts** in `smart-contracts/src/{sector}/`
3. **4 Foundry Test Suites** in `smart-contracts/test/{sector}/`
4. **Constants Update** in `bezhas-agents-constants.js`

### 6.3 Naming Conventions

| Asset | Pattern | Example |
|-------|---------|---------|
| Agent JSX | `{shortname}-agent.jsx` | `coursetoken-agent.jsx` |
| Contract | `PascalCase.sol` | `CourseTokenNFT.sol` |
| Test | `PascalCaseTest.t.sol` | `CourseTokenNFTTest.t.sol` |
| Import prefix | `"openzeppelin-contracts/contracts/..."` | — |

### 6.4 Struct Field Limit
Keep Solidity structs ≤ 12 fields to avoid "Stack too deep" errors.

---

## 7. AI Development Rules

1. **Never break the Web2.5 illusion** — Corporate users never see Metamask or hex strings
2. **AI First** — All supply chain events pass through MCP compliance check before contracts
3. **Gas Optimization** — L2 gas is BEZCoin; optimize for OP Stack calldata compression
4. **Read docs/ before architectural changes** — 55+ design documents define the theoretical mechanics
5. **Test everything** — Every contract must have a Foundry test suite before merging
6. **Security** — Never commit API keys, private keys, seeds. JWT always in-memory only
7. **Imports from core/** — Root JS modules live in `core/`, imported by `index.js` via `./core/`

---

## 8. Departments & Orchestration

The system uses `orchestration/orchestration-manifest.json` to route events to agents:

| Department | Agent ID | Runtime Agent | Priority |
|-----------|----------|---------------|----------|
| Director | director-agent | workflow-agent | Critical |
| Tokenomics | tokenomics-agent | tokenomics-agent | High |
| Growth | marketing-agent | workflow-agent | Medium |
| Solutions | solutions-engineer-agent | workflow-agent | Medium |
| Blockchain | blockchain-agent | workflow-agent | High |
| DevOps | devops-agent | workflow-agent | High |
| Legal | legal-agent | compliance-agent | Critical |
| Finance | finance-agent | workflow-agent | High |
| Skills | skill-optimizer-agent | workflow-agent | Medium |

### Approval Policy
These actions require human approval: `deploy_contract`, `upgrade_contract`, `bridge_tokens`, `treasury_transfer`, `create_payment`, `send_outreach`, `legal_commitment`, `publish_skill_change`.

---

*Last updated: May 2026*
*Maintainer: Yoel (BeZhas founder)*
*Version: 2.0 — Unified Workflow Context*
