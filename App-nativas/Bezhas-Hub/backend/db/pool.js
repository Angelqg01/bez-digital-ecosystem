const { Pool } = require('pg');

const DEFAULT_URL = 'postgresql://bezhas:bezhas_password@localhost:5433/bezhas';

/**
 * Resuelve la cadena de conexión de PostgreSQL.
 *
 * El Hub convive con Mongoose, y el `.env` de la raíz define
 * DATABASE_URL="mongodb://…" para Mongo — la MISMA variable que leía este pool.
 * Hoy no explota sólo porque `npm start` corre desde backend/, cuyo .env no la
 * define; arrancar desde la raíz del Hub bastaba para que Postgres intentase
 * conectarse a una URL de Mongo y fallase de forma desconcertante.
 *
 * Prioridad: POSTGRES_URL (específica) → DATABASE_URL (sólo si de verdad es de
 * Postgres) → valor por defecto de desarrollo.
 */
function resolveConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;

  const url = process.env.DATABASE_URL;
  if (!url) return DEFAULT_URL;

  if (/^postgres(ql)?:\/\//i.test(url)) return url;

  console.warn(
    `[db/pool] DATABASE_URL no es una URL de PostgreSQL (${url.split('://')[0]}://…) — ` +
    'se ignora. Usa POSTGRES_URL para la conexión de Postgres.'
  );
  return DEFAULT_URL;
}

const pool = new Pool({ connectionString: resolveConnectionString() });

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  resolveConnectionString,
};
