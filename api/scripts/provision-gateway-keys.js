#!/usr/bin/env node
'use strict';

/**
 * provision-gateway-keys.js — Da de alta claves nuevas en app_registry.
 *
 *   node scripts/provision-gateway-keys.js --all
 *   node scripts/provision-gateway-keys.js --app bezhas-core --app bezhas-defi
 *   node scripts/provision-gateway-keys.js --all --dry-run
 *
 * Hace falta porque la migración 051 revoca las claves que la 005 sembraba en
 * claro, y tras aplicarla NINGUNA app autentica hasta que se le da una nueva.
 * Escribir esos UPDATE a mano en producción es justo el momento en que una
 * clave acaba pegada en un historial de shell.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ SE NIEGA A ESCRIBIR EN UN LOG
 * ══════════════════════════════════════════════════════════════════════════
 *
 * La clave generada solo existe una vez: se guarda su SHA-256, no ella. Así
 * que hay que enseñarla, y ahí está el riesgo. Si esto corriera como job de
 * Cloud Run, su stdout va derecho a Cloud Logging y la clave quedaría
 * archivada en claro, con retención y con quien tenga permiso de lectura.
 *
 * Por eso: si la salida NO es un terminal, el script aborta salvo que se le
 * indique `--out <fichero>`, que escribe con permisos 0600. Nunca imprime a
 * ciegas.
 *
 * Lo pensado es ejecutarlo en local contra el Cloud SQL Proxy, no como job.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { query, pool } = require('../db/pool');

/** Apps que la migración 005 define. Solo se tocan estas. */
const APPS_CONOCIDAS = ['bezhas-core', 'bezhas-defi', 'bezhas-app', 'bezhas-web3'];

function parseArgs(argv) {
    const opts = { apps: [], all: false, dryRun: false, out: null, force: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--all') opts.all = true;
        else if (a === '--app') opts.apps.push(argv[++i]);
        else if (a === '--dry-run') opts.dryRun = true;
        else if (a === '--out') opts.out = argv[++i];
        else if (a === '--force') opts.force = true;
        else if (a === '--help' || a === '-h') opts.help = true;
        else { console.error(`Argumento desconocido: ${a}`); process.exit(2); }
    }
    return opts;
}

function ayuda() {
    console.log(`
Da de alta claves nuevas para las apps del Gateway.

  --all                Todas las apps conocidas (${APPS_CONOCIDAS.join(', ')})
  --app <nombre>       Una app concreta. Repetible.
  --out <fichero>      Escribe las claves ahí con permisos 0600 en vez de por
                       pantalla. Obligatorio si la salida no es un terminal.
  --dry-run            Enseña qué haría sin tocar la base.
  --force              Rota también las apps que ya tengan una clave activa.
                       Sin esto se saltan, para no invalidar sin querer una
                       integración que está funcionando.
`);
}

/**
 * Clave con prefijo legible por app. El prefijo no es decorativo: cuando
 * aparezca en un informe de incidente se sabrá de cuál se trata sin tener que
 * cruzarla con nada.
 */
function generarClave(app) {
    const sufijo = app.replace(/^bezhas-/, '');
    return `bez_${sufijo}_${crypto.randomBytes(24).toString('hex')}`;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) return ayuda();

    const objetivo = opts.all ? APPS_CONOCIDAS : opts.apps;
    if (objetivo.length === 0) {
        console.error('Indica --all o al menos un --app. Usa --help para ver las opciones.');
        process.exit(2);
    }

    const desconocidas = objetivo.filter((a) => !APPS_CONOCIDAS.includes(a));
    if (desconocidas.length) {
        console.error(`Apps no reconocidas: ${desconocidas.join(', ')}`);
        console.error(`Conocidas: ${APPS_CONOCIDAS.join(', ')}`);
        process.exit(2);
    }

    // Se decide ANTES de generar nada: si no hay dónde entregar la clave de
    // forma segura, no tiene sentido crearla.
    if (!process.stdout.isTTY && !opts.out && !opts.dryRun) {
        console.error('La salida no es un terminal y no se ha indicado --out.');
        console.error('Sin eso, la clave acabaría en un log en claro. Aborto.');
        console.error('Ejecuta con --out claves.txt, o desde un terminal.');
        process.exit(1);
    }

    // Comprobar la base antes de tocarla: un fallo a mitad deja unas apps
    // rotadas y otras no, que es el peor estado posible.
    try {
        await query('SELECT 1');
    } catch (err) {
        console.error(`No se puede conectar a la base de datos: ${err.message}`);
        console.error('Revisa DATABASE_URL. Contra producción hace falta el Cloud SQL Proxy.');
        process.exit(1);
    }

    const { rows: existentes } = await query(
        `SELECT app_name, is_active, api_key_hash FROM app_registry WHERE app_name = ANY($1)`,
        [objetivo]
    );
    const porNombre = new Map(existentes.map((r) => [r.app_name, r]));

    const faltantes = objetivo.filter((a) => !porNombre.has(a));
    if (faltantes.length) {
        console.error(`Estas apps no existen en app_registry: ${faltantes.join(', ')}`);
        console.error('¿Se han aplicado las migraciones? Ejecuta antes: node db/migrate.js');
        process.exit(1);
    }

    const generadas = {};
    const saltadas = [];

    for (const app of objetivo) {
        const fila = porNombre.get(app);
        // Una clave ya provisionada y activa se respeta salvo --force: rotarla
        // sin querer tira abajo una integración que estaba funcionando.
        const yaProvisionada = fila.is_active && !String(fila.api_key_hash).startsWith('PROVISION_REQUIRED_')
            && !String(fila.api_key_hash).startsWith('REVOKED_');
        if (yaProvisionada && !opts.force) {
            saltadas.push(app);
            continue;
        }
        generadas[app] = generarClave(app);
    }

    if (opts.dryRun) {
        console.log('\n[dry-run] No se ha tocado la base.');
        for (const app of Object.keys(generadas)) console.log(`  se daría de alta: ${app}`);
        for (const app of saltadas) console.log(`  se saltaría (ya activa, usa --force): ${app}`);
        await pool.end();
        return;
    }

    if (Object.keys(generadas).length === 0) {
        console.log('Nada que hacer: todas las apps indicadas ya tienen clave activa.');
        console.log(`Usa --force para rotarlas de todos modos. Saltadas: ${saltadas.join(', ')}`);
        await pool.end();
        return;
    }

    // Una transacción: o se dan de alta todas o ninguna.
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        for (const [app, clave] of Object.entries(generadas)) {
            await cliente.query(
                `UPDATE app_registry
                    SET api_key_hash = encode(digest($1, 'sha256'), 'hex'),
                        is_active = TRUE,
                        updated_at = NOW()
                  WHERE app_name = $2`,
                [clave, app]
            );
        }
        await cliente.query('COMMIT');
    } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        console.error(`Fallo al dar de alta, nada se ha modificado: ${err.message}`);
        process.exit(1);
    } finally {
        cliente.release();
    }

    const lineas = [
        '# Claves del Gateway de BeZhas',
        `# Generadas: ${new Date().toISOString()}`,
        '# Se guarda su SHA-256, no ellas: esto es la única copia.',
        '',
        ...Object.entries(generadas).map(([app, clave]) => `${app}=${clave}`),
        '',
    ];

    if (opts.out) {
        // 0600 desde la creación, no después: entre crear y hacer chmod hay una
        // ventana en la que el fichero es legible por todos.
        fs.writeFileSync(opts.out, lineas.join('\n'), { mode: 0o600 });
        console.log(`${Object.keys(generadas).length} clave(s) dadas de alta.`);
        console.log(`Escritas en ${opts.out} con permisos 0600.`);
    } else {
        console.log(`\n${Object.keys(generadas).length} clave(s) dadas de alta:\n`);
        console.log(lineas.join('\n'));
    }

    if (saltadas.length) {
        console.log(`Saltadas por tener ya clave activa (usa --force): ${saltadas.join(', ')}`);
    }
    console.log('Guárdalas en el gestor de secretos AHORA. No se pueden recuperar.');

    await pool.end();
}

main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
