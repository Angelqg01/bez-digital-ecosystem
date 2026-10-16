-- Migration 065: búsqueda por texto en Postgres para el Knowledge Plane.
--
-- Hasta ahora cada mensaje del chat cargaba hasta 5000 fragmentos en Node y rankeaba allí. Con esta migración el
-- prefiltro (tenant + estado + términos de la pregunta) lo hace Postgres con un índice GIN y Node sólo reordena con
-- BM25 los candidatos. Sólo añade una columna y un índice: no cambia ni borra datos y se puede revertir con
-- `DROP INDEX idx_knowledge_chunks_tsv; ALTER TABLE knowledge_chunks DROP COLUMN tsv, DROP COLUMN tokens, DROP COLUMN ntok;`.
--
-- `tokens` los calcula la aplicación con el MISMO tokenizador que BM25 (sin acentos, sin invisibles, con raíz), de modo
-- que lo que se indexa y lo que se busca coincide exactamente. Por eso no hace falta la extensión `unaccent` ni el
-- diccionario `spanish`. Las filas anteriores a esta migración tienen `tokens` NULL hasta que se ejecute
-- `node scripts/knowledge-reindex.js`; mientras tanto la consulta las incluye siempre, así que nada deja de encontrarse.
-- `ntok` = longitud del fragmento en tokens (con el título contado tres veces, como en el BM25): da la longitud media.
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS tokens TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS ntok INTEGER;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(tokens, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv ON knowledge_chunks USING GIN (tsv);
