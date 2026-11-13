# App-nativas/Bezhas-Hub — Hub (frontend Vite + backend heredado)

Contexto general: [`../../CLAUDE.md`](../../CLAUDE.md). Cada carpeta (`frontend/`, `backend/`) se instala
por separado con pnpm.

## Frontend (`frontend/`)

Vite + React 18 + wagmi 3 + react-router 7. `pnpm dev`, `pnpm test:run` (Vitest), `pnpm build`.

- **Menú lateral:** el estado vive en `src/state/sidebarStore.js` (abierto en móvil, colapsado en
  escritorio, se recuerda). No volver a crear un `useState` por layout. `AppLayout` (`src/App.jsx`)
  decide el layout con `useLocation`, nunca con `window.location`.
- **Sellos de clasificación:** `src/config/pageClassification.js` (borrador, sólo etiqueta). Un test
  falla si se añade una ruta a `App.jsx` sin clasificarla; el Control Center usa la misma clasificación.
- **Precios de OPERANT:** `src/config/operant-native-app.js` es un **espejo** del backend. Si cambia el
  precio por tarea, el test del propio fichero lo detecta.
- WalletConnect va fijado a la 2.21.10 con `overrides` de `pnpm-workspace.yaml`; no quitarlos.
  `@web3modal/wagmi` está deprecado (migrar a `@reown/appkit` está pendiente).

## Backend heredado (`backend/`)

Express. `pnpm test` (Jest `--env=node`). Muchos tests necesitan MongoDB o Postgres; el CI ejecuta sólo
los que no (job `hub-backend`, lista en `../../.github/workflows/ci.yml`).

- **Ningún secreto con valor por defecto en producción.** Se usa `config/requiredSecret.js`
  (`secretoObligatorio`): sin valor, con uno de desarrollo conocido o demasiado corto, lanza error.
- Las claves del KMS local viven fuera del repo: `KEYS_DIR` en `backend/.env`.
- `backend/.env`, `backend/.keys/` y los ficheros de claves **no se versionan**.
- Es un backend en migración: antes de añadir funcionalidad nueva, valorar si va en `../../api`
  (ver `../MAPA_BEZHAS_HUB_KEEP_MIGRATE_DELETE.md`).
