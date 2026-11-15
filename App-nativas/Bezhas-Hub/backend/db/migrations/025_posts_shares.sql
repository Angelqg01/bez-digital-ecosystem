-- Migration 025: contador de compartidos y campos del oráculo de calidad en `posts`, y tabla `post_shares`
-- (antes, colecciones `posts` y `shares` de Mongo).
--
-- `posts` ya existía desde la 005 (autor como cadena: wallet o nombre). Esta migración sólo AÑADE columnas.
-- `post_shares` guarda cada compartido; la IP y el user-agent se conservan para antiabuso pero la API no los devuelve.
-- Mongo borraba los compartidos a los 12 meses con un índice TTL: aquí lo hace Share.purgeExpired().
-- Revertir: DROP TABLE post_shares; ALTER TABLE posts DROP COLUMN shares, DROP COLUMN quality_score, ...
ALTER TABLE posts ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 0 CHECK (shares >= 0);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5, 2);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_analysis_data JSONB;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS blockchain_validated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS validation_tx_hash VARCHAR(66);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(20, 6);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reward_distributed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reward_distributed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ALTER COLUMN image TYPE TEXT;

-- Los posts sin analizar se buscan por fecha: índice parcial.
CREATE INDEX IF NOT EXISTS idx_posts_unanalyzed ON posts (created_at DESC) WHERE quality_score IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

CREATE TABLE IF NOT EXISTS post_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('twitter', 'facebook', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'email', 'discord', 'copy', 'native')),
    url TEXT,
    comment VARCHAR(500) NOT NULL DEFAULT '',
    ip_address VARCHAR(64),
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,        -- hashtags, mentions, location
    clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    reach INTEGER NOT NULL DEFAULT 0 CHECK (reach >= 0),
    engagement INTEGER NOT NULL DEFAULT 0 CHECK (engagement >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_post_shares_user ON post_shares (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_shares_post_platform ON post_shares (post_id, platform);
CREATE INDEX IF NOT EXISTS idx_post_shares_platform ON post_shares (platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_shares_created ON post_shares (created_at);
