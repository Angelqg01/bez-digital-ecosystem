# Agent Runtime — Runbook

> Module: `agent-runtime/` | API: `/api/runtime` | Version: 0.4.0

---

## 1. Quick Start

```bash
# Run all agent-runtime tests
cd agent-runtime && npx jest --verbose

# Start API with runtime route
cd api && node index.js
# Runtime available at http://localhost:3001/api/runtime/health
```

## 2. Architecture

```
agent-runtime/
├── core/
│   ├── ToolRegistry.js       — Typed tool registry (register, invoke, list)
│   ├── PermissionEngine.js   — RBAC + sector-scoped policies + rate limiting
│   ├── CommandRouter.js      — Slash command dispatch (/cmd args)
│   ├── SessionManager.js     — Conversation state (Redis + memory fallback)
│   ├── PluginLoader.js       — Auto-discover sector plugins
│   ├── ParityChecker.js      — ABI ↔ deploy ↔ SDK validation
│   ├── CircuitBreaker.js     — Failure protection (CLOSED/OPEN/HALF_OPEN)
│   └── RuntimeEventBus.js    — In-process SSE event emitter
├── tools/                     — 5 core tools + 12 MCP proxy + 6 plugin
├── commands/                  — 5 slash commands + 3 plugin commands
├── plugins/                   — 3 sector plugins (logistics, defi, governance)
└── permissions/               — policies.json, permission-defs.js
```

## 3. Tools Catalog

| Tool | Permissions | Sector | Backend |
|------|------------|--------|---------|
| `bridge-health` | runtime:read, bridge:status | global | SDK ChainManager |
| `validator-status` | runtime:read, validator:read | global | Aegis |
| `gas-analytics` | runtime:read | global | Aegis GasPredictor |
| `deploy-check` | runtime:admin, deploy:verify | global | SDK + FS |
| `incident-report` | runtime:write, incident:create | global | Aegis AutoHealer |
| `sector-query` | runtime:read | global | AgentService DB |
| `mcp:*` (12 tools) | mcp:{name}:invoke | global | AI-Engine :3002 |
| Plugin tools (6) | runtime:read | per-sector | Plugin stubs |

## 4. Commands

| Command | Aliases | Min Role | Description |
|---------|---------|----------|-------------|
| `/bridge-health` | bh | viewer | Check L1↔L2 bridge |
| `/validator-status` | vs | viewer | Validator health |
| `/parity-audit` | pa, parity | admin | Run parity audit |
| `/deploy-check` | dc, deploy | deployer | Verify contract deploy |
| `/incident` | inc | operator | Create incident report |

## 5. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/runtime/health | No | Health + version + counts |
| GET | /api/runtime/tools | JWT | List registered tools |
| GET | /api/runtime/commands | JWT | List slash commands |
| GET | /api/runtime/plugins | JWT | List loaded plugins |
| GET | /api/runtime/parity | JWT (admin/deployer) | Run parity audit |
| GET | /api/runtime/circuits | JWT | Circuit breaker statuses |
| GET | /api/runtime/stream | No (SSE) | Real-time event stream |
| POST | /api/runtime/invoke | JWT | Invoke a tool |
| POST | /api/runtime/command | JWT | Execute slash command |
| GET | /api/runtime/session/:id | JWT | Get session |
| DELETE | /api/runtime/session/:id | JWT | Destroy session |

## 6. Circuit Breaker

States: CLOSED → (failures ≥ threshold) → OPEN → (timeout) → HALF_OPEN → (success) → CLOSED

Default config:
- `failureThreshold`: 5 failures
- `resetTimeout`: 30 seconds
- `halfOpenMax`: 1 probe

Named circuits: `aegis`, `mcp`, `sdk` (or custom per service call).

## 7. Rate Limiting

Per-tool rate limits defined in `permissions/policies.json` → `toolOverrides`:
- `incident-report`: 5 calls/minute per user
- `deploy-check`: 2 calls/minute per user

Returns HTTP 429 with `retryAfter` field when exceeded.

## 8. SSE Events

Event types emitted on `/api/runtime/stream`:
- `tool:invoke` — tool execution started
- `tool:result` — tool completed successfully
- `tool:error` — tool execution failed
- `command:exec` — slash command dispatched
- `circuit:change` — circuit breaker state transition

## 9. Plugins

Plugin structure:
```
plugins/{sector-name}/manifest.json
```

Manifest schema: `plugins/plugin-manifest.schema.json` (JSON Schema draft-07)

Current plugins:
- **logistics**: cargo-track, escrow-status tools + /logistics command
- **defi**: staking-info, farming-yields tools + /defi command
- **governance**: proposal-status, timelock-queue tools + /governance command

## 10. Testing

```bash
# Unit + integration (207 tests, 19 suites)
cd agent-runtime && npx jest --verbose

# Playwright E2E (runtime dashboard)
cd control-center/e2e-tests && npx playwright test e2e/runtime.spec.ts

# k6 load test
k6 run scripts/k6-runtime-load.js
k6 run scripts/k6-runtime-load.js --env MODE=full  # includes invoke/command
```

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tool not found | Not registered in index.js | Add to `createRuntime()` |
| Permission denied | Role lacks required permissions | Check policies.json |
| Circuit OPEN | Too many failures to backend | Wait for resetTimeout or manual `breaker.reset(name)` |
| Rate limited (429) | Too many calls per minute | Wait for retryAfter seconds |
| SSE not connecting | CORS or proxy buffering | Add `X-Accel-Buffering: no` header |
| Plugin not loading | Invalid manifest.json | Validate against plugin-manifest.schema.json |
