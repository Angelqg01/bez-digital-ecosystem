# BeZhas Agent Runtime — Blueprint Técnico

> **Versión**: 1.0.0 | **Fecha**: 2026-04-03  
> **Basado en**: Patrones de claw-code (runtime/plugins/commands/tools/permissions)  
> **Adaptado a**: Stack actual BeZhas (API Node :3001, AI-Engine MCP :3002, Aegis FastAPI :8001, Edge Node :4000, Control Center Next.js :3000)

---

## 1. Visión General

El **BeZhas Agent Runtime** es una capa de orquestación que unifica los 73+ agentes IA existentes, los 12 MCP tools, el sistema SKILL y el SDK bajo un solo control-plane con:

- **ToolRegistry** — registro tipado de herramientas con schema JSON
- **CommandRouter** — comandos slash internos (`/bridge-health`, `/validator-status`, etc.)
- **PermissionEngine** — RBAC + policy por wallet/rol/sector
- **PluginLoader** — extensiones por sector sin tocar el core
- **ParityChecker** — validación continua ABI ↔ deploy ↔ SDK
- **SessionManager** — estado conversacional persistente (Redis)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CONTROL CENTER (Next.js :3000)                  │
│            /dashboard/agents   /dashboard/runtime                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST + SSE
┌────────────────────────────▼────────────────────────────────────────┐
│                     API GATEWAY (Express :3001)                     │
│   routes/agents.js ──→ routes/runtime.js (NUEVO)                   │
│   middleware: security.js + runtime-auth.js (NUEVO)                 │
└──────┬──────────────┬───────────────┬──────────────┬───────────────┘
       │              │               │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐ ┌─────▼──────┐
│  Agent      │ │  AI-Engine │ │   Aegis     │ │ Edge Node  │
│  Runtime    │ │  MCP :3002 │ │   :8001     │ │   :4000    │
│  (NUEVO)    │ │  12 tools  │ │  5 ML models│ │  signer    │
│  core/      │ └────────────┘ └─────────────┘ └────────────┘
│  plugins/   │
│  commands/  │       ┌─────────────────────────┐
│  tools/     │───────│ SDK v3 + OpenClaw v2    │
│  sessions/  │       │ sdk/modules/ + sdk/     │
└─────────────┘       └─────────────────────────┘
```

---

## 2. Estructura de Módulos

```
agent-runtime/                        ← NUEVO directorio raíz
├── package.json
├── index.js                          ← Entrypoint: carga registry + boot
├── core/
│   ├── ToolRegistry.js               ← Registro central de tools
│   ├── CommandRouter.js              ← Despacho de comandos slash
│   ├── PermissionEngine.js           ← RBAC + policies
│   ├── SessionManager.js             ← Estado conversacional (Redis-backed)
│   ├── PluginLoader.js               ← Descubre y carga plugins de sector
│   └── ParityChecker.js              ← Valida ABI ↔ deploy ↔ SDK
├── tools/
│   ├── bridge-health.tool.js         ← Tool: estado del bridge L1↔L2
│   ├── validator-status.tool.js      ← Tool: salud de validadores
│   ├── gas-analytics.tool.js         ← Tool: proxy a Aegis GasPredictor
│   ├── deploy-check.tool.js          ← Tool: verifica deploy vs ABI
│   ├── incident-report.tool.js       ← Tool: crea incidente auto-healing
│   ├── sector-query.tool.js          ← Tool: consulta agentes de un sector
│   └── _base.tool.js                 ← Clase base + validación de schema
├── commands/
│   ├── bridge-health.cmd.js          ← /bridge-health
│   ├── validator-status.cmd.js       ← /validator-status
│   ├── deploy-check.cmd.js           ← /deploy-check
│   ├── parity-audit.cmd.js           ← /parity-audit
│   ├── incident.cmd.js               ← /incident <sector> <severity>
│   └── _base.cmd.js                  ← Clase base para commands
├── plugins/
│   ├── plugin-manifest.schema.json   ← JSON Schema de un plugin
│   ├── logistics/
│   │   └── manifest.json             ← hooks + tools propios de logistics
│   ├── defi/
│   │   └── manifest.json
│   └── governance/
│       └── manifest.json
├── permissions/
│   ├── policies.json                 ← Políticas por rol/sector
│   └── permission-defs.js            ← Constantes de permisos
└── tests/
    ├── tool-registry.test.js
    ├── command-router.test.js
    ├── permission-engine.test.js
    └── parity-checker.test.js
```

---

## 3. Contratos de Tool (Schema)

Cada tool implementa esta interfaz:

```javascript
// agent-runtime/tools/_base.tool.js
class BaseTool {
    /** @type {string} Nombre único: "bridge-health" */
    name;
    /** @type {string} Descripción humana */
    description;
    /** @type {string[]} Permisos requeridos: ["runtime:read", "bridge:status"] */
    permissions;
    /** @type {object} JSON Schema de parámetros de entrada */
    inputSchema;
    /** @type {object} JSON Schema de respuesta */
    outputSchema;
    /** @type {string} Sector propietario (null = global) */
    sector;
    /** @type {number} Timeout en ms */
    timeoutMs;

    /**
     * Ejecuta la tool.
     * @param {object} params  — Parámetros validados contra inputSchema
     * @param {object} context — { user, session, permissions, abortSignal }
     * @returns {Promise<{success: boolean, data: any, meta?: object}>}
     */
    async execute(params, context) {
        throw new Error('execute() must be implemented');
    }
}
```

### Ejemplo: bridge-health.tool.js

```javascript
{
    name: "bridge-health",
    description: "Checks L1↔L2 bridge status: pending messages, finalization lag, deposit/withdraw queues",
    permissions: ["runtime:read", "bridge:status"],
    sector: null,  // global
    timeoutMs: 10000,
    inputSchema: {
        type: "object",
        properties: {
            include_pending: { type: "boolean", default: true },
            max_age_blocks: { type: "number", default: 100 }
        }
    },
    outputSchema: {
        type: "object",
        properties: {
            l1_bridge_balance: { type: "string" },
            l2_bridge_balance: { type: "string" },
            pending_deposits: { type: "number" },
            pending_withdrawals: { type: "number" },
            finalization_lag_seconds: { type: "number" },
            health: { type: "string", enum: ["healthy", "degraded", "critical"] }
        }
    }
}
```

### Catálogo de Tools (Sprint 1-4)

| Tool | Sector | Permisos | Backend |
|------|--------|----------|---------|
| `bridge-health` | global | `runtime:read, bridge:status` | SDK ChainManager |
| `validator-status` | global | `runtime:read, validator:read` | Aegis ValidatorMonitor |
| `gas-analytics` | global | `runtime:read` | Aegis GasPredictor |
| `deploy-check` | global | `runtime:admin, deploy:verify` | SDK contracts.js + FS |
| `incident-report` | global | `runtime:write, incident:create` | Aegis AutoHealer |
| `sector-query` | {sector} | `runtime:read, sector:{id}:read` | AgentService DB |
| `parity-audit` | global | `runtime:admin` | ParityChecker |
| `mcp-proxy` | global | `mcp:{tool}:invoke` | AI-Engine :3002 |

---

## 4. Esquema de Permisos

### 4.1 Roles Base (compatible con security.js actual)

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `viewer` | Solo lectura de dashboards | `runtime:read` |
| `operator` | Opera agentes y lee métricas | `runtime:read, runtime:write, mcp:*:invoke` |
| `sector-admin` | Admin de 1+ sectores | `runtime:read, runtime:write, sector:{assigned}:*` |
| `deployer` | Puede ejecutar deploys y auditorías | `runtime:admin, deploy:*, parity:*` |
| `admin` | Acceso total | `*` |

### 4.2 Policies (permissions/policies.json)

```json
{
    "version": 1,
    "roles": {
        "viewer": {
            "allow": ["runtime:read"],
            "deny": []
        },
        "operator": {
            "allow": ["runtime:read", "runtime:write", "mcp:*:invoke", "bridge:status", "validator:read"],
            "deny": ["deploy:*", "parity:*"]
        },
        "sector-admin": {
            "allow": ["runtime:read", "runtime:write"],
            "sectorScoped": true,
            "sectorPermissions": ["sector:{sector}:read", "sector:{sector}:write", "sector:{sector}:tools"]
        },
        "deployer": {
            "allow": ["runtime:read", "runtime:admin", "deploy:verify", "deploy:execute", "parity:audit"],
            "deny": ["sector:*:write"]
        },
        "admin": {
            "allow": ["*"],
            "deny": []
        }
    },
    "toolOverrides": {
        "incident-report": {
            "minRole": "operator",
            "requireAuditLog": true,
            "maxRatePerMinute": 5
        },
        "deploy-check": {
            "minRole": "deployer",
            "requireAuditLog": true,
            "maxRatePerMinute": 2
        }
    }
}
```

### 4.3 Flujo de autorización

```
Request → authenticateToken (JWT) 
        → PermissionEngine.check(user.role, tool.permissions, sector?)
          ├─ 1. Resolve role → allowed/denied patterns
          ├─ 2. If sectorScoped → check user.sectors includes target sector
          ├─ 3. Check toolOverrides (rate limit, audit flag)
          ├─ 4. If requireAuditLog → write to ai_logs
          └─ ALLOW / DENY(403)
        → Tool.execute()
```

---

## 5. Integración con Servicios Existentes

### 5.1 Conexión con AI-Engine MCP (:3002)

El runtime **no reemplaza** AI-Engine; lo envuelve:

```javascript
// tools/mcp-proxy.tool.js
// Para cada MCP tool existente (12 tools), genera un wrapper automático
// que añade: permisos, audit log, session context, rate limiting.

const mcpTools = await fetch('http://localhost:3002/api/mcp/tools');
for (const tool of mcpTools) {
    registry.register({
        name: `mcp:${tool.name}`,
        permissions: [`mcp:${tool.name}:invoke`],
        execute: (params, ctx) => aiEngineProxy(tool.endpoint, params, ctx)
    });
}
```

### 5.2 Conexión con Aegis (:8001)

```javascript
// Las tools que necesitan ML (gas, fraud, sentiment, validator) 
// llaman a Aegis directamente vía axios con retry + circuit breaker.
// El runtime añade la capa de permisos y logging que Aegis no tiene.
```

### 5.3 Conexión con SDK v3

```javascript
// tools/deploy-check.tool.js y parity-audit usa:
const { getContractInstance, getProvider } = require('@bezhas/sdk/chain-manager');
const deployments = require('@bezhas/sdk/contracts');
// Compara ABI actual vs bytecode deployed, emite discrepancias.
```

### 5.4 Conexión con SKILL System

```javascript
// El PluginLoader lee SKILL/config/ para informar tool defaults.
// El ParityChecker usa SKILL/solutions/ para enriquecer diagnósticos.
// El SessionManager almacena SKILL/feedback/log.md entries automáticamente.
```

---

## 6. Roadmap de 4 Sprints

### Sprint 1 — Foundation (Semana 1-2)
**Objetivo**: Core funcional con 3 tools globales

| Tarea | Archivo(s) | Dependencia |
|-------|-----------|-------------|
| Scaffolding agent-runtime/ | Toda la estructura | — |
| ToolRegistry + BaseTool | core/ToolRegistry.js, tools/_base.tool.js | — |
| PermissionEngine (RBAC básico) | core/PermissionEngine.js, permissions/ | security.js |
| Tool: bridge-health | tools/bridge-health.tool.js | SDK ChainManager |
| Tool: validator-status | tools/validator-status.tool.js | Aegis |
| Tool: gas-analytics | tools/gas-analytics.tool.js | Aegis |
| API route: /api/runtime | api/routes/runtime.js | agents.js pattern |
| Tests unitarios (≥20 tests) | tests/ | Jest |

**Entregable**: `GET /api/runtime/tools` lista 3 tools, `POST /api/runtime/invoke` las ejecuta con permisos.

---

### Sprint 2 — Commands + MCP Proxy (Semana 3-4)
**Objetivo**: CommandRouter + wrapping automático de 12 MCP tools

| Tarea | Archivo(s) | Dependencia |
|-------|-----------|-------------|
| CommandRouter + BaseCommand | core/CommandRouter.js, commands/_base.cmd.js | — |
| Comando: /bridge-health | commands/bridge-health.cmd.js | Tool bridge-health |
| Comando: /validator-status | commands/validator-status.cmd.js | Tool validator-status |
| MCP proxy automático (12 tools) | tools/mcp-proxy.tool.js | AI-Engine :3002 |
| SessionManager (Redis) | core/SessionManager.js | Redis existente |
| Integración en API gateway | api/routes/runtime.js (ampliar) | Sprint 1 |
| Tests (≥15 más → total ≥35) | tests/ | Jest |

**Entregable**: `POST /api/runtime/command` ejecuta slash commands, los 12 MCP tools disponibles vía `/api/runtime/invoke` con permisos.

---

### Sprint 3 — Plugins + Parity (Semana 5-6)
**Objetivo**: PluginLoader por sector + ParityChecker

| Tarea | Archivo(s) | Dependencia |
|-------|-----------|-------------|
| PluginLoader | core/PluginLoader.js | — |
| Plugin schema + validator | plugins/plugin-manifest.schema.json | — |
| Plugin: logistics | plugins/logistics/manifest.json | Sector logistics |
| Plugin: defi | plugins/defi/manifest.json | Sector finanzas |
| Plugin: governance | plugins/governance/manifest.json | Sector gobierno |
| ParityChecker | core/ParityChecker.js | SDK, FS |
| Comando: /parity-audit | commands/parity-audit.cmd.js | ParityChecker |
| Comando: /deploy-check | commands/deploy-check.cmd.js | Tool deploy-check |
| Tool: deploy-check | tools/deploy-check.tool.js | SDK |
| SKILL feedback auto-write | core/SessionManager.js (extend) | SKILL system |
| Tests (≥20 más → total ≥55) | tests/ | Jest |

**Entregable**: Plugins cargan tools extra por sector, `/api/runtime/parity` devuelve informe de discrepancias ABI/deploy.

---

### Sprint 4 — Dashboard + Hardening (Semana 7-8)
**Objetivo**: UI en Control Center + endurecimiento para producción

| Tarea | Archivo(s) | Dependencia |
|-------|-----------|-------------|
| SSE endpoint runtime events | api/routes/runtime.js (ampliar) | Redis pub/sub |
| Frontend: RuntimeDashboard | control-center/frontend/app/dashboard/runtime/ | Sprint 1-3 |
| Frontend: ToolInvoker widget | control-center/frontend/components/ToolInvoker.tsx | — |
| Frontend: ParityReport page | control-center/frontend/app/dashboard/parity/ | ParityChecker |
| Rate limiting por tool | core/PermissionEngine.js (extend) | Redis |
| Circuit breaker (Aegis/MCP) | core/CircuitBreaker.js | — |
| Docker service runtime | docker-compose.dev.yml (extend) | — |
| E2E tests Playwright (≥6) | control-center/e2e-tests/ | Playwright |
| k6 load test runtime | scripts/k6-runtime-load.js | k6 |
| Documentación SKILL | SKILL/runbooks/agent-runtime.md | — |

**Entregable**: Dashboard operativo con invocación de tools, parity visual, SSE real-time, listo para staging.

---

## 7. Métricas de Éxito

| Métrica | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
|---------|----------|----------|----------|----------|
| Tools registradas | 3 | 15 | 20+ | 20+ |
| Commands | 0 | 3 | 6 | 6+ |
| Plugins cargados | 0 | 0 | 3 | 3+ |
| Tests passing | 20+ | 35+ | 55+ | 70+ |
| Parity checks | 0 | 0 | ABI vs deploy | + SDK + routes |
| Dashboard pages | 0 | 0 | 0 | 3 |
| P95 latency invoke | — | <200ms | <200ms | <150ms |

---

## 8. Decisiones de Diseño

1. **No reemplazar AI-Engine/Aegis** — El runtime los envuelve, no compite con ellos.
2. **Misma DB (PostgreSQL)** — Usa tablas `ai_logs` existentes; no se crea DB nueva.
3. **Redis compartido** — Sessions y pub/sub usan la instancia Redis existente (:6379).
4. **Compatibilidad backward** — `/api/agents/*` sigue funcionando; `/api/runtime/*` es nuevo.
5. **Permisos progresivos** — Sprint 1 usa RBAC simple; Sprint 3+ añade sector-scoped policies.
6. **Clean-room** — Ningún código copiado de repos filtrados; solo patrones de diseño reimplementados.
