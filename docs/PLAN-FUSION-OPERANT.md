# Plan de fusión: OPERANT → BeZhas-Blockchain

> Estado: propuesta para aprobación · Fecha: 2026-08-13 · Alcance elegido: **absorción total**
> Origen: `/home/amaliacr/Documentos/Gestión empresarial/operant-saas`
> Destino: `business-ops/` en este monorepo

---

## Contexto

BeZhas necesita operar la empresa (ventas, finanzas, legal, RR.HH., tesorería) de forma
casi autónoma. OPERANT ya resuelve eso: 10 departamentos, ~75 agentes, guardrails con
líneas rojas, HITL, persistencia multi-tenant con RLS, 71 evals y tests de integración HTTP.

El problema real no es "a BeZhas le falta una capa de agentes". Es el contrario: **BeZhas
tiene cuatro stacks de agentes parciales que no se hablan entre sí**, y OPERANT sería el
quinto. La fusión consiste en dejar uno.

### Corrección de un análisis previo

Un análisis anterior de esta misma sesión afirmó que BeZhas "no tiene arquitectura
unificada de agentes" e incluyó fragmentos de código de `BeZhasCoreConnector` y
`RedLines` **que no correspondían al código real**. Ambas cosas eran incorrectas:

- BeZhas **sí** tiene capa de agentes (`agent-runtime/`, en CI y montada en `/api/agents`).
- `RedLines.js` no expone `RedLines.for(tenant, {...})`; es un array plano de reglas con
  función `test(action)`. Las líneas rojas de cripto **ya existen** y son globales, no
  por tenant.

Todo lo que sigue está verificado leyendo los ficheros.

---

## Estado verificado

| Hecho | Verificación |
|---|---|
| `BeZhasCoreConnector` existe y es solo-lectura, con circuit breaker | `operant-saas/src/connectors/BeZhasCoreConnector.js` |
| Los 5 endpoints que consume **existen y son públicos** (sin `authenticateToken`) | `api/routes/{blockchain,validators,treasury,gas}.js` |
| `RedLines` ya cubre `crypto_asset_movement` y `smart_contract_change` | `operant-saas/src/guardrails/RedLines.js:27-47` |
| BeZhas tiene **3 HITL** distintos | `api/middleware/hitl.js`, `api/services/hitlQueue.js`, `api/routes/agents.js:176-195` |
| OPERANT aporta un **4.º** HITL | `operant-saas/src/core/HITLGate.js` |
| `agent-runtime` son **89 ficheros JS**, con CI propio, Dockerfile, SDK, plugins y componentes React | `agent-runtime/`, `.github/workflows/ci.yml:109-114` |
| `aegis` es **mitad Python** (`main.py`, `pyproject.toml`, `routers/`) | `aegis/` |
| `sales-agency` son **952 líneas** | `sales-agency/{index.js,modules,config}` |
| Auth BeZhas: JWT (`JWT_SECRET`) + PQC opcional → `req.user = {address, userId, role}` | `api/middleware/security.js:13-38` |
| Auth OPERANT: `x-api-key` → `ApiKeyRegistry.resolve()` → tenant | `operant-saas/src/server.js:379-384` |

### Duplicación exacta a eliminar

| Capacidad | Copias hoy |
|---|---|
| **Compliance** | `agent-runtime/agents/ComplianceAgent.js` · `aegis/ComplianceAgent.js` · `operant/blockchain/ComplianceCheckAgent.js` |
| **Tokenomics** | `agent-runtime/agents/TokenomicsAgent.js` · `aegis/tokenomics.js` · `operant/treasury/TokenomicsAgent.js` |
| **BaseAgent / TaskQueue / MemoryManager** | `agent-runtime/*` · `operant/src/{agents,core,cognition}/*` |
| **Canal Telegram + HITL** | `openclaw/channels/` · `sales-agency/modules/telegram.js` · `operant/src/channels/TelegramChannel.js` |
| **Ventas (scout, mailer, secuencias)** | `sales-agency/` · `operant/src/agents/sales/` (11 agentes) |

---

## Decisiones tomadas

1. **Ubicación:** sub-proyecto `business-ops/` en el monorepo, con `package.json`,
   `pnpm-workspace.yaml` y lockfile propios — el patrón que ya siguen `api/`,
   `agent-runtime/` y `control-center/frontend/`. CI instala por directorio.
2. **Alcance:** absorción total. `sales-agency`, `aegis` (parte JS) y `agent-runtime` se
   migran a OPERANT y se retiran. `openclaw` **se mantiene** como enrutador LLM.

### Matiz obligado sobre "absorber todo"

La absorción no es uniforme y el plan la ordena por dificultad real:

- `sales-agency` (952 líneas) → absorción limpia dentro del escuadrón de Ventas.
- `aegis` **JS** (~1.100 líneas: compliance + tokenomics) → absorbible. Su **mitad Python**
  (`main.py`, `routers/`, `models/`) es un servicio aparte: **no se disuelve en OPERANT**,
  se queda como servicio de control y OPERANT lo consume por HTTP.
- `agent-runtime` (89 ficheros) → **no todo es operación de empresa**. Sus 10 `tools/`
  (`blockchain-validator`, `gas-analytics`, `validator-status`, `deploy-check`…) son plano
  de producto, y `frontend/`, `CompliancePage.jsx`, `GovernancePage.jsx`, `useGovernance.js`
  ni siquiera son código de agente. Eso **se reubica**, no se disuelve: las tools entran en
  el catálogo de tool-use de OPERANT (`cognition/toolCatalog.js`) y los componentes React
  van a `control-center/frontend/`.

Disolver a ciegas esos 89 ficheros dentro de departamentos de negocio rompería `/api/agents`
y el CI. Por eso la Fase 5 es la última y va con inventario de capacidades previo.

---

## Arquitectura destino

```
                    ┌──────────────────────────────┐
   Canales  ───────►│  business-ops/  (OPERANT)    │
   (web, TG, email) │  Plano de OPERACIÓN EMPRESA  │
                    │  TenantManager→Orchestrator  │
                    │  10 depts · HITL ÚNICO       │
                    │  RedLines · AuditLog · Store │
                    └───────┬──────────────┬───────┘
                    lectura │              │ acciones (nunca on-chain directas)
                            ▼              ▼
              ┌─────────────────┐   ┌──────────────────┐
              │  api/  (:3001)  │   │  openclaw        │
              │  Producto/cadena│   │  Enrutado LLM    │
              │  JWT · RBAC     │   │  (se mantiene)   │
              └────────┬────────┘   └──────────────────┘
                       │
              ┌────────▼────────┐   ┌──────────────────┐
              │ smart-contracts │   │ aegis (Python)   │
              │ Verdad on-chain │   │ Control/servicio │
              └─────────────────┘   └──────────────────┘
```

**Frontera irrenunciable:** OPERANT **lee** la cadena, nunca escribe en ella. Toda acción
con efecto on-chain sale por `api/` y pasa antes por el HITL único.

---

## Fases

### Fase 0 — Aterrizaje en el monorepo (sin cambio funcional) · ✅ HECHA

> Ejecutada. `business-ops/` existe (280 ficheros, 2 MB), instala con pnpm y sus
> tres puertas pasan dentro del monorepo: **679 tests, 71 evals, smoke OK**.
> Job `business-ops` añadido a `.github/workflows/ci.yml`, con servicio Postgres
> propio. Cero cambios en `api/`.
>
> Dos cosas salieron distintas de lo previsto:
> - OPERANT **ya estaba en pnpm** (tenía `pnpm-lock.yaml`, no `package-lock.json`),
>   así que no hubo que regenerar nada, y ya era CommonJS sin `"type": "module"`.
> - Tiene **repositorio git propio con 25 commits**. El monorepo arrastra 3.869
>   cambios sin commitear de una reestructuración en curso, y `git subtree`
>   exige árbol limpio, así que se copió sin historial. **El historial sigue
>   intacto en `/home/amaliacr/Documentos/Gestión empresarial/operant-saas`** y
>   puede injertarse con `git subtree` cuando el árbol esté limpio; hasta
>   entonces, no borrar el origen.


Objetivo: que OPERANT compile, instale y pase sus tests dentro de BeZhas, sin tocar nada vivo.

- Copiar `operant-saas/` → `business-ops/`.
- **pnpm obligatorio:** la raíz tiene `preinstall: only-allow pnpm`, así que `npm install`
  falla por diseño. Crear `business-ops/pnpm-workspace.yaml` + lockfile propio y convertir
  los scripts. Regenerar el lockfile desde cero (no migrar `package-lock.json`).
- **CommonJS:** `business-ops/package.json` **no** debe llevar `"type": "module"` — la raíz
  es ESM y OPERANT es CJS (`require`/`module.exports`). Mismo caso que `api/`, que ya
  convive así.
- Alinear versiones con los `overrides` de `pnpm-workspace.yaml` de la raíz (`axios`,
  `form-data`). OPERANT trae `express@4` y `ethers@6`: `ethers` coincide con la raíz;
  `express` difiere (raíz `5`, api `4`) — se queda en 4, como `api/`.
- Añadir job de CI por directorio, replicando el bloque de `agent-runtime`
  (`.github/workflows/ci.yml:109-114`): install + `pnpm test` + `pnpm evals` + `pnpm smoke`.

**Criterio de salida:** `pnpm test` (tests + 71 evals + smoke) verde en CI. Cero cambios en `api/`.

### Fase 1 — Conexión real de solo lectura + puente de auth · ✅ HECHA

> **Lectura real.** Los 5 endpoints responden y `BeZhasCoreConnector` devuelve
> `simulated: false` en los cinco. El monitor on-chain, lanzado bajo demanda,
> completa enrutado al departamento `blockchain` con datos de la cadena
> (bloque 85, chainId 31337).
>
> **Puente de auth.** `business-ops/src/server.js` acepta ahora el JWT de
> BeZhas además de su `x-api-key`. Verificado: sin credenciales 401 · JWT
> válido 200 · JWT con otro secreto 401 · `alg:none` 401 · JWT hacia otro
> tenant 403 · JWT intentando dar de alta 403. **Un JWT nunca concede admin**:
> administrar sigue exigiendo la clave interna.
>
> **Tenant y trabajos.** `bezhas` aprovisionado con sus 10 departamentos y su
> perfil de negocio. Los 6 trabajos recurrentes se programaron solos, incluidos
> el monitor on-chain (30 min) y el runway (diario).
>
> **Almacén propio, y no por gusto.** Al arrancar heredando el `DATABASE_URL`
> de la raíz, OPERANT **se negó a levantar**: ese rol es dueño de la base y se
> salta la Row-Level Security, así que no habría aislamiento entre tenants. Se
> le dio contenedor propio con pgvector (`bezhas-operant-pg`, :5434), base
> `operant` y rol `operant_app`.
>
> **Herencia acotada.** Del `.env` de la raíz solo se hereda `JWT_SECRET`, y a
> propósito: el puente debe verificar con el mismo secreto que firma la API.
> Heredarlo entero reinyectaba la `DATABASE_URL` de BeZhas por detrás —lo
> destapó un test que la borra a propósito— y dejaba a business-ops sin
> aislamiento. La lista de variables compartidas está en `server.js`.
>
> **Telegram: enrutado verificado, envío real bloqueado por falta de destino.**
> El `.env` de la raíz tiene los 6 tokens de bot, pero **ninguna variable de
> chat** — así que hoy no puede salir nada a nadie. El camino sí se comprobó de
> punta a punta con un emisor de prueba, sin tocar la red:
>
> | Evento | Bot | Destino |
> |---|---|---|
> | `blockchain:anomaly_detected` | DevOps | ✅ |
> | `treasury:runway_critical` | CFO | ✅ |
> | `operations:anomaly_detected` | DevOps | ✅ |
>
> Para un envío real solo falta el `chatId` de cada bot. Mientras no exista,
> `HitlNotifier` construye el aviso y no tiene a dónde mandarlo — la aprobación
> sigue en el panel, que es el comportamiento correcto.


- `BEZHAS_API_URL=http://localhost:3001` y validar los 5 endpoints en vivo. Son públicos,
  así que el conector funciona sin credenciales; si alguno pasa a requerir auth, entra por
  el puente del punto siguiente.
- **Puente de auth:** hoy son dos mundos (`x-api-key` de OPERANT vs JWT de BeZhas). Añadir
  en `business-ops/src/server.js` un middleware que acepte **también** el JWT de BeZhas
  verificándolo con el mismo `JWT_SECRET`, y mapee `req.user.{userId,address,role}` →
  tenant. Mantener `x-api-key` para integraciones máquina-a-máquina.
  No duplicar el secreto: leerlo de la misma fuente que `api/config/secrets.js`.
- Aprovisionar el tenant `bezhas` con `config/business/bezhas.json` (ya contiene las
  direcciones on-chain reales y las reglas de honestidad).
- Programar los trabajos recurrentes: monitor on-chain (30 min), runway (diario),
  digest del CEO (diario).

**Criterio de salida:** el monitor on-chain reporta datos reales (`simulated: false`) y una
anomalía provocada llega a Telegram.

### Fase 2 — HITL único (4 → 1) · ✅ HECHA (con un cambio de diseño)

> **El plan decía convertir `api/services/hitlQueue.js` en cliente de
> business-ops. No se hizo, y no debe hacerse.** Al leer el código aparecieron
> dos razones:
>
> 1. Su interfaz es **síncrona** (`submit`, `approve`, `consume` devuelven el
>    trabajo, no una promesa). Convertirla en cliente de red obliga a hacer
>    asíncrono todo `routes/energy.js` — lo contrario del objetivo declarado.
> 2. Y sobre todo: dejaría las aprobaciones de **mando eléctrico** dependiendo
>    de que un segundo servicio esté vivo. Si business-ops cae, un operador
>    tiene que poder **rechazar** un deslastre igual. Una aprobación que no se
>    puede denegar es peor que no tener panel unificado. Es la misma lección
>    que OPERANT ya aprendió cuando un DNS caído de Telegram le tumbó el
>    proceso (ver el comentario en `HITLGate.request`).
>
> **Diseño aplicado: espejo, no cliente.** business-ops es el sistema de
> registro único; cada cola sigue siendo dueña de su estado.
>
> - `api/services/hitlMirror.js` (nuevo) refleja cada transición —alta,
>   aprobación, consumo, rechazo— en business-ops. Fuego y olvido: no bloquea,
>   no lanza, no espera. Se autentica con el puente de JWT de la Fase 1, así que
>   no hay credencial nueva entre servicios.
> - `HITLGate.mirror()` (nuevo) las recibe: van a la misma bandeja y a la misma
>   auditoría, marcadas `decidableAqui: false` — se ven aquí, se deciden allí.
> - `routes/agents.js` refleja también sus aprobaciones y rechazos.
>
> **Verificado en vivo:** un comando SCADA aparece en la bandeja de
> business-ops; al aprobarse en su plano, sale de ella; la auditoría guarda
> `hitl:mirror:pending` → `hitl:mirror:approved`. Y con **business-ops caído**,
> el ciclo SCADA completo (crear, aprobar, ejecutar, rechazar) responde 200.
>
> **Tests:** 583 en la API (6 nuevos, que fijan las dos propiedades críticas) ·
> 679 + 71 evals + smoke en business-ops.
>
> Queda fuera `api/middleware/hitl.js`, que ya se corrigió antes en esta misma
> sesión: aceptaba `x-human-approved` del propio llamante.


La pieza de más valor y la de más riesgo. Hoy conviven cuatro puertas de aprobación.

- `business-ops` (`core/HITLGate.js` + `platform/HitlNotifier.js`) pasa a ser **la única
  autoridad de aprobación**, con su cola persistida, enrutado por departamento y auditoría
  append-only.
- `api/services/hitlQueue.js` (usado por rutas de energía/SCADA) se reimplementa como
  **cliente** del HITL de `business-ops`, conservando su interfaz para no tocar `routes/energy.js`.
- `api/routes/agents.js:176-195` (`/api/hitl/pending|approve|reject`) pasa a proxear al
  HITL único en vez de a `manager.memory`.
- ⚠️ **Hallazgo de seguridad a corregir aquí:** `api/middleware/hitl.js` da por aprobada
  una acción si el propio llamante manda `humanApproved: true` en el body o la cabecera
  `x-human-approved: true`. Quien pueda invocar el endpoint puede autoaprobarse. Está
  importado en `api/routes/energy.js:41`, que gobierna comandos SCADA. La aprobación debe
  resolverse contra la cola del HITL por `jobId`, nunca contra una cabecera del cliente.

**Criterio de salida:** una aprobación aparece en un único panel; `x-human-approved` ya no
concede paso; los tests de energía siguen verdes.

### Fase 3 — Absorber `sales-agency` (la limpia) · ✅ HECHA

> **Sin datos que migrar.** El plan preveía rescatar la prospección existente;
> no había carpeta `data/`, así que el CRM en JSON estaba vacío.
>
> **Lo único que aportaba de verdad: cadencia por sector.** OPERANT ya tenía 11
> agentes de ventas, HITL para el frío, perfil de negocio y embudo completo —
> todo mejor que el monolito. Lo que no tenía era distinguir el ritmo por
> segmento: una sola cadencia global `[3, 7, 14]`. `sales-agency` sí lo hacía.
> - `followUpPolicy.cadenceFor(segmento, perfil)` (nuevo) traduce el calendario
>   del perfil (días desde el primer contacto) a esperas entre pasos.
> - `bezhas.json` gana `followUpCadence` y `sequenceAngles` para logística,
>   puerto, agro, importador/exportador y marketplace.
>
> **Su secuencia `crypto` NO se portó, a propósito.** Incumplía las
> `coldCopyRules` del propio perfil: asuntos como «BEZ-Coin — precio semilla
> $0.0075» o «Antes del listing en QuickSwap — último aviso» llevan jerga
> cripto, precio y presión en frío, justo lo que esas reglas prohíben. Un test
> lo fija: ningún ángulo portado puede contener esos términos.
>
> **Tests:** 685 pasan (6 nuevos) + 71 evals + smoke. `sales-agency/` eliminada
> (11 ficheros); no la referenciaba ningún código ni el CI.


952 líneas contra 11 agentes de ventas ya operativos en OPERANT.

- `modules/scout.js` → `agents/sales/LeadHunterAgent.js` + `platform/leadSources.js`
- `config/sequences.js` + `config/personas.js` → `platform/followUpPolicy.js` + perfil de negocio
- `modules/mailer.js` → `connectors/EmailConnector.js` (ya soporta Resend y SMTP)
- `modules/telegram.js` → `channels/TelegramChannel.js`
- `modules/db.js` → `Store` (SQLite/Postgres)
- Migrar los datos de prospección existentes antes de retirar la carpeta.

**Criterio de salida:** una secuencia de outreach completa corre por OPERANT con el frío
pasando por HITL. `sales-agency/` se elimina.

### Fase 4 — Absorber la parte JS de `aegis` y deduplicar · ✅ HECHA (el plan se equivocaba)

> **El plan daba por hecho que compliance y tokenomics estaban triplicados y
> había que portar el delta a OPERANT. Al leerlos, no es así.**
>
> No son la misma cosa, son concernencias distintas:
> - `aegis/ComplianceAgent.js` (596 l) es un **motor regulatorio**: MiCA, AEAT,
>   IRPF por tramos, informes. No es el trabajo de OPERANT.
> - `business-ops/src/compliance/screening.js` (27 l) es un **cribado previo a
>   transferir**: país sancionado, importe alto, wallet ausente. Se queda como
>   está.
> - `aegis/tokenomics.js` es un **router Express**, no un agente. Tampoco
>   duplica al `TokenomicsAgent`.
>
> **La duplicación real era otra:** `aegis/ComplianceAgent.js` y
> `agent-runtime/agents/ComplianceAgent.js` eran **byte a byte el mismo
> fichero** (mismo MD5). La copia viva es la de `agent-runtime` — es la que
> requiere `api/server.js`.
>
> **Y la capa Node de `aegis` entera era código muerto:**
> - Cero referencias externas a sus 5 `.js`.
> - `aegis` no tiene `package.json`.
> - Su `Dockerfile` arranca `uvicorn main:app`: el contenedor es solo Python.
> - `aegis/server.js` ni siquiera podía arrancar — requería `./routes/`, una
>   carpeta que no existe.
>
> **Hecho:** eliminados los 5 ficheros JS (`ComplianceAgent`, `tokenomics`,
> `agents`, `server`, `websocket`). El servicio Python queda intacto, que es el
> que `api/routes/aegis.js` consume por HTTP en `AEGIS_URL` (:8001).
>
> **Contrato verificado:** `/api/aegis/status` y `/api/aegis/logs` responden 401
> (vivas, pidiendo auth) igual que antes. 583 tests de la API en verde.

Compliance y Tokenomics existen **por triplicado**. Aquí se queda una sola copia.

- Inventariar qué hace `aegis/ComplianceAgent.js` (596 líneas) que **no** hagan
  `operant/compliance/screening.js` + `blockchain/ComplianceCheckAgent.js`, y portar solo
  ese delta.
- Igual con `aegis/tokenomics.js` (313) frente a `operant/treasury/TokenomicsAgent.js`.
- `aegis/agents.js`, `server.js`, `websocket.js` → revisar qué expone `/api/aegis` y
  `/api/ai-control` (alias legacy) y reapuntarlo.
- **La mitad Python se queda.** `main.py`, `routers/`, `models/`, `pyproject.toml` siguen
  siendo un servicio propio; OPERANT lo consume por HTTP como un conector más.

**Criterio de salida:** una sola implementación de compliance y una de tokenomics.
`/api/aegis` responde igual que antes (contrato intacto).

### Fase 5 — Absorber `agent-runtime` (la dura) · ✅ HECHA

> Las cuatro decisiones que quedaban abiertas tras el inventario se ejecutaron:
>
> **1. Los 5 agentes, dentro del proceso de la API.** El cableado vive ahora en
> `api/services/agentRuntime.js` — una sola copia — y lo arranca `index.js` en
> el PASO 3c, no bloqueante y a prueba de fallos: si el runtime no levanta, la
> API sigue sirviendo pagos, cadena y energía. Verificado en caliente:
> `/api/agents/health` responde 200 con **`agents: 5`**, y `/tasks` y
> `/hitl/pending` devuelven datos reales donde antes daban 500.
>
> **2. Las 33 tools, en el catálogo de OPERANT.** `RuntimeToolsConnector` entra
> como un conector más (`{ method, args }`, siendo `method` el nombre de la
> tool), con lista blanca explícita y circuito. `toolCatalog` les asigna
> categoría (`infra_read` / `infra_write`), así que **ahora los permisos pasan
> por dos sitios**: `PolicyEngine`/`RedLines` del tenant antes de salir, y
> `invokeWithPermissions` del runtime después. No es duplicación: la primera
> pregunta es «¿puede este agente de este tenant?», la segunda «¿puede este
> usuario del runtime?».
>
> **3. Componentes React a `control-center/frontend`.** 7 ficheros, 2391
> líneas: `CompliancePage`, `GovernancePage`, `AegisDashboard`,
> `AgentRuntimePage`, `TelegramStatusWidget` a `components/`; `useGovernance` y
> `useAgentRuntime` a `hooks/`. Sus imports (`'../hooks/useGovernance'`) solo
> resuelven ahí — donde estaban, apuntaban a una estructura inexistente.
>
> **4. Cableado duplicado, depurado.** `api/server.js` y
> `scripts/wire-agents.js` ya no requieren `agent-runtime` directamente: los dos
> usan el módulo compartido. Antes eran tres versiones del mismo cableado que
> podían divergir — y divergían: `index.js` no lo hacía en absoluto.
>
> **Tests:** 583 en la API · 692 + 71 evals + smoke en business-ops (7 nuevos
> para el conector de tools).

> **El paso 1 (inventario de capacidades) invalidó la premisa de la fase.**
> Inventario completo en [INVENTARIO-AGENT-RUNTIME.md](INVENTARIO-AGENT-RUNTIME.md).
>
> La fase daba por hecho «89 ficheros montados en `/api/agents`» y consistía en
> absorberlos conservando ese contrato. Medido:
> - `api/index.js` —el arranque real— **no referencia `agent-runtime` ni una vez**.
> - Monta `agentRoutes()` **sin argumentos**, así que `manager` llegaba
>   `undefined` y todo lo que lo tocaba devolvía **500**. No había contrato que
>   preservar: estaba roto. (También los endpoints HITL que se aseguraron antes
>   en esta sesión: protegidos, pero rotos.)
> - Lo que **sí** está vivo es `/api/runtime/*`: 33 tools, 8 comandos y 3
>   plugins respondiendo. Es infraestructura de producto —puente L1↔L2, gas,
>   validadores—, no operación de empresa. Disolverla en los departamentos de
>   OPERANT sería un error de categoría.
> - Los 5 agentes solo los instancian `api/server.js` (que no es el arranque) y
>   un script suelto. Están dormidos.
>
> **Hecho:** guarda `requiereRuntime` en las 13 rutas afectadas. Sin runtime
> cableado responden **503 `RUNTIME_NOT_WIRED`** explicando qué falta y dónde
> está el cableado, en vez de un 500 que parece una caída. Lo que no depende del
> runtime (`/api/agents/`, `/analytics`) sigue en 200, y `/api/runtime/health`
> intacto. 583 tests en verde.
>
> **Parada aquí a propósito.** Cablear el runtime en el arranque real levantaría
> cinco agentes dentro del proceso de la API; migrar las 33 tools al catálogo de
> OPERANT cambia por dónde pasan sus permisos. Son decisiones de producto, no
> arreglos. Las cuatro que quedan abiertas están listadas en el inventario.
>
> El job de CI de `agent-runtime` **se mantiene**: su cobertura no vive en
> ningún otro sitio.

89 ficheros, en CI y montado en `/api/agents`. Va por capas, no de golpe.

1. **Inventario de capacidades**: para cada uno de los 5 agentes (`Compliance`, `Security`,
   `Tokenomics`, `Trading`, `Workflow`) y las 10 tools, anotar quién los llama de verdad
   (`api/routes/agents.js`, `unified-agent.js`, `runtime.js`, bot de Telegram, SDK).
2. **Reubicar lo que no es operación de empresa**:
   - `tools/*.tool.js` (10) → catálogo de tool-use de OPERANT (`cognition/toolCatalog.js`),
     conservando su esquema; cada invocación pasa por `PolicyEngine`/`RedLines`.
   - `frontend/`, `CompliancePage.jsx`, `GovernancePage.jsx`, `useGovernance.js` →
     `control-center/frontend/`.
   - `sdk/`, `plugins/`, `commands/`, `permissions/` → evaluar uno a uno; `permissions/`
     probablemente se subsume en `PolicyEngine`.
3. **Fundir el núcleo duplicado**: `BaseAgent`, `TaskQueue`, `MemoryManager`,
   `OllamaGateway` → los equivalentes de OPERANT (que además tienen tests y evals).
4. **Mantener el contrato HTTP**: `/api/agents` sigue respondiendo igual; por dentro
   delega en `business-ops`. `agentRoutes()` ya es una factory lazy, buen punto de corte.
5. Retirar el job de CI de `agent-runtime` solo cuando su cobertura viva en `business-ops`.

**Criterio de salida:** `/api/agents` y `/api/runtime` con el mismo contrato, sin
`agent-runtime/` en el árbol y sin pérdida de cobertura en CI.

### Fase 6 — Producción · ⏳ EN CURSO (y el plan volvía a equivocarse)

- **Postgres con RLS** · ✅ ya estaba hecho cuando se escribió esta línea.
  `001_init.sql` activa `ENABLE` + `FORCE ROW LEVEL SECURITY` y `004_app_role.sql`
  crea `operant_app`, sin superusuario y sin `BYPASSRLS`.

- **`docker-compose.prod.yml`** · ✅ hecho, pero el trabajo no era el que decía el plan.
  `business-ops` **ya estaba** en el despliegue: `docker-compose.prod.yml` no es un
  compose autónomo sino un *override* (`-f docker-compose.yml -f docker-compose.prod.yml`),
  así que todo servicio del base entra en producción. Lo que faltaba era su endurecimiento
  —sin puerto publicado, `restart: always`, límites y rotación de logs—, y sobre todo esto:

  > **El compose de producción estaba roto.** El par base+prod ni siquiera producía un
  > proyecto válido: `service "bezhas-batcher" has neither an image nor a build context
  > specified: invalid compose project`.

  Sobreescribía ocho servicios inexistentes en el base. Compose no distingue entre ajustar
  un servicio y declarar uno nuevo: un override huérfano se vuelve un servicio sin imagen y
  el proyecto entero deja de parsear. Como `scripts/deploy-prod.sh` invoca justo ese par,
  **el despliegue de producción llevaba tiempo muerto y abortaba en el primer comando**.

  Arreglado: el base define `bezhas-api`, no `api`; `ai-gateway`, `control-center`,
  `bezhas-node` y `bezhas-batcher` no existían en ningún compose del repositorio. Sus
  bloques quedan comentados con el estado real de cada uno, para no perder la intención.

  Por el camino, dos cosas más que impedían arrancar el borde:
  - `nginx.conf` tenía una regex del WAF sin cerrar (`(\.\./|\.\.\)`) → `nginx: [emerg]`.
  - Los `proxy_pass` eran literales. Nginx resuelve los literales **al cargar la config**:
    un solo host ausente y no arranca nada. Pasados a variables con `resolver 127.0.0.11`,
    la resolución es por petición y lo que falte da 502 en su ruta sin tumbar el resto.

- **`agent-runtime` retirado** · ✅ el servicio sale del compose y su job sale del CI. La
  Fase 5 lo había absorbido en `api/services/agentRuntime.js`, pero seguía levantándose
  aparte: dos runtimes y dos fuentes de verdad para `/api/agents`. Nadie dependía de él.
  El directorio sigue en disco (116 MB) — borrarlo es decisión aparte.

- **Observabilidad** · ✅ hecha, y aquí también había algo roto de fondo.

  > **El stack de monitorización no podía arrancar.** Declaraba
  > `networks: bezhas-net: {external: true, name: bezhas-blockchain_default}`, y esa red
  > **no existe**: parecía el nombre autogenerado de un proyecto `bezhas-blockchain`, pero
  > el compose principal crea la suya con `name: bezhas-network`. Con `external: true` y un
  > nombre inexistente, `docker compose up` falla en seco; y de haber arrancado, habría
  > quedado en otra red que todo lo que debe raspar.

  Además `prometheus.yml` repetía el error de nombres del compose de producción
  (`api:3001` en vez de `bezhas-api:3001`) y raspaba cuatro servicios inexistentes
  —`aegis`, `bezhas-edge-node`, `geth`, `op-node`—. Medido en vivo antes del arreglo:
  **8 de 10 objetivos `down`**. Un tablero así enseña a ignorar los objetivos caídos, que
  es lo contrario de para lo que sirve. Los cuatro quedan comentados, como en el compose
  de producción.

  Un tercer fallo, más silencioso: el job `business-ops` se etiquetaba `service: api`, así
  que las métricas de OPERANT se mezclaban con las de la API en cualquier consulta por esa
  etiqueta y los paneles sumaban dos servicios como uno.

  Verificado tras el arreglo: `promtool check config` en verde, y **15 métricas distintas
  de OPERANT** llegando a Prometheus con sus etiquetas de tenant y departamento
  (`operant_tasks_total`, `operant_model_calls_total`, `operant_task_duration_ms`…).

  Sobre `OtlpExporter`: se queda dormido **a propósito**, y no es una tarea pendiente.
  Exporta métricas (no trazas) por push a un colector central, y no hay ninguno en el
  stack —ni Tempo, ni Jaeger, ni OTel Collector—. Como Prometheus ya raspa `/metrics`,
  montar un colector solo duplicaría los mismos datos. Cobra sentido el día que haya
  varios nodos empujando a un punto único; hasta entonces, encenderlo sería trabajo y
  coste sin dato nuevo.

- **Correo propio (Stalwart)** · ⏳ el servidor ya está configurado y sirviendo
  (`220 mail.bez.digital`, DKIM generado). Faltan el buzón emisor y el DNS de `bez.digital`
  —MX/SPF/DKIM/DMARC—, ambos tareas del operador. Ver `docs/CORREO-PROPIO-RUNBOOK.md`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Fase 5 rompe `/api/agents` en producción | Mantener contrato HTTP; delegar por dentro; retirar CI solo al final |
| Se pierde una capacidad de `agent-runtime` al fusionar | Inventario de capacidades **antes** de tocar código (Fase 5.1) |
| `x-human-approved` sigue permitiendo autoaprobación | Se corrige en Fase 2, antes de ampliar el alcance del HITL |
| Choque CJS/ESM al entrar en el monorepo | `business-ops` sin `"type": "module"`, como `api/` |
| `npm install` rompe el store de pnpm | `only-allow pnpm` ya lo impide; lockfile regenerado, no migrado |
| Coste LLM al activar 10 departamentos | Tiers de `ModelGateway`: local en Ollama para lo barato, Claude solo para decisiones |
| Deriva entre el perfil de negocio y las direcciones on-chain reales | `config/business/bezhas.json` pasa a ser la única fuente; contrastar con `CLAUDE.md` en CI |

---

## Verificación

```bash
# Fase 0 — OPERANT vivo dentro del monorepo
cd business-ops && pnpm install && pnpm test && pnpm evals && pnpm smoke
```

```bash
# Fase 1 — los 5 endpoints que consume el conector responden de verdad
for p in /api/blockchain/overview /api/validators/stats /api/treasury/stats /api/gas/status /api/validators/governance/proposals; do
  printf '%s -> ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3001$p"
done
```

```bash
# Fase 2 — la cabecera de autoaprobación ya no concede paso (debe devolver 428, no 200)
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3001/api/energy/demand-response \
  -H 'Content-Type: application/json' -H 'x-human-approved: true' \
  -d '{"requiresHumanApproval":true}'
```

```bash
# Fases 3-5 — sin regresión en el contrato HTTP de agentes
cd api && pnpm test:unit && pnpm test:e2e
```

> **`test:e2e` necesita cadena.** `live-chain.test.js` es la única suite que no
> levanta su propia Anvil: mide el despliegue real de `DeployAll.s.sol`. Sin cadena
> reventaba con 31 `AggregateError` vacíos —ECONNREFUSED envuelto por ethers— en cada
> ejecución. Ahora se **salta** diciendo qué falta, porque 31 rojos que solo significan
> "no había cadena" enseñan a ignorar los rojos justo en la suite que vigila los
> contratos. Para ejecutarla de verdad:
>
> ```bash
> anvil --port 8545 --silent &
> cd smart-contracts && forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast
> cd ../api && pnpm test:e2e     # 95/95, las 8 suites
> ```
>
> El puerto se puede cambiar con `LIVE_CHAIN_RPC_URL`.

Además, por fase: `GET /healthz` de `business-ops` en verde (store + modelo), y el digest
del CEO generándose con KPIs reales en vez de simulados.

### Resultado de esa verificación (ejecutada, no prevista)

Los 5 endpoints de la Fase 1 responden **200** desde el contenedor de OPERANT, y el digest
sale con `simulado: false` y KPIs reales (`plan=enterprise`, `tareasRecientes=10`).

Levantar la API para poder comprobarlo destapó cuatro fallos que la hacían **imposible de
arrancar desde el compose**, encadenados uno tras otro:

| Fallo | Efecto |
|---|---|
| `container_name: bezhas-postgres` duplicado con el proyecto `bezhas-hub` | `Conflict. The container name is already in use` |
| Puertos 5432 y 6379 del anfitrión ya ocupados por otros proyectos | `Bind for 0.0.0.0:5432 failed: port is already allocated` |
| El compose pasaba `BEZHAS_API_KEY`, pero `config/secrets.js` exige `INTERNAL_API_KEY` | La API moría en bucle: `FATAL: INTERNAL_API_KEY … required in production` |
| Stripe se instanciaba al importar el módulo | Sin `STRIPE_SECRET_KEY`, **toda** la API caía con `Neither apiKey nor config.authenticator provided` |

Los dos primeros son colisiones entre proyectos de compose: un `container_name` es global
al demonio Docker, no del proyecto. Los puertos del anfitrión pasan a ser configurables
(`POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`); dentro de la red no cambia nada.

El de Stripe merece nota aparte: `require('stripe')(process.env.STRIPE_SECRET_KEY)` en la
cabecera del módulo ataba el arranque de la plataforma entera a una clave de pagos. Pasa a
construirse de forma perezosa, así que ahora falta la clave → falla la facturación, y solo
ella. Es la misma doctrina que el resto de conectores: degradar donde duele, no en la raíz.

### Un defecto de diseño del propio digest

La caché servía un digest `[SIMULADO · model=claude-haiku-4-5]` **cuando el motor
configurado ya era Ollama desde hacía días**. `buildDigest` persistía siempre, y
`lastDigest` alimenta a todo el que no pida `?fresh=1`: un digest generado durante un rato
sin modelo se quedaba de titular fijo del panel del dueño para siempre.

Ahora un digest simulado no se cachea (se mira la bandera `simulated` del gateway, no el
prefijo del texto, que es presentación). El test que exigía lo contrario se actualizó al
contrato nuevo y se añadió cobertura del camino con modelo real, que antes no existía.

---

## Lo que queda fuera

- **No** se toca `openclaw`: sigue siendo el enrutador LLM.
- **No** se migra la mitad Python de `aegis`.
- **No** se cambian direcciones de contratos ni nada on-chain: OPERANT solo lee.
- La multi-tenancia para clientes externos es consecuencia de la fusión, no requisito de
  ninguna fase: se habilita sola cuando el tenant `bezhas` es estable.
