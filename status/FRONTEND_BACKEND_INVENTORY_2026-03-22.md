# Inventario Frontend / Backend BeZhas

Fecha: 2026-03-22

Este documento lista las paginas y subpaginas reales desarrolladas en el frontend de Control Center, junto con las funciones backend relacionadas que existen hoy en el repositorio.

## 1. Paginas reales del frontend

Frontend base detectado en `control-center/frontend/app`.

### Paginas principales

| Ruta frontend | Archivo | Tipo | Backend asociado | Estado de integracion |
|---|---|---|---|---|
| `/` | `control-center/frontend/app/page.tsx` | Redirect | Ninguno | Redirige a `/dashboard` |
| `/dashboard` | `control-center/frontend/app/dashboard/page.tsx` | Pagina principal | Analytics + Transactions + Notifications del header | Parcial |
| `/dashboard/analytics` | `control-center/frontend/app/dashboard/analytics/page.tsx` | Subpagina | Analytics + Notifications del header | Parcial |
| `/dashboard/sectors` | `control-center/frontend/app/dashboard/sectors/page.tsx` | Subpagina | Sectors + Notifications del header | Parcial |
| `/dashboard/sectors/[sector]` | `control-center/frontend/app/dashboard/sectors/[sector]/page.tsx` | Subpagina dinamica | Sector detail + Notifications del header | Parcial |
| `/dashboard/contracts` | `control-center/frontend/app/dashboard/contracts/page.tsx` | Subpagina | Contracts + Notifications del header | Parcial |
| `/dashboard/transactions` | `control-center/frontend/app/dashboard/transactions/page.tsx` | Subpagina | Transactions + Notifications del header | Parcial |
| `/dashboard/nfts` | `control-center/frontend/app/dashboard/nfts/page.tsx` | Subpagina | NFTs + Notifications del header | Parcial |
| `/dashboard/gas` | `control-center/frontend/app/dashboard/gas/page.tsx` | Subpagina | Gas + Notifications del header | Parcial |
| `/dashboard/aegis` | `control-center/frontend/app/dashboard/aegis/page.tsx` | Subpagina | Aegis + Notifications del header | Parcial |
| `/dashboard/gamification` | `control-center/frontend/app/dashboard/gamification/page.tsx` | Subpagina | Gamification + Notifications del header | Parcial |
| `/dashboard/notifications` | `control-center/frontend/app/dashboard/notifications/page.tsx` | Subpagina | Notifications | Parcial |
| `/dashboard/settings` | `control-center/frontend/app/dashboard/settings/page.tsx` | Subpagina | Config + Notifications del header | Parcial |
| `not-found` | `control-center/frontend/app/not-found.tsx` | Pagina de error | Ninguno | Sin backend |

### Subpaginas dinamicas de sectores desarrolladas

La ruta dinamica `/dashboard/sectors/[sector]` soporta estas 16 subpaginas por el objeto `SECTOR_META`:

1. `/dashboard/sectors/health`
2. `/dashboard/sectors/realestate`
3. `/dashboard/sectors/energy`
4. `/dashboard/sectors/automotive`
5. `/dashboard/sectors/manufacturing`
6. `/dashboard/sectors/agriculture`
7. `/dashboard/sectors/insurance`
8. `/dashboard/sectors/education`
9. `/dashboard/sectors/entertainment`
10. `/dashboard/sectors/legal`
11. `/dashboard/sectors/supplychain`
12. `/dashboard/sectors/gobierno`
13. `/dashboard/sectors/finanzas`
14. `/dashboard/sectors/servicios`
15. `/dashboard/sectors/otros`
16. `/dashboard/sectors/logistics`

## 2. Funciones backend por pagina

## 2.1 `/`

- Frontend: redireccion a `/dashboard`
- Backend consumido: ninguno

## 2.2 `/dashboard`

Funciones frontend usadas:

- `useStats()` -> llama a `/analytics/stats`
- `useChartData(14)` -> llama a `/analytics/chart?days=14`
- `useTransactions(1, 5)` -> llama a `/transactions?page=1&limit=5`
- `Header` -> `useNotifications()` -> llama a `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/transactions`
  - Archivo: `api/routes/transactions.js`
  - Servicio: `txService.getRecentTxs()` en `api/services/txService.js`
- `GET /api/analytics/platform`
  - Archivo: `api/routes/analytics.js`
  - Implementa analitica global autenticada
- `GET /api/notifications`
  - Archivo: `api/routes/notifications.js`
  - Requiere autenticacion JWT

Observaciones:

- El frontend pide `/analytics/stats` y `/analytics/chart`, pero el backend actual expone `/api/analytics/platform` y `/api/analytics/user/:address`.
- La cabecera del dashboard siempre intenta leer `/notifications`, pero el backend exige token y los hooks actuales no lo envian.

## 2.3 `/dashboard/analytics`

Funciones frontend usadas:

- `useStats()` -> `/analytics/stats`
- `useChartData(7)` -> `/analytics/chart?days=7`
- `useChartData(30)` -> `/analytics/chart?days=30`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/analytics/platform`
- `GET /api/analytics/user/:address`
- `GET /api/notifications`

Observaciones:

- No existe actualmente en backend un `GET /api/analytics/stats` ni `GET /api/analytics/chart`.

## 2.4 `/dashboard/sectors`

Funciones frontend usadas:

- `useSectors()` -> `/sectors`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/sectors`
  - Archivo: `api/routes/sectors.js`
  - Devuelve overview por sector desde `contract_addresses`
- `GET /api/notifications`

Observaciones:

- El hook espera un arreglo de sectores directamente.
- El backend devuelve `{ sectors: rows }`.
- El contenido devuelto por backend usa campos como `sector`, `contract_count` y `contracts`, mientras el frontend espera `key`, `name`, `contracts`, `transactions`, `active`.

## 2.5 `/dashboard/sectors/[sector]`

Funciones frontend usadas:

- `useSectorDetail(sector)` -> `/sectors/:sector`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/sectors/:sector`
  - Archivo: `api/routes/sectors.js`
  - Devuelve contratos por sector
- `GET /api/notifications`

Observaciones:

- El frontend espera `{ contracts, transactions }`.
- El backend actual devuelve `{ sector, contracts }` y no adjunta transacciones del sector.

## 2.6 `/dashboard/contracts`

Funciones frontend usadas:

- `useContracts()` -> `/contracts`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/contracts`
  - Archivo: `api/routes/contracts.js`
  - Servicio: `contractService.getAllAddresses()` en `api/services/contractService.js`
- `GET /api/contracts/:name`
- `GET /api/notifications`

Observaciones:

- El frontend espera un arreglo de contratos con campos tipo `contract_name`, `sector`, `address`, `chain_id`, `deployed_at`.
- El backend devuelve `{ chainId, contracts }`, donde `contracts` viene agrupado por categoria y nombre, no como lista plana.

## 2.7 `/dashboard/transactions`

Funciones frontend usadas:

- `useTransactions(page, 20)` -> `/transactions?page=X&limit=20`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/transactions`
  - Archivo: `api/routes/transactions.js`
  - Servicio: `txService.getRecentTxs()`
- `GET /api/transactions/:txHash`
  - Servicio: `txService.getTxByHash()`
- `GET /api/notifications`

Observaciones:

- El frontend espera `{ rows, total }`.
- El backend devuelve `{ transactions, total, page, pages }`.

## 2.8 `/dashboard/nfts`

Funciones frontend usadas:

- `useNFTs(page)` -> `/nfts?page=X`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/nfts`
  - Archivo: `api/routes/nfts.js`
  - Lista NFTs con paginacion y filtros
- `GET /api/nfts/:tokenId`
- `GET /api/notifications`

Observaciones:

- El frontend espera `{ rows, total }`.
- El backend devuelve `{ nfts, pagination }`.

## 2.9 `/dashboard/gas`

Funciones frontend usadas:

- `useGasBalances()` -> `/gas/balances`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/gas/status`
  - Archivo: `api/routes/gas.js`
  - Servicio: `contractService.getBlockchainStats()`
- `GET /api/gas/balances`
  - Archivo: `api/routes/gas.js`
  - Consulta DB `gas_balances` + `enterprises`
  - Requiere autenticacion y rol `admin` o `enterprise`
- `GET /api/notifications`

Observaciones:

- El hook espera un arreglo de balances directamente.
- El backend devuelve `{ balances: rows }`.
- Ademas requiere token y rol, pero el hook no adjunta autenticacion.

## 2.10 `/dashboard/aegis`

Funciones frontend usadas:

- `useAILogs(page)` -> `/aegis/logs?page=X`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `PUT /api/ai-control/mode`
  - Archivo: `api/routes/aegis.js`
  - Proxy hacia el motor Aegis
- `GET /api/ai-control/status`
- `POST /api/ai-control/telemetry`
  - Archivo: `api/routes/aegis.js`
  - Servicio: `aegisService.processTelemetryAndTokenize()`
- Alias legado: `POST /api/telemetry/process`
- `GET /api/notifications`

Observaciones:

- El frontend busca `/aegis/logs`, pero el backend esta montado en `/api/ai-control`.
- No existe una ruta `GET /api/ai-control/logs` ni `GET /api/aegis/logs` en el backend actual.
- La funcionalidad backend de Aegis existe, pero esta orientada a `status`, `mode` y `telemetry`, no a listado de logs para la tabla del frontend.

## 2.11 `/dashboard/gamification`

Funciones frontend usadas:

- `useAchievements()` -> `/gamification/achievements`
- `useLeaderboard()` -> `/gamification/leaderboard`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/gamification/profile/:address`
  - Archivo: `api/routes/gamification.js`
  - Calcula nivel y puntos
- `GET /api/gamification/leaderboard/:type`
  - Tipos validos: `transactions`, `nfts`, `staking`
- `GET /api/notifications`

Observaciones:

- El frontend consume endpoints que no existen con ese contrato exacto.
- El backend si tiene leaderboard, pero exige un `:type` explicito.
- No existe una ruta `GET /api/gamification/achievements`.

## 2.12 `/dashboard/notifications`

Funciones frontend usadas:

- `useNotifications()` -> `/notifications`
- `api.post('/notifications/read-all', {})`

Funciones backend desarrolladas relacionadas:

- `GET /api/notifications`
  - Archivo: `api/routes/notifications.js`
  - Requiere autenticacion JWT
- `POST /api/notifications/send`
- `PATCH /api/notifications/:id/read`

Observaciones:

- El frontend espera un arreglo simple de notificaciones.
- El backend devuelve `{ notifications: rows }`.
- El frontend intenta `POST /notifications/read-all`, pero esa ruta no existe.
- El backend actual permite marcar una por una via `PATCH /api/notifications/:id/read`.

## 2.13 `/dashboard/settings`

Funciones frontend usadas:

- `usePlatformConfig()` -> `/config/platform`
- `Header` -> `/notifications`

Funciones backend desarrolladas relacionadas:

- `GET /api/config/platform`
  - Archivo: `api/routes/config.js`
  - Consulta DB para version y numero de tablas
  - Usa `contractService.getBlockchainStats()`
  - Consulta salud de Aegis y MCP por HTTP
- `GET /api/notifications`

Observaciones:

- Esta es la pagina con mejor alineacion frontend/backend.
- Aun asi, el `Header` vuelve a depender de `/notifications`, que requiere autenticacion no enviada por el hook.

## 2.14 `not-found`

- Backend consumido: ninguno

## 3. Funciones backend desarrolladas pero no mapeadas como pagina directa del frontend

Estas rutas existen en backend, pero no estan asociadas a una pagina dedicada en `control-center/frontend/app`:

1. `POST /api/auth/*`
2. `GET /api/user/*`
3. `GET /api/market/*`
4. `GET /api/wallet/*`
5. `GET /api/health`
6. `GET /api/metrics`

## 4. Componentes frontend desarrollados que no son paginas activas

Hay componentes en `control-center/frontend/components` que no aparecen montados como rutas en el App Router actual:

1. `BridgePortal.tsx`
2. `BlockchainDashboard.tsx`
3. `FarmingDashboard.tsx`
4. `AILogsDashboard.tsx`
5. `AgentsDashboard.tsx`

## 5. Resumen ejecutivo

Lo realmente desarrollado en frontend hoy es un dashboard con 11 subpaginas funcionales a nivel de UI mas una ruta dinamica de sectores.

Lo realmente desarrollado en backend cubre dominios de:

1. Transacciones
2. Contratos
3. NFTs
4. Sectores
5. Gas
6. Gamification
7. Notifications
8. Aegis AI
9. Configuracion de plataforma

Pero la integracion frontend/backend esta solo parcialmente alineada porque hoy existen varios desacoples:

1. Endpoints esperados por frontend que no existen con ese nombre en backend.
2. Respuestas backend con estructura distinta a la esperada por los hooks del frontend.
3. Endpoints protegidos por JWT consumidos desde hooks que no envian token.

## 6. Estado por pagina (POST-INTEGRACIÓN)

| Pagina | UI desarrollada | Backend desarrollado | Integracion exacta |
|---|---|---|---|
| `/dashboard` | Si | Si | **Si** |
| `/dashboard/analytics` | Si | Si | **Si** |
| `/dashboard/sectors` | Si | Si | **Si** |
| `/dashboard/sectors/[sector]` | Si | Si | **Si** |
| `/dashboard/contracts` | Si | Si | **Si** |
| `/dashboard/transactions` | Si | Si | **Si** |
| `/dashboard/nfts` | Si | Si | **Si** |
| `/dashboard/gas` | Si | Si | **Si** (requiere login) |
| `/dashboard/aegis` | Si | Si | **Si** |
| `/dashboard/gamification` | Si | Si | **Si** |
| `/dashboard/notifications` | Si | Si | **Si** (requiere login) |
| `/dashboard/settings` | Si | Si | **Si** |

### Cambios realizados para la alineación

**Nuevos endpoints backend creados:**
- `GET /api/analytics/stats` — stats del dashboard (público)
- `GET /api/analytics/chart?days=N` — datos de gráficas (público)
- `GET /api/aegis/logs?page=N` — logs paginados de AI (público)
- `GET /api/gamification/achievements` — logros de la plataforma (público)
- `GET /api/gamification/leaderboard` — tabla de posiciones general (público)
- `POST /api/notifications/read-all` — marcar todas como leídas (auth)
- `GET /api/contracts?flat=true` — lista plana de contratos

**Endpoints backend modificados:**
- `GET /api/sectors` — ahora retorna `key`, `contracts`, `transactions`, `active`
- `GET /api/sectors/:sector` — ahora incluye transacciones del sector
- Aegis montado también en `/api/aegis` (además de `/api/ai-control`)

**Frontend actualizado:**
- `lib/api.ts` — fetcher auto-incluye token JWT desde localStorage
- `lib/hooks.ts` — todos los hooks transforman las respuestas del backend al formato esperado por las páginas
