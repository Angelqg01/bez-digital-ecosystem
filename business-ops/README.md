# OPERANT — SaaS de Gestión Empresarial Autónoma

Plataforma **multi-tenant** que da a cada empresa cliente su propio "ejército" de agentes IA
que gestionan sus departamentos (ventas, atención, marketing, RR.HH., finanzas, operaciones)
de forma casi autónoma, 24/7, aprendiendo de cada interacción y escalando al humano solo lo
irreversible.

> Este repositorio es el **esqueleto funcional avanzado**: el núcleo (orquestación,
> multi-tenencia, HITL, guardrails, memoria, cuotas, facturación y panel) está implementado
> y probado. Los escuadrones de Ventas, Soporte, Marketing, Finanzas, RR.HH. y Operaciones
> ya tienen especialistas operativos en modo simulado o con conectores reales cuando hay
> credenciales.

**Adaptación a BeZhas (empresa Web3).** Además de los 6 departamentos genéricos, la
plataforma incorpora 4 verticales para operar una empresa blockchain real: **Blockchain
Ops** (vigilancia on-chain + cribado KYC/AML), **Legal/Compliance** (contratos y
normativa), **Tesorería/Tokenomics** (runway del Treasury DAO, salud del token) y
**Fundraising** (relación con inversores). Con ellos llegan dos líneas rojas nuevas —
mover activos on-chain y tocar un smart contract — que **ningún agente cruza sin
aprobación humana**. Ver §"Vertical BeZhas" abajo.

---

## Arranque rápido (modo simulado, sin claves)

```bash
npm install
npm run smoke      # prueba el flujo end-to-end sin API keys
npm run server     # levanta la API en http://localhost:4000
```

Sin `ANTHROPIC_API_KEY`, el `ModelGateway` responde en **modo simulado** para que puedas
probar toda la arquitectura sin gastar tokens. Añade la clave en `.env` para modo real.
El panel de control estático se sirve en `http://localhost:4000/panel.html`.

### Probar la API

```bash
# Alta de una empresa cliente
curl -X POST http://localhost:4000/tenants \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"acme","plan":"pro","departments":["sales","support"]}'

# Una solicitud de cliente final
curl -X POST http://localhost:4000/tenants/acme/handle \
  -H "Content-Type: application/json" \
  -d '{"text":"Quiero una demo y precio","channel":"web","customerId":"c1"}'
```

---

## Estructura del proyecto

```
operant-saas/
├── src/
│   ├── index.js              Punto de entrada
│   ├── server.js             API REST (Express) + middleware auth
│   ├── core/                 Núcleo: orquestación y multi-tenencia
│   │   ├── TenantManager.js     Aísla y aprovisiona cada empresa cliente
│   │   ├── Orchestrator.js      "Director General IA" por tenant (Nivel 1)
│   │   ├── TaskQueue.js         Cola con concurrencia limitada + aparcado HITL
│   │   ├── HITLGate.js          Human-in-the-loop
│   │   ├── executionContext.js  Contexto de tarea (AsyncLocalStorage)
│   │   └── EventBus.js          Bus de eventos por tenant
│   ├── agents/               El ejército — 10 departamentos
│   │   ├── BaseAgent.js         Clase base (think / act / thinkAndAct / remember)
│   │   ├── DepartmentManager.js Base de los managers (Nivel 2)
│   │   ├── index.js             Registro y ensamblador de departamentos
│   │   ├── sales/               Ventas (referencia del patrón)
│   │   ├── support/             Soporte (triage + KB/RAG + resolver + escalado)
│   │   ├── marketing/           Marketing (contenido + copy + SEO + redes)
│   │   ├── hr/                  RR.HH. (dudas + criba CV + agenda + onboarding)
│   │   ├── finance/             Finanzas (+ dispersión de BEZ-Coin vía HITL)
│   │   ├── operations/          Operaciones (coordinación + compras + inventario)
│   │   ├── blockchain/          ── BeZhas ── vigilancia on-chain + KYC/AML
│   │   ├── legal/               ── BeZhas ── contratos y normativa (RGPD/NIS2…)
│   │   ├── treasury/            ── BeZhas ── runway del Treasury DAO + tokenomics
│   │   └── fundraising/         ── BeZhas ── scoring y contacto con inversores
│   ├── cognition/            Capa cognitiva
│   │   ├── ModelGateway.js      Estrategia de modelos por tiers
│   │   ├── MemoryManager.js     Memoria corto plazo / episódica / semántica
│   │   ├── LearningEngine.js    Bucle de mejora continua
│   │   └── providers/ollama.js  Motor local + caché de embeddings
│   ├── guardrails/           Seguridad y cumplimiento
│   │   ├── RedLines.js          Las acciones que NUNCA se ejecutan solas
│   │   ├── PolicyEngine.js      Permite / bloquea / requiere aprobación
│   │   └── AuditLog.js          Registro de auditoría append-only
│   ├── compliance/           Cribado KYC/AML (previo a mover activos)
│   ├── connectors/           Herramientas externas (CRM, email, pago, on-chain...)
│   ├── platform/             Servicios transversales (cuotas, coste, agenda, avisos)
│   ├── channels/             Canales de entrada (web, Telegram, WhatsApp)
│   └── db/                    Esquema SQL + migraciones (RLS multi-tenant)
├── config/
│   ├── plans.json            Planes comerciales y sus departamentos
│   ├── departments.json      Definición de cada departamento
│   └── business/             Perfil de negocio por tenant (p. ej. bezhas.json)
├── docs/                     Documentación detallada (leer en este orden ↓)
├── evals/                    Contratos de comportamiento (npm run evals)
└── test/                     Tests unitarios + integración HTTP + smoke + piloto
```

---

## Documentación

Lee en este orden:

1. **`docs/ARCHITECTURE.md`** — las capas y cómo encajan
2. **`docs/AGENTS.md`** — la jerarquía del ejército y cómo crear un agente nuevo
3. **`docs/MULTI-TENANCY.md`** — aislamiento de datos entre clientes
4. **`docs/GUARDRAILS.md`** — las líneas rojas y el HITL
5. **`docs/LEARNING.md`** — cómo "aprende" de verdad el sistema
6. **`docs/MODEL-STRATEGY.md`** — qué modelo para cada trabajo
7. **`docs/API.md`** — endpoints REST
8. **`docs/CORREO-PROPIO.md`** — poner en pie el correo propio (Stalwart, SPF/DKIM/DMARC)
9. **`docs/ROADMAP.md`** — orden de construcción

---

## Estado actual

| Componente | Estado |
|---|---|
| Núcleo (orquestación, tenancy, cola, bus) | ✅ Implementado y probado |
| HITL + Guardrails + Auditoría | ✅ Implementado |
| Memoria (3 niveles) | ✅ Stub funcional en memoria |
| ModelGateway (tiers) | ✅ Implementado (modo simulado + Anthropic) |
| Escuadrón de Ventas | ✅ Completo (referencia) |
| Escuadrón de Soporte | ✅ Completo (triage + KB/RAG + resolver + escalado) |
| Escuadrón de Finanzas | ✅ Completo (advisor + facturas + cobros + previsión) |
| Escuadrón de Marketing | ✅ Completo (contenido + copy + SEO + redes) |
| Escuadrón de RR.HH. | ✅ Completo (dudas + criba CV + agenda + onboarding) |
| Escuadrón de Operaciones | ✅ Completo (coordinación + compras + inventario + informes) |
| **Blockchain Ops** (BeZhas) | ✅ `onchain-monitor` (lee cadena, validadores, tesorería y gas vía `BeZhasCoreConnector`; si el stack no responde lo reporta como anomalía en vez de fingir normalidad) + `compliance-check` (cribado KYC/AML: importe, país de riesgo, datos incompletos). Vigilancia programada cada 30 min |
| **Legal / Compliance** (BeZhas) | ✅ `contract-review` (señala cláusulas de riesgo; **firmar = línea roja** → HITL) + `regulatory-advisor` (RGPD, ENS, NIS2, DORA, Crea y Crece, Veri*factu; nunca vinculante) |
| **Tesorería / Tokenomics** (BeZhas) | ✅ `runway` (meses de autonomía del Treasury DAO; alerta crítica solo con dato REAL, nunca con uno simulado) + `tokenomics` (salud del token, sin asesoría de inversión). Cálculo diario programado |
| **Fundraising / Inversores** (BeZhas) | ✅ `investor-scorer` (0-100 según tesis) + `investor-outreach` (mismas líneas rojas que Ventas: cuenta vetada → bloqueo; frío → HITL) |
| **Líneas rojas on-chain** (BeZhas) | ✅ `crypto_asset_movement` (transferir BEZ-Coin, tesorería, staking, wallets) y `smart_contract_change` (deploy/upgrade/pausa/roles). Ningún override las relaja. Direcciones reales en `config/business/bezhas.json` |
| **Venta de BEZ-Coin automatizada** (Stripe → token) | ✅ Webhook `POST /webhooks/stripe/:tenantId` con firma HMAC verificada → calcula tokens al precio semilla → cribado KYC/AML → **transferencia siempre a HITL**. Firma con una wallet de dispersión dedicada (float limitado), nunca con la clave del Treasury |
| Avisos HITL por Telegram (por departamento) | ✅ Conectado en vivo (CFO + marketing) |
| Coste y cuotas por tenant (CostTracker + UsageMeter) | ✅ Implementado |
| Persistencia (Store: memoria + **SQLite embebido** + Postgres/RLS) | ✅ SQLite por defecto en el server (`data/operant.db`): tenants, claves de API, memoria, hechos y auditoría sobreviven a reinicios (rehidratación al arrancar). **Postgres verificado en vivo**: los tres adaptadores cumplen el mismo contrato (`test/store-contract.test.js`, 35 pruebas, las de Postgres contra la base real), aislamiento por RLS forzada comprobado con consultas sin `WHERE`, y alta → tarea → reinicio → rehidratación probado de punta a punta contra la API |
| Resiliencia del motor IA (fallback a simulado si el proveedor falla) | ✅ `ModelGateway.fallbackToSimulated` — la tarea nunca muere por un fallo del proveedor |
| **Tool-use** (el modelo invoca conectores; guardrails por invocación) | ✅ `BaseAgent.thinkAndAct` + `ModelGateway.completeWithTools` + `cognition/toolCatalog` — cada llamada del modelo pasa por PolicyEngine/RedLines y HITL; los rechazos se realimentan al modelo. Soporta Claude y Ollama. Piloto en producción: `OpsCoordinatorAgent` |
| Persistencia de KB, cuota consumida y coste acumulado | ✅ Sobreviven a reinicios (facts por tenant en el Store); rehidratación al arrancar |
| **Agentes proactivos** (Scheduler: trabajan sin que nadie pregunte) | ✅ Trabajos recurrentes por tenant, persistidos; misma cola, cuota y guardrails que una solicitud humana. `GET/PUT/DELETE /tenants/:id/schedules` |
| **Digest del CEO** (resumen ejecutivo diario cross-departamento) | ✅ `platform/digest.js`: KPIs reales + redacción del modelo, persistido. Generación diaria automática (trabajo por defecto en el alta) y bajo demanda: `GET /tenants/:id/digest[?fresh=1]` |
| **Adaptador MCP** (ecosistema estándar de integraciones) | ✅ `connectors/MCPConnector.js` — cliente MCP por stdio sin dependencias; cualquier servidor MCP (CRM, ERP, miles de herramientas) entra como un conector más. Sus herramientas se exponen al tool-use con esquemas reales y categoría de política `external` (endurecible por tenant) |
| **Tests de integración HTTP** (la capa expuesta a internet) | ✅ `test/http-api.test.js`: 30 pruebas contra el servidor real (`app.listen(0)` + fetch, sin dobles). Cubren autenticación y ámbito por tenant (una clave no abre los recursos de otro), firma HMAC del webhook de Stripe (ausente, inválida, de otro secreto y **cuerpo manipulado con firma legítima**), que un pago con wallet deja la transferencia esperando al humano y no la ejecuta, las defensas del formulario público (honeypot, consentimiento RGPD, throttle por IP), el secreto de los canales de entrada y el enlace firmado del CSAT. Corren con el `.env` real fuera de alcance: un HITL de prueba no manda mensajes de verdad |
| **Evals + CI** (proteger el comportamiento, no solo el código) | ✅ `evals/` con **71 contratos**: routing, soporte anti-alucinación, líneas rojas (incl. on-chain y firma), cribado KYC/AML, runway de tesorería y bucle de herramientas. `npm run evals` (o `EVALS_LIVE=1` contra modelo real) + workflow de CI con tests+evals+smoke |
| **Aparcado HITL** (una aprobación pendiente no congela al tenant) | ✅ La tarea que espera a un humano **suelta su hueco de concurrencia** y lo recupera con prioridad al decidirse (`TaskQueue.park/unpark` + `executionContext`). Estado propio `awaiting_approval` y latencia del agente separada de la espera humana (`ms` vs `waitedMs`). Antes, N aprobaciones pendientes bloqueaban la cola entera |
| **Alertas proactivas a Telegram** (el aviso llega solo) | ✅ `HitlNotifier.attach()` suscribe el bus del tenant: anomalía on-chain → bot DevOps, runway crítico → bot CFO, anomalía operativa → bot DevOps. Antes los agentes emitían el evento y nadie escuchaba |
| **Resiliencia y coste** (circuit breaker + caché) | ✅ Circuit breaker en `BeZhasCoreConnector` (3 fallos → 60 s sin tocar la red, media apertura al vencer) y caché LRU de embeddings en el proveedor Ollama (deterministas; se llaman en cada `think()`). No se cachean generaciones del LLM: devolver un borrador cacheado a otro cliente sería un fallo real |
| **Ventana caliente de tareas** (la RAM no crece sin límite) | ✅ `Orchestrator` mantiene las últimas 200 en memoria y poda solo las terminadas (nunca lo que está en vuelo o esperando aprobación); `findTask()` recupera del Store lo ya podado, así la API no pierde nada |
| **Exportador OTLP + alertas de salud** | ✅ `OtlpExporter` empuja métricas a SigNoz/Grafana/OTel Collector (OTLP HTTP+JSON, sin dependencias; sin `OTEL_EXPORTER_OTLP_ENDPOINT` no arranca) — verificado contra un colector real, con la conversión de buckets acumulados→OTLP correcta. `AlertRules` + `HealthWatchdog`: 5 umbrales (tasa de fallo, dead-letter, cuota antes de cortar, latencia y **degradación a simulado**, crítica porque el contenido deja de ser fiable sin que nada "falle"). Deduplicado: avisa al aparecer, al empeorar y al resolverse, nunca en cada ciclo. `GET /tenants/:id/alerts` · `GET /observability/otlp` |
| **Reintentos automáticos + dead-letter** | ✅ Un fallo transitorio se reintenta solo (backoff exponencial con jitter, 3 intentos) sin retener hueco de cola. **Nunca se reintenta lo que ya tuvo efecto fuera** (email enviado, CRM escrito, workflow disparado): repetirlo lo duplicaría, así que lo decide un humano. Lo no clasificado en `toolCatalog.READ_ONLY_METHODS` se asume con efecto — el olvido vuelve al sistema más cauto, nunca menos. Los errores permanentes (departamento inexistente, cuota agotada) no se reintentan. Panel: `3× dead-letter` y `con efecto` |
| **Durabilidad de tareas y HITL** (nada muere al reiniciar) | ✅ Toda transición de tarea y toda solicitud/decisión HITL se persisten. Tras un reinicio: tareas en vuelo → `interrupted` (reintenables con `POST .../tasks/:id/retry` o desde el panel); aprobaciones pendientes → huérfanas decidibles: el sí humano ejecuta la acción vía el conector, el no queda registrado |
| **Motor IA local real** (Ollama, coste marginal cero) | ✅ Verificado en vivo con `qwen2.5:3b` (dimensionado a 8 GB RAM) + `nomic-embed-text`: los 3 tiers en local, borradores de venta reales y **RAG semántico** (la KB empareja "olvidé mis credenciales" → "Restablecer contraseña" sin palabras en común, score 0.63, resuelto sin humano). Backfill de embeddings al hidratar |
| **Perfil de negocio por tenant** (los agentes hablan como la empresa) | ✅ `config/business/<id>.json` + `BusinessProfile.js`: identidad, propuesta de valor, lenguaje ("Tubería de Cristal"), segmentación, guía de scoring, cuentas vetadas y reglas de honestidad. Compone los prompts (`BaseAgent._system`), persiste por tenant y se rehidrata (`businessId`). Perfil real de BeZhas verificado en vivo: cuenta excluida bloqueada, borrador en frío sin jerga cripto, cold → HITL |
| **Aprendizaje continuo** (LearningEngine: aprende de cada interacción) | ✅ Destila la memoria episódica de cada agente en un **playbook** (qué funciona / cuándo escalar) con métricas de autonomía, lo persiste y lo **reinyecta en sus prompts futuros**. Acción `learn` del Scheduler + `GET /tenants/:id/playbooks` / `POST .../learn` + tarjeta en el panel. Verificado en vivo con IA local (3 agentes destilaron su playbook) |
| **Observabilidad** (métricas, trazas y health, forma OTel) | ✅ `Telemetry.js`: contadores (tareas, modelo, tokens, HITL, tool-calls, errores) + histograma de latencia (tarea y modelo) + trazas por tarea. `GET /metrics` (formato Prometheus), `GET /healthz` (chequea store+modelo), `GET /tenants/:id/traces` + tarjeta en el panel. Verificado en vivo |
| **Correo propio** (Stalwart) | 🟡 Conector listo y **honesto**: comprueba el canal sin enviar (handshake SMTP real, no un "¿el puerto está abierto?"), y si no responde queda `degradado` — `/healthz` lo reporta y ningún envío se da por hecho. **Un buzón por departamento** (`ventas@`, `soporte@`, `facturacion@`… en `bez.digital`): lo resuelve el perfil de negocio y lo inyecta `BaseAgent`, así que ningún agente tiene que acordarse de su remitente. Falta el servicio en pie: Stalwart arranca en modo bootstrap y `bez.digital` no tiene MX/SPF/DKIM/DMARC. Runbook en `docs/CORREO-PROPIO.md` |
| **Conectores en modo real** (envían de verdad al configurar credenciales) | ✅ Email (Resend HTTP / SMTP nodemailer), Stripe (enlaces de cobro + facturas; **nunca mueve fondos** — línea roja), Cal.com v2 (agenda), Twenty CRM (REST), Telegram/WhatsApp (canales), LinkedIn (publicar en feed de miembro con `w_member_social`; publicar en página de organización requiere aprobación del Partner Program), **Microsoft Learn MCP** (docs de MS/Azure vía transporte HTTP MCP, solo lectura). Sin credenciales → simulado. El envío en frío y todo lo irreversible siguen pasando por **HITL**. Cableado probado con `fetch` inyectado (sin credenciales ni envíos reales) |
| **Conectores MCP** (Model Context Protocol, spec 2025-06-18) | ✅ Transporte **stdio** (servidores locales tipo `npx twenty-mcp-server`) y **HTTP Streamable** (servidores remotos como `https://learn.microsoft.com/api/mcp`). Descubrimiento de herramientas vía `tools/list`, invocación vía `tools/call`; cada llamada pasa por PolicyEngine/RedLines igual que cualquier conector. Ver `src/connectors/MCPConnector.js` |
| **Captación de leads end-to-end** | ✅ `LeadFunnel`: descubrimiento multi-fuente (formulario web, listas propias, búsqueda pública vía MCP, inbound de LinkedIn por UTM) → puntuación ICP → `PitchMatcherAgent` elige la SubApp de BeZhas y el ángulo → outreach en frío **siempre por HITL** → `LeadOutcomeTracker` reentrena los pesos para el siguiente ciclo. Captación pública en `POST /intake/:tenantId` con consentimiento RGPD, honeypot, throttle por IP y techo de cola; resultados por webhook firmado (HMAC-SHA256) |
| Panel de control + facturación | ✅ Consola estática con onboarding, KPIs, HITL, KB y políticas |
| **Stack soberano** (todo propio, open source) | 🟡 **Cimientos verificados en vivo** (`npm run pilot`, 30/30): Postgres+pgvector con RLS, MinIO como almacén real y Ollama generando y embebiendo en local, sin una sola llamada de pago. Pendientes las capas de comunicaciones, banco y ERP (`docs/STACK-SOBERANO.md`) |
| Motor IA híbrido por tier (Claude + Ollama local) | ✅ Cableado (`cognition/providers/ollama.js`) y verificado en el piloto: con un modelo descargado, los tres tiers corren en local y el borrador en frío de Ventas lo escribe la máquina del cliente |
| Vertical Ventas soberano (Twenty CRM + email propio + HITL) | ✅ End-to-end (`test/sales-vertical.test.js`) |
| **Memoria semántica real** (RAG por similitud, no solo cronológico) | ✅ `recall()` devuelve los k casos más parecidos por coseno en los tres adaptadores del Store; orden cronológico desempatado por id (los timestamps en ms empataban). `test/vector-recall.test.js` |
| **Automatización propia** (n8n como pegamento de eventos) | ✅ `connectors/AutomationConnector.js` — webhooks + API de n8n auto-alojado, `tenantId` inyectado en cada evento (el aislamiento no depende del workflow). Política separada: `automation` (disparar) vs `automation_read` (consultar), porque un workflow es poder arbitrario — `PUT /tenants/:id/policies/automation → always_approve` lo endurece de un golpe. Sin `N8N_API_URL` → simulado. Testeado en `test/automation.test.js` |

---

## Vertical BeZhas

El tenant `bezhas` (plan enterprise, 10 departamentos) es el primer cliente real de la
plataforma y la razón de los 4 departamentos Web3. Lo que lo hace distinto de un tenant
genérico:

**Su perfil de negocio manda sobre los prompts.** `config/business/bezhas.json` define
identidad, propuesta de valor, segmentación de mercado, guía de scoring, cuentas vetadas
(Acuerdo V1) y las reglas de honestidad — incluida la prohibición de jerga cripto en frío.
Todo agente compone su prompt sobre ese perfil.

**Sus activos on-chain están declarados, no adivinados.** El perfil lista las direcciones
reales (BEZ-Coin en Polygon y BNB Chain, Treasury DAO, QualityEscrow, Hot Wallet) y se
inyectan en el preámbulo de cada agente con una advertencia explícita: nunca autorizar un
movimiento sin aprobación humana.

**El dinero y los contratos tienen dos frenos, no uno.** Además de las líneas rojas
universales (mover dinero, firmar, contratar), hay dos específicas: `crypto_asset_movement`
y `smart_contract_change`. Ningún override de tenant puede relajarlas — se evalúan antes.

**Cada tipo de aprobación va al humano correcto.** Los avisos HITL se enrutan por bot de
Telegram según departamento y categoría: cripto/contratos → DevOps, finanzas y tesorería →
CFO, legal/firmas/empleo → Bufete, marketing → CMO, resto → CEO.

**Vigila sin que nadie pregunte.** Al aprovisionar un tenant con esos departamentos se
programan solos: digest ejecutivo y destilado de playbooks (diarios), monitor on-chain
(cada 30 min) y runway de tesorería (diario).

> El conector `BeZhasCoreConnector` habla con la API real del monorepo
> `BeZhas-Blockchain` (`:3001`) en **solo lectura**. Sin ese stack levantado degrada a
> simulado y lo dice — no inventa métricas de cadena.

---

**Aviso legal:** las decisiones de cumplimiento (RGPD, normativa laboral en RR.HH.,
normativa de valores) deben validarse con un profesional. Este código es una base técnica,
no asesoría legal.
