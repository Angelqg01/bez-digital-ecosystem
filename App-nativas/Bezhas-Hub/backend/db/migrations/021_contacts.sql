-- Migration 021: contactos sincronizados (antes, colección `contacts` de Mongo).
--
-- Guarda sólo HASHES de email/teléfono (para emparejar con usuarios sin almacenar el dato en claro consultable) y
-- el dato original cifrado por el cliente. `status`: pending (sin coincidencia), is_user (coincide con un usuario),
-- invited (ya se envió la invitación y se pagó la recompensa: no se puede cobrar dos veces).
-- Los índices únicos parciales hacen que re-sincronizar el mismo contacto lo actualice en vez de duplicarlo.
-- Revertir: DROP TABLE contacts;
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_hash VARCHAR(255),
    email_hash VARCHAR(255),
    encrypted_data TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'is_user', 'invited')),
    matched_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contacts_has_hash CHECK (email_hash IS NOT NULL OR phone_hash IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_owner_email ON contacts (owner_id, email_hash) WHERE email_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_owner_phone ON contacts (owner_id, phone_hash) WHERE phone_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_owner_matches ON contacts (owner_id) WHERE status = 'is_user';

-- Emparejar contactos con usuarios busca por estos hashes.
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users (email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users (phone_hash) WHERE phone_hash IS NOT NULL;
