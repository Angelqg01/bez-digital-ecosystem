#!/usr/bin/env node
'use strict';

/**
 * scripts/set-admin-credentials.js — Fija usuario y contraseña del SuperAdmin.
 *
 *   cd api && node scripts/set-admin-credentials.js
 *
 * Existe porque las credenciales viven en DOS sitios desde que el panel puede
 * rotarlas, y editar sólo uno no hace nada:
 *
 *   1. .env → ADMIN_USERNAME / ADMIN_PASSWORD_HASH
 *      Sólo es la semilla del primer arranque.
 *   2. Tabla `admin_credentials` (fila id = 1)
 *      La fuente de verdad en cuanto existe. Si hay fila, el .env se ignora.
 *
 * Este script escribe en los dos y los deja coincidiendo.
 *
 * La contraseña se pide por consola con el eco apagado: no se pasa por
 * argumento (quedaría en el historial del shell y en `ps`), ni por variable de
 * entorno, ni se muestra nunca en pantalla.
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const bcrypt = require('bcryptjs');

const ENV_PATH = path.resolve(__dirname, '..', '..', '.env');
require('dotenv').config({ path: ENV_PATH });

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 14;

const IS_TTY = Boolean(process.stdin.isTTY);

/**
 * Cola de respuestas para cuando la entrada NO es un terminal.
 *
 * Con stdin conectado a una tubería, readline emite todas las líneas de golpe
 * en cuanto se abre la interfaz: las preguntas registradas después ya no ven
 * nada y el proceso se queda esperando para siempre. Por eso, sin TTY se lee
 * la entrada entera por adelantado y cada pregunta consume una línea.
 */
let pipedLines = null;
async function readAllStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
}

let rl = null;
let masking = false;
let currentPrompt = '';

function initTty() {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Con el enmascarado activo, readline pinta asteriscos en lugar de lo
    // tecleado. Se interviene `_writeToOutput` porque es el único punto por el
    // que pasa todo lo que la interfaz escribe en pantalla.
    const originalWrite = rl._writeToOutput.bind(rl);
    rl._writeToOutput = function (chunk) {
        if (!masking) return originalWrite(chunk);
        if (chunk.includes(currentPrompt)) {
            originalWrite(currentPrompt + '*'.repeat(rl.line.length));
        } else {
            originalWrite('*');
        }
    };
}

function nextPipedAnswer(question) {
    process.stdout.write(question + '\n');
    return (pipedLines.shift() ?? '');
}

function ask(question) {
    if (!IS_TTY) return Promise.resolve(nextPipedAnswer(question).trim());
    return new Promise(resolve => {
        currentPrompt = question;
        masking = false;
        rl.question(question, answer => resolve(answer.trim()));
    });
}

/**
 * Pregunta ocultando lo tecleado. La contraseña no debe quedar visible en
 * pantalla ni en el scroll del terminal. Sin TTY no hay eco que suprimir.
 */
function askHidden(question) {
    if (!IS_TTY) return Promise.resolve(nextPipedAnswer(question));
    return new Promise(resolve => {
        currentPrompt = question;
        masking = true;
        rl.question(question, answer => {
            masking = false;
            process.stdout.write('\n');
            resolve(answer);
        });
    });
}


/**
 * Sustituye o añade una clave en el .env, conservando el resto intacto.
 *
 * El reemplazo va como FUNCIÓN, no como cadena: `String.replace` interpreta
 * `$&`, `$1`, `` $` `` y `$'` dentro del texto de sustitución, y un hash bcrypt
 * es literalmente `$2a$12$...`. Con la forma de cadena, cualquier hash que
 * contuviera `$'` habría insertado el resto del fichero en mitad de la línea.
 * Devolviéndolo desde una función, el valor se escribe tal cual.
 */
function upsertEnvVar(contents, key, value) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    return pattern.test(contents)
        ? contents.replace(pattern, () => line)
        : `${contents.replace(/\n*$/, '\n')}${line}\n`;
}

(async () => {
    if (IS_TTY) initTty();
    else pipedLines = await readAllStdin();

    console.log('\n── Credenciales SuperAdmin de BeZhas ──\n');
    console.log(`Fichero de entorno: ${ENV_PATH}`);

    const currentUser = process.env.ADMIN_USERNAME || '(sin definir)';
    const username = (await ask(`Usuario [${currentUser}]: `)) || process.env.ADMIN_USERNAME;

    if (!username || username.length < 3 || username.length > 50) {
        console.error('\nEl usuario debe tener entre 3 y 50 caracteres.');
        process.exit(1);
    }

    const password = await askHidden('Contraseña nueva: ');
    if (password.length < MIN_PASSWORD_LENGTH) {
        console.error(`\nLa contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        process.exit(1);
    }
    const confirm = await askHidden('Repite la contraseña: ');
    if (password !== confirm) {
        console.error('\nLas contraseñas no coinciden.');
        process.exit(1);
    }

    console.log('\nCalculando hash bcrypt (coste 12)...');
    const hash = await bcrypt.hash(password, BCRYPT_COST);

    // ── 1. .env ──
    // El hash va entre comillas simples: bcrypt contiene '$' y sin comillas hay
    // parsers de .env que lo tratan como expansión de variable y lo corrompen.
    const original = fs.readFileSync(ENV_PATH, 'utf8');
    const backup = `${ENV_PATH}.bak-${Date.now()}`;
    fs.copyFileSync(ENV_PATH, backup);

    let updated = upsertEnvVar(original, 'ADMIN_USERNAME', username);
    updated = upsertEnvVar(updated, 'ADMIN_PASSWORD_HASH', `'${hash}'`);
    fs.writeFileSync(ENV_PATH, updated, { mode: 0o600 });
    console.log(`OK  .env actualizado (copia previa en ${path.basename(backup)})`);

    // ── 2. Tabla admin_credentials ──
    // Sin esto el cambio no surte efecto: si la fila existe, el .env se ignora.
    try {
        const adminCreds = require('../services/adminCredentials');
        const { query } = require('../db/pool');
        await adminCreds.ensureSchema();

        const wallet = process.env.ADMIN_WALLET ? process.env.ADMIN_WALLET.toLowerCase() : null;
        await query(
            `INSERT INTO admin_credentials
                (id, username, password_hash, wallet_address, totp_secret_encrypted,
                 totp_enabled, backup_codes, password_history, must_change_password,
                 last_password_rotated_at, updated_at)
             VALUES (1, $1, $2, $3, NULL, FALSE, '[]'::jsonb, '[]'::jsonb, FALSE, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
                username = EXCLUDED.username,
                password_hash = EXCLUDED.password_hash,
                wallet_address = EXCLUDED.wallet_address,
                -- Se limpia el 2FA: dejar activo un secreto TOTP que ya nadie
                -- tiene en el móvil bloquea el acceso justo después de cambiar
                -- la contraseña. Se vuelve a dar de alta desde el panel.
                totp_secret_encrypted = NULL,
                totp_enabled = FALSE,
                backup_codes = '[]'::jsonb,
                password_history = '[]'::jsonb,
                must_change_password = FALSE,
                last_password_rotated_at = NOW(),
                updated_at = NOW()`,
            [username, hash, wallet]
        );
        console.log('OK  Tabla admin_credentials actualizada (2FA desactivado, historial limpio)');
    } catch (error) {
        console.warn(`\nNo se pudo escribir en la base de datos: ${error.message}`);
        console.warn('El .env sí quedó actualizado, pero si la fila admin_credentials');
        console.warn('existe, seguirá mandando ella. Arregla la conexión y repite.');
        process.exit(2);
    }

    console.log(`\nListo. Usuario: ${username}`);
    console.log('Reinicia la API para que recoja el .env:  docker compose restart bezhas-api\n');
    process.exit(0);
})().catch(error => {
    console.error('\nError:', error.message);
    process.exit(1);
});
