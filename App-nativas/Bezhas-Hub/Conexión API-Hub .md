# Conexión API-Hub — Plan de Desarrollo

> **Tipo:** Análisis del estado actual + Roadmap priorizado
> **Ámbito:** `App-nativas/Bezhas-Hub`
> **Objetivo:** Fusionar/optimizar nuevas funciones sobre lo ya desarrollado **sin romper** lo existente.
> **Fecha:** 2026-06-09 · **Maintainer:** Yoel (BeZhas)
> **Estado:** Borrador para decisión — ninguna vertical concreta fijada todavía.

---

## 0. Resumen ejecutivo

Bezhas-Hub contiene **dos capas de API que hoy no están conectadas entre sí**:

1. **`backend/`** — El **Hub real**. `server.js` (1708 líneas) monta **~80 módulos de rutas** con servicios reales: blockchain, IA/OpenClaw, AEGIS, pagos (Stripe/BEZ-Pay), IPFS, WebSocket, MCP, etc. Es lo que se despliega (puerto `3001`).
2. **`api/`** — Un **gateway Express standalone y huérfano** (`api/index.js`, ~15 endpoints) con **datos 100 % mock** (`Math.random()`). No está en ningún `docker-compose`, usa un stack divergente (express 4 / ethers 5 vs. express 5 / ethers 6 del Hub) y su `Dockerfile` colisiona con el puerto `3001` del backend.

El nombre de este plan, **"Conexión API-Hub"**, describe exactamente el hueco arquitectónico: **no existe una capa de API limpia, versionada y conectada al Hub**. El trabajo no es construir desde cero, sino **decidir el destino de `api/`** (eliminar, o reconvertir en BFF/gateway delgado hacia `backend/`) y **sanear la deuda técnica** antes de adjuntar funciones nuevas.

> **Regla rectora de todo este plan:** _no romper lo desplegado._ El backend en producción es la fuente de verdad operativa; cualquier capa nueva se monta **delante o al lado**, nunca sustituyendo rutas vivas.

---

## 1. Mapa del estado actual

### 1.1 Topología desplegada (lo que SÍ corre)

Fuente: `docker-compose.yml`.

| Servicio | Puerto | Rol |
|---|---|---|
| `backend` | `3001` | **Hub / API real** (Express 5, ethers 6) |
| `frontend` | `5173` | UI React/Vite |
| `bezhas-intelligence` (MCP) | `8080` | Cerebro IA / MCP server |
| `aegis` | `8001` | Capa de validación/monitoreo IA |
| `postgres` | `5433→5432` | DB principal |
| `timescaledb` | `5432` | Analytics time-series |
| `redis` | `6379` | Cache / colas |
| `hardhat` | `8545` | Nodo EVM local (opcional) |

> **`api/` NO aparece aquí.** Confirmado: es código fuera del ciclo de despliegue.

### 1.2 El Hub real — `backend/`

- **Entrypoint:** `backend/server.js`. Tolerante a fallos por diseño (lista `IGNORABLE_ERRORS`, no cae por Redis/RPC/SDK ausentes).
- **Rutas:** ~80 módulos en `backend/routes/*.routes.js`, montados bajo `/api/*`.
- **Servicios:** ~90 en `backend/services/` (blockchain, AEGIS, OpenClaw, fiat-gateway, IPFS, RAG, websocket-hub, etc.).
- **Patrón clave — verticales delegadas a SubApps:** muchas rutas ya son `deprecatedSubappRoute(...)` que **redirigen** a subdominios de SubApps en vez de servir lógica local. Ejemplos en `server.js`:
  - `/api/staking`, `/api/farming`, `/api/defi`, `/api/marketplace` → `SUBAPP_URLS.capital`
  - `/api/wallet`, `/api/governance`, `/api/dao`, `/api/bezcoin`, `/api/v1/bridge` → `SUBAPP_URLS.wallet`
  - `/api/oracle`, `/api/quality-escrow` → `SUBAPP_URLS.vision`
  - `/api/payment(s)`, `/api/crypto`, `/api/fiat`, `/api/moonpay` → `SUBAPP_URLS.pay`
- **Lo que el Hub sí sirve localmente:** auth/SIWE, admin, posts, feed, profile, users, vip, subscription, chat/IA, ai-gateway, agents, openclaw, mcp, automation, security, upload/IPFS, health, métricas.
- **Seguridad ya presente:** `helmet`, CORS, rate-limiters (`advancedRateLimiter`, `intelligentRateLimiter`), `apiKeyAuth`, JWT admin, auditLogger, fieldEncryption, etc.

### 1.3 El gateway huérfano — `api/`

- `api/index.js`: health, auth (login/refresh por firma wallet), user profile, NFTs, market, analytics, gamification, notifications, upload IPFS, email.
- **Todo mock**: respuestas con `Math.random()`. No toca blockchain ni DB.
- **Stack divergente:** `express ^4.21`, `ethers ^5.7` → usa `ethers.utils.verifyMessage` (API v5).
- **Dependencias declaradas pero NO usadas** en `index.js`: `mongoose`, `redis`, `swagger`, `multer`, `nodemailer`, `bcryptjs`, `axios`, `winston`, `compression` (peso muerto).
- **`api/Dockerfile`:** `EXPOSE 3001` (colisión con backend) y `RUN ln -s /app/agent-runtime ...` (carpeta inexistente en `api/`; copy-paste de otro servicio → el build falla o crea un symlink roto).

### 1.4 Frontends duplicados

- `frontend/` — React + Vite (el desplegado).
- `frontend-next/` — Next.js (paralelo, estado incierto).
- Decidir cuál es canónico afecta a qué cliente consumirá la "Conexión API-Hub".

### 1.5 Conexión con terceros (visión documentada, no implementada en código)

`BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt` describe el flujo objetivo:
`Compra/Suscripción (Stripe/BEZ-Pay) → AEGIS valida → OpenClaw genera credenciales → adapters (Vinted/Shopify/Amazon) vía Universal Bridge`.
Existen ya las rutas base (`/api/openclaw`, `/api/aegis`, `/api/subscription`, `/api/webhooks`) pero la orquestación end-to-end del documento aún no está cableada.

---

## 2. Deuda técnica y riesgos (a resolver antes de adjuntar funciones)

| # | Hallazgo | Severidad | Evidencia | Impacto |
|---|---|---|---|---|
| D1 | **Secrets en texto plano en el repo** | 🔴 Crítica | `BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt` (API keys + `whsec_*`), `BEZHAS_API_KEYS_ABIS_WEBHOOKS.txt`, `temp_secret.txt`, `.env` commiteado | Fuga de credenciales. **Rotar y sacar del repo.** |
| D2 | **`api/` huérfano y mock** | 🟠 Alta | No está en compose; `Math.random()` | Confusión sobre cuál es "la API"; riesgo de exponer mocks como reales |
| D3 | **Stack divergente** entre `api/` y Hub | 🟠 Alta | express 4/ethers 5 vs 5/6 | `ethers.utils` no existe en v6 → bug latente si se reusa código |
| D4 | **`api/Dockerfile` roto** | 🟠 Alta | symlink `/app/agent-runtime` + `EXPOSE 3001` | Build inválido / colisión de puerto |
| D5 | **Dos frontends** sin canon definido | 🟡 Media | `frontend/` vs `frontend-next/` | Esfuerzo duplicado, drift de contratos API |
| D6 | **Sin contrato de API versionado** | 🟡 Media | Mezcla `/api/`, `/api/v1/`, `/api/v2/` sin OpenAPI único | Difícil para SubApps/devs consumir establemente |
| D7 | **Ruido en el repo** | 🟢 Baja | `.tmp.driveupload/` (cientos de archivos), `*.log`, `*.txt` de salidas, `.bak` | Lentitud de búsquedas, repo inflado |
| D8 | **Orquestación terceros incompleta** | 🟡 Media | doc vs. código | La visión OpenClaw+AEGIS no está end-to-end |
| D9 | **CI/CD desalineado con producción** | 🟠 Alta | `.github/workflows/deploy-gcp.yml` testea `./api` (mock, etiquetado "backend") y construye `./frontend-next`; `cloudbuild.yaml` despliega `backend/` + `frontend/` | El pipeline da confianza falsa: valida código que NO se despliega |

---

## 3. Estrategia "sin romper nada"

Principios que rigen cualquier cambio de este plan:

1. **El backend `:3001` es intocable en su contrato actual.** Las rutas existentes y los `deprecatedSubappRoute` se mantienen. Nada se borra de `server.js` sin un reemplazo verificado.
2. **Aditivo antes que sustitutivo.** Toda capa/funcionalidad nueva se monta como:
   - prefijo nuevo (`/api/v1/...` namespaced), o
   - servicio nuevo en compose, o
   - middleware delante (BFF/gateway) que **proxya** a lo existente.
3. **Feature-flag + fallback.** Igual que `IGNORABLE_ERRORS`, lo nuevo arranca opt-in (`process.env.FEATURE_X`) y degrada con elegancia si falta una dependencia.
4. **Mocks → reales detrás del mismo contrato.** Si se reaprovecha `api/`, cada endpoint mock se sustituye por una llamada real **manteniendo idéntica la forma de la respuesta**, validada con un test de contrato.
5. **Verificación obligatoria por fase:** `pnpm test` (backend), smoke `/api/health`, y arranque local `scripts\quick-start.ps1` antes de dar una fase por cerrada.

### 3.1 Decisión sobre `api/` — ✅ RESUELTA: **Eliminar (Opción A)**

`api/` es 100 % mock y **nunca se despliega** (no está en `cloudbuild.yaml` ni en `docker-compose.yml`; solo lo "testea" un workflow CI desalineado — ver D9). El backend real ya sirve `/api/*` con rate-limit, `apiKeyAuth` y swagger, por lo que un BFF separado sería redundante hoy.

→ **Se elimina `api/`** y se **realinea el CI** (`deploy-gcp.yml`) para testear `backend/` en vez del mock. _(Si en el futuro se necesita una superficie pública separada, se reconsiderará la Opción B; la capa pública para devs se aborda en Fase 3 sobre el propio backend.)_

---

## 4. Roadmap priorizado

### 🔴 Fase 0 — Higiene y seguridad (bloqueante, ~1–2 días)
Pre-requisito de todo lo demás. No adjuntar funciones sobre una base con secrets expuestos.

- [ ] **D1** Rotar TODAS las credenciales de `*_CONEXION_TERCEROS_*` y `*_API_KEYS_*`; mover valores a Secret Manager; sustituir los `.txt` por plantillas sin secretos; añadir a `.gitignore`; purgar del historial si procede.
- [ ] **D1** Eliminar `temp_secret.txt` y confirmar que `.env` no está versionado (solo `.env.example`).
- [ ] **D7** Sacar `.tmp.driveupload/` y logs de salida del control de versiones (`.gitignore`).
- [ ] Ejecutar `pnpm scan:secrets` (script ya existe) y dejarlo en CI.
- **Hecho cuando:** `scan:secrets` limpio + ningún secreto real en árbol de trabajo.

### 🟠 Fase 1 — Saneado de la capa API (~2–4 días)
- [ ] **Decidir A vs B** para `api/` (sección 3.1) y registrarlo aquí.
- [ ] Si **B**: alinear `api/package.json` a express 5 + ethers 6, corregir `verifyMessage` (v6: `ethers.verifyMessage`), reparar `api/Dockerfile` (quitar symlink, `EXPOSE` puerto distinto p. ej. `3010`), purgar deps no usadas.
- [ ] Si **A**: eliminar `api/` y documentar el borrado.
- [ ] **D6** Publicar **OpenAPI 3.1 único** del contrato vivo del backend (reusar `swagger.config.js` ya presente; el Hub ya expone `/api-docs`).
- **Hecho cuando:** una sola capa API coherente, documentada y arrancable sin errores de build.

### 🟡 Fase 2 — Contrato y conexión estable Hub ↔ clientes (~3–5 días)
- [ ] **D5** Declarar el frontend canónico (`frontend/` Vite por defecto, salvo decisión contraria) y congelar el otro.
- [ ] Centralizar `SUBAPP_URLS` y la base URL del Hub en un único módulo de config consumido por front y (si aplica) gateway.
- [ ] Tests de contrato (supertest, ya disponible) sobre los endpoints núcleo que las SubApps consumen.
- [ ] Healthchecks y métricas homogéneos (`/api/health` + Prometheus exporter ya existente).
- **Hecho cuando:** las SubApps consumen el Hub por un contrato versionado y testeado.

### 🟢 Fase 3 — Adjuntar las nuevas funciones (iterativo, opt-in)
Cada idea nueva entra como módulo aditivo siguiendo §3 (prefijo propio + feature-flag + test de contrato). **Áreas confirmadas por Yoel (las 4):**
- [ ] **3A — Conexión terceros (OpenClaw + AEGIS):** cablear end-to-end Subscription → AEGIS valida → OpenClaw genera credenciales → adapters Vinted/Shopify/Amazon vía Universal Bridge. **D8.**
- [ ] **3B — API pública + API keys para devs:** capa versionada sobre el backend con API keys por plan, rate-limit por tier, webhooks firmados y Developer Console/portal.
- [ ] **3C — Pagos reales con BEZ:** sustituir mocks de pago por settlement real con BEZ Token (Polygon `0xEcBa…11A8`) vía `BeZhasPayment` + fiat on-ramp.
- [ ] **3D — Datos reales (quitar mocks):** reemplazar `Math.random()` por datos reales de blockchain/DB en analytics, gamification, NFTs, market.
- **Hecho cuando:** cada función nueva pasa sus tests y `quick-start.ps1` arranca el stack sin regresiones.

> El detalle por tarea vive en **`Conexión API-Hub — TAREAS.md`** (backlog vivo).

---

## 5. Checklist de verificación por cada cambio

Reutiliza el checklist del proyecto y añade:

- [ ] `cd backend && pnpm test` en verde.
- [ ] `scripts\check.ps1` sin errores.
- [ ] `scripts\quick-start.ps1` levanta backend (3001) + frontend sin caídas.
- [ ] Smoke: `GET /api/health` → `200 OK`.
- [ ] Ningún endpoint vivo del backend cambió de forma (test de contrato).
- [ ] Feature nueva detrás de flag y degradando con elegancia si falta dependencia.
- [ ] Sin secretos nuevos en el árbol (`pnpm scan:secrets`).

---

## 6. Mapa de archivos clave (referencia rápida)

| Propósito | Ruta |
|---|---|
| Hub / API real (entrypoint) | `backend/server.js` |
| Montaje de rutas / SubApp redirects | `backend/server.js` (líneas ~471–1166) |
| Rutas del Hub | `backend/routes/*.routes.js` |
| Servicios del Hub | `backend/services/*.service.js` |
| Gateway huérfano (mock) | `api/index.js` |
| Stack desplegado | `docker-compose.yml` |
| Visión conexión terceros | `BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt` ⚠️ secrets |
| Swagger/OpenAPI | `backend/swagger.config.js`, `/api-docs` |
| Arranque local | `scripts/quick-start.ps1`, `scripts/check.ps1` |

---

## 7. Decisiones tomadas (2026-06-09)

1. **`api/`** → ✅ **Eliminar** (Opción A) + realinear CI para testear `backend/`.
2. **Frontend canónico** → ✅ **`frontend/` (Vite)**; congelar/archivar `frontend-next/`; realinear CI.
3. **Nuevas funciones (Fase 3)** → ✅ las **4 áreas**: 3A terceros (OpenClaw+AEGIS), 3B API pública+keys, 3C pagos reales BEZ, 3D datos reales (quitar mocks).

> Documento promovido de _análisis + roadmap_ a **plan ejecutable**. El backlog accionable vive en **`Conexión API-Hub — TAREAS.md`**.
