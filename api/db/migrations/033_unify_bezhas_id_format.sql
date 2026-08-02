-- Migration 033: unifica el formato del BeZhas_ID.
-- =============================================================================
-- Hasta ahora convivían dos formatos para la MISMA cosa:
--   · users.bezhas_id (esta BD)        →  BEZ-XXXXXXXX-XXXXXXXX   (hex)
--   · identities.bezhas_id (Hub)       →  BZ-XXXXXXXXXX           (Crockford b32)
-- Una persona que entraba por la API core y luego por el Hub acababa con dos
-- identidades. El canónico es el del Hub, porque su alfabeto no tiene
-- caracteres ambiguos (sin I/L/O/U) y porque memberships.bezhas_id y
-- api_keys.bezhas_id ya lo referencian con VARCHAR(24).
--
-- La conversión es DETERMINISTA (sha256 del id antiguo, 10 primeros hex chars)
-- para que:
--   1. re-ejecutar la migración sea idempotente,
--   2. lib/bezhasId.js llegue al mismo resultado desde JS
--      (legacyToCanonical), y un BEZ-… impreso en un albarán antiguo se
--      pueda seguir resolviendo.
-- Los chars hex [0-9A-F] son subconjunto del alfabeto Crockford, así que el
-- resultado siempre cumple el CHECK que se añade al final.
--
-- Aditivo y reversible: se guarda el id antiguo en users.legacy_bezhas_id.
-- =============================================================================

BEGIN;

-- 1) Conservar el identificador antiguo antes de tocarlo.
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_bezhas_id VARCHAR(50);

UPDATE users
   SET legacy_bezhas_id = bezhas_id
 WHERE bezhas_id ~ '^BEZ-[0-9A-Fa-f]{8}-[0-9A-Fa-f]{8}$'
   AND legacy_bezhas_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_legacy_bezhas_id ON users(legacy_bezhas_id);

-- 2) Reescribir al formato canónico.
UPDATE users
   SET bezhas_id = 'BZ-' || upper(substr(encode(sha256(convert_to(bezhas_id, 'UTF8')), 'hex'), 1, 10))
 WHERE bezhas_id ~ '^BEZ-[0-9A-Fa-f]{8}-[0-9A-Fa-f]{8}$';

-- 3) Cualquier resto que no encaje en ninguno de los dos formatos (filas
--    manuales, semillas de test) recibe un id canónico nuevo derivado de su
--    propia PK, que también es determinista y por tanto idempotente.
UPDATE users
   SET bezhas_id = 'BZ-' || upper(substr(encode(sha256(convert_to('uid:' || id::text, 'UTF8')), 'hex'), 1, 10))
 WHERE bezhas_id IS NOT NULL
   AND bezhas_id !~ '^BZ-[0-9A-HJKMNP-TV-Z]{10}$';

-- 4) Blindar el formato para que la divergencia no pueda reaparecer.
--    NOT VALID: no re-escanea la tabla histórica, pero sí valida todo INSERT
--    y UPDATE a partir de ahora. El VALIDATE explícito lo hace la línea
--    siguiente, ya barato porque los pasos 2 y 3 dejaron todo conforme.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_bezhas_id_format;
ALTER TABLE users ADD CONSTRAINT chk_users_bezhas_id_format
    CHECK (bezhas_id IS NULL OR bezhas_id ~ '^BZ-[0-9A-HJKMNP-TV-Z]{10}$') NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT chk_users_bezhas_id_format;

COMMIT;
