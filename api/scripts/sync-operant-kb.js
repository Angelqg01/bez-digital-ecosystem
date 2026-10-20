#!/usr/bin/env node
'use strict';

/**
 * Copia la documentación PÚBLICA del RAG de la API a la base de conocimiento de OPERANT
 * (la misma acción que el botón «Sincronizar RAG» del panel, pero sin necesitar sesión de
 * administrador). Sin esto, Soporte de OPERANT no sabe nada de BEZ-Coin, de cómo comprar ni de los
 * planes, y contesta «no tenemos detalles» a lo más importante de la plataforma.
 *
 * Corre como Cloud Run Job con la imagen de la API (13-operant-conocimiento.sh): necesita
 * DATABASE_URL, OPERANT_API_URL y OPERANT_INTERNAL_KEY, y la cuenta de servicio de la API
 * (que tiene run.invoker sobre OPERANT).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const { crearAdminAutomation } = require('../services/adminAutomation');
const operant = require('../services/operantBridge');
const { query, pool } = require('../db/pool');
const { knowledge } = require('../services/knowledge');
const { seedPublicKnowledge } = require('../services/knowledge/seed');

(async () => {
    // Primero se pone al día el corpus público de la API (idempotente por checksum) y después se copia.
    const nuevos = await seedPublicKnowledge(knowledge);
    console.log('corpus de la API al día; documentos nuevos o cambiados:', nuevos);
    const auto = crearAdminAutomation({
        query, operant, metricValues: async () => null,
        knowledgeStore: { chunksVisibles: (t) => knowledge.store.chunksVisibles(t) },
    });
    const r = await auto.sincronizarConocimiento({ actor: 'job:sync-operant-kb' });
    console.log('RESULT', JSON.stringify(r));
    await pool.end();
    process.exit(r.fallos?.length ? 1 : 0);
})().catch((err) => { console.error('ERR', err.message); process.exit(1); });
