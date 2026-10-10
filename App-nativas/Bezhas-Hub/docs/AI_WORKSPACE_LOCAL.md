# BeZhas AI Workspace — desarrollo local

Chat con RAG seguro y login (email o wallet), sin Postgres, MongoDB ni Redis.

## Arranque

El chat vive en la API principal (`api/`, ruta `/api/ai-workspace`) y también en el backend del Hub
(`backend/routes/ai-workspace.routes.js`). Con la API del stack de desarrollo en marcha
(`docker compose up -d --build bezhas-api`, puerto 3001) basta con arrancar el frontend del Hub:

```bash
cd App-nativas/Bezhas-Hub/frontend
pnpm dev        # http://localhost:5173, el proxy de Vite reenvía /api/* a http://localhost:3001
```

Sin `ANTHROPIC_API_KEY` ni `OPENAI_API_KEY` el chat responde en **modo extractivo**: devuelve los fragmentos
de documentación encontrados, con citas, y no cuesta nada. Con una clave usa el modelo (streaming).

Acceso: wallet (firma del mensaje que entrega `GET /api/auth/nonce`, `POST /api/auth/login`) o email y
contraseña (`/api/auth/register-email`, `/login-email`, `/forgot-password`, `/reset-password`).
Pagos con Stripe (`/api/checkout/plan` y `/bez`): ver `api/services/chatCheckout.js`.

## Qué incluye

- **Barra de chat flotante** (inferior): solo se puede chatear con sesión iniciada (email o wallet).
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

## Variables

| Variable | Efecto |
|---|---|
| `AI_STREAM_PACE_MS` | Pausa por palabra en modo local (simula un modelo) |
| `AI_WORKSPACE_RATE_LIMIT` / `_IP_RATE_LIMIT` | Peticiones por minuto por usuario / IP |
| `AI_CONVERSATIONS_PERSIST`, `KNOWLEDGE_PERSIST` | `false` = solo memoria (el servidor de desarrollo lo fija) |

## Pruebas

```bash
cd backend && npx jest tests/knowledge tests/auth
```
