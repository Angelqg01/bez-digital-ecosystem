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

### 1.3 OpenAPI único (D6)
- [ ] Consolidar contrato vivo del backend reusando `backend/swagger.config.js`
- [ ] Confirmar `/api-docs` sirve el spec actualizado
- [ ] Exportar `openapi.json` versionado para consumo de SubApps/devs

**DoD Fase 1:** una sola capa API; CI testea lo que se despliega; build sin errores.

---

## 🟡 FASE 2 — Contrato y conexión estable Hub ↔ clientes
### 2.1 Frontend canónico (Decisión `frontend/` Vite)
- [ ] Marcar `frontend-next/` como `EXPERIMENTAL/FROZEN` (README + sacar del build/CI)
- [ ] Decidir si se archiva en `legacy/` o se mantiene congelado en sitio
- [ ] Confirmar que `cloudbuild.yaml` y `docker-compose.yml` solo referencian `frontend/`

### 2.2 Config centralizada
- [ ] Módulo único de config con base URL del Hub + `SUBAPP_URLS` (consumido por front)
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
