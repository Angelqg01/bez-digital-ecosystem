# BeZhas AI Workspace — desarrollo local

Chat con RAG seguro y login (email o wallet), sin Postgres, MongoDB ni Redis.

## Arranque

```bash
# 1) Backend de desarrollo (http://localhost:5000). Usuarios en memoria.
cd backend
node scripts/dev-ai-workspace.js

# 2) Frontend oficial (Vite, http://localhost:5173)
cd ../frontend
VITE_API_URL=http://localhost:5000 pnpm dev
```

Sin `ANTHROPIC_API_KEY` ni `OPENAI_API_KEY` el chat responde en **modo local**: devuelve los
fragmentos de documentación encontrados, con citas. Con una clave usa el modelo (streaming):

```bash
ANTHROPIC_API_KEY=sk-ant-... node scripts/dev-ai-workspace.js
# modelo: AI_MODEL_ANTHROPIC (por defecto claude-sonnet-5-5); OpenAI: AI_MODEL_OPENAI
```

El frontend oficial es `frontend/` (Vite; `frontend-next/` se eliminó). Si abres Vite como `127.0.0.1`, añade el origen: `DEV_ALLOWED_ORIGINS=http://127.0.0.1:5173 node scripts/dev-ai-workspace.js`.

El servidor monta las rutas **reales** (`/api/ai-workspace`, `/api/wallet-auth`) con su autenticación
JWT y límites de peticiones; solo el modelo de usuarios (y el registro/login por email) es de
desarrollo. No arranca con `NODE_ENV=production`.

## Qué incluye

- **Barra de chat flotante** (inferior): solo se puede chatear con sesión iniciada (email o wallet SIWE).
- **Streaming** de respuestas (SSE) con botón de detener, copiar, citas de fuentes y Markdown.
- **Historial** de conversaciones por usuario (abrir y borrar).
- **Documentos propios**: el clip sube `.txt`, `.md`, `.csv` o `.json` al conocimiento privado de tu
  tenant. Otros usuarios no pueden recuperarlo. Los documentos con instrucciones sospechosas
  (prompt injection) quedan en cuarentena y no se indexan.

## Acciones dentro del chat

Las respuestas pueden traer **tarjetas de acción** (tokenizar activos, RWA, staking, bridge, DAO, apps, planes,
documentos exclusivos…) y el botón **Acciones** de la cabecera abre el catálogo completo. Cada una abre una
**ventana emergente dentro del chat** que lleva al enlace directo; el chat nunca ejecuta operaciones ni pide claves.

Seguridad:
- Los destinos viven solo en `backend/services/ai-workspace/actions.js`; ni el modelo, ni los documentos, ni el cliente los eligen.
- Las sugerencias se calculan solo con el mensaje del usuario (un documento envenenado no puede mostrar botones).
- Acceso por plan/rol validado al listar y de nuevo al abrir; un plan desconocido no desbloquea nada.
- La salida del modelo se sanea (`outputSanitizer.js`): sin imágenes, HTML, enlaces externos ni claves; el servidor envía un evento `replace` si cambia el texto.
- Hooks (`hooks.js`): `beforeChat`, `afterModel` y `onAction`; los críticos fallan cerrado. Se extienden con `router.hooks.register(etapa, fn)`.
- Dominios propios permitidos en enlaces: `AI_TRUSTED_LINK_HOSTS` (por defecto `bezhas.com,www.bezhas.com`).

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/ai-workspace/chat` | Respuesta completa |
| POST | `/api/ai-workspace/chat/stream` | SSE: `meta` → `provider` → `delta`* → `done` (o `error`) |
| GET / DELETE | `/api/ai-workspace/conversations[/:id]` | Historial del usuario |
| GET / POST / DELETE | `/api/ai-workspace/knowledge[/:id]` | Documentos del tenant |
| GET | `/api/ai-workspace/actions` | Catálogo de acciones según rol/plan (las bloqueadas llevan `locked` y `upgradeActionId`) |
| POST | `/api/ai-workspace/actions/:id/open` | Re-valida el acceso y devuelve el destino (`href`); 403 con `upgradeActionId` si el plan no basta |
| GET | `/api/ai-workspace/plans` | Planes públicos (id, nombre, precio mensual) para la ventana de planes |
| POST | `/api/wallet-auth/nonce` · `/verify` | Login con wallet (SIWE) → JWT |

## Variables

| Variable | Efecto |
|---|---|
| `PORT` | Puerto del servidor de desarrollo (5000) |
| `AI_STREAM_PACE_MS` | Pausa por palabra en modo local (simula un modelo) |
| `AI_WORKSPACE_RATE_LIMIT` / `_IP_RATE_LIMIT` | Peticiones por minuto por usuario / IP |
| `AI_CONVERSATIONS_PERSIST`, `KNOWLEDGE_PERSIST` | `false` = solo memoria (el servidor de desarrollo lo fija) |
| `REDIS_URL` (o `REDIS_HOST`/`REDIS_PORT`) | Nonces SIWE en Redis (multi-instancia). Sin Redis se usan en memoria (una sola instancia); con Redis configurado pero caído el login con wallet responde 503 |
| `WALLET_AUTH_REQUIRE_REDIS=true` | Exige Redis para los nonces SIWE aunque no esté configurado |
| `DEV_ALLOWED_ORIGINS` | Orígenes CORS permitidos (por defecto localhost:3000 y 5173) |

## Pruebas

```bash
cd backend && npx jest tests/knowledge tests/auth
```
