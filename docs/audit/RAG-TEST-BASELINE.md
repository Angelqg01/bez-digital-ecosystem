# RAG — baseline de pruebas (BM25 actual)

**Fecha:** 2026-10-15 · **Commit base:** `acff5bbc` + Fase 2 · **Comando:** `cd api && node scripts/rag-eval.js [--json out.json]`

Corpus: `api/__tests__/fixtures/rag-eval/questions.json` (54 preguntas: 30 directas, 8 paráfrasis, 6 identificadores exactos, 2 en inglés, 6 sin respuesta y 2 adversariales). Documentos: los 32 del conocimiento público sembrado (`services/knowledge/seed.js`) en un almacén en memoria. Sólo mide recuperación: no llama a ningún modelo ni a la base de datos.

| Métrica | Resultado |
|---|---|
| recall@4 (46 preguntas con respuesta) | **95,7 %** |
| Acierto en 1.ª posición / MRR | 87,0 % / 0,913 |
| Directas · paráfrasis · exactas | 100 % · 100 % · 100 % |
| Inglés | **0 %** (2 preguntas) |
| Sin respuesta: se abstiene del todo | 75 % (6 de 8) |
| Sin respuesta: se abstiene o devuelve coincidencia débil (el chat lo avisa) | 100 % |
| Latencia del retrieval, 32 documentos | p50 1,5 ms · p95 2,6 ms |

**Fallos conocidos**
- `q45` «How do I connect my AI assistant via MCP?» → nada. `q46` «What does the Starter plan cost?» → `bz_contabilidad`. Los documentos están en español y BM25 no cruza idiomas; es el caso que justificaría embeddings (Fase 3).
- `n01` «capital de Mongolia» → `bz_staking` con cobertura 0,43 y `a02` → `bz_mcp` con 0,31: no se abstiene, pero ambas quedan bajo 0,5 y el chat responde «No estoy seguro…». Con proveedor LLM esa advertencia depende del prompt, no de código.

**Limitaciones de esta medición**
- 32 documentos: no demuestra que el ranking escale. La latencia con miles de fragmentos por tenant está sin medir (hallazgo H2 del plan).
- El corpus lo escribí yo conociendo los documentos: sirve como puerta de regresión, no como estimación de calidad frente a preguntas reales de clientes. Conviene añadir preguntas reales anonimizadas.
- No hay prueba de aislamiento contra un Postgres real: `knowledge-isolation.test.js` usa el almacén en memoria. La barrera SQL (`PgStore.chunksVisibles`, `WHERE tenant_id IS NOT DISTINCT FROM`) sigue sin test automático.

**Pruebas automáticas asociadas** (`pnpm exec jest`): `rag-eval.test.js` (umbrales sobre este baseline), `knowledge-isolation.test.js` (10 casos de tenant, borrado, cuarentena, vigencia y versión), `ai-citations.test.js` (citas inexistentes).

## Fase 3 — búsqueda en Postgres (medido con Postgres 16 real, contenedor desechable)

Prueba: 400 documentos de un mismo tenant (14.324 fragmentos) + los 32 globales. `KNOWLEDGE_RETRIEVAL` sin definir (modo actual) frente a `fts`.

| Modo | p50 | p95 | Resultado |
|---|---|---|---|
| completo (actual, `LIMIT 5000` sin orden) | 247 ms | 407 ms | **no devuelve nada**: el tope de 5000 deja fuera el conocimiento global y la respuesta queda vacía |
| `fts` (índice GIN + estadísticas BM25 en SQL) | 22 ms | 33 ms | top-1 correcto en las 4 preguntas |

Esto confirma el hallazgo H2: con más de 5000 fragmentos por tenant el modo actual **falla en silencio**, no sólo se vuelve lento. Con el corpus de evaluación (54 preguntas) `fts` devuelve los mismos documentos y en el mismo orden que el modo completo (`__tests__/integration/knowledge-pg.test.js`, se salta si no hay `KNOWLEDGE_TEST_PG_URL`). El modo `fts` sigue DESACTIVADO por defecto.
