/**
 * migrate.js — Simple PostgreSQL migration runner for BeZhas.
 * 
 * Usage:
 *   node db/migrate.js          — Run all pending migrations
 *   node db/migrate.js --reset  — Drop all tables and re-run
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

async function ensureMigrationsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

async function isApplied(name) {
    const { rows } = await pool.query('SELECT 1 FROM migrations WHERE name = $1', [name]);
    return rows.length > 0;
}

async function runSchema() {
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    console.log('[MIGRATE] Applying schema.sql...');
    await pool.query(sql);
    await pool.query(
        'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        ['001_initial_schema']
    );
    console.log('[MIGRATE] Schema applied successfully.');
}

async function resetDatabase() {
    console.log('[MIGRATE] Dropping all tables...');
    const { rows } = await pool.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
    `);
    for (const row of rows) {
        await pool.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
    }
    console.log(`[MIGRATE] Dropped ${rows.length} tables.`);
}

async function runMigrations() {
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.log('[MIGRATE] No migrations directory found. Only schema applied.');
        return;
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const name = path.basename(file, '.sql');
        if (await isApplied(name)) {
            console.log(`[MIGRATE] Skipping ${name} (already applied)`);
            continue;
        }
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        console.log(`[MIGRATE] Applying ${name}...`);
        await pool.query(sql);
        await pool.query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
        console.log(`[MIGRATE] Applied ${name}`);
    }
}

async function main() {
    try {
        const isReset = process.argv.includes('--reset');

        if (isReset) {
            await resetDatabase();
        }

        await ensureMigrationsTable();

        if (!(await isApplied('001_initial_schema'))) {
            await runSchema();
        } else {
            console.log('[MIGRATE] Schema already applied.');
        }

        await runMigrations();
        console.log('[MIGRATE] All migrations complete.');
    } catch (err) {
        console.error('[MIGRATE] Error:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
