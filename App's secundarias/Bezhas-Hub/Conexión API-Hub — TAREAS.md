# Conexión API-Hub — TAREAS (backlog vivo)

> Compañero de **`Conexión API-Hub .md`** (plan). Aquí viven las tareas accionables.
> Convención: `[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[!]` bloqueada (tarea del usuario).
> **Decisiones (2026-06-09):** api/ → eliminar · frontend canónico → `frontend/` Vite · Fase 3 → 4 áreas.
> **Regla de oro:** aditivo, feature-flag, test de contrato, no romper `backend:3001`.

---

## 🔴 FASE 0 — Higiene y seguridad
- [x] Plantillas redactadas `*.example.txt` (`scripts/redact-secrets-to-template.cjs`, 82 tokens → `<ROTATE_ME>`)
- [x] `.gitignore` bloquea los 3 `.txt` con secretos + patrones; excepción `!*.example.txt`
- [x] `git rm --cached` de los 3 originales (siguen en disco)
- [x] Runbook de purga de historial (`scripts/PURGE_SECRETS_HISTORY.md`)
- [x] `.tmp.driveupload/` y logs ya cubiertos por `.gitignore`
- [!] **(Usuario)** Rotar TODAS las credenciales expuestas en sus servicios
- [!] **(Usuario)** Purgar el historial git (tras rotar) siguiendo el runbook
- [!] **(Usuario)** Mover valores a GCP Secret Manager
- [ ] Commit de la limpieza Fase 0 (cuando Yoel lo autorice)
- [ ] Dejar `pnpm scan:secrets` en CI

---

## 🟠 FASE 1 — Saneado de la capa API
### 1.1 Eliminar `api/` (Decisión A) — ✅ HECHO (2026-06-09)
- [x] Confirmado 0 consumidores reales: no estaba en `cloudbuild.yaml` ni `docker-compose*`; solo en workflows CI
- [x] Carpeta `api/` eliminada (workspace + disco). Backup recuperable: tag **`pre-remove-api-20260609`** + historial git
- [x] `pnpm-workspace.yaml`: quitado `- 'api'`
- [x] Quitadas referencias a `./api` en los 3 workflows

### 1.2 Realinear CI/CD (D9) — ✅ HECHO (2026-06-09)
- [x] `deploy-gcp.yml`: test-backend → `./backend`; cache key → `backend/pnpm-lock.yaml`; lint+test-frontend → `./frontend`; artefactos → `frontend/dist`
- [x] `ci.yml`: install/test backend → `./backend`; frontend lint/build → `./frontend`; artefacto → `frontend/dist`
- [x] `security-audit.yml` (3er workflow): matrix + deps + eslint + codeql → `backend`/`frontend`
- [x] **Auto-deploy peligroso neutralizado**: `build-images`+deploy de `deploy-gcp.yml` gateados a `workflow_dispatch` (manual); Dockerfiles repuntados a `backend/Dockerfile.optimized` + `frontend/Dockerfile.gcp`; deploy de PROD sigue vía `cloudbuild.yaml` (intacto)
- [!] **Verificar pipeline verde**: los jobs de test ahora apuntan al código REAL (antes testeaban el mock). Pueden requerir setup de DB/env que antes estaba oculto — validar en el próximo push/PR. **Riesgo de rojo = señal real, no regresión introducida.**
- [ ] (follow-up) Unificar build-args VITE_*/URLs entre `deploy-gcp.yml` y `cloudbuild.yaml` (fuente única) antes de re-activar auto-deploy

### 1.3 OpenAPI único (D6) — ✅ HECHO (2026-06-12)
- [x] `swagger.config.js` consolidado: dev server → `:3001`, prod → `api.bez.digital/api`; quitado `bezcoin.routes.js` (no montado, delegado a SubApp wallet); añadido `clothingRental.routes.js`; lista `apis` curada con política comentada (solo rutas público-seguras; `globalSettings` admin excluida)
- [x] Anotado `health.routes.js` (`/health`, `/health/live`, `/health/ready`) — antes el tag Health existía sin endpoints
- [x] Reparadas 13 anotaciones de `clothingRental.routes.js` (sin `responses` obligatorio + prefijo `/api/` duplicado)
- [x] **`backend/scripts/export-openapi.cjs`**: valida (swagger-parser + invariantes) y exporta `backend/openapi.json` — **25 paths / 25 operaciones**. Script pnpm: `openapi:export`. Sale ≠0 si el contrato es inválido → apto para CI
- [x] **Test de contrato Jest**: `backend/tests/openapi-contract.test.js` (6 tests ✅, entra en `pnpm test` → CI): OpenAPI 3.x, paths>0, ApiKeyAuth, sin prefijo `/api` duplicado, responses en toda operación, validación swagger-parser completa
- [x] Fix infra: `pnpm-workspace.yaml` + `blockExoticSubdeps: false` (subdep git de @chainlink/contracts bloqueaba `pnpm install`); backend reinstalado (faltaba `lru-cache` → roto el export y jest)
- [x] Fix menor: script `health` de backend/package.json apuntaba a `:3000` → `:3001`
- [x] (runtime smoke, 2026-06-12) Backend arrancado en local: `GET /api/health → 200`, `GET /api-docs/ → 200`. **Bug real encontrado y corregido**: `services/cache.service.js` estaba borrado del working tree (sin commitear) y 6 servicios lo requieren → el server no llegaba a escuchar; restaurado con `git checkout -- backend/services/cache.service.js`
- [x] (2026-06-12) Anotada la superficie **read-only institucional de web3-core** (`/web3/health`, `/web3/status`, `/web3/indexer/stats`, `/web3/indexer/events` con query params, `/web3/queue/stats`) + tag `Web3 Core`. Contrato: **30 paths / 30 operaciones**, 6/6 tests ✅
- [x] Decisión de política: rutas `/api/mcp` son admin-only (`verifyAdminToken` global) → **NO entran al contrato público**. La superficie MCP para instituciones es `packages/mcp-server` (bezhas-intelligence :8080), producto separado
- [ ] (progresivo, alimenta 3B) Anotar las demás rutas públicas que deban entrar al contrato (posts, profile, …) — el test de contrato vigila cada anotación nueva
- [x] (3B/SDK, 2026-06-12) **`@bezhas/sdk` v2.1.0 creado en `sdk/`** (la carpeta no existía pese a estar en workspace+scripts — referencia huérfana resuelta): cliente zero-deps (fetch nativo, Node 18+/browser), 30 métodos generados desde manifest `ENDPOINTS`, tipados `index.d.ts`, README institucional. Validación: smoke sin red (7 grupos de aserciones) + **test de sincronía bidireccional SDK↔OpenAPI** en `backend/tests/sdk-contract-sync.test.js` (CI falla si contrato y SDK divergen). 10/10 tests ✅
- [ ] (3B/SDK) Publicar `@bezhas/sdk` en npm cuando el contrato se estabilice (`pnpm sdk:publish-npm` ya existe en root)
- [x] (MCP institucional, 2026-06-12) **Superficie MCP asegurada y documentada.** 🔴 Hallazgo de seguridad: `bezhas-intelligence` desplegado `--allow-unauthenticated` en Cloud Run con secrets (GitHub/Alpaca/1inch) y **HTTP sin auth** → cualquiera podía invocar trading/repos con credenciales BeZhas. Fix: middleware `src/middleware/apiKeyAuth.ts` (opt-in vía `MCP_API_KEY`/`MCP_API_KEYS`; `/health` público; modo legacy con warning si no hay clave = no rompe nada). Backend actualizado para enviar `X-API-Key` (helper `backend/utils/mcpAuthHeaders.js` + 3 servicios parcheados: automationEngine, leadFinder, mcp-context; aiGateway ya usaba OIDC). README institucional con guía de conexión STDIO+HTTP. Validación: tsc limpio + **166/166 vitest** (9 nuevos de auth)
- [!] **(Usuario/deploy)** Activar enforcement en prod: crear secret `MCP_API_KEY` y añadirlo a `--set-secrets` de `bezhas-intelligence` Y del backend en `cloudbuild.yaml`. Hasta entonces el MCP server sigue abierto (modo legacy)

**DoD Fase 1:** una sola capa API; CI testea lo que se despliega; build sin errores.

---

## 🟡 FASE 2 — Contrato y conexión estable Hub ↔ clientes
### 2.1 Frontend canónico (Decisión `frontend/` Vite)
- [x] Marcar `frontend-next/` como `EXPERIMENTAL/FROZEN` (2026-06-13: banner WARNING en su README). Verificado: ya NO está en el build/CI — `cloudbuild.yaml` usa `frontend/Dockerfile.gcp`; los jobs de `deploy-gcp.yml` que lo construían fueron neutralizados en Fase 1.2; su única traza en CI es un `paths-ignore` de CodeQL (inofensivo)
- [ ] Decidir si se archiva en `legacy/` o se mantiene congelado en sitio
- [x] Confirmar que `cloudbuild.yaml` y `docker-compose.yml` solo referencian `frontend/`

> **Dedup Capa 2 (2026-06-13):** eliminados 2 duplicados muertos y sin referencias →
> `deployed-backend/` (396 ficheros, snapshot obsoleto de `backend/` del 2026-06-02, no usado por ningún deploy, duplicaba `app-secrets.yaml`/`config/secrets.js`) y
> `frontend/package/` (240 ficheros: copia desempaquetada de tailwindcss v3.4.18 metida por error). Recuperables vía historial git.

> **Vertical DeFi → BZ Capital migrado (2026-06-13, Capa 2A):** las rutas del Hub
> `/defi`, `/staking`, `/farming`, `/liquidity` (+ `/defi-hub`→redirect) ya NO renderizan
> operativa local: muestran el panel `MovedToSubApp` con deep-link a BZ Capital
> (`basePath /defi`, p.ej. `…/defi/staking`). Imports lazy huérfanos de
> `StakingPage`/`FarmingPage`/`DeFiHub` eliminados de `App.jsx`. Los ficheros de página
> siguen en disco (aún los cubre `tests/critical-routes.test.jsx` en aislamiento) →
> **borrado físico + limpieza de hooks (`useStaking`/`useFarming`/`useTokenomics`) y del
> test = siguiente iteración.** Validado: esbuild transform OK en los 3 ficheros tocados.

### 2.2 Config centralizada
- [x] Módulo único de config con base URL del Hub + `SUBAPP_URLS` (consumido por front) — `frontend/src/config/subappUrls.js` (fuente única, las 13 SubApps, env-overridable `VITE_SUBAPP_*_URL`, alineada con control-center; helper `subappUrl(app, subPath)`). Consumidor migrado: `data/landing.ts` `ECOSYSTEM_APPS` (12 tarjetas de SubApps) que antes apuntaban a rutas internas `/dashboard/*` (drift + enlaces incorrectos) ahora deep-linkean a la SubApp real; las páginas genuinamente internas del Hub siguen con `prodUrl`.
- [x] Variables `VITE_API_URL` / `VITE_WS_URL` / `VITE_MCP_URL` coherentes con cloudbuild (2026-06-14): módulo único `frontend/src/config/api.js` — `API_ROOT` (raíz sin `/api`, convención de cloudbuild+docker-compose), `API_BASE`, `WS_URL` (deriva http→ws/https→wss), `MCP_URL`, y helper `apiUrl(path)` que **normaliza el `/api`** (idempotente, evita el doble-prefijo). Bug corregido: `AIContext.jsx` default `:5000` → `:3001`. Validado: 9/9 aserciones (node) + test vitest `src/config/api.test.js` para CI; esbuild transform OK. Hallado drift: ~30 consumidores con defaults dispares (`/api`, `:3001`, `:3001/api`, `:5000`)
- [ ] (progresivo, bajo riesgo) Migrar los ~30 consumidores a `apiUrl()`/`API_BASE` — hacerlo por lotes verificando cada uno (la convención `${VITE_API_URL}/api/...` ya correcta NO urge; prioridad: los `|| '/api'` y `|| ':3001/api'` que rompen con servicios run.app separados)
- [!] **Nota infra**: `frontend/node_modules` tiene tailwindcss roto (`Cannot find module './cacheInvalidation.js'`) → vitest no arranca (carga vite/postcss). Tests JS puros se validan con node directo; reinstalar frontend deps para habilitar vitest en local (ya falla igual hoy, no es regresión de esta iteración)

### 2.3 Tests de contrato + observabilidad
- [x] Tests supertest sobre endpoints núcleo (2026-06-14): `backend/tests/subapp-contract.test.js` (12 tests ✅) monta el código REAL (`control-plane/policy.js` + `health.routes.js`) sobre express mínimo — evita el boot de `server.js` (grafo mongoose/mongodb no resuelve bajo jest aquí). Cubre: health surface, **contrato de capacidad migrada** (410 Gone + `CAPABILITY_MIGRATED_TO_SUBAPP` + `X-BeZhas-Hub-Role` + `targetUrl`==registry + `Location`), 404 estable.
- [x] **🐛 Bug de producción cazado y arreglado**: en `health.routes.js` la ruta param `/:service` estaba ANTES de `/live`, `/ready`, `/startup` → las ensombrecía → **las probes de liveness/readiness/startup de Cloud Run devolvían 404**. Fix: `/:service` movido al final. Las 3 probes ahora 200/503; test de regresión añadido. (Además yo había documentado `/health/live` y `/health/ready` en el OpenAPI — ahora el contrato y la realidad coinciden.)
- [x] Healthchecks homogéneos (`/api/health` 200, probes Cloud Run operativas)
- [ ] (futuro) Snapshot del `openapi.json` para detectar cambios de forma (regresiones de contrato) — el test de contrato OpenAPI ya valida estructura; falta diff de forma entre versiones
- [ ] (futuro) Boot-test E2E de `server.js` cuando se arregle la resolución `mongodb` `.ts` bajo jest

**DoD Fase 2:** ✅ SubApps consumen el Hub por contrato versionado y testeado (health + migración cubiertos; quedan snapshots de regresión como mejora).

---

## 🟢 FASE 3 — Nuevas funciones (las 4 áreas, aditivas + opt-in)

### 3A — Conexión terceros (OpenClaw + AEGIS) · D8
- [x] **Mapeado** (2026-06-14): el grueso YA existía → `routes/openclaw.routes.js` (lifecycle `/provision` `/revoke` `/rotate` `/client/:address` `/payment-hook` `/stats`), y `services/payment-openclaw-bridge.js` con la orquestación end-to-end (`AegisValidator.validateTransaction` → `OpenClawAgent.provisionClient` → `onPaymentCompleted`/`onSubscriptionCreated`) que emite eventos vía `bridgeEvents` (EventEmitter exportado): `client.provisioned`, `payment.processed`, `payment.rejected`.
- [x] **Orquestador** Subscription→AEGIS→OpenClaw: ya cableado en `onPaymentCompleted` + ruta `/api/openclaw/payment-hook`. (Sin acción nueva — verificado existente.)
- [x] **Universal Bridge event-driven + adapters** (2026-06-14, EL GAP REAL): `services/bridge/universalBridge.js` — escucha `client.provisioned` y hace **fan-out** a adapters por plataforma (vinted/shopify/amazon, factory `createWebhookAdapter`). Cableado opt-in en `server.js` (junto a WebhookBlockchainBridge).
- [x] **Webhooks salientes firmados HMAC-SHA256** (`X-BeZhas-Signature` + `X-BeZhas-Event`); secreto por adapter desde env `BRIDGE_<PLATAFORMA>_SECRET` (→ Secret Manager en prod).
- [x] **Feature-flag `FEATURE_THIRDPARTY_BRIDGE`** (no arranca si ≠ true) + degradación: adapter sin URL → `skipped`; sin adapter → `no-adapter`; fallo de entrega aislado por-plataforma (`error`), nunca propaga al emitter.
- [x] Tests del Bridge: `backend/tests/universal-bridge.test.js` (9 ✅) — firma HMAC verificable, fan-out firmado, no-adapter, skipped, aislamiento de fallos, flag gating, registro de los 3 adapters.
- [!] **(Usuario/deploy)** Configurar en prod `BRIDGE_VINTED_WEBHOOK_URL`/`_SECRET` (y shopify/amazon) + `FEATURE_THIRDPARTY_BRIDGE=true` cuando los endpoints de los adapters estén listos. Hasta entonces: flag off → bridge inactivo (cero impacto).
- [ ] (siguiente) Test e2e que emita `client.provisioned` real desde `payment-openclaw-bridge` y verifique la entrega (hoy probado en aislamiento con `deliver` inyectado).

### 3B — API pública + API keys para devs
- [ ] Reusar `middleware/apiKeyAuth.js`: modelo de API keys por plan/tier
- [ ] Rate-limit por tier (reusar `advancedRateLimiter`/`intelligentRateLimiter`)
- [ ] Endpoints públicos versionados (`/api/v1/public/...`) namespaced, sin tocar rutas internas
- [ ] Webhooks salientes firmados para devs
- [ ] Developer Console/portal (ya hay `developerConsole.routes.js`/`controller`) — extender
- [ ] Documentar en el OpenAPI de Fase 1.3

### 3C — Pagos reales con BEZ
- [x] **Servicio de settlement BEZ on-chain** (2026-06-14): `backend/services/bezSettlement.service.js` — `verifyBezSettlement({txHash, expectedTo, minAmountBez})` lee el recibo real (ethers v6), parsea el evento `Transfer` del contrato BEZ (`0xEcBa…11A8`, moneda de settlement), valida destinatario + importe + confirmaciones. Read-only (no firma ni mueve fondos). Provider/ledger inyectables.
- [x] **Idempotencia**: `settle()` con ledger pluggable (memoria por defecto → DB/Redis en prod) — el mismo `txHash` no se acredita dos veces (`alreadySettled:true`); un settlement inválido NO se registra (reintentable).
- [x] **Feature-flag `FEATURE_BEZ_SETTLEMENT`** (`isEnabled()`); el flujo de pago actual no cambia hasta activarlo.
- [x] Tests mock: `backend/tests/bez-settlement.test.js` (11 ✅) — Transfer válido, txhash inválido, tx-not-found, tx-failed, importe bajo, otro destinatario, otro token, suma de múltiples Transfers, idempotencia (no re-consulta cadena), no-registro de inválidos, flag.
- [x] **✅ TEST REAL on-chain ejecutado** (2026-06-14): `backend/scripts/verify-bez-settlement-live.cjs` contra Polygon en vivo →
  (1) identidad del contrato BEZ confirmada real (symbol=BEZ, decimals=18, totalSupply=3.000M);
  (2) camino negativo real (txHash inexistente → `tx-not-found` vía `getTransactionReceipt` real);
  (3) **verificación POSITIVA de un Transfer ERC-20 real** (tx `0x6e72…961`, confirmaciones+parseo OK). _Nota: BEZ es de baja actividad y `getLogs` está limitado en el RPC público alcanzable, así que el positivo se probó sobre un Transfer real del head; la lógica BEZ-específica está cubierta por los 11 tests mock._
- [x] **Wiring `settle()` dentro de `onPaymentCompleted`** (2026-06-14): hook detrás del flag `FEATURE_BEZ_SETTLEMENT`, ejecutado ANTES de AEGIS. Flag OFF → comportamiento legacy intacto. Flag ON: si hay `txHash`, verifica on-chain idempotentemente; inválido → `payment.rejected` con `reason: "settlement:<motivo>"`; `alreadySettled` → corto-circuita sin re-provisionar. Destinatario esperado = `metadata.expectedTo` ?? `TREASURY_WALLET` env. Tests: `backend/tests/payment-bridge-wiring.test.js` (6 ✅: flag off, sin txHash, settle válido, settle inválido + emit, idempotente, override expectedTo). Regresión 3A+3C: **26/26 ✓**.
- [ ] (siguiente, opcional) fiat on-ramp (Stripe/MoonPay) → conversión a BEZ; reconciliación con `revenue-event-listener`
- [!] **(Usuario/deploy)** Para producción: usar un RPC con `getLogs`/archivo fiable (publicnode free limita `getLogs`) y backear el ledger de idempotencia en DB/Redis

### 3D — Datos reales (quitar mocks)
- [x] **Inventario de `Math.random()` en backend/routes** (2026-06-14, 26 usos / 10 ficheros). Clasificación:
  - **Legítimos (NO tocar)**: `auth.routes` (OTP 6 dígitos + referralCode), `campaigns/upload.routes` (sufijo de filename multer), `payment.routes` (referenceCode), `admin.v1.routes` (id de log), `chat.routes` 223-307 (selección de respuestas fallback canned del bot) + 523/566 (ids de mensaje/chat), `data-oracle.service` (batchId).
  - **Mock en ruta MIGRADA (deprecatedSubappRoute, ya no se sirve)**: `wallet.routes` (txHash falso), `bezcoin-moonpay.routes` (fluctuación de precio) → resueltos por la migración a SubApp, sin acción.
  - **Mock VIVO**: `uploads.routes.js` `/api/uploads/upload-ipfs` (hash IPFS aleatorio). ✅ migrado abajo.
- [x] **`/api/uploads/upload-ipfs` → datos reales** (2026-06-14): usa `ipfs.service` real cuando llega `content` (base64; Pinata si configurado, mock honesto del servicio si no); sin contenido → **CID determinista sha256** (reproducible) + `mock:true` en vez de `Math.random()`. Forma de respuesta preservada (`mock`/`size` aditivos). Manejo de fallo → 502.
- [x] Test de contrato del endpoint migrado: `backend/tests/uploads-ipfs.test.js` (6 ✅) — forma preservada, **determinismo (la regresión anti-random)**, flag mock, ruta real con content, validación 400, recuperable por `/file/:hash`.
- [ ] (siguiente) Caché Redis para lecturas on-chain costosas cuando se cableen lecturas reales de blockchain (indexer ya expone stats vía web3-core)
- [ ] (nota) Los mocks de "analytics/gamification/NFTs/market" del brief original vivían en el `api/` borrado (Fase 1.1); en el backend real esas verticales están migradas a SubApps o no fabrican datos. El mock vivo restante era el IPFS — resuelto.

**DoD Fase 3:** cada función pasa sus tests y `quick-start.ps1` arranca el stack sin regresiones.

---

## Backlog transversal / dudas a resolver
- [ ] ¿`frontend-next/` se archiva o se borra? (decisión menor pendiente)
- [ ] Orden de ataque de Fase 3: sugerido **3D → 3B → 3C → 3A** (datos reales primero da base sólida; terceros al final por dependencia de AEGIS/OpenClaw). Confirmar con Yoel.
- [ ] ¿Algún adapter de terceros prioritario (Vinted/Shopify/Amazon) para empezar 3A?
