-- OPERANT · rol de aplicación sin privilegios (el que hace que la RLS exista).
--
-- Postgres NO aplica Row-Level Security a los superusuarios ni a los roles con
-- BYPASSRLS, y exime al dueño de la tabla salvo que se use FORCE. La imagen de
-- Docker crea POSTGRES_USER como SUPERUSUARIO y es el dueño del esquema: si la
-- aplicación se conecta con ese rol —lo que hacía la configuración por defecto,
-- y lo que sugería el DATABASE_URL de la documentación— las políticas del
-- fichero 001 no filtran absolutamente nada. Verificado, no supuesto: con el
-- rol superusuario, un SELECT sin WHERE dentro del contexto del tenant A
-- devolvía también las filas del tenant B.
--
-- Por eso el esquema y las migraciones los sigue haciendo el dueño, pero la
-- aplicación se conecta con `operant_app`: sin superusuario, sin BYPASSRLS y
-- sin ser dueña de nada. Solo puede leer y escribir filas de su tenant.
--
-- El rol se crea SIN contraseña a propósito: no puede iniciar sesión hasta que
-- alguien le ponga una. Un fichero del repositorio no es sitio para una
-- credencial, y un rol con contraseña por defecto es peor que ninguno.
--   npm run db:migrate  la fija a partir de PG_APP_PASSWORD, si está definida
--   o a mano:  ALTER ROLE operant_app LOGIN PASSWORD '...';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'operant_app') THEN
    CREATE ROLE operant_app LOGIN PASSWORD NULL;
    RAISE NOTICE 'rol operant_app creado sin contraseña: fíjala antes de usarlo';
  END IF;

  -- Defensa en profundidad: aunque alguien se los conceda por error más
  -- adelante, estos dos atributos anularían toda la RLS.
  EXECUTE 'ALTER ROLE operant_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE';
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO operant_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO operant_app;

-- Datos: leer y escribir, nada de DDL. El esquema solo lo cambia el dueño.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants, api_keys, tasks, approvals, interactions, facts, audit_log
  TO operant_app;

-- Secuencias de los BIGSERIAL (interactions.id, audit_log.id).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO operant_app;

-- La auditoría es append-only: ni siquiera la aplicación puede reescribirla.
-- Si un día se pudiera editar o borrar, la cadena de hashes de AuditLog dejaría
-- de probar nada ante un auditor.
REVOKE UPDATE, DELETE ON audit_log FROM operant_app;
