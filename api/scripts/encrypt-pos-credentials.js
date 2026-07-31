'use strict';

/**
 * Migración puntual: cifra las credenciales de POS que quedaron en claro
 * (filas creadas antes de que cargoLinkPosConnector aplicase secretVault).
 *
 * Idempotente: las filas ya cifradas se detectan por el prefijo de versión y
 * se omiten, así que puedes ejecutarlo las veces que haga falta.
 *
 *   node api/scripts/encrypt-pos-credentials.js            # simulacro
 *   node api/scripts/encrypt-pos-credentials.js --apply    # escribe
 *
 * IMPORTANTE: usa la misma SECRET_VAULT_KEY (o WALLET_VAULT_SECRET / JWT_SECRET)
 * que use el servidor, o las credenciales quedarán ilegibles.
 */
const { query } = require('../db/pool');
const { encryptSecret, isEncrypted } = require('../services/secretVault');

async function main() {
    const apply = process.argv.includes('--apply');

    const { rows } = await query(
        `SELECT bezhas_id, api_key FROM cargolink_pos_links WHERE api_key IS NOT NULL AND api_key <> ''`
    );

    const pending = rows.filter((r) => !isEncrypted(r.api_key));
    console.log(`Enlaces POS con credencial: ${rows.length}`);
    console.log(`  ya cifrados:      ${rows.length - pending.length}`);
    console.log(`  pendientes:       ${pending.length}`);

    if (pending.length === 0) {
        console.log('\nNada que hacer.');
        return;
    }
    if (!apply) {
        console.log('\nSimulacro. Vuelve a ejecutarlo con --apply para cifrarlos.');
        return;
    }

    let done = 0;
    for (const row of pending) {
        await query(
            `UPDATE cargolink_pos_links SET api_key = $2, updated_at = NOW() WHERE bezhas_id = $1`,
            [row.bezhas_id, encryptSecret(row.api_key)]
        );
        done++;
    }
    console.log(`\nCifradas ${done} credenciales.`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Fallo la migración:', err.message);
        process.exit(1);
    });
