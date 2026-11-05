#!/usr/bin/env node
'use strict';

/**
 * Pasada de anclaje del API Marketplace, para el Cloud Run Job programado
 * `bezhas-marketplace-anchor` (deploy/gcp/15-marketplace.sh): cierra los lotes
 * de recibos pendientes y los ancla en Polygon (y en la L2 si tiene nodo).
 *
 * Imprime un resumen sin secretos. Sale con código 1 si alguna ancla falló,
 * para que Cloud Run marque la ejecución como fallida y salte la alerta; la
 * siguiente pasada la reintenta sin pagar gas dos veces.
 *
 * Uso local:  node scripts/marketplace-anchor.js
 */

// Antes que nada: si la clave de anclaje controlara una dirección protegida
// (Treasury DAO, Hot Wallet), hotKeyGuard la retira del entorno.
require('../services/hotKeyGuard').revisar();

const anchor = require('../services/marketplace/anchor');
const { pool } = require('../db/pool');

(async () => {
    let codigo = 0;
    try {
        const r = await anchor.ejecutar();
        const fallidas = r.anclas.filter((a) => a.status === 'failed');
        console.log(`[MARKETPLACE-ANCHOR] redes=${r.redes.join(',') || 'ninguna'} lotes_nuevos=${r.lotesNuevos} `
            + `anclas=${r.anclas.length} confirmadas=${r.anclas.filter((a) => a.status === 'confirmed').length} `
            + `fallidas=${fallidas.length}`);
        for (const f of fallidas) console.error(`[MARKETPLACE-ANCHOR] fallo lote=${f.batchId} red=${f.red}: ${f.error}`);
        if (!r.redes.length) console.log('[MARKETPLACE-ANCHOR] sin redes configuradas: sólo se cierran lotes');
        if (fallidas.length) codigo = 1;
    } catch (err) {
        console.error(`[MARKETPLACE-ANCHOR] error: ${err.message}`);
        codigo = 1;
    } finally {
        await pool?.end?.().catch(() => {});
    }
    process.exit(codigo);
})();
