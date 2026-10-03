# BeZhas AI Workspace — desarrollo local

Chat con RAG seguro y login (email o wallet), sin Postgres, MongoDB ni Redis.

## Arranque

```bash
# 1) Backend de desarrollo (http://localhost:5000). Usuarios en memoria.
cd backend
node scripts/dev-ai-workspace.js

# 2) Frontend (http://localhost:3000)
cd ../frontend-next
NEXT_PUBLIC_API_URL=http://localhost:5000 pnpm dev
```

Sin `ANTHROPIC_API_KEY` ni `OPENAI_API_KEY` el chat responde en **modo local**: devuelve los
fragmentos de documentación encontrados, con citas. Con una clave usa el modelo (streaming):

```bash
ANTHROPIC_API_KEY=sk-ant-... node scripts/dev-ai-workspace.js
# modelo: AI_MODEL_ANTHROPIC (por defecto claude-sonnet-5-5); OpenAI: AI_MODEL_OPENAI
```

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

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/ai-workspace/chat` | Respuesta completa |
| POST | `/api/ai-workspace/chat/stream` | SSE: `meta` → `provider` → `delta`* → `done` (o `error`) |
| GET / DELETE | `/api/ai-workspace/conversations[/:id]` | Historial del usuario |
| GET / POST / DELETE | `/api/ai-workspace/knowledge[/:id]` | Documentos del tenant |
| POST | `/api/wallet-auth/nonce` · `/verify` | Login con wallet (SIWE) → JWT |

## Variables

| Variable | Efecto |
|---|---|
| `PORT` | Puerto del servidor de desarrollo (5000) |
| `AI_STREAM_PACE_MS` | Pausa por palabra en modo local (simula un modelo) |
| `AI_WORKSPACE_RATE_LIMIT` / `_IP_RATE_LIMIT` | Peticiones por minuto por usuario / IP |
| `AI_CONVERSATIONS_PERSIST`, `KNOWLEDGE_PERSIST` | `false` = solo memoria (el servidor de desarrollo lo fija) |
| `DEV_ALLOWED_ORIGINS` | Orígenes CORS permitidos (por defecto localhost:3000 y 5173) |

## Pruebas

```bash
cd backend && npx jest tests/knowledge tests/auth
```
