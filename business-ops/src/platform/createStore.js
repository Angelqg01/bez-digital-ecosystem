'use strict';

const InMemoryStore = require('./InMemoryStore');

/**
 * createStore — elige el adaptador de persistencia según el entorno.
 *
 *  - Con DATABASE_URL  → PostgresStore (producción multi-nodo, RLS por tenant).
 *  - Con sqlitePath    → SqliteStore (base de datos interna embebida, durable).
 *  - Sin nada          → InMemoryStore (tests/desarrollo; no sobrevive a reinicios).
 *
 * Mismo patrón que el ModelGateway (live vs simulado): el resto del sistema
 * no sabe qué adaptador hay detrás.
 */
function createStore({ databaseUrl, sqlitePath } = {}) {
  if (databaseUrl) {
    try {
      const PostgresStore = require('./PostgresStore'); // carga `pg` solo aquí
      return new PostgresStore({ connectionString: databaseUrl });
    } catch (err) {
      console.warn(`[store] Postgres no disponible (${err.message}). Usando memoria.`);
    }
  }
  if (sqlitePath) {
    try {
      const SqliteStore = require('./SqliteStore'); // requiere node:sqlite (Node ≥22.5)
      return new SqliteStore({ filePath: sqlitePath });
    } catch (err) {
      console.warn(`[store] SQLite no disponible (${err.message}). Usando memoria.`);
    }
  }
  return new InMemoryStore();
}

module.exports = createStore;
