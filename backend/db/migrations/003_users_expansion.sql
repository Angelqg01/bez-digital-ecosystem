-- 003_users_expansion.sql
-- Expande la tabla simple inicial 'users' para soportar todas las variables del sistema anterior (Mongoose).

DO $$
BEGIN
    -- Identidad
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password') THEN
        ALTER TABLE users ADD COLUMN password VARCHAR(255);
    END IF;

    -- Cuenta / Perfil (Uso de JSONB para el perfil dinámico de empresas/freelancers)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_type') THEN
        ALTER TABLE users ADD COLUMN account_type VARCHAR(50) DEFAULT 'individual';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile') THEN
        ALTER TABLE users ADD COLUMN profile JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='commercial_profile') THEN
        ALTER TABLE users ADD COLUMN commercial_profile JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Roles e Identidad
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='roles') THEN
        ALTER TABLE users ADD COLUMN roles JSONB DEFAULT '["USER"]'::jsonb;
    END IF;
    
    -- Seguridad / Estado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='security_flags') THEN
        ALTER TABLE users ADD COLUMN security_flags JSONB DEFAULT '{"isEmailVerified": false, "isWalletVerified": false, "is2FAEnabled": false}'::jsonb;
    END IF;
    
    -- Autenticación Externa (SSO)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='sso_ids') THEN
        ALTER TABLE users ADD COLUMN sso_ids JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Afiliados
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='affiliate_data') THEN
        ALTER TABLE users ADD COLUMN affiliate_data JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- VIP Status Legacy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vip_status') THEN
        ALTER TABLE users ADD COLUMN vip_status JSONB DEFAULT '{"isVIP": false, "vipTier": null}'::jsonb;
    END IF;
END $$;
