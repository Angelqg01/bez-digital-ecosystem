-- 048_admin_credentials.sql
--
-- Credenciales del SuperAdmin y su segundo factor.
--
-- Hasta ahora vivían sólo en ADMIN_USERNAME / ADMIN_PASSWORD_HASH del entorno,
-- lo que hacía imposible el endpoint de rotación del panel: cambiar la
-- contraseña habría exigido reescribir un .env y reiniciar el proceso. Con la
-- credencial en base, el entorno pasa a ser sólo la semilla del primer
-- arranque y la rotación tiene efecto inmediato.
--
-- Fila única (CHECK id = 1): no hay "varios superadmins", hay uno. Modelarlo
-- como tabla de N filas invitaría a crear un segundo con otro rol y a que la
-- pregunta "quién es el superadmin" pase a tener varias respuestas.

CREATE TABLE IF NOT EXISTS admin_credentials (
    id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    username                 VARCHAR(50)  NOT NULL,
    password_hash            TEXT         NOT NULL,
    wallet_address           VARCHAR(42),

    -- Secreto TOTP cifrado con VAULT_KEY (aes-256-gcm), nunca en claro: quien
    -- lea la base no puede generar códigos válidos.
    totp_secret_encrypted    TEXT,
    -- Separado de que el secreto exista: durante el alta hay secreto emitido
    -- pero 2FA aún no activo, y hasta que el usuario no confirma un código no
    -- se puede exigir el segundo factor sin arriesgar un bloqueo.
    totp_enabled             BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Hashes bcrypt de los códigos de respaldo. Se guardan hasheados por el
    -- mismo motivo que la contraseña: son credenciales de acceso completo.
    backup_codes             JSONB        NOT NULL DEFAULT '[]'::jsonb,

    -- Hashes de contraseñas anteriores, para rechazar la reutilización.
    password_history         JSONB        NOT NULL DEFAULT '[]'::jsonb,

    must_change_password     BOOLEAN      NOT NULL DEFAULT FALSE,
    last_password_rotated_at TIMESTAMPTZ,
    last_2fa_verified_at     TIMESTAMPTZ,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
