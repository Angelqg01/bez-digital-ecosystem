# Inventario de `agent-runtime` — qué está vivo y qué no

Paso 1 de la Fase 5 del [plan de fusión](PLAN-FUSION-OPERANT.md). Se hizo antes
de mover nada, y cambió el plan: la premisa de la fase era falsa.

---

## La premisa era falsa

El plan decía que `agent-runtime` son «89 ficheros **montados en `/api/agents`**»
y que la fase consistía en absorberlos conservando ese contrato HTTP.

Al medirlo:

- **`api/index.js` —el arranque real (`main: index.js`)— no referencia
  `agent-runtime` ni una vez.**
- Monta el router así: `app.use('/api/agents', agentRoutes())`, **sin
  argumentos**. La factory espera `(manager, wss)`, así que `manager` llegaba
  `undefined`.
- Consecuencia: todos los endpoints que tocaban `manager` respondían **500** con
  `Cannot read properties of undefined (reading 'memory')`. Incluidos los de
  HITL que se aseguraron antes en esta misma sesión: estaban protegidos, pero
  rotos.
- Quien sí cablea el runtime es `api/server.js` (`AgentManager` +
  `registerAgent`), que **no es el arranque** y no lo lanza nadie.

No había, por tanto, contrato que preservar en `/api/agents`.

---

## Lo que SÍ está vivo

`/api/runtime/*`, con `require` diferido a `createRuntime()`. Verificado en
caliente:

| Endpoint | Estado |
|---|---|
| `GET /api/runtime/health` | 200 — **33 tools, 8 comandos, 3 plugins** |
| `GET /api/runtime/tools` | 200 — `bridge-health`, `gas-analytics`, `validator-status`… |
| `GET /api/runtime/commands` | 200 |
| `GET /api/runtime/plugins` | 200 — `defi-plugin`, gobernanza… |

También `/api/agent/*` (`unified-agent.js`), que responde en `/status`.

Esto es **infraestructura de producto**, no operación de empresa: herramientas
sobre la cadena (puente L1↔L2, gas, validadores). Disolverlas dentro de los
departamentos de negocio de OPERANT sería un error de categoría — es justo lo
que el plan ya advertía en su matiz sobre «absorber todo».

---

## Consumidores reales (fuera de `agent-runtime/`)

| Fichero | Qué importa | ¿Vivo? |
|---|---|---|
| `api/routes/runtime.js` | `createRuntime`, `invokeWithPermissions` | ✅ montado y respondiendo |
| `api/routes/unified-agent.js` | `createRuntime`, `UnifiedAgent`, `ChannelManager`, `MemoryManager`, `SkillWriter` | ✅ montado |
| `api/routes/openclaw.js` | `createRuntime` | 🟡 monta, pero falta `@bezhas/openclaw-unified` |
| `api/server.js` | `AgentManager` + los 5 agentes | ❌ no es el arranque |
| `scripts/wire-agents.js` | los 5 agentes | ❌ script suelto |
| `core/OpenClawOrchestrator.js` | `GeminiClient` | 🟡 raíz ESM |

Los **5 agentes** (`Security`, `Trading`, `Workflow`, `Compliance`,
`Tokenomics`) solo los instancian `api/server.js` y `scripts/wire-agents.js`.
En el proceso que corre de verdad, están **dormidos**.

---

## Hecho en esta fase

**Los endpoints dejan de mentir.** Se añadió la guarda `requiereRuntime`: sin
`manager`, responden **503 `RUNTIME_NOT_WIRED`** con el motivo y dónde está el
cableado, en vez de un 500 que parece una caída.

Cablear el runtime en `api/index.js` levantaría cinco agentes dentro del proceso
de la API. Eso es una **decisión de producto**, no un arreglo, y no se toma aquí.

---

## Lo que queda por decidir (no ejecutado)

1. **Los 5 agentes dormidos**: ¿se cablean en el arranque real, se migran a
   `business-ops` como departamento, o se retiran? Compliance y Tokenomics ya
   tienen equivalente en OPERANT, aunque con **alcance distinto** (ver Fase 4).
2. **Las 33 tools**: candidatas a entrar en el catálogo de tool-use de OPERANT
   (`cognition/toolCatalog.js`), donde cada invocación pasaría por
   `PolicyEngine`/`RedLines`. Hoy pasan por `permissions/` de agent-runtime.
3. **Componentes React** (`CompliancePage.jsx`, `GovernancePage.jsx`,
   `useGovernance.js`, `frontend/`): no son código de agente; su sitio es
   `control-center/frontend/`.
4. **`api/server.js`**: entrada muerta que duplica el cableado. O se convierte
   en el arranque, o se retira.

Mientras 1 y 2 no se decidan, **el job de CI de `agent-runtime` se mantiene**:
su cobertura no vive en ningún otro sitio.
