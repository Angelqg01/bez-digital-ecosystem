---
name: Platform Management
description: How to manage the BeZhas platform — CLI commands, architecture, and common operations
---

# Platform Management SKILL

## Arquitectura BeZhas

```
BeZhas-Hub/
├── frontend/          ← React app (Vite)
├── backend/           ← Express.js API server
│   ├── routes/        ← API endpoints
│   ├── services/      ← Business logic (68 services)
│   ├── models/        ← MongoDB models (Prisma + Mongoose)
│   ├── bridge/        ← Universal Bridge (adapters for third-party platforms)
│   ├── tests/         ← Jest tests (36 test files)
│   └── utils/         ← Helpers, logger, etc.
├── contracts/         ← Solidity smart contracts
├── sdk/               ← BeZhas SDK for developers
├── aegis/             ← AEGIS AI monitoring system (Python/FastAPI)
└── _agents/           ← AI SKILL system (este folder)
```

## CLI Commands Internos

### Backend
```bash
# Iniciar servidor desarrollo
cd backend && npm run dev

# Correr tests
npx jest tests/ --no-cache

# Correr test específico
npx jest tests/payment-system.test.js --verbose

# Verificar linting
npx eslint routes/ services/ --fix
```

### Blockchain
```bash
# Compilar contratos
npx hardhat compile

# Deploy a testnet
npx hardhat run scripts/deploy.js --network amoy

# Verificar contrato
npx hardhat verify --network amoy <CONTRACT_ADDRESS>
```

### GCP Deployment
```bash
# Build y deploy
gcloud builds submit --tag gcr.io/<PROJECT_ID>/bezhas-backend
gcloud run deploy bezhas-backend --image gcr.io/<PROJECT_ID>/bezhas-backend --region europe-west1

# Ver logs
gcloud run logs read --service bezhas-backend --limit 50
```

## Puertos y URLs
| Servicio | Dev | Prod |
|---|---|---|
| Backend API | localhost:3001 | api.bez.digital |
| Frontend | localhost:5173 | bez.digital |
| WebSocket | localhost:3002 | ws.bez.digital:3002 |
| AEGIS | localhost:8000 | aegis.bez.digital |

## Variables de Entorno Críticas
- `HOT_WALLET_PRIVATE_KEY` — Wallet para dispensar BEZ tokens
- `MONGODB_URI` — Base de datos
- `STRIPE_SECRET_KEY` — Pagos Stripe
- `POLYGON_RPC_URL` — Nodo Polygon
- `REDIS_URL` — Cache y BullMQ queues
- `OPENCLAW_API_KEY` — Agente OpenCLaw
- `AEGIS_API_KEY` — Sistema AEGIS

## Problemas Comunes

### DEADLINE_EXCEEDED en GCP
**Causa**: Server tarda >10s en arrancar
**Solución**: Mover carga pesada de rutas a `server.listen()` callback (lazy loading)
**Ref**: Conversación `61bb351c` — Optimizing Backend Startup

### Redis/BullMQ limits exceeded
**Causa**: Upstash free tier agotado
**Solución**: `DISABLE_BULLMQ=true` en variables de entorno
**Ref**: Conversación `c3347188` — Fixing Cloud Run Deployment
