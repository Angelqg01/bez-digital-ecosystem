-- 062_ai_workspace.sql
--
-- Asistente de IA de la plataforma (RAG + chat). Antes vivía en memoria o en un
-- fichero JSON: en Cloud Run se perdía en cada despliegue y cada instancia veía
-- datos distintos. Aquí persiste y lo comparten todas las instancias.
--
-- knowledge_documents / knowledge_chunks: la base de conocimiento. tenant_id NULL
--   = conocimiento global (solo PUBLIC, lo publica un admin); si no, el de la
--   organización del usuario ('org:<uuid>') o el suyo propio ('user:<id>').
--   La ACL (clasificación, roles, planes, vigencia) se evalúa en el servicio
--   antes de rankear y otra vez antes de entregar el contexto.
-- ai_conversations: historial por usuario. La clave (user_id, id) hace que un
--   id ajeno nunca pueda leer ni sobrescribir la conversación de otro.

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id                VARCHAR(100) PRIMARY KEY,
    tenant_id         VARCHAR(120),
    title             VARCHAR(200) NOT NULL,
    source            VARCHAR(60)  NOT NULL DEFAULT 'upload',
    category          VARCHAR(60)  NOT NULL DEFAULT 'general',
    classification    VARCHAR(30)  NOT NULL
                      CHECK (classification IN ('PUBLIC', 'INTERNAL', 'TENANT_CONFIDENTIAL', 'RESTRICTED')),
    allowed_roles     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    allowed_plans     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    valid_from        TIMESTAMPTZ,
    valid_to          TIMESTAMPTZ,
    version           INTEGER      NOT NULL DEFAULT 1,
    checksum          TEXT         NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'quarantined')),
    quarantine_reason JSONB,
    created_by        VARCHAR(120),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Conocimiento global solo PUBLIC (la misma regla que el servicio, en la base).
    CHECK (tenant_id IS NOT NULL OR classification = 'PUBLIC')
);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant ON knowledge_documents(tenant_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id          VARCHAR(160) PRIMARY KEY,
    document_id VARCHAR(100) NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER      NOT NULL,
    content     TEXT         NOT NULL,
    section     TEXT,
    version     INTEGER      NOT NULL,
    checksum    TEXT         NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);

CREATE TABLE IF NOT EXISTS ai_conversations (
    user_id    VARCHAR(120) NOT NULL,
    id         VARCHAR(64)  NOT NULL,
    title      VARCHAR(80)  NOT NULL DEFAULT '',
    turns      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated ON ai_conversations(user_id, updated_at DESC);
