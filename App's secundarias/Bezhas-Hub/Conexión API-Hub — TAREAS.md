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
- [~] Módulo único de config con base URL del Hub + `SUBAPP_URLS` (consumido por front) — creado `frontend/src/config/subappUrls.js` (fuente única, env-overridable `VITE_SUBAPP_*_URL`, mismas URLs que `secondaryApps` del control-center; helper `subappUrl(app, subPath)`). Falta migrar consumidores existentes (landing/EcosystemBar) a esta fuente.
- [ ] Variables `VITE_API_URL` / `VITE_WS_URL` / `VITE_MCP_URL` coherentes con cloudbuild

### 2.3 Tests de contrato + observabilidad
- [ ] Tests supertest sobre endpoints núcleo que consumen las SubApps
- [ ] Healthchecks homogéneos (`/api/health`) + Prometheus exporter ya existente
- [ ] Snapshot del contrato para detectar cambios de forma (regresiones)

**DoD Fase 2:** SubApps consumen el Hub por contrato versionado y testeado.

---

## 🟢 FASE 3 — Nuevas funciones (las 4 áreas, aditivas + opt-in)

### 3A — Conexión terceros (OpenClaw + AEGIS) · D8
- [ ] Mapear estado real de rutas base: `/api/openclaw`, `/api/aegis`, `/api/subscription`, `/api/webhooks`
- [ ] Orquestador: webhook `subscription.created`/`payment.completed` → AEGIS valida → OpenClaw genera credenciales
- [ ] Universal Bridge event-driven + adapters Vinted / Shopify / Amazon (empezar por 1 adapter de referencia)
- [ ] Webhooks firmados (`whsec_*`) con verificación HMAC; secretos desde Secret Manager
- [ ] Feature-flag `FEATURE_THIRDPARTY_BRIDGE`; degradar si AEGIS/OpenClaw no responden
- [ ] Tests e2e del flujo compra→credenciales (mock de adapter externo)

### 3B — API pública + API keys para devs
- [ ] Reusar `middleware/apiKeyAuth.js`: modelo de API keys por plan/tier
- [ ] Rate-limit por tier (reusar `advancedRateLimiter`/`intelligentRateLimiter`)
- [ ] Endpoints públicos versionados (`/api/v1/public/...`) namespaced, sin tocar rutas internas
- [ ] Webhooks salientes firmados para devs
- [ ] Developer Console/portal (ya hay `developerConsole.routes.js`/`controller`) — extender
- [ ] Documentar en el OpenAPI de Fase 1.3

### 3C — Pagos reales con BEZ
- [ ] Cablear `BeZhasPayment` con BEZ Token Polygon `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` (moneda de settlement)
- [ ] Sustituir mocks de pago por settlement on-chain real (con confirmaciones)
- [ ] Integrar fiat on-ramp (Stripe/MoonPay ya presentes) → conversión a BEZ
- [ ] Idempotencia + reconciliación de eventos de pago (revenue-event-listener ya existe)
- [ ] Feature-flag `FEATURE_BEZ_SETTLEMENT`; fallback a flujo actual
- [ ] Tests con red de prueba (Amoy) antes de mainnet

### 3D — Datos reales (quitar mocks)
- [ ] Inventario de endpoints con `Math.random()`/mock en backend (analytics, gamification, NFTs, market)
- [ ] Reemplazar por lectura real de blockchain/DB **manteniendo idéntica la forma de respuesta**
- [ ] Test de contrato por endpoint migrado (forma antes == forma después)
- [ ] Caché (Redis ya presente) para lecturas on-chain costosas

**DoD Fase 3:** cada función pasa sus tests y `quick-start.ps1` arranca el stack sin regresiones.

---

## Backlog transversal / dudas a resolver
- [ ] ¿`frontend-next/` se archiva o se borra? (decisión menor pendiente)
- [ ] Orden de ataque de Fase 3: sugerido **3D → 3B → 3C → 3A** (datos reales primero da base sólida; terceros al final por dependencia de AEGIS/OpenClaw). Confirmar con Yoel.
- [ ] ¿Algún adapter de terceros prioritario (Vinted/Shopify/Amazon) para empezar 3A?
