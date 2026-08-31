#!/usr/bin/env node
'use strict';

/**
 * Aplicador de migraciones — `npm run db:migrate`.
 *
 * El compose monta src/db/migrations en el initdb de Postgres, que SOLO se
 * ejecuta la primera vez que se crea el volumen. Sin este runner, cualquier
 * corrección del esquema quedaba inaplicable en una base ya creada: había que
 * borrar el volumen y perder los datos.
 *
 * Los ficheros están escritos para ser reaplicables (IF NOT EXISTS, DROP POLICY
 * antes de CREATE POLICY, ALTER guardados por condición), así que volver a
 * pasarlos sobre una base al día es un no-op. Aun así se lleva registro en
 * `schema_migrations` para no reejecutar lo ya aplicado y poder ver de un
 * vistazo en qué estado está una base.
 *
 *   DATABASE_URL=postgres://operant:operant@localhost:5432/operant npm run db:migrate
 *   ... --force   reaplica también las ya registradas (útil tras editar un fichero)
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'migrations');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL no definida. Ejemplo:\n' +
      '  DATABASE_URL=postgres://operant:operant@localhost:5432/operant npm run db:migrate');
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
    );
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file) && !force) {
        console.log(`· ${file} (ya aplicada)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
      try {
        // Cada fichero, una transacción: o entra entero o no entra.
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1)
           ON CONFLICT (filename) DO UPDATE SET applied_at = now()`,
          [file]
        );
        await client.query('COMMIT');
        console.log(`✔ ${file}`);
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`✖ ${file}\n  ${err.message}`);
        process.exitCode = 1;
        return;
      }
    }

    console.log(ran ? `\n${ran} migración(es) aplicadas.` : '\nEsquema ya al día.');
    await setAppRolePassword(client, databaseUrl);
  } finally {
    await client.end();
  }
}

/**
 * Cierra el único cabo que una migración no puede atar sola: la contraseña del
 * rol de aplicación.
 *
 * Las migraciones las ejecuta el rol dueño (superusuario en la imagen de
 * Docker). La APLICACIÓN no debe usar ese rol: un superusuario ignora la
 * Row-Level Security y se lleva por delante el aislamiento entre clientes
 * — PostgresStore.connect() se niega a arrancar si detecta que es el caso.
 */
async function setAppRolePassword(client, databaseUrl) {
  const password = process.env.PG_APP_PASSWORD;
  const { rows } = await client.query(
    "SELECT 1 FROM pg_roles WHERE rolname = 'operant_app'"
  );
  if (!rows.length) return;

  if (password) {
    // La contraseña no admite parámetro en ALTER ROLE; escapeLiteral es la
    // forma segura de interpolarla (la provee el propio driver).
    await client.query(`ALTER ROLE operant_app LOGIN PASSWORD ${client.escapeLiteral(password)}`);
    const url = new URL(databaseUrl);
    console.log(
      '\nRol de aplicación listo. Arranca la plataforma con:\n' +
      `  DATABASE_URL=postgresql://operant_app:<PG_APP_PASSWORD>@${url.host}${url.pathname}`
    );
  } else {
    console.log(
      '\n⚠ El rol operant_app existe pero no tiene contraseña, así que no puede conectarse.\n' +
      '  Vuelve a lanzar esto con PG_APP_PASSWORD=... (o ALTER ROLE operant_app LOGIN PASSWORD \'...\').\n' +
      '  No arranques la plataforma con el rol dueño: se salta la RLS y no habría aislamiento entre tenants.'
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
