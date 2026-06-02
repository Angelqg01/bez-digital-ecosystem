# BeZhas — Mapa Completo de la Estructura del Proyecto

> Este archivo describe TODA la estructura del proyecto para que la IA
> y las automatizaciones puedan navegar eficientemente.

## 🏗️ Arquitectura de Alto Nivel

```
BeZhas-Hub/
│
├── 🧠 _agents/                  ← SISTEMA IA (SKILLs + Workflows)
│   ├── skills/                   ← 8 categorías de aprendizaje IA
│   │   ├── SKILL_INDEX.md        ← Índice maestro
│   │   ├── platform-management/  ← Gestión plataforma, CLI, env vars
│   │   ├── payment-system/       ← BEZ-Pay, Stripe, Bank, OpenCLaw
│   │   ├── blockchain-contracts/ ← Contratos, ABIs, deployment
│   │   ├── bridge-adapters/      ← Adapters terceros (Vinted, Amazon...)
│   │   ├── ai-aegis/             ← AEGIS + OpenCLaw config
│   │   ├── deployment/           ← GCP Cloud Run
│   │   ├── testing/              ← 36 test files
│   │   ├── feedback-loop/        ← Error log + Optimization log
│   │   └── training-corpus/      ← Índice 158+ MDs categorizados
│   └── workflows/                ← 4 workflows automatizados
│       ├── deploy.md             ← /deploy
│       ├── test-payment.md       ← /test-payment
│       ├── add-adapter.md        ← /add-adapter
│       └── troubleshoot.md       ← /troubleshoot
│
├── 🖥️ frontend/                 ← React App (Vite)
│   ├── src/
│   │   ├── components/           ← UI components
│   │   ├── pages/                ← Route pages
│   │   └── hooks/                ← Custom hooks (useBezPayTransaction, etc.)
│   └── public/
│
├── ⚙️ backend/                   ← Express.js API Server
│   ├── routes/                   ← 20+ route files
│   │   ├── payment.routes.js     ← Hybrid payment (Stripe+BEZ+Bank)
│   │   ├── bezpay.routes.js      ← BEZ-Pay endpoints
│   │   ├── openclaw.routes.js    ← OpenCLaw Agent API ← NUEVO
│   │   ├── subscription.routes.js
│   │   ├── developerConsole.routes.js
│   │   └── ...
│   ├── services/                 ← 68 services
│   │   ├── bezpay.service.js     ← Core payment (Hot Wallet, VIP, Farming)
│   │   ├── payment-openclaw-bridge.js ← OpenCLaw+AEGIS bridge ← NUEVO
│   │   ├── stripe.service.js     ← Stripe integration
│   │   ├── fiat-gateway.service.js ← SEPA/Bank transfers
│   │   ├── unified-ai.service.js ← Multi-LLM gateway
│   │   ├── automation/           ← 3 automation services
│   │   └── ...
│   ├── models/                   ← MongoDB models
│   ├── bridge/                   ← Universal Bridge
│   │   ├── index.js              ← Core event-driven bridge
│   │   ├── adapters/             ← 3 adapters (Vinted, Airbnb, Maersk)
│   │   ├── routes/               ← Bridge API routes
│   │   └── webhooks/             ← Webhook receivers
│   ├── tests/                    ← 36 Jest test files
│   └── prisma/                   ← Prisma schema
│
├── 📜 contracts/                 ← Solidity Smart Contracts
│   ├── BezCoin.sol               ← ERC20 token
│   ├── QualityEscrow.sol         ← Quality guarantees
│   ├── StakingPool.sol           ← Single-sided staking
│   ├── LiquidityFarming.sol      ← Farming with lock multipliers
│   └── GovernanceSystem.sol      ← DAO governance
│
├── 📦 sdk/                       ← BeZhas SDK for Developers
│   ├── index.js                  ← SDK entry point
│   ├── api-client.js             ← API client
│   ├── contracts.js              ← ABI references
│   └── examples/                 ← Integration examples
│
├── 🛡️ aegis/                    ← AEGIS AI Monitoring (Python/FastAPI)
│   └── CONTROL_API_README.md
│
├── 🏷️ artifacts/                ← Compiled contract ABIs (98 JSON files)
│
├── 📋 backup_docs_20260114_071707/ ← 158 markdown docs (historical)
│
├── 🔧 scripts/                   ← PowerShell/Node.js scripts
│   ├── check.ps1                 ← System health check
│   ├── quick-start.ps1           ← Quick start
│   └── deploy-*.js               ← Deployment scripts
│
├── 🐳 Docker & GCP              ← Container configs
│   ├── docker-compose.yml
│   ├── docker-compose.production.yml
│   ├── cloudbuild.yaml
│   └── cloudbuild-backend.yaml
│
└── 📄 Archivos Clave Raíz
    ├── README.md
    ├── START_HERE.md
    ├── bezhas-pay-system.jsx      ← Frontend payment component (1406 líneas)
    ├── BEZHAS_API_KEYS_ABIS_WEBHOOKS.txt ← 16 sector API keys
    ├── BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt ← 12 platform keys
    ├── hardhat.config.js
    └── package.json
```

## 🔄 Flujo de Automatizaciones

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUJO DE PAGOS AUTOMATIZADO                 │
│                                                                  │
│  Cliente → Compra/Suscribe                                       │
│     │                                                            │
│     ▼                                                            │
│  bezpay.service.js → processPayment() / handleWebhook()         │
│     │                                                            │
│     ▼                                                            │
│  payment-openclaw-bridge.js → onPaymentCompleted()              │
│     │                                                            │
│     ├──→ AegisValidator.validateTransaction()                    │
│     │                                                            │
│     ├──→ OpenClawAgent.provisionClient() [si es suscripción]    │
│     │                                                            │
│     └──→ deliverWebhook() → Sub-App del cliente                 │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     FLUJO DE BRIDGE AUTOMÁTICO                   │
│                                                                  │
│  Plataforma Tercera (Vinted/Amazon/etc.)                        │
│     │                                                            │
│     ▼                                                            │
│  webhooks.routes.js → recibe evento                              │
│     │                                                            │
│     ▼                                                            │
│  bridge/index.js → PlatformAdapter.handleWebhook()              │
│     │                                                            │
│     ▼                                                            │
│  Sincronizar datos ↔ MongoDB                                    │
│     │                                                            │
│     ▼                                                            │
│  Notificar al cliente via webhook BeZhas                        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     FLUJO DE LA IA                                │
│                                                                  │
│  Nuevo problema/tarea detectado                                  │
│     │                                                            │
│     ▼                                                            │
│  _agents/skills/SKILL_INDEX.md → Buscar SKILL relevante         │
│     │                                                            │
│     ▼                                                            │
│  SKILL.md del área → Leer instrucciones                         │
│     │                                                            │
│     ▼                                                            │
│  feedback-loop/error-log.md → ¿Error conocido?                  │
│     │                                                            │
│     ├──→ SÍ → Aplicar solución documentada                      │
│     │                                                            │
│     └──→ NO → Investigar, resolver, registrar en error-log      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     SERVICIOS DE AUTOMATIZACIÓN                   │
│                                                                  │
│  diagnosticAgent.service.js                                      │
│     → Monitoreo automático del sistema                           │
│     → Detección de fallos                                        │
│     → Alertas proactivas                                         │
│                                                                  │
│  rewardSystem.service.js                                         │
│     → Distribución automática de recompensas                    │
│     → Cálculo de multiplicadores farming                        │
│                                                                  │
│  thirdPartyAnalyzer.service.js                                   │
│     → Análisis de plataformas terceras                           │
│     → Detección de oportunidades de integración                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔌 Puertos y URLs

| Servicio | Desarrollo | Producción |
|---|---|---|
| Backend API | `localhost:3001` | `api.bez.digital` |
| Frontend | `localhost:5173` | `bez.digital` |
| WebSocket | `localhost:3002` | `ws.bez.digital:3002` |
| AEGIS | `localhost:8000` | `aegis.bez.digital` |

## 📊 Métricas del Proyecto

| Métrica | Valor |
|---|---|
| Services backend | 68 |
| Route files | 20+ |
| Test files | 36 |
| Smart contracts | 5 |
| Bridge adapters | 3 (+ 9 pendientes) |
| SKILLs | 8 categorías |
| Workflows | 4 |
| Training docs | 158+ |
| API keys generadas | 32 (16 sectores + 16 terceros) |
