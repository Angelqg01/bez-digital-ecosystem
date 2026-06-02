# Infrastructure Configuration
> Docker services, ports, and dependencies

## Docker Services (docker-compose.yml)
| Service | Image | Port | Depends On |
|---|---|---|---|
| postgres | postgres:16 | 5432 | — |
| redis | redis:7-alpine | 6379 | — |
| bezhas-geth | custom op-geth | 8545, 8546 | — |
| bezhas-node | custom op-node | 5052 | bezhas-geth |
| bezhas-batcher | custom op-batcher | — | bezhas-node |
| api | node:20-alpine | 3001 | postgres, redis |
| aegis | python:3.11-slim | 8001 | postgres, redis |
| ai-gateway | node:20-alpine | 3002 | aegis |
| bezhas-edge-node | node:20-alpine | 4000 | api |
| control-center | node:20-alpine | 3000 | api |

## Environment Variables
```bash
# API
PORT=3001
BEZHAS_L2_RPC_URL=http://bezhas-geth:8545
BEZHAS_CHAIN_ID=2708
DEPLOYER_PRIVATE_KEY=<NEVER_COMMIT>
JWT_SECRET=<GENERATE_STRONG>
DATABASE_URL=postgres://bezhas:password@postgres:5432/bezhas
REDIS_URL=redis://redis:6379

# Aegis
AEGIS_PORT=8001
AEGIS_DB_URL=postgres://bezhas:password@postgres:5432/bezhas

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=2708
```

## Build Commands
| Component | Command |
|---|---|
| Smart Contracts | `cd smart-contracts && forge build` |
| API | `cd api && npm install && npm start` |
| Frontend | `cd control-center/frontend && pnpm install && pnpm build` |
| Docker Full | `docker compose up --build` |
| Tests | `cd smart-contracts && forge test` |

## Health Checks
- API: `GET /api/health`
- Aegis: `GET /health`
- Geth: `POST :8545` (JSON-RPC `eth_blockNumber`)
