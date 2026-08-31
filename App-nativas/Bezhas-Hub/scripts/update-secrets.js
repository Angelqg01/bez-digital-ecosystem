#!/usr/bin/env node
/**
 * Sube las claves de Stripe a GCP Secret Manager.
 *
 * Antes este script llevaba los valores escritos dentro (`SECRETS = { ... }`),
 * lo que obligaba a editarlo —y a dejar una sk_live en un fichero versionado—
 * cada vez que se rotaba. Ahora los lee de un .env local y no imprime ninguno.
 *
 * El despliegue usa DOS convenciones de nombre para el mismo secreto:
 *
 *   STRIPE_SECRET_KEY   → cloudbuild-backend.yaml, scripts/gcp-deploy.sh
 *   stripe-secret-key   → .github/workflows/deploy-gcp.yml, backend/service.yaml
 *
 * Si solo se actualiza una, la mitad de los servicios se queda con la clave
 * revocada y los cobros empiezan a fallar sin que nadie toque nada. Por eso
 * cada valor se publica en ambos nombres.
 *
 * Uso:
 *   node scripts/update-secrets.js --dry-run          # no escribe nada
 *   node scripts/update-secrets.js
 *   node scripts/update-secrets.js --env-file ../.env --project bezhas-web3
 */

'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// Variable del .env → nombres del secreto en Secret Manager.
const SECRET_NAMES = {
    STRIPE_SECRET_KEY:      ['STRIPE_SECRET_KEY', 'stripe-secret-key'],
    STRIPE_PUBLISHABLE_KEY: ['STRIPE_PUBLISHABLE_KEY', 'stripe-publishable-key'],
    STRIPE_WEBHOOK_SECRET:  ['STRIPE_WEBHOOK_SECRET', 'stripe-webhook-secret'],
};

// Prefijo esperado por variable. Un valor con el prefijo equivocado casi
// siempre es un pegado en el hueco de al lado —una sk_live en el hueco del
// webhook, por ejemplo— y sube igual de silencioso que subiría el correcto.
const EXPECTED_PREFIX = {
    STRIPE_SECRET_KEY:      ['sk_live_', 'sk_test_', 'rk_live_', 'rk_test_'],
    STRIPE_PUBLISHABLE_KEY: ['pk_live_', 'pk_test_'],
    STRIPE_WEBHOOK_SECRET:  ['whsec_'],
};

const PLACEHOLDER = /^(<|your_|changeme|tu_clave|xxx|rotate_me)/i;

function parseArgs(argv) {
    const opts = { dryRun: false, envFile: null, project: process.env.GCP_PROJECT_ID || null };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--dry-run') opts.dryRun = true;
        else if (argv[i] === '--env-file') opts.envFile = argv[++i];
        else if (argv[i] === '--project') opts.project = argv[++i];
    }
    return opts;
}

function loadEnv(file) {
    const out = {};
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
        const line = raw.replace(/\r$/, '');
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (!m) continue;
        out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
}

function gcloud(args, stdin) {
    return new Promise((resolve) => {
        const child = execFile('gcloud', args, (error, stdout, stderr) =>
            resolve({ ok: !error, stdout, stderr: stderr || (error && error.message) || '' }));
        if (stdin !== undefined) {
            child.stdin.end(stdin);   // el valor va por stdin: nunca toca el disco
        }
    });
}

async function publish(name, value, opts) {
    const base = opts.project ? ['--project', opts.project] : [];

    if (opts.dryRun) {
        console.log(`  · ${name}: se publicaría (${value.length} caracteres)`);
        return true;
    }

    let res = await gcloud([...base, 'secrets', 'versions', 'add', name, '--data-file=-'], value);
    if (res.ok) {
        console.log(`  ✅ ${name}: versión nueva añadida`);
        return true;
    }

    if (/NOT_FOUND|was not found/i.test(res.stderr)) {
        res = await gcloud(
            [...base, 'secrets', 'create', name, '--replication-policy=automatic', '--data-file=-'],
            value,
        );
        if (res.ok) {
            console.log(`  ✅ ${name}: secreto creado`);
            return true;
        }
    }

    console.error(`  ❌ ${name}: ${res.stderr.trim().split('\n')[0]}`);
    return false;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const envFile = path.resolve(opts.envFile || path.join(__dirname, '..', 'backend', '.env'));

    if (!fs.existsSync(envFile)) {
        console.error(`No existe el fichero de entorno: ${envFile}`);
        process.exit(1);
    }

    console.log(`Origen : ${envFile}`);
    console.log(`Proyecto: ${opts.project || '(el activo de gcloud)'}`);
    if (opts.dryRun) console.log('Modo   : --dry-run, no se escribe nada\n');

    const env = loadEnv(envFile);
    const pending = [];
    let bad = false;

    for (const [variable, names] of Object.entries(SECRET_NAMES)) {
        const value = env[variable];

        if (!value || PLACEHOLDER.test(value)) {
            console.warn(`⚠️  ${variable}: vacía o placeholder — se omite`);
            continue;
        }
        if (!EXPECTED_PREFIX[variable].some((p) => value.startsWith(p))) {
            const got = value.split('_').slice(0, 2).join('_');
            console.error(
                `❌ ${variable}: empieza por "${got}_…" y debería empezar por ` +
                `${EXPECTED_PREFIX[variable].join(' | ')}. Es el valor de otra variable.`,
            );
            bad = true;
            continue;
        }
        pending.push([variable, names, value]);
    }

    if (bad) {
        console.error('\nAbortado: corrige los valores mal asignados antes de subir nada.');
        process.exit(1);
    }
    if (!pending.length) {
        console.error('\nNo hay nada que subir.');
        process.exit(1);
    }

    let failures = 0;
    for (const [variable, names, value] of pending) {
        console.log(`\n${variable}`);
        for (const name of names) {
            if (!(await publish(name, value, opts))) failures += 1;
        }
    }

    console.log(
        failures
            ? `\nTerminado con ${failures} error(es).`
            : '\nListo. Recuerda forzar una revisión nueva en Cloud Run: los secretos ' +
              'se inyectan en el arranque y config/secrets.js además cachea 5 minutos.',
    );
    process.exit(failures ? 1 : 0);
}

main();
