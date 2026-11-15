-- Migration 081: vectores de los fragmentos del Knowledge Plane (búsqueda semántica híbrida con BM25).
--
-- `embedding` es real[] (vector unitario) y `embedding_model` identifica el modelo y los prefijos con que se
-- calculó: un vector sólo se compara con otro del mismo `embedding_model`, así que cambiar de modelo no
-- corrompe nada, sólo deja los antiguos sin usar hasta `node scripts/knowledge-embed.js`.
-- Se eligió real[] y no la extensión pgvector: el prefiltro de tenant/estado/ACL ya recorta a cientos de
-- candidatos y la similitud se calcula en Node. Si el volumen por tenant lo exige, pgvector se añade después
-- con una columna nueva y sin tocar ésta. Sólo añade columnas NULL: no cambia ni borra datos.
-- Revertir: ALTER TABLE knowledge_chunks DROP COLUMN embedding, DROP COLUMN embedding_model;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding real[];
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding_model TEXT;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_model ON knowledge_chunks (embedding_model)
    WHERE embedding IS NOT NULL;
