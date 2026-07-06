#!/usr/bin/env node
/**
 * run-migrations.js — aplicador de migraciones SQL idempotente.
 *
 * Aplica en orden los ficheros de db/migrations/*.sql que aún no estén
 * registrados en la tabla `_migrations`. Tolera bases de datos ya migradas:
 * si una migración antigua falla por "ya existe" (tipo/tabla/columna/índice
 * duplicado), la marca como aplicada y continúa, en vez de abortar.
 *
 * Uso:  node scripts/run-migrations.js        (aplica pendientes)
 *       node scripts/run-migrations.js --list (lista estado)
 */
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

// Códigos de error "ya existe" de PostgreSQL → migración antigua ya aplicada.
const DUP_CODES = new Set(['42710', '42P07', '42P06', '42701', '42P16', '23505']);

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )`);
}

function listFiles() {
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => ({ name: f, full: path.join(dir, f) }));
}

async function applied() {
  const { rows } = await pool.query('SELECT name FROM _migrations');
  return new Set(rows.map((r) => r.name));
}

async function run() {
  await ensureTable();
  const done = await applied();
  const files = listFiles();

  if (process.argv.includes('--list')) {
    for (const f of files) console.log(`${done.has(f.name) ? '✓' : '·'} ${f.name}`);
    return;
  }

  for (const f of files) {
    if (done.has(f.name)) { console.log('skip   ', f.name); continue; }
    const sql = fs.readFileSync(f.full, 'utf8');
    const client = await pool.getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations(name) VALUES($1) ON CONFLICT DO NOTHING', [f.name]);
      await client.query('COMMIT');
      console.log('applied', f.name);
    } catch (err) {
      await client.query('ROLLBACK');
      if (DUP_CODES.has(err.code)) {
        // El objeto ya existe (DB previamente migrada) → registrar como aplicada.
        await pool.query('INSERT INTO _migrations(name) VALUES($1) ON CONFLICT DO NOTHING', [f.name]);
        console.log('baseline', f.name, `(${err.code})`);
      } else {
        console.error('FAILED ', f.name, err.code || '', err.message);
        client.release();
        throw err;
      }
    } finally {
      client.release();
    }
  }
  console.log('✅ migrations done');
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
