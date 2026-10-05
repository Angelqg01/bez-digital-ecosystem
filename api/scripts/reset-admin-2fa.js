#!/usr/bin/env node
'use strict';

/**
 * Restablece el 2FA del SuperAdmin: borra el secreto TOTP y los códigos de
 * respaldo y deja `totp_enabled = false`. El siguiente login por contraseña
 * (con ADMIN_2FA_REQUIRED=true) lanza el alta guiada con QR nuevo.
 *
 * Es una operación de servidor a propósito: exige acceso a la base de datos,
 * no se expone por HTTP, porque un reset sólo con contraseña dejaría que quien
 * la robe enrole su propio autenticador.
 *
 *   DATABASE_URL=... node api/scripts/reset-admin-2fa.js --yes
 */
const adminCreds = require('../services/adminCredentials');
const { pool } = require('../db/pool');

(async () => {
    if (!process.argv.includes('--yes')) {
        console.error('Esto desactiva el 2FA del SuperAdmin. Repite con --yes para confirmar.');
        process.exit(1);
    }
    await adminCreds.ensureSchema();
    const before = await adminCreds.status();
    if (!before) {
        console.error('No hay fila admin_credentials: nada que restablecer.');
        process.exit(1);
    }
    await adminCreds.resetTotp();
    console.log(`2FA restablecido para "${before.username}". Estaba ${before.twoFactorEnabled ? 'activo' : 'inactivo'}.`);
    console.log('Siguiente paso: iniciar sesión (con ADMIN_2FA_REQUIRED=true) para dar de alta el autenticador de nuevo.');
    await pool?.end?.();
})().catch((e) => { console.error(e.message); process.exit(1); });
