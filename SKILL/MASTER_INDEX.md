# MASTER INDEX — BeZhas SKILL System
> Índice maestro de conocimiento. Punto de entrada para la IA.
> Última actualización: 2026-03-30

## ⚡ REGLA UNIVERSAL — LEER SIEMPRE
> **Toda modificación en BeZhas Blockchain se propaga automáticamente a todos los proyectos sincronizados.**
> Ver → [SKILL/UNIVERSAL_SYNC.md](UNIVERSAL_SYNC.md) para el protocolo completo de sincronización.

## Resumen del Ecosistema

| Componente | Tecnología | Puerto | Estado |
|---|---|---|---|
| L2 Blockchain | OP Stack (op-geth) | 8545 | Configurado |
| API Backend | Express/Node.js | 3001 | Activo |
| AI Engine | Node.js MCP | 3002 | Activo |
| Aegis AI | Python FastAPI | 8001 | Activo |
| Frontend | Next.js 14 | 3000 | Activo |
| Edge Nodes | Node.js | 4000 | Activo |
| PostgreSQL | v16 | 5432 | Activo |
| Redis | v7 | 6379 | Activo |

## Contratos Smart (73 contratos, 931+ tests)

### Core (8) — Actualizado 2026-03-30
- `BEZCoinV2` — Token nativo ERC20 + Permit + AccessControl
- `StakingPool` — Single-sided staking con APY dinámico
- `LiquidityFarming` — MasterChef con time-lock multipliers
- `GovernanceSystem` — DAO (OpenZeppelin Governor)
- `QualityEscrow` — Validación IoT
- `BeZhasBridgeL2` — Puente L1↔L2
- `BeZhasLogisticsNFT` — ERC721 para contenedores
- `BeZhasPayment` ✅ **NUEVO** — Gateway de pagos nativos BEZ-Coin (processPayment, batchPayment, refund, cross-chain)

### Wallet System (5) — NUEVO 2026-03-19
- `SmartWallet` — Account Abstraction, sesiones, timelock, recovery social
- `SmartWalletFactory` — Factory CREATE2 para wallets determinísticas
- `MultiSigWallet` — M-de-N para empresas, roles ADMIN/OPERATOR/VIEWER
- `Paymaster` — Gas sponsorship para B2B, whitelist contratos
- `SecurityModule` — Pausa global, circuit breaker, timelock protocolo, audit log
- `WalletGuardian` — Registro de guardianes, trust score, recovery tracking

### Sectores (60 contratos)
- 15 sectores × 4 contratos cada uno
- Ver → [SKILL/training/contracts-catalog.md](training/contracts-catalog.md)

## Rutas API (17 módulos)

| Ruta | Archivo | Descripción |
|---|---|---|
| `/api/auth` | routes/auth.js | Login wallet signature, JWT |
| `/api/user` | routes/users.js | Perfil, preferencias |
| `/api/wallet` | routes/wallet.js | **SmartWallet, MultiSig, Paymaster, Security, Guardian** |
| `/api/nfts` | routes/nfts.js | NFTs logísticos |
| `/api/contracts` | routes/contracts.js | Info contratos |
| `/api/transactions` | routes/transactions.js | Historial tx |
| `/api/gas` | routes/gas.js | Monitor gas |
| `/api/sectors` | routes/sectors.js | Datos sectoriales |
| `/api/analytics` | routes/analytics.js | Métricas |
| `/api/gamification` | routes/gamification.js | Rewards/XP |
| `/api/ai-control` | routes/aegis.js | AI operations + Aegis Oracle config |
| `/api/notifications` | routes/notifications.js | Alertas |
| `/api/market` | routes/market.js | Marketplace |
| `/api/gateway/v1` | routes/gateway.js | **Unified Gateway: SSO, wallet, staking, bridge, chat, /chat/stream (LLM proxy)** |
| `/api/agent` | routes/unified-agent.js | **UnifiedAgent: chat, stream SSE, config, HITL, edge-confirm CRUD** |
| `/api/identity` | routes/identity.js | **Secrets Vault AES-256-GCM, execution nodes, audit log** |
| `/api/telemetry` | index.js (legacy) | IoT telemetry |

## Módulos AI Agent (Nuevos — 2026-04-19)

| Módulo | Archivo | Descripción |
|---|---|---|
| `UnifiedAgent` | agent-runtime/core/UnifiedAgent.js | Agente principal con HITL, streaming LLM, memory, tools |
| `MemoryManager` | agent-runtime/core/MemoryManager.js | Historial conversacional Redis/in-memory |
| `ChannelManager` | agent-runtime/channels/index.js | Telegram, Discord, WhatsApp adapters |
| `auto-signer` | bezhas-edge-node/auto-signer.js | Edge Node con gate HITL antes de firmar on-chain |
| `LLM Gateway` | api/routes/gateway.js | Proxy LLM: DeepSeek streaming → Gemini fallback |
| `Identity Vault` | api/routes/identity.js | Secrets cifrados AES-256-GCM |

## Variables de Entorno Críticas (Nuevas)

```env
VAULT_KEY=<32-byte hex>          # AES-256-GCM para Identity Vault
AI_GATEWAY_URL=http://localhost:3001/api/gateway/v1
INTERNAL_API_KEY=<key>           # Auth agent → gateway (LLM proxy)
DEEPSEEK_API_KEY=<key>           # LLM principal (streaming nativo)
GEMINI_API_KEY=<key>             # LLM fallback
EDGE_NODE_ID=edge-node-prod-01   # ID del nodo Edge para HITL
HITL_AMOUNT_THRESHOLD_BEZ=1000   # Umbral BEZ para gate de confirmación
HITL_TIMEOUT_MS=300000           # Timeout gate HITL (5 min)
```

## SKILLs Disponibles

### 🔴 CRÍTICO — Sincronización Universal
- [UNIVERSAL_SYNC.md](UNIVERSAL_SYNC.md) — **LEER SIEMPRE** — Protocolo de sync automático entre todos los proyectos

### Configuración
- [blockchain.md](config/blockchain.md) — Chain ID 2708, genesis, OP Stack
- [contracts.md](config/contracts.md) — Direcciones, ABIs, roles
- [infrastructure.md](config/infrastructure.md) — Docker, puertos, servicios
- [security.md](config/security.md) — Políticas de seguridad

### Runbooks (Procedimientos)
- [deploy.md](runbooks/deploy.md) — Deploy de contratos
- [monitor.md](runbooks/monitor.md) — Monitoreo
- [incident-response.md](runbooks/incident-response.md) — Respuesta a incidentes
- [wallet-operations.md](runbooks/wallet-operations.md) — Operaciones wallet
- [pnpm-dependency-check.md](runbooks/pnpm-dependency-check.md) — Comprobación PNPM (Cron diario 09:00)


### Soluciones (Errores resueltos)
- [compilation-errors.md](solutions/compilation-errors.md) — Errores Solidity
- [test-failures.md](solutions/test-failures.md) — Tests fallidos
- [deployment-issues.md](solutions/deployment-issues.md) — Deploy issues
- [runtime-errors.md](solutions/runtime-errors.md) — Runtime errors

### Patrones
- [solidity.md](patterns/solidity.md) — Patrones Solidity
- [api.md](patterns/api.md) — Patrones API
- [testing.md](patterns/testing.md) — Patrones testing

### CLI
- [forge.md](cli/forge.md) — Foundry commands
- [docker.md](cli/docker.md) — Docker commands
- [sdk-cli.md](cli/sdk-cli.md) — SDK usage

### Training Data
- [architecture.md](training/architecture.md) — Arquitectura consolidada
- [contracts-catalog.md](training/contracts-catalog.md) — Catálogo contratos
- [security-playbook.md](training/security-playbook.md) — Playbook seguridad
