#!/usr/bin/env node
'use strict';

/**
 * scripts/sync-admin-from-env.js — Copia ADMIN_USERNAME / ADMIN_PASSWORD_HASH
 * del entorno a la fila de `admin_credentials` (la fuente de verdad).
 *
 * Para producción, donde las credenciales llegan de Secret Manager y la base
 * solo es accesible desde la VPC: lo ejecuta deploy/gcp/08-reset-admin.sh como
 * Cloud Run Job. Hace falta cuando el usuario o la contraseña de la semilla
 * se cambian DESPUÉS de que la fila existiera (el entorno solo siembra el
 * primer arranque; después se ignora) y ya no se puede entrar para rotarla
 * desde el panel.
 *
 * No toca el 2FA ni los códigos de respaldo: quien lo tuviera activado sigue
 * necesitándolo. El hash anterior pasa al historial, como en una rotación.
 * No imprime el hash ni ningún secreto.
 *
 * Para fijarlas a mano en local (con contraseña por teclado) está
 * scripts/set-admin-credentials.js.
 */
const { query, pool } = require('../db/pool');
const adminCreds = require('../services/adminCredentials');

const PASSWORD_HISTORY_LIMIT = 5;
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

async function main() {
    const username = (process.env.ADMIN_USERNAME || '').trim();
    const hash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
    if (!username || username.length > 50) throw new Error('ADMIN_USERNAME vacío o de más de 50 caracteres');
    if (!BCRYPT_RE.test(hash)) throw new Error('ADMIN_PASSWORD_HASH no es un hash bcrypt');

    // Crea la tabla si hace falta y, si no hay fila, la siembra desde el
    // entorno: en ese caso ya queda como se pide.
    await adminCreds.ensureSchema();
    const { rows } = await query('SELECT username, password_hash, password_history FROM admin_credentials WHERE id = 1');
    if (!rows.length) {
        await query(
            'INSERT INTO admin_credentials (id, username, password_hash) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING',
            [username, hash]
        );
        console.log(`[ADMIN] Credenciales creadas para ${username}`);
        return;
    }

    const row = rows[0];
    if (row.username === username && row.password_hash === hash) {
        console.log(`[ADMIN] Ya coinciden con el entorno (${username}); nada que cambiar`);
        return;
    }
    const history = [row.password_hash, ...(Array.isArray(row.password_history) ? row.password_history : [])]
        .filter((h) => h !== hash)
        .slice(0, PASSWORD_HISTORY_LIMIT);
    await query(
        `UPDATE admin_credentials
            SET username = $1, password_hash = $2, password_history = $3::jsonb,
                must_change_password = FALSE, last_password_rotated_at = NOW(), updated_at = NOW()
          WHERE id = 1`,
        [username, hash, JSON.stringify(history)]
    );
    console.log(`[ADMIN] Usuario: ${row.username} → ${username}; contraseña ${row.password_hash === hash ? 'sin cambios' : 'actualizada'}`);
}

main()
    .then(() => pool.end())
    .catch(async (err) => {
        console.error(`[ADMIN] ✗ ${err.message}`);
        await pool.end().catch(() => {});
        process.exit(1);
    });
