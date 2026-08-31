# Plan y estructura de desarrollo — OPERANT

> Documento vivo. Nació del estado del esqueleto (junio 2026) y traza el camino de
> "prototipo simulado" a "producto con clientes de pago". Complementa `ROADMAP.md`
> con detalle de ingeniería y un catálogo de funciones por departamento.
>
> **Última revisión: julio 2026.** Fases 0-5 cerradas · 547 tests · 71 evals · smoke.

---

## 1. Estado actual

| Capa | Estado |
|---|---|
| **Núcleo** | ✅ Orchestrator, TaskQueue (con aparcado HITL), EventBus, TenantManager. Tareas persistidas y rehidratadas; las que quedan en vuelo → `interrupted` y reintentables |
| **HITL** | ✅ Bucle cerrado: `act()` espera la decisión, y la tarea **suelta su hueco de cola** mientras espera (§2.5). Aprobaciones durables: sobreviven a reinicios como huérfanas decidibles |
| **Guardrails** | ✅ RedLines (10, incl. on-chain y smart contracts) + PolicyEngine (overrides que solo endurecen) + AuditLog persistido. Cuotas de plan aplicadas |
| **Cognición** | ✅ ModelGateway híbrido (Anthropic + Ollama local) con reintentos/backoff y fallback a simulado · RAG semántico real por coseno · LearningEngine destilando playbooks · tool-use con guardrails por invocación |
| **Agentes** | ✅ **10 departamentos** completos: los 6 genéricos + Blockchain Ops, Legal, Tesorería y Fundraising (vertical BeZhas, §2.5) |
| **Conectores** | ✅ Reales tras credenciales: email (Resend/SMTP), Stripe, Cal.com, Twenty CRM, Telegram/WhatsApp, MCP, n8n, blockchain (ethers) y `bezhas-core`. Sin credenciales → simulado explícito |
| **API** | ✅ Express + clave por tenant (hash + rotación), scoping, rate-limit por plan, webhooks (Stripe con firma HMAC), billing |
| **Datos** | ✅ Store con 3 adaptadores: memoria, **SQLite embebido** (por defecto) y Postgres/RLS. Postgres pendiente de verificar en vivo |
| **Frontend** | ✅ Panel estático: onboarding, KPIs, bandeja HITL, KB, políticas, agenda, trazas y digest; tiempo real por SSE |
| **Calidad** | ✅ 547 tests + 71 evals + smoke, en CI. *Regla: ningún cambio de prompt entra sin pasar evals* |

**Principio rector** (de `ROADMAP.md`): *un cliente real usando un departamento de verdad
> seis departamentos a medias*. Se respetó: Ventas primero, luego Soporte, y solo después
el resto. Hoy el cliente real es **BeZhas** (§2.5).

---

## 2. Plan por fases

### 2.0 — Fase 0: Cerrar cimientos (1–2 semanas) · *bloqueante*

Antes de añadir departamentos hay que cerrar lo que ya está a medias:

1. ✅ **Cerrar el bucle HITL.** `BaseAgent.act()` espera la resolución del gate y reanuda
   tras el "sí" humano; `hitl` inyectado en el ctx del agente.
   *Ampliado en julio 2026:* esperar ya no cuesta un hueco de concurrencia — ver §2.5.4.
2. **Persistencia real (Postgres + pgvector).** ✅ Hecho: abstracción `Store`
   (`platform/InMemoryStore` + `platform/SqliteStore` por defecto + `platform/PostgresStore`
   con RLS por tenant), cableada en `MemoryManager` y `AuditLog`; migraciones 000→004 y
   `docker-compose` (`npm run db:up`). ✅ **Embeddings reales y búsqueda por similitud**
   cerrados en julio: `recall()` devuelve los k casos más parecidos por coseno en los tres
   adaptadores (antes solo los más recientes). *Pendiente:* verificar contra un Postgres vivo.
3. **Reintentos + backoff + timeout** en `ModelGateway.complete()`. ✅ Hecho:
   reintenta 429/408/409/5xx + errores de red + timeout, con backoff exponencial
   y jitter; IDs de modelo actualizados a los vigentes (`claude-opus-4-8` /
   `claude-sonnet-4-6` / `claude-haiku-4-5` — el anterior `claude-sonnet-4-20250514`
   se retira el 15-jun-2026). Testeado en `test/model-gateway.test.js`.
4. **Tests del núcleo** (Orchestrator, TaskQueue, PolicyEngine, HITL) + CI.

### 2.1 — Fase 1: Vertical de Soporte end-to-end (2–3 semanas)

El segundo departamento más rentable y el más fácil de demostrar valor.

- ✅ Especialistas (patrón `sales/`): `TriageAgent`, `KnowledgeBaseAgent` (RAG),
  `ResolverAgent`, `EscalationAgent`, orquestados en pipeline por `SupportManager`.
- ✅ **Base de conocimiento por tenant** (`platform/KnowledgeBase.js`) con endpoint de
  ingesta `POST /tenants/:id/kb`. Recuperación por solapamiento de términos
  (*TODO: embeddings/pgvector*). Testeado en `test/support.test.js`.
- ✅ Canal de entrada **web síncrono**: abstracción `channels/` (`BaseChannel` + `WebChannel`)
  + endpoint `POST /channels/web/:tenantId/inbound` que normaliza → procesa →
  **devuelve la respuesta** (vía `Orchestrator.handleAndWait`/`waitForTask`, respetando
  cola, cuota y concurrencia). Testeado en `test/channels.test.js`.
- ✅ Canales **Telegram, WhatsApp (Meta) y email** (`channels/*Channel.js` + `transports.js`):
  parseo de webhook, verificación por proveedor, handshake GET de Meta y envío de la
  respuesta por la API (simulado sin credenciales). Endpoint único `ALL /channels/:canal/:id/inbound`.
  Testeado en `test/channels-providers.test.js`. Credenciales en `.env.example`.
- ✅ Métricas de Soporte (`platform/SupportMetrics.js`): tickets atendidos, % resuelto
  sin humano, tasa de escalado, desglose por categoría y latencia media; suscritas al
  bus del tenant y expuestas en `GET /tenants/:id/support/metrics`. Testeado en
  `test/support-metrics.test.js`. ✅ **CSAT real cerrado** en julio 2026 (§5.5): encuesta firmada al cliente final, expuesta junto a los KPIs internos en el mismo endpoint.

### 2.2 — Fase 2: Multi-tenancy y comercialización (3–4 semanas)

- ✅ **UsageMeter** (Fase 0): cuotas de plan aplicadas.
- ✅ **Auth real por tenant**: `ApiKeyRegistry` (clave por tenant, hash, rotación) +
  middleware `auth`/`scopeToTenant` (cada clave solo ve lo suyo; admin = `INTERNAL_API_KEY`).
  **Rate limiting** por plan (`RateLimiter`, `maxRequestsPerMinute`). Testeado en `test/onboarding.test.js`.
- ✅ **Onboarding self-service**: `POST /signup` → valida plan, limita departamentos al plan,
  aprovisiona y devuelve la clave de API (`platform/onboarding.js`).
- ✅ **Facturación**: `Billing` + `billingProvider` (Stripe tras `STRIPE_SECRET_KEY`, simulado
  por defecto). Suscripción en el alta y factura del periodo (cuota del plan + excedente de
  llamadas medido por el `UsageMeter`) en `GET /tenants/:id/billing/invoice`. Testeado en
  `test/billing.test.js`. *Ruta Stripe real sin verificar (requiere claves).*

### 2.3 — Fase 3: Panel de control (3–4 semanas)

- ✅ **Endpoint agregado** `GET /tenants/:id/dashboard` (`platform/dashboard.js`): plan, consumo,
  factura, KPIs de Soporte, aprobaciones HITL y últimas tareas en una sola llamada. Testeado.
- ✅ **Panel estático** `public/panel.html` (sin build): KPIs + coste + factura + KPIs de Soporte
  + **bandeja HITL con aprobar/rechazar** + últimas tareas. Servido en `/panel.html`.
- ✅ **Tiempo real (SSE)**: `platform/sse.js` + `GET /tenants/:id/events` emiten los eventos
  del bus (HITL, tareas, escalados); el panel se refresca solo (`EventSource`). Testeado en `test/sse.test.js`.
- ✅ **Push de HITL a Telegram** (`platform/HitlNotifier.js`): al quedar una acción pendiente,
  se avisa al chat del operador (por defecto o por tenant vía `PUT /tenants/:id/hitl/telegram`).
  Testeado en `test/hitl-notifier.test.js`.
- ✅ **Editor de políticas del tenant**: `PolicyEngine.setOverride/removeOverride/getOverrides`
  (solo `always_approve`/`block` — endurecer, nunca relajar; las líneas rojas se evalúan antes).
  Endpoints `GET/PUT/DELETE /tenants/:id/policies[/:category]`; visible en el dashboard.
  Testeado en `test/policies.test.js`.

> **Fase 3 cerrada.** Panel + tiempo real (SSE) + push HITL a Telegram (por departamento) + editor de políticas.

### 2.4 — Fase 4: Resto de departamentos a demanda (4–8 semanas)

- ✅ **Finanzas**: `advisor`, `invoice`, `collections` (AR chaser; cobrar = línea roja → CFO bot),
  `forecast`. Enrutado por tipo. Testeado en `test/finance-marketing.test.js`.
- ✅ **Marketing**: `content`, `copy`, `seo`, `social` (publicar = línea roja → bot de marketing).
- ✅ **RR.HH.**: `advisor` (dudas), `cv-screener` (criba; contratar = línea roja), `scheduler`, `onboarding`.
- ✅ **Operaciones**: `coordinator`, `procurement` (pagar proveedor = línea roja), `inventory`, `report`.
  Testeado en `test/hr-operations.test.js`.

> **Los 6 departamentos están completos.** Sales, Support, Finance, Marketing, HR y Operations,
> todos con su escuadrón, enrutado y líneas rojas → HITL. 84 tests verdes.

### 2.5 — Fase 5: Vertical BeZhas + endurecimiento (julio 2026)

Primer cliente real: **BeZhas**, empresa Web3 con tesorería, contratos inteligentes y
cumplimiento normativo. Los 6 departamentos genéricos no cubrían nada de eso.

**5.1 — Puente al stack real.** `connectors/BeZhasCoreConnector.js`: lectura de la API
del monorepo `BeZhas-Blockchain` (`:3001`) — cadena, validadores, tesorería, gas y
gobernanza. **Solo lee.** Sin stack levantado degrada a simulado y lo declara, para que
ningún agente construya un análisis sobre datos inventados. Circuit breaker: 3 fallos
seguidos abren el circuito 60 s (media apertura al vencer) en vez de gastar un timeout
por endpoint en cada vigilancia.

**5.2 — Cuatro departamentos nuevos** (`config/departments.json`, plan enterprise):

| Departamento | Especialistas | Nota |
|---|---|---|
| `blockchain` | `onchain-monitor`, `compliance-check` | Vigilancia + cribado KYC/AML previo a mover activos |
| `legal` | `contract-review`, `regulatory-advisor` | Firmar = línea roja; asesoría nunca vinculante |
| `treasury` | `runway`, `tokenomics` | Alerta crítica solo con dato real, nunca con uno simulado |
| `fundraising` | `investor-scorer`, `investor-outreach` | Migra el CRM de capital institucional que vivía en Sheets |

**5.3 — Dos líneas rojas nuevas** (`guardrails/RedLines.js`): `crypto_asset_movement`
(transferir BEZ-Coin, tesorería, staking, wallets) y `smart_contract_change`
(deploy/upgrade/pausa/roles). Ningún override las relaja: se evalúan antes que la política
del tenant. Cubiertas por evals.

**5.4 — Aparcado HITL** (`core/TaskQueue.js` + `core/executionContext.js`). *Bug de
producción encontrado con datos reales:* una aprobación pendiente retenía su hueco de
concurrencia mientras esperaba — se midió una tarea con **43 minutos de "latencia"** que
en realidad estaba parada esperando un clic. Con `maxConcurrentTasks: 20`, veinte contactos
en frío sin aprobar congelaban al tenant entero. Ahora la tarea suelta el hueco al esperar
y lo recupera **con prioridad** al decidirse (lo aprobado por un humano se termina antes
de empezar nada nuevo), con estado propio `awaiting_approval` y la latencia del agente
(`ms`) separada de la espera humana (`waitedMs`).

**5.5 — Automatizaciones que antes no se disparaban solas:**
- El `LearningEngine` estaba construido pero **nunca corría** salvo que alguien pulsara el
  botón (`learn` era una acción registrada sin trabajo programado). Ahora es diario.
- Los agentes de vigilancia emitían `blockchain:anomaly_detected` y
  `treasury:runway_critical` al bus y **nadie estaba suscrito**: el aviso moría ahí.
  `HitlNotifier.attach()` los enruta al bot del departamento correcto.
- Agenda por defecto según departamento contratado, reconciliada al arrancar (idempotente,
  conserva `lastRunAt`): digest y aprendizaje diarios, monitor on-chain cada 30 min,
  runway diario.

**5.6 — Venta de BEZ-Coin de punta a punta.** Webhook de Stripe con firma HMAC verificada
→ cálculo de tokens al precio semilla → cribado KYC/AML (las señales viajan al aviso de
Telegram) → **transferencia siempre a HITL**. Firma con una wallet de dispersión dedicada
de float limitado; la clave del Treasury DAO nunca toca el proceso.

**5.7 — Higiene de plataforma:** ventana caliente de tareas acotada a 200 con poda solo de
las terminadas (`findTask()` recupera del Store lo podado, así la API no pierde nada) y
caché LRU de embeddings en el proveedor Ollama. *No* se cachean generaciones del LLM:
devolver un borrador cacheado a otro cliente sería un fallo real, no una optimización.

**5.8 — Reintentos automáticos con dead-letter.** Un fallo transitorio (proveedor caído,
corte de red) ya no exige intervención manual: la tarea se reintenta sola con backoff
exponencial y jitter, hasta 3 intentos, y mientras espera **no retiene hueco de cola**.

La regla que gobierna todo lo demás: **una tarea que ya tuvo efecto fuera del sistema no
se reintenta jamás en automático.** Si el agente ya envió el email, escribió en el CRM o
disparó un workflow, repetirla lo duplicaría. `BaseAgent._execute` marca la tarea *antes*
de ejecutar algo con efecto (no después: si el conector falla a medias no sabemos si el
efecto llegó a producirse, y ante la duda no se reintenta). La clasificación vive en
`toolCatalog.READ_ONLY_METHODS`, y **lo no clasificado se asume con efecto** — si alguien
añade un conector y olvida clasificarlo, el sistema se vuelve más cauto, nunca menos.

Tampoco se reintenta lo permanente (departamento inexistente, conector ausente, cuota
agotada): daría el mismo resultado. Agotar el presupuesto de reintentos marca
`deadLetter: true`, distinguible en el panel de un fallo puntual (`3× dead-letter`) y de
uno que llegó a tocar el mundo exterior (`con efecto`, donde reintentar a mano es decisión
del operador, no automatismo).

**5.9 — Observabilidad que llega a una persona.** `Telemetry` ya exponía Prometheus para
quien quisiera scrapear; faltaba el camino inverso (empujar a un colector) y, sobre todo,
que alguien se entere cuando algo va mal.

- **`OtlpExporter`** (OTLP/HTTP+JSON, sin dependencias): empuja contadores e histogramas a
  SigNoz / Grafana Alloy / OTel Collector cada 60 s. Sin `OTEL_EXPORTER_OTLP_ENDPOINT` no
  arranca. Detalle que se rompe en silencio: `Telemetry` guarda los buckets **acumulados**
  (estilo Prometheus) y OTLP los quiere **por bucket** — convertirlo mal infla los totales
  en el backend y nadie lo nota hasta que alguien decide algo con esos números. Verificado
  contra un colector HTTP real: los buckets suman exactamente el `count`.
- **`AlertRules`** (función pura) + **`HealthWatchdog`**: cinco umbrales — tasa de fallo,
  dead-letter sin revisar, cuota del plan (avisa *antes* de cortar), latencia del modelo y
  **degradación a simulado**, esta última crítica porque el sistema sigue respondiendo con
  texto inventado mientras *nada* parece fallar.

Dos decisiones que gobiernan el diseño: cada regla exige un **mínimo de muestras** antes de
opinar (2 de 3 tareas fallando no significa nada), y el vigilante **deduplica** — avisa
cuando una alerta aparece, cuando empeora y cuando se resuelve, nunca en cada ciclo. Una
alerta con falsos positivos o repetitiva se silencia en dos semanas, y entonces ya no
protege de nada, solo da falsa sensación de control.

El watchdog **no pasa por el Scheduler** a propósito: ese mete el trabajo en la cola del
tenant y le gastaría cuota del plan. Vigilar la plataforma no puede facturarle llamadas al
cliente.

> **Fase 5 cerrada.** 10 departamentos · 262 tests · 71 evals · smoke.

### 2.6 — Continuo: Aprendizaje, evals y observabilidad

- ✅ **Eval harness** (`evals/`): contratos de comportamiento por suite — routing,
  soporte (anti-alucinación), guardrails (líneas rojas intocables) y tool-use
  (rechazos encajados). `npm run evals`; determinista en simulado, `EVALS_LIVE=1`
  para correr contra el modelo real. CI en `.github/workflows/ci.yml`
  (tests + evals + smoke). *Regla: ningún cambio de prompt entra sin pasar evals.*
- ✅ **LearningEngine** real (`cognition/LearningEngine.js`): destila la memoria
  episódica de cada agente en un playbook (qué funciona / cuándo escalar) con
  métricas de autonomía, lo persiste (fact `playbook:<id>`) y lo reinyecta en los
  prompts (`BaseAgent._playbookContext`). Acción `learn` del Scheduler + endpoints
  + panel. Testeado (`test/learning.test.js`) y en evals.
- ✅ **Observabilidad** (`platform/Telemetry.js`): métricas (contadores + histograma de
  latencia de tarea y modelo), trazas por tarea y health, con forma OpenTelemetry para
  exportar a OTel/SigNoz sin cambiar quién la alimenta. `GET /metrics` (Prometheus),
  `GET /healthz`, `GET /tenants/:id/traces` + panel. Testeado (`test/telemetry.test.js`).
  *Pendiente:* exportador OTLP a un backend real y alertas.

---

## 3. Estructura de desarrollo

Lo que en junio era "carpetas a añadir" hoy existe. Estado real:

```
operant-saas/
├── src/
│   ├── platform/              ✅ servicios transversales
│   │   ├── UsageMeter.js          Conteo y cuotas por tenant/plan
│   │   ├── CostTracker.js         Coste de tokens por tenant (ModelGateway.onUsage)
│   │   ├── Scheduler.js           Agenda de agentes proactivos y LearningEngine
│   │   ├── KnowledgeBase.js       Ingesta de docs por tenant → memoria semántica
│   │   ├── HitlNotifier.js        Avisos y alertas a Telegram, por departamento
│   │   ├── Telemetry.js           Métricas, trazas y health (forma OTel)
│   │   ├── {InMemory,Sqlite,Postgres}Store.js   Adaptadores del contrato Store
│   │   └── dashboard.js · digest.js · sse.js · onboarding.js · Billing.js
│   ├── compliance/            ✅ cribado KYC/AML (screening.js)
│   ├── evals/  → `evals/`     ✅ 64 contratos + runner (raíz, no bajo src/)
│   ├── agents/<dept>/         ✅ 10 departamentos con sus especialistas
│   └── core/executionContext.js  ✅ contexto de tarea (aparcado HITL)
├── public/panel.html          ✅ panel estático (sin build; se descartó Next.js)
├── test/                      ✅ 262 tests unitarios + integración + smoke
└── infra/                     ✅ docker-compose (Postgres+pgvector+Redis) + CI
```

> Dos desvíos conscientes del plan original: el panel es **HTML estático servido por la
> propia API** en vez de una app Next.js aparte (cero build, cero superficie extra que
> mantener), y `evals/` vive en la raíz junto a `test/` en vez de bajo `src/`, porque no
> es código de producción. `WebhookRouter.js` no se construyó como pieza propia: los
> canales de entrada se resolvieron en `channels/` + un único endpoint
> `ALL /channels/:canal/:tenantId/inbound`.

---

## 4. Catálogo de funciones para potenciar el producto

### 4.A — Plataforma (transversal, alto apalancamiento)

| Función | Para qué | Dónde |
|---|---|---|
| **Tool-use / function calling** | ✅ Hecho. El modelo invoca conectores en bucle agéntico (`BaseAgent.thinkAndAct`); cada invocación pasa por PolicyEngine/RedLines y HITL, y los rechazos vuelven al modelo como `tool_result`. Catálogo en `cognition/toolCatalog.js`; Claude y Ollama. Testeado en `test/tool-use.test.js` | `ModelGateway` + `BaseAgent` |
| **CostTracker + UsageMeter** | Cobrar bien y no quemar tokens; aplicar cuotas de plan | `platform/` |
| **Cache de embeddings** | ✅ Hecho. Caché LRU en el proveedor Ollama: `embed()` es determinista y se llama en cada `think()` para recuperar memoria, así que cachearla ahorra una ida y vuelta HTTP sin riesgo. **Decisión explícita: NO se cachean generaciones del LLM** — devolver un borrador de email cacheado a otro cliente sería un fallo, no una optimización | `cognition/providers/ollama.js` |
| **Reintentos + circuit breaker** | ✅ Hecho. Reintentos con backoff exponencial y jitter en `ModelGateway` (429/408/409/5xx, red, timeout) + fallback a simulado. Circuit breaker en `BeZhasCoreConnector` (3 fallos → 60 s de enfriado, media apertura al vencer) | `ModelGateway` · `connectors/` |
| **Scheduler de agentes proactivos** | ✅ Hecho. Trabajos recurrentes por tenant (`platform/Scheduler.js`), persistidos y rehidratados; entran por la misma cola/cuota/guardrails que una solicitud humana. Endpoints `GET/PUT/DELETE /tenants/:id/schedules`. Testeado en `test/scheduler.test.js` | `platform/Scheduler` |
| **KnowledgeBase por tenant** | ✅ Hecho. RAG sobre los docs del cliente, con recuperación semántica por coseno cuando hay embedder (Ollama local); persistida y rehidratada | `platform/KnowledgeBase` |
| **Eval harness** | ✅ Hecho. 64 contratos de comportamiento; ningún cambio de prompt entra sin pasarlos | `evals/` |
| **Digest del CEO** | ✅ Hecho. Resumen diario cross-departamento (KPIs reales + redacción del modelo), persistido y programado por defecto. Se resolvió como acción de plataforma, no como agente "executive" | `platform/digest.js` |
| **Aparcado de tareas en espera humana** | ✅ Hecho. Una aprobación pendiente ya no retiene hueco de concurrencia; se recupera con prioridad al decidirse | `core/TaskQueue` + `core/executionContext` |
| **Alertas proactivas** | ✅ Hecho. Los eventos de anomalía del bus llegan al bot de Telegram del departamento correcto en vez de morir sin oyente | `platform/HitlNotifier.attach()` |

### 4.B — Ventas (ampliar el escuadrón existente)

✅ **Los cinco especialistas propuestos, cerrados** (julio 2026). Cada uno tenía un fallo
caro distinto, y la defensa vive en un módulo puro y testeable, no en el prompt:

| Agente | Fallo caro | Defensa |
|---|---|---|
| `ProposalGeneratorAgent` | Un total mal calculado o un precio inventado en una propuesta que sale al cliente | **El código calcula el dinero, el modelo solo redacta** (`platform/priceCatalog.js`). Céntimos enteros, IVA por línea. SKU fuera de catálogo → no hay propuesta |
| `FollowUpAgent` | Insistir de más: quema el contacto y el dominio | `platform/followUpPolicy.js`, función pura. Espaciado 3-7-14 días, paradas definitivas, ni madrugadas ni fines de semana |
| `MeetingBookerAgent` | Duplicar reuniones al reintentar la tarea | Idempotencia por prospecto. Sin huecos reales no propone una hora inventada |
| `CRMSyncAgent` | "Funcionar" y dejar los datos peor que estaban | `platform/crmMerge.js`: no vacía lo lleno, no pisa dato humano, no retrocede el funnel. Siempre dice qué omitió y por qué |
| `ChurnPredictorAgent` | Dar por sano a un cliente del que no se sabe nada | `platform/churnScore.js`, determinista y con factores explicados. **Sin señales suficientes devuelve `null`, no cero** |

- **Línea roja nueva: `pricing_concession`.** Un descuento >15 % compromete el margen igual
  que un contrato compromete legalmente, así que lo evalúa el guardrail y no el agente:
  quien propone el descuento no puede decidir si necesita permiso. *(La primera versión
  llevaba un `forceApproval` en el agente que `PolicyEngine` ignoraba en silencio — un
  descuento del 40 % habría salido sin aprobación.)*
- `ChurnPredictorAgent` reutiliza señales que la plataforma YA observa: `churn_intent` de
  `SentimentAgent`, detractores de `csat.js`, escalados de Soporte, silencio e impagos.
- Catálogo de precios en `GET/PUT/DELETE /tenants/:id/sales/catalog`.
- 31 tests en `test/sales-squad.test.js` + 15 comprobaciones e2e contra el servidor real.

✅ **Pipeline de captación end-to-end (LeadFunnel).** Orquesta descubrimiento
multi-fuente → puntuación ICP (`LeadScorerAgent`) → matching al SubApp de BeZhas
correcto (`PitchMatcherAgent` con reglas explícitas + pesos aprendidos) → outreach
en frío por email vía HITL (`OutreachAgent`) → registro de resultados
(`LeadOutcomeTracker`) → los pesos se realimentan al siguiente ciclo (bandit
suavizado con Laplace). Fuentes disponibles: `WebFormSource`, `OwnedListSource`,
`PublicSearchSource` (vía MCP tipo Bright Data cuando el tenant lo autorice),
`LinkedInInboundSource` (traduce clicks UTM desde posts orgánicos publicados
por `SocialAgent`+`LinkedInConnector`). Dedup por email/company, `maxLeadsPerRun`
protege la cuota. 22 tests en `test/lead-funnel.test.js`.

✅ **Captación pública y webhooks de resultados (ciclo de aprendizaje cerrado).**
- `POST /intake/:tenantId` — único endpoint que escribe **sin API key** (lo llama el
  formulario público del tenant). Defensas en `platform/leadIntake.js`: consentimiento
  RGPD obligatorio con sello temporal (art. 6.1.a y 7.1), honeypot y ventana mínima de
  relleno que responden **200** para no dar señal al bot, throttle por IP en memoria,
  campos acotados, neutralización de CRLF (inyección de cabeceras), techo de cola con
  429 y deduplicación por email.
- `POST /webhooks/leads/:tenantId` — firmado con HMAC-SHA256 (`x-signature`) y
  comparación *timing-safe*. **Cerrado con 503 si falta `LEADS_WEBHOOK_SECRET`**: un
  webhook de resultados abierto permitiría envenenar el aprendizaje del funnel.
- `GET /tenants/:tenantId/funnel` — cola pendiente y estado del aprendizaje.
- `LeadOutcomeTracker` vive ya en el espacio del tenant (`TenantManager`), hidratado
  al arrancar.
- 19 tests en `test/lead-intake.test.js` + 11 comprobaciones HTTP contra el servidor real.

> *Bug de integración encontrado y corregido en esta fase:* `LeadFunnel` invocaba
> `agent.handle()`, método que `BaseAgent` no implementa (solo `run()`). Los dobles de
> test lo exponían, así que la suite estaba verde con la integración rota. Corregido y
> blindado con un test que usa las clases de agente **reales** en modo simulado.

### 4.C — Soporte

`TriageAgent` · `KnowledgeBaseAgent` (RAG) · `ResolverAgent` · `EscalationAgent` ·
*pendiente: `ResolverAgent` avanzado.*

✅ **`MacroSuggesterAgent`** (julio 2026) — al escalar, el humano recibía un resumen y
redactaba desde cero. Ahora recibe además un borrador listo para enviar.

Orden de preferencia, de más seguro a menos:

1. **Amenaza legal → solo acuse de recibo.** No se redacta respuesta de fondo ni se llama
   al modelo. Contestar al fondo de una reclamación legal sin que lo vea Legal es el error
   caro; un acuse neutro no cierra ninguna puerta.
2. **Macro guardada que encaje** (`platform/macros.js`): texto que el equipo ya aprobó, así
   que dice siempre lo mismo y no puede inventarse una política inexistente. Emparejamiento
   determinista a propósito — si lo eligiera un modelo, la misma consulta recibiría
   respuestas distintas según el día, que es lo contrario de tener respuestas guardadas.
3. **Borrador generado**, solo si hay base de conocimiento. Sin ella devuelve `null`: en
   soporte, una respuesta inventada es peor que ninguna.

- ✅ **`platform/draftGuard.js`** revisa la SALIDA del modelo y marca (no censura) cuatro
  familias de compromiso: admisión de culpa, promesa económica, plazo vinculante y garantía
  absoluta. Se revisa la salida en vez de fiarse del prompt porque pedirlo funciona “casi
  siempre”, y eso no basta cuando quien pulsa enviar no puede deshacerlo.
- El agente **nunca envía**: devuelve borrador. El envío sigue siendo del humano.
- La gravedad del sentimiento **manda sobre la prioridad del triage** en el handoff: un
  cliente que amenaza con irse es urgente aunque su consulta sea trivial.
- Gestión de macros en `GET/PUT/DELETE /tenants/:id/support/macros` + contador de uso, para
  saber cuáles sirven y cuáles solo ocupan sitio.
- 20 tests en `test/macro-suggester.test.js` + 14 comprobaciones e2e contra el servidor real.

> **Calibración corregida durante el desarrollo.** Con el reparto inicial (categoría 0.4),
> “No puedo entrar, mi acceso está bloqueado” se clasificaba como `general` —no dice “error”
> ni “no funciona”— y la macro de acceso, que casaba con 3 de sus 5 palabras clave, no se
> proponía. Las palabras clave las escribe el equipo a mano; la categoría la asigna el triage
> y solo tiene cuatro valores. Ahora pesan 0.55 frente a 0.30, con rendimientos decrecientes
> y **sin normalizar por el tamaño de la macro**: normalizar penalizaba añadirle sinónimos,
> justo lo que un tenant hace para que cubra más casos.

✅ **`SentimentAgent`** (julio 2026) — riesgo de cliente con el ticket AÚN ABIERTO.
Complementa al CSAT, que llega al cerrar y solo lo contesta una minoría.

- **Híbrido y asimétrico** (`platform/sentimentLexicon.js` + modelo): el léxico fija un
  SUELO de gravedad y el modelo solo puede subirlo. Dos motivos: (1) con el proveedor
  caído y el gateway degradado a simulado, una amenaza legal se sigue detectando —es
  cuando más caro sale no verla—; (2) un modelo blando no puede rebajar una baja escrita
  de forma explícita. El modelo aporta el matiz (ironía, frustración educada).
- **Señales separadas por consecuencia**, no un “está enfadado” genérico:
  `churn_intent`, `legal_threat`, `reputational_threat`, `repeat_contact`.
- **Escalado propio**: una baja o una amenaza legal meten a una persona aunque el triage
  lo vea rutinario y la KB tenga respuesta. Aviso al bot de Soporte solo desde gravedad
  `high`: si sonara en cada ticket, dejaría de mirarse.
- **Triage y sentimiento van en paralelo** (antes en serie): dos llamadas al modelo
  independientes, no había motivo para duplicar la latencia.
- ✅ **Calibración medible** (`platform/sentimentCalibration.js`): el CSAT del mismo
  ticket da la verdad de campo unos días después, así que se cruza predicción contra
  realidad y salen **precisión y exhaustividad** (expuestas en
  `GET /tenants/:id/support/metrics`). Se omite la exactitud a propósito: con pocos
  detractores, un detector que no marque nada saca 95 % y es inútil.
- 20 tests en `test/sentiment.test.js` + 8 comprobaciones e2e contra el servidor real.

> **Dos falsos positivos de dominio corregidos.** En una empresa de tokens, “consumo”
> (de gas), “demanda” (de mercado) y “arbitraje” (de precios) son vocabulario diario, y
> los tres se marcaban como amenaza legal crítica. Ahora van en frases inequívocas: se
> pierde alguna detección real a cambio de que la alerta legal no salte con la operativa
> normal, porque una alerta que salta a diario se ignora en una semana.

### 4.D — Marketing

`ContentPlannerAgent` (calendario editorial) · `CopywriterAgent` · `SEOAgent` — ya existían.

✅ **Los dos especialistas que faltaban, cerrados** (julio 2026):

| Agente | Fallo caro | Defensa |
|---|---|---|
| `SocialSchedulerAgent` | Un post aprobado hace días sale en mitad de un incidente (le ha pasado a marcas grandes; en BeZhas, con activos on-chain, un post entusiasta durante un exploit sería igual de grave) | `platform/socialQueue.js`: **la aprobación caduca a las 48 h** (se marca `stale` y hay que revisarla, no se publica sola) + **freno de mano global** (`PUT /tenants/:id/marketing/hold`) que congela toda la cola de una vez, sin revisar post por post |
| `CampaignAnalystAgent` | Declarar ganador de un A/B con ruido estadístico y cambiar la campaña por una diferencia que no existía | `platform/abTest.js`: test z de dos proporciones real (verificado contra tabla normal). Con <100 impresiones o <10 conversiones por variante, dice explícitamente "sin conclusión" en vez de inventar un ganador |

- Cada publicación sigue pasando por la línea roja `public_communication` (HITL), sea o no la
  primera vez que se aprobó el contenido.
- Trabajo del Scheduler `publicar-programado` (cada 15 min) para que la cola no se quede
  esperando a que alguien la dispare a mano — sin él, el agente existía pero no lo invocaba nadie.
- **Bug real encontrado en e2e**: no existe conector genérico multi-red (solo LinkedIn tiene
  backend); programar un post para otra red lanzaba una excepción no controlada que abortaba
  **toda la tanda**, incluidos los posts de LinkedIn que sí podían publicarse. Corregido: se
  comprueba el conector antes de actuar y cada post se aísla en su propio try/catch.
- 27 tests en `test/marketing-squad.test.js` + 14 comprobaciones e2e contra el servidor real
  (alta por API real → Scheduler → cola → freno → caducidad → análisis A/B).

### 4.E — Finanzas

`InvoiceAgent` (genera facturas) · `CollectionsAgent` (AR chaser — *cobrar = línea roja*) ·
`ForecastAgent` (cashflow) — ya existían.

✅ **Los dos especialistas que faltaban, cerrados** (julio 2026):

| Agente | Fallo caro | Defensa |
|---|---|---|
| `ExpenseCategorizerAgent` | Inventar una categoría contable que no existe, o tratar un acierto de suerte como certeza → desalinea el IVA deducible en la declaración | `platform/expenseCategories.js`: emparejamiento determinista contra el plan contable REAL del tenant (proveedor exacto + palabras clave). **Sin categoría cargada, no clasifica nada.** Por debajo del umbral de confianza, se marca para revisión — nunca se aplica sola |
| `ReconciliationAgent` | Casar un movimiento con la factura equivocada: deja dos rastros falsos (una "cobrada" que no lo está, y una de verdad cobrada que Collections sigue reclamando) | `platform/reconciliation.js`: importe + moneda + ventana de fechas. **Ambigüedad → ninguna candidata se marca**, ni en importe exacto ni en pago parcial. Facturas conciliadas salen del pool para siempre; idempotente entre corridas |

- Diseño deliberadamente conservador en `ExpenseCategorizerAgent`: sin proveedor conocido, las
  palabras clave del concepto **nunca** bastan solas para clasificar (máximo asintótico por
  debajo del umbral) — el concepto de un extracto bancario es poco fiable, el proveedor es la
  señal fuerte. El modelo solo puede *sugerir* entre las categorías ya existentes en el caso
  dudoso; la sugerencia no se aplica sola.
- **Bug real encontrado y corregido en `reconciliation.js`**: cuando había más de una candidata
  para un pago PARCIAL (no solo exacto), el movimiento cayó en silencio como "sin conciliar" sin
  decir que había opciones. Ahora se declara ambigüedad igual que con importes exactos.
- Endpoints `GET/PUT/DELETE /tenants/:id/finance/expense-categories`.
- 24 tests en `test/finance-squad.test.js` + 11 comprobaciones e2e contra el servidor real.

✅ **`InvoiceAgent` reparado** (julio 2026) — dos bugs encontrados al auditar el paso más
lógico tras cerrar §4.E, no en el catálogo de "faltantes":

1. **Estaba inalcanzable.** El enrutador de `FinanceManager` mandaba `'finance:invoice'` a
   `InvoiceBot`, así que el especialista `finance.invoice` estaba registrado pero ninguna tarea
   real podía llegarle — solo se podía invocar llamando al specialist a mano. Corregido: nueva
   ruta `'finance:invoice-draft'` para el documento de factura con desglose (el de archivar y
   mandar al cliente), distinta de `'finance:invoice'` (el enlace de cobro de Stripe sobre un
   deal ganado). Verificado a través del **orquestador real**, no del specialist directo.
2. **El mismo bug de matemática financiera que `ProposalGeneratorAgent`.** El modelo redactaba
   base/IVA/total en texto libre — solo que aquí el resultado es un documento fiscal archivado,
   no una propuesta. Corregido reutilizando `platform/priceCatalog.js` (el mismo catálogo que
   usa Ventas): el código calcula, el modelo solo redacta. Sin catálogo o con SKU desconocido,
   no se emite factura.

5 tests nuevos en `test/finance-squad.test.js` (incluye que `finance:invoice` sin `-draft` sigue
yendo a `InvoiceBot`, sin romper nada) + 3 comprobaciones e2e adicionales.

### 4.F — RR.HH.

`CVScreenerAgent` (criba de candidatos) · `RecruiterScreenAgent` · `InterviewSchedulerAgent` ·
`OnboardingAgent` · `OnboardingAssistant` · `HRPolicyAgent` (dudas de empleados sobre normativa
interna) — los 4 del catálogo ya existían. *Contratar/despedir/evaluar = línea roja* (`RedLines`).

✅ **Auditoría de sesgo en la criba de candidatos** (julio 2026) — al cerrar el catálogo se
encontró el paso más lógico siguiente, igual que con `InvoiceAgent` en §4.E: no faltaba
ningún agente, pero los dos que ya cribaban CVs (`CVScreenerAgent`, `RecruiterScreenAgent`)
mandaban el candidato **completo** al modelo, incluido el nombre interpolado literalmente en
el prompt (`"Nombre: Fatima Al-Rashid"`). La contratación es una decisión automatizada de
riesgo alto (RGPD art. 22, AI Act de la UE): un modelo no puede explicar si una correlación
implícita con el nombre, la edad o la nacionalidad influyó en su veredicto, así que
directamente no debe verlos.

- **`platform/candidateRedaction.js`** — quita nombre, foto, edad, fecha de nacimiento,
  nacionalidad y estado civil antes de que el texto llegue al modelo, tanto de campos
  estructurados como de patrones en el CV pegado. **Nunca en silencio**: devuelve qué se quitó,
  para poder auditar la decisión si se impugna. La decisión de empleo en sí (HITL) sigue
  identificando al candidato por su nombre real — eso lo decide un humano, no el modelo.
- **`platform/requisitionMatch.js`** — mismo patrón que `priceCatalog`/`expenseCategories`: el
  código calcula el encaje objetivo contra los requisitos del puesto (habilidades obligatorias,
  deseables, experiencia mínima) y el modelo solo redacta la valoración cualitativa alrededor
  de un número que ya existe — nunca decide el ajuste al puesto desde cero.
- **Bug real encontrado y corregido durante el desarrollo**: el primer regex de edad
  (`\d{1,2}\s*años`) se comía "10 años de **experiencia**" entero — justo la señal que el
  cribador necesita ver, no un dato protegido. Corregido con un lookahead negativo antes de
  escribir el agente encima.
- 14 tests en `test/hr-squad.test.js` + 5 comprobaciones e2e vía el orquestador real.

### 4.G — Operaciones

`ProcurementAgent` · `InventoryAgent` (alertas de stock) · `ReportAgent`/`ExecutiveReporterAgent`
(informes) · `OpsMonitorAgent` (salud del sistema) — ya existían.

✅ **Los dos especialistas que faltaban, cerrados** (julio 2026), más una corrección de fondo
en el que ya existía:

| Agente | Fallo caro | Defensa |
|---|---|---|
| `InventoryAgent` *(corregido)* | El modelo "proponía cantidades" leyendo la tabla de stock — pedir de menos rompe stock, pedir de más inmoviliza caja | `platform/inventoryReorder.js`: punto de pedido = consumo diario × plazo de entrega + stock de seguridad. **Sin `maxLevel`/`reorderQty` configurados, no se inventa una cantidad** — se avisa de que hace falta, la cifra la decide un humano |
| `SLAMonitorAgent` | Contar un caso todavía abierto y a tiempo como "cumplido" infla la tasa de cumplimiento con casos que ni han tenido ocasión de fallar | `platform/slaBreach.js`: estados `compliant`/`breached`/`at_risk`/`on_track` según fecha real. La tasa de cumplimiento solo cuenta casos YA decididos; sin ninguno, `null`, no 0% ni 100% |
| `VendorCommsAgent` | Reenviar el mismo seguimiento a un proveedor dos veces por un reintento de la tarea | Idempotencia por `referenceId` (nº de pedido/RFQ) + fecha: mismo proveedor y misma referencia el mismo día no se repite. Pasa por las mismas líneas rojas `outbound`/`cold_outbound` que Ventas |

- `InventoryAgent` fue el mismo hallazgo que `ExpenseCategorizerAgent`/`InvoiceAgent` en
  Finanzas y `requisitionMatch` en RR.HH.: un número con consecuencia económica real dejado a
  la prosa libre del modelo. Se detecta además cuándo un SKU se agotará **antes** de que llegue
  un pedido hecho hoy (`willStockOutBeforeRestock`), que es la urgencia real y no solo "conviene
  reponer".
- 23 tests en `test/operations-squad.test.js` + 6 comprobaciones e2e vía el orquestador real.

### 4.H — Vertical BeZhas (Web3)

✅ **Catálogo completo, cerrado** (julio 2026). Los 7 especialistas que faltaban, con el mismo
principio que en el resto de departamentos: todo número con consecuencia económica o legal
real lo calcula un módulo puro, el modelo solo redacta alrededor.

**Blockchain Ops:** `OnChainMonitorAgent` · `ComplianceCheckAgent` (KYC/AML) — ya existían.

| Agente | Fallo caro | Defensa |
|---|---|---|
| `SlashingWatcherAgent` | Tratar cualquier evento de slashing igual, cuando un 0.01% es ruido y un 5%+ suele ser double-signing | `platform/slashingWatch.js`: gravedad por % real penalizado. Sin dato de slashing por validador (el stack de BeZhas no expone ese endpoint todavía), no se opina |
| `GasOptimizerAgent` | El modelo decidiendo si "el gas está caro" sin un umbral objetivo | `platform/gasOptimizer.js`: compara contra `thresholdGwei`, que es política del tenant, nunca inventada. Con `bezhas-core` degradado a simulado, se niega a recomendar sobre un precio falso |

**Legal:** `ContractReviewAgent` · `RegulatoryAdvisorAgent` — ya existían.

| Agente | Fallo caro | Defensa |
|---|---|---|
| `DPIAAgent` | Un modelo "aprobando" que una SubApp no necesita evaluación de impacto (RGPD art. 35) por su cuenta | `platform/dpiaChecklist.js`: los 9 criterios objetivos de la guía WP248; 2+ → obligatoria. **`requiresDPOReview` es siempre `true`**, incluso en veredicto "no obligatoria" — ni una DPIA aparentemente innecesaria queda cerrada sin que la vea el DPO |

**Tesorería:** `TreasuryRunwayAgent` · `TokenomicsAgent` — ya existían.

| Agente | Fallo caro | Defensa |
|---|---|---|
| `VestingMonitorAgent` | Errar cuánto token tiene liberado un fundador/inversor — dato que mueve la lectura de presión de venta | `platform/vestingMath.js`: cliff + vesting lineal mensual con fórmula real, verificado en 0%, 50% y 100% de progreso |
| `LiquidityWatcherAgent` | "El pool es grande" leído de un número total, sin calcular el impacto de precio real de un trade | `platform/liquidityMath.js`: fórmula constant-product (x·y=k) real, verificada contra el cálculo manual. Umbrales de liquidez mínima y slippage máximo son política del tenant, nunca un valor por defecto inventado |

**Fundraising:** `InvestorScorerAgent` · `InvestorOutreachAgent` — ya existían.

| Agente | Fallo caro | Defensa |
|---|---|---|
| `DataRoomAgent` | Un checklist de due diligence que el modelo recompone de memoria cada vez — que se olvide el cap table firmado no puede depender de qué se le ocurrió hoy | Checklist FIJO de 5 categorías/17 documentos estándar; solo redacta la petición de lo que falta según la lista |
| `CapTableAgent` | Dilución "estimada" por un modelo — un inversor la contrasta con su propia hoja de cálculo, y el desacuerdo es contractual, no un matiz de redacción | `platform/capTableMath.js`: post-money, nuevas acciones y dilución por accionista con la fórmula estándar; verificado que los porcentajes tras la ronda siempre suman 100% |

- 30 tests en `test/bezhas-vertical-squad.test.js` + 8 comprobaciones e2e vía el orquestador real.

*Todo lo que mueva un activo on-chain o toque un contrato sigue pasando por HITL, sin excepción.*

> **Catálogo §4 completo.** Ventas, Soporte, Marketing, Finanzas, RR.HH., Operaciones y el
> vertical BeZhas tienen ya todos los especialistas propuestos, cada uno con sus guardarraíles
> verificados end-to-end. Lo que queda del roadmap son los dos bloqueos de infraestructura
> (§5.1–5.2, Docker) y el aprendizaje continuo con datos reales de producción.

---

## 5. Prioridades inmediatas (siguiente sprint)

Las prioridades de fases anteriores están cerradas (§2.0–§2.5). Lo que queda, por orden:

1. **Verificar contra el stack real de BeZhas.** El `BeZhasCoreConnector` está probado
   contra un `fetch` inyectado y en degradación a simulado, pero **nunca contra la API
   viva** — requiere levantar Redis + Postgres + Aegis + API del monorepo
   `BeZhas-Blockchain`. Hasta entonces, la vigilancia on-chain está construida pero no
   validada contra datos reales.
2. **Verificar Postgres en vivo** (`npm run db:up`). SQLite es el store por defecto y está
   probado a fondo; la ruta Postgres/RLS solo lo está en contrato. Bloquea el multi-nodo.
3. ✅ **Exportador OTLP + alertas** — hecho (§2.5.9).
4. ✅ **Dead-letter y reintentos con backoff** — hecho (§2.5.8).
5. ✅ **CSAT real de Soporte** — hecho. El mecanismo de captura ya existe; lo que falta
   ahora son clientes reales usándolo, no código. `platform/csat.js`:
   - Token **firmado y sin estado** (`tenantId.taskId.emitidoEn.firma`, HMAC-SHA256,
     caduca a 14 días). No se puede falsificar, ni cambiar el ticket, ni cruzar tenants.
   - `POST /tenants/:id/support/csat/issue` (con API key) emite el enlace;
     `POST /csat/:token` lo responde **sin API key** — al cliente final lo autoriza el
     token, no una cabecera.
   - Un voto por ticket (409 al repetir), escala 1-5, comentario saneado, throttle por IP.
   - **CSAT como top-2-box** (4 y 5 sobre el total), no la media: un 3 no es un cliente
     satisfecho y publicar la media infla la percepción.
   - **Sin muestras devuelve `null`, nunca 0 %**: confundir “sin datos” con “muy mal”
     dispara alertas falsas el primer día de vida de un tenant.
   - Una valoración ≤2 emite `support:csat_detractor` → bot de Telegram de Soporte, que
     es cuando aún se puede rescatar al cliente.
   - 18 tests en `test/csat.test.js` + 10 comprobaciones HTTP contra el servidor real.
6. ✅ **Índice invertido en `KnowledgeBase`** — hecho. Medido en `bench/kb-search.bench.js`
   (cruce del umbral p95 < 5 ms en ~5k artículos). Se construye perezosamente a partir de
   `INVERTED_INDEX_MIN = 2000` e invalida al ingerir. Mejora medida: 5k → 3×, 10k baja del
   umbral, 50k → 32% más rápido. Test de equivalencia en `test/kb-inverted-index.test.js`.

> **Fases 0–5 cerradas.** Cimientos, Soporte, comercialización, panel, los 6 departamentos
> genéricos y el vertical BeZhas. El cuello de botella ya no es código de plataforma: es
> **verificación contra infraestructura viva** (puntos 1 y 2).
