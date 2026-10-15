# BeZhas AI (chat + RAG) — despliegue y operación

Servicio: `bezhas-api` en Cloud Run (`europe-west1`, proyecto `bezhas-prod` por defecto). El chat, el RAG, el MCP y la subida de archivos NFT viven en esa misma API. Despliegue general: `scripts/gcp-deploy.sh` (ver `docs/developer/GCP_DEPLOYMENT_GUIDE.md`).

> ⚠️ `gcloud run deploy --set-env-vars` **reemplaza todas** las variables. Para tocar un flag usa siempre `gcloud run services update … --update-env-vars` (o `--remove-env-vars`), nunca `--set-env-vars`.

## 1. Variables de entorno del chat y el RAG

| Variable | Por defecto | Efecto |
|---|---|---|
| `ANTHROPIC_API_KEY` (secreto) | — | Proveedor de IA. Sin clave ni Gemini: modo extractivo (fragmentos, coste 0) |
| `AI_MODEL_ANTHROPIC` | `claude-sonnet-5-5` | Modelo del chat. Comprobar que el id es válido: si no, el chat degrada en silencio (ver métrica de degradaciones) |
| `AI_PROVIDER` | auto | `extractive` fuerza el modo sin modelo de pago (kill switch suave) |
| `AI_WORKSPACE_ENABLED` | `true` | `false` → 503 `AI_DISABLED` en los mensajes (chat, stream y pregunta gratis). Las lecturas siguen |
| `AI_GLOBAL_DAILY_CALLS` | `20000` | Techo diario de llamadas de pago a IA, **compartido por todas las instancias si hay Redis** (`REDIS_URL`); además cuenta cada instancia |
| `AI_WORKSPACE_RATE_LIMIT` | `20` | Mensajes/min por usuario (compartido vía Redis; en memoria local si no hay) |
| `OLLAMA_URL` / `AI_MODEL_OLLAMA` / `OLLAMA_NUM_CTX` | `http://127.0.0.1:11434` / `qwen3.5:4b` / `4096` | Modelo local, **sólo** con `AI_PROVIDER=ollama`. La URL debe ser privada; si Ollama falla se sirve el modo extractivo, nunca la nube. Ollama no debe exponerse a Internet |
| `KNOWLEDGE_RETRIEVAL` | (vacío) | `fts` = prefiltro en Postgres con índice GIN. Requiere migración 065 |
| `KNOWLEDGE_CANDIDATES` | `300` | Candidatos que reordena BM25 en modo `fts` |
| `KNOWLEDGE_TENANT_INGEST` | (vacío = apagada) | `true` reactiva el RAG privado de clientes. **Mantener apagado** (política anti prompt injection) |
| `KNOWLEDGE_AUTOSEED` | `true` | Siembra el conocimiento público al primer uso |
| `NFT_UPLOADS_ENABLED` | `true` | `false` apaga `POST /api/nft-assets` |
| `PINATA_JWT` (secreto) | — | IPFS para las subidas de NFT. Sin él: 503 |
| `JWT_STRICT_CLAIMS` | (vacío) | `true` exige `iss`/`aud` en todos los tokens. Cierra las sesiones con tokens antiguos |

## 2. Primer despliegue del bloque RAG (orden)

1. **Antes de nada** (y nunca pases `--reset` a `db/migrate.js`: borra todas las tablas): copia de seguridad de Cloud SQL (`gcloud sql backups create --instance bezhas-postgres`). Las migraciones 049–051 siguen **sin aplicar**: `db/migrate.js` aplica las pendientes en orden, así que se aplicarán todas junto con la 065. Revísalas antes (`api/db/migrations/049*–051*`).
2. Despliega la revisión nueva con `scripts/gcp-deploy.sh` (el job `bezhas-db-migrate` aplica migraciones, incluida la 065, que sólo **añade** columnas e índice).
3. Rellena los índices de las filas anteriores:
   ```bash
   gcloud run jobs execute bezhas-db-migrate --region europe-west1 --args "scripts/knowledge-reindex.js" --wait
   ```
   (o ejecuta `node scripts/knowledge-reindex.js` con las variables de la API). Es idempotente.
4. Activa el modo `fts` **después** de comprobar el paso 3:
   ```bash
   gcloud run services update bezhas-api --region europe-west1 --update-env-vars KNOWLEDGE_RETRIEVAL=fts
   ```
5. Smoke tests (sección 4).

## 3. Interruptores de apagado (de menos a más drástico)

```bash
# a) Chat sin modelo de pago (sigue respondiendo con fragmentos de la documentación, coste 0)
gcloud run services update bezhas-api --region europe-west1 --update-env-vars AI_PROVIDER=extractive
# b) Chat apagado del todo (503 en los mensajes; el resto de la plataforma sigue)
gcloud run services update bezhas-api --region europe-west1 --update-env-vars AI_WORKSPACE_ENABLED=false
# c) Subidas de archivos NFT apagadas
gcloud run services update bezhas-api --region europe-west1 --update-env-vars NFT_UPLOADS_ENABLED=false
# d) Volver al modo de búsqueda anterior (sin índice GIN)
gcloud run services update bezhas-api --region europe-west1 --remove-env-vars KNOWLEDGE_RETRIEVAL
```
Cada comando crea una revisión nueva (≈1 min). Para revertir un interruptor: `--remove-env-vars <NOMBRE>`.

## 4. Smoke tests tras desplegar

```bash
API=https://api.bezhas.com
curl -s -o /dev/null -w "actions sin token → %{http_code} (esperado 401)\n" $API/api/ai-workspace/actions
curl -s -o /dev/null -w "nft-assets sin token → %{http_code} (esperado 401)\n" -X POST $API/api/nft-assets
curl -s -H "x-api-key: $BEZHAS_TEST_KEY" "$API/api/gateway/v1/knowledge/search?q=planes%20y%20precios" | head -c 400
```
Con un token de prueba de un usuario con plan: `POST /api/ai-workspace/chat` → 200, `reply` con cita `[1]`; con un usuario sin plan → 402. Versión desplegada: `gcloud run services describe bezhas-api --region europe-west1 --format "value(status.latestReadyRevisionName)"`.

## 5. Observabilidad

- **Log JSON** (una línea por mensaje): `evento="ai_chat_turno"` con `canal`, `outcome` (`ok|blocked|aborted|no_plan|rechazado|error`), `provider`, `ms`, `retrieval{ms,fuentes,cobertura,resultado}`, `userId`, `tenant`, `tokens`. **Nunca** lleva la pregunta, la respuesta ni los fragmentos.
- **Prometheus** (`/metrics`): `bezhas_ai_chat_messages_total{canal,outcome,provider}`, `bezhas_ai_chat_duration_seconds`, `bezhas_ai_retrieval_duration_seconds{modo}`, `bezhas_ai_retrieval_total{resultado=hit|weak|none}`, `bezhas_ai_provider_degradations_total{provider}`.
- **Alertas sugeridas** (no creadas): degradaciones > 0 sostenidas 5 min (el modelo o la clave fallan); `retrieval_total{resultado="none"}` > 30 % de los mensajes (el RAG no encuentra); p95 de `chat_duration` > 15 s; `outcome="error"` > 2 %.

## 6. Evaluación del retrieval antes de cada cambio de ranking o de documentos

```bash
cd api && node scripts/rag-eval.js                 # informe
node scripts/rag-eval.js --min-recall 0.95 --min-abstencion 1   # falla (exit 1) si baja del baseline
pnpm exec jest __tests__/services/rag-eval.test.js
# contra Postgres real (contenedor desechable):
docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54329:5432 postgres:16-alpine
KNOWLEDGE_TEST_PG_URL=postgres://postgres:test@localhost:54329/t pnpm exec jest __tests__/integration/knowledge-pg.test.js
```
Baseline en `docs/audit/RAG-TEST-BASELINE.md`.

## 7. Lo que NO se ha hecho (no asumir)

Nada de lo anterior está desplegado: son cambios locales sin `push`. No hay alertas creadas, ni dashboard, ni prueba de carga, ni modelo local.
