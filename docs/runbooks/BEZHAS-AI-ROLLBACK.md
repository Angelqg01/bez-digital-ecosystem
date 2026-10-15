# BeZhas AI — rollback e incidentes

## Rollback de la API (código)

```bash
# Ver revisiones y cuál sirve tráfico
gcloud run revisions list --service bezhas-api --region europe-west1 --limit 5
# Devolver el 100 % del tráfico a una revisión anterior (instantáneo, no borra nada)
gcloud run services update-traffic bezhas-api --region europe-west1 --to-revisions <REVISION_ANTERIOR>=100
```

## Rollback de la migración 065 (sólo si hiciera falta)

La 065 es aditiva: la revisión anterior de la API **sigue funcionando** con las columnas nuevas presentes, así que normalmente basta con el rollback de código y `--remove-env-vars KNOWLEDGE_RETRIEVAL`. Sólo para retirarla del todo:
```sql
DROP INDEX IF EXISTS idx_knowledge_chunks_tsv;
ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS tsv, DROP COLUMN IF EXISTS tokens, DROP COLUMN IF EXISTS ntok;
DELETE FROM migrations WHERE name LIKE '065%';   -- comprobar el nombre exacto antes
```
Hacer antes una copia: `gcloud sql backups create --instance bezhas-postgres`.

## Runbooks por incidente

| Incidente | Qué hacer |
|---|---|
| **Sospecha de fuga entre clientes** | 1) `AI_WORKSPACE_ENABLED=false` y, si procede, `KNOWLEDGE_RETRIEVAL` fuera. 2) Guardar los logs `ai_chat_turno` de la ventana (no llevan texto). 3) Revisar `knowledge_documents` con `tenant_id` no nulo (con la ingesta apagada debería estar vacío o ser anterior a la política). 4) Pasar `__tests__/services/knowledge-isolation.test.js` y el de integración contra Postgres. 5) No reactivar hasta que pasen. |
| **Modelo no disponible / clave inválida** | Métrica `degradations_total` sube y los mensajes salen con `provider=extractive`. Revisar `ANTHROPIC_API_KEY` y `AI_MODEL_ANTHROPIC`. Mientras tanto el chat responde con fragmentos: no hace falta apagarlo. |
| **Coste desbocado** | `AI_PROVIDER=extractive` (coste IA 0) y bajar `AI_GLOBAL_DAILY_CALLS`. Revisar `bezhas_ai_chat_messages_total` por canal. |
| **El RAG no encuentra / respuestas flojas** | Mirar `retrieval_total{resultado="none"|"weak"}`; ejecutar `node scripts/rag-eval.js` para ver si es regresión del ranking; si empezó con `fts`, quitar `KNOWLEDGE_RETRIEVAL`. |
| **Documento sospechoso / prompt injection** | Sólo hay conocimiento sembrado: revisar `api/services/knowledge/seed.js` y el historial de git. Si apareciera un documento de tenant: `DELETE /api/ai-workspace/knowledge/:id` y revisar por qué estaba la ingesta activa. |
| **Subida de archivo malicioso** | `NFT_UPLOADS_ENABLED=false`; los rechazos quedan en el log (`nft-assets: archivo rechazado`, con `code`). El archivo anexado a IPFS no se puede borrar de la red: se retira de Pinata (unpin) con su CID. |
| **Redis caído** | El chat sigue: los límites caen a memoria por instancia y el techo diario usa el contador local. Sin acción inmediata. |

## Dónde está cada cosa
Chat: `api/routes/ai-workspace.js` · RAG: `api/services/knowledge/` · pasarela de modelos: `api/services/ai-workspace/gateway.js` · métricas: `api/services/ai-workspace/telemetry.js` · MCP/REST: `api/services/knowledge/search.js` · subidas: `api/routes/nft-assets.js`, `api/utils/uploadGuard.js` · plan de desarrollo: `docs/audit/RAG-PLAN-DESARROLLO.md`.
