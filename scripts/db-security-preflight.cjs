#!/usr/bin/env node

/**
 * DB security preflight for local/dev environments.
 * Checks:
 * - insecure/default DB secrets
 * - missing DATABASE_URL or weak URL patterns
 * - PostgreSQL listener on localhost:5432
 *
 * NOTA (extensión .cjs): scripts/package.json declara `"type": "module"`, así
 * que con la extensión .js este fichero moría al cargar con
 * «require is not defined in ES module scope» — nunca llegó a ejecutar ni una
 * comprobación. Detectaba correctamente la contraseña por defecto
 * TuPasswordSeguro, que acabó siendo la contraseña real de la base de datos
 * durante meses, y no pudo avisar porque no arrancaba.
 */

const net = require('net');
const path = require('path');

// Carga el .env de la raíz si el llamante no lo ha hecho ya. Sin esto el
// preflight avisaba de «DATABASE_URL is not set» en un entorno donde sí está,
// y ese falso positivo es la vía más rápida para que alguien deje de mirarlo.
if (!process.env.DATABASE_URL) {
    try {
        require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
    } catch { /* dotenv no instalado: se sigue con lo que haya en el entorno */ }
}

const findings = [];

function addFinding(level, message) {
    findings.push({ level, message });
}

function isPlaceholder(value) {
    if (!value) return true;
    const weak = [
        'TuPasswordSeguro',
        'password',
        'admin',
        'postgres',
        'changeme',
        'example',
    ];
    return weak.some((w) => value.toLowerCase().includes(w.toLowerCase()));
}

function checkEnv() {
    const databaseUrl = process.env.DATABASE_URL || '';
    const pgPassword = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '';

    if (!databaseUrl) {
        addFinding('warn', 'DATABASE_URL is not set. API will rely on PG* vars and may fail to connect.');
    } else {
        if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
            addFinding('error', 'DATABASE_URL must use postgres:// or postgresql:// scheme.');
        }
        if (databaseUrl.includes('TuPasswordSeguro')) {
            addFinding('error', 'DATABASE_URL contains default placeholder password (TuPasswordSeguro).');
        }
        if (databaseUrl.includes('@localhost') && databaseUrl.includes(':admin@')) {
            addFinding('warn', 'DATABASE_URL appears to use default admin user on localhost.');
        }
    }

    if (pgPassword && isPlaceholder(pgPassword)) {
        addFinding('error', 'POSTGRES_PASSWORD/PGPASSWORD appears weak or placeholder.');
    }
}

function checkPort5432() {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let done = false;

        const finish = (ok) => {
            if (done) return;
            done = true;
            socket.destroy();
            resolve(ok);
        };

        socket.setTimeout(2000);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.connect(5432, '127.0.0.1');
    });
}

async function main() {
    checkEnv();

    const portOpen = await checkPort5432();
    if (!portOpen) {
        addFinding('warn', 'No PostgreSQL listener detected on 127.0.0.1:5432. database=down is expected.');
    }

    const hasErrors = findings.some((f) => f.level === 'error');
    const result = {
        ok: !hasErrors,
        findings,
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
    console.error(JSON.stringify({ ok: false, findings: [{ level: 'error', message: err.message }] }, null, 2));
    process.exit(1);
});
