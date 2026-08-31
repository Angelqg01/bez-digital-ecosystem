# BeZhas Ecosystem v3.0 — Development Guide

## Quick Start

```bash
# 1. Install dependencies
cd "App-nativas"
pnpm install

# 2. Build shared packages first
pnpm build:sdk

# 3. Start infrastructure (Postgres + Redis + Gateway)
pnpm docker:up

# 4. Start all apps in parallel
pnpm dev:all
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND APPS                        │
│                                                         │
│  :3000 Hub  :3010 Wallet  :3011 Gas  :3012 Nodes       │
│  :3013 Vision  :3014 Capital  :3015 Customs             │
│                                                         │
│  All import from: @bezhas/platform-sdk                  │
│                   @bezhas/ui-components                  │
│                   @bezhas/contracts                      │
├─────────────────────────────────────────────────────────┤
│                  API GATEWAY :3001                       │
│                                                         │
│  /api/auth     SIWE + JWT + DID                        │
│  /api/gas      Gas Tank + Aegis ML                     │
│  /api/vision   Gemini Vision + SIFT                    │
│  /api/wallet   Balance + NFTs + Staking                │
│  /api/nodes    DePIN registration + rewards            │
│  /api/contracts Read/Write proxy + Paymaster           │
│  /api/mcp      12 AI tools (JSON-RPC)                  │
│  /api/health   System status                           │
├─────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE                         │
│                                                         │
│  PostgreSQL :5432    Redis :6379    BeZhas L2 :8545     │
│  Aegis AI :8000      Ollama :11434                     │
└─────────────────────────────────────────────────────────┘
```

## Individual App Commands

```bash
pnpm dev:wallet    # BEZ Wallet on :3010
pnpm dev:gas       # Gas Tank Manager on :3011
pnpm dev:nodes     # Edge Node Manager on :3012
pnpm dev:vision    # BEZ Vision Scan on :3013
pnpm dev:hub       # Bezhas Hub on :3000
pnpm gateway:dev   # API Gateway on :3001 (Node --watch)
```

## Docker Commands

```bash
pnpm docker:up     # Start Postgres + Redis + Gateway
pnpm docker:down   # Stop all containers
pnpm docker:logs   # Follow container logs
```

## API Gateway Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Full system status |
| `/api/auth/nonce` | GET | Generate SIWE nonce |
| `/api/auth/verify` | POST | Verify signature, get JWT |
| `/api/auth/me` | GET | Current user from JWT |
| `/api/gas/balance` | GET | Gas tank balance |
| `/api/gas/recharge` | POST | Stripe recharge |
| `/api/gas/predict` | GET | Aegis ML gas prediction |
| `/api/gas/usage` | GET | Usage analytics |
| `/api/vision/analyze` | POST | Gemini Vision analysis |
| `/api/vision/fingerprint` | POST | SIFT fingerprint |
| `/api/wallet/balance/:addr` | GET | BEZ + ETH balance |
| `/api/wallet/nfts/:addr` | GET | RWA NFTs owned |
| `/api/nodes/network` | GET | Global network stats |
| `/api/nodes/register` | POST | Register new node |
| `/api/contracts/read` | POST | Contract read call |
| `/api/contracts/write` | POST | Contract write (Paymaster) |
| `/api/mcp/tools` | GET | List 12 AI tools |
| `/api/mcp/invoke` | POST | Invoke MCP tool |

## Environment Variables

All apps read from `.env.shared` in the monorepo root:

```env
RPC_URL=http://localhost:8545
CHAIN_ID=2708
BEZ_TOKEN_ADDRESS=0x...
GEMINI_API_KEY=your-key
AEGIS_BASE_URL=http://localhost:8000
JWT_SECRET=change-me
```

## Shared Packages

| Package | Import | Description |
|---------|--------|-------------|
| `@bezhas/platform-sdk` | `from '@bezhas/platform-sdk'` | Auth, Gas, Vision, MCP, Wallet hooks |
| `@bezhas/ui-components` | `from '@bezhas/ui-components'` | AppSwitcher, GasIndicator, badges |
| `@bezhas/contracts` | `from '@bezhas/contracts'` | Typed ABIs for 9 contracts |
| `@bezhas/api-gateway` | Server-side only | Express API for all apps |
