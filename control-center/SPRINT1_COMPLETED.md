# 🏁 Sprint 1 — Agent Runtime Core
## Estado: ✅ COMPLETADO
**Fecha:** 2025-04-25 | `D:\BeZhas-Blockchain\agent-runtime\`

---

## 📦 Archivos Creados

```
agent-runtime/
├── index.js                          ✅ Entry point con Ollama check (Opción 1)
├── package.json                      ✅ Dependencias: ethers, redis, dotenv
├── AgentManager.js                   ✅ Ciclo de vida, dispatch, HITL, eventos
├── BaseAgent.js                      ✅ Clase abstracta base para todos los agentes
├── MemoryManager.js                  ✅ Redis-backed memory (P0 completado)
├── TaskQueue.js                      ✅ Cola con prioridades y concurrencia
├── AgentRegistry.js                  ✅ Registro y descubrimiento por capability
├── connectors/
│   ├── BlockchainConnector.js        ✅ WebSocket + eventos on-chain
│   ├── OpenClawConnector.js          ✅ Bridge Python engine + Ollama fallback
│   └── AegisConnector.js             ✅ Monitor off-chain AegisSecurityProvider.sol
└── agents/
    ├── SecurityAgent.js              ✅ AEGIS + LLM analysis + HITL mitigation
    ├── TradingAgent.js               ✅ Trading con HITL obligatorio
    └── WorkflowAgent.js              ✅ BeZhasWorkflowRegistry.sol orchestration
```

---

## 🔗 Conexiones Implementadas

| Conexión | Estado |
|----------|--------|
| `AgentManager` → `MemoryManager` (Redis) | ✅ **IMPLEMENTADO** |
| `AgentManager` → `BlockchainConnector` (WebSocket L2) | ✅ **IMPLEMENTADO** |
| `AgentManager` → `AegisConnector` (polling getLogs) | ✅ **IMPLEMENTADO** |
| `AgentManager` → `OpenClawConnector` (Python engine) | ✅ **IMPLEMENTADO** |
| `OpenClawConnector` → Ollama fallback (localhost:11434) | ✅ **IMPLEMENTADO** |
| `SecurityAgent` ← `AegisConnector` (amenazas detectadas) | ✅ **IMPLEMENTADO** |
| `SecurityAgent` → `BlockchainConnector` (reporte on-chain) | ✅ **IMPLEMENTADO** |
| `TradingAgent` → HITL antes de ejecutar trade | ✅ **IMPLEMENTADO** |
| `WorkflowAgent` → `WorkflowRegistry.sol` | ✅ **IMPLEMENTADO** |
| `AgentManager` → HITL → `OpenClawConnector` → Telegram | 🟡 Telegram Sprint 2 |

---

## 🧠 Decisiones de Arquitectura

### Ollama — Opción 1 (desarrollo)
- Ollama corre como **daemon manual** (`ollama serve`) antes de `node index.js`
- El `OpenClawConnector` verifica disponibilidad en `localhost:11434` al arrancar
- Si Ollama no está disponible, el runtime usa APIs externas sin interrupciones
- **TODO:** Migrar a Opción 3 (Docker Compose + RTX 4090 GPU passthrough) al terminar la plataforma

### HITL (Human-in-the-Loop)
- **TradingAgent:** HITL obligatorio para TODOS los trades reales
- **SecurityAgent:** HITL para `REQUIRE_APPROVAL`; auto-block sólo si score ML > 95%
- Timeout configurable (default 60s) → acción conservadora si no hay respuesta

### Redis Memory Namespaces
```
bezhas:agent:{id}:state     → Estado persistente del agente
bezhas:task:{id}            → Estado de cada tarea (TTL 24h)
bezhas:hitl:{id}            → Confirmaciones pendientes (TTL 5min)
bezhas:memory:{id}:{key}    → Memoria semántica (TTL 30 días)
bezhas:session:{id}         → Sesión de conversación (TTL 1h)
bezhas:context:{entityId}   → Contexto de entidad (TTL 30 días)
```

### Prioridades de Tarea
```
critical → aegis:alert con severity >= HIGH
high     → blockchain:task, trade urgente
normal   → workflow:execute, análisis
low      → backtest, reports
```

---

## 🚦 Variables de Entorno Requeridas

```env
# Blockchain
RPC_URL=http://localhost:8545
WS_URL=ws://localhost:8546
OPENCLAW_AGENT_ADDRESS=<dirección-desplegada>
AEGIS_PROVIDER_ADDRESS=<dirección-desplegada>
WORKFLOW_REGISTRY_ADDRESS=<dirección-desplegada>
AGENT_PRIVATE_KEY=<clave-privada-hot-wallet>

# Servicios
REDIS_URL=redis://localhost:6379
OPENCLAW_URL=http://localhost:8080
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# HITL
HITL_ENABLED=true
HITL_TIMEOUT_MS=60000
HITL_CALLBACK_URL=http://localhost:3001/api/hitl
```

---

## 🧪 Arranque

```powershell
# 1. Arrancar Ollama (Opción 1 — desarrollo)
ollama serve

# 2. En nueva terminal
cd D:\BeZhas-Blockchain\agent-runtime
npm install
npm run dev   # Con demo task de prueba

# Output esperado:
# 🦙 Ollama disponible en http://localhost:11434
# ✅ 3 agentes activos (3 idle)
# 🔗 Escuchando eventos on-chain...
# 🛡️  AEGIS monitoring activo
# 👤 HITL: ACTIVADO
```

---

## ⏭️ Próximo: Sprint 2 — Telegram Channel Wire

### Objetivo
Conectar `scripts/_tg_poll.js` → `OpenClawConnector` → `AgentManager` → respuesta al usuario.

### Archivos a crear
```
openclaw/channels/
├── TelegramChannel.js    → Bot con long-polling completo
├── ChannelRouter.js      → Routing mensaje → agente correcto
└── HITLHandler.js        → Recepción y resolución de confirmaciones HITL
```

### Funcionalidad target Sprint 2
- Usuario envía mensaje a bot Telegram → Agente responde
- HITL: Bot muestra botones "✅ Aprobar / ❌ Rechazar" para trades/mitigaciones
- Notificaciones AEGIS van directamente al chat del operador

---

*Sprint 1 completado: 2025-04-25*
*Tiempo estimado Sprint 2: 2-3 días*
