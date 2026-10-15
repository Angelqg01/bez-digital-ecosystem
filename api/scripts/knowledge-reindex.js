#!/usr/bin/env node
'use strict';

/**
 * Rellena `knowledge_chunks.tokens` en las filas anteriores a la migración 065. Idempotente: sólo toca las que
 * están a NULL. Uso: `node scripts/knowledge-reindex.js` (con DATABASE_URL / PG* del entorno).
 */
const { PgStore } = require('../services/knowledge/store');

(async () => {
    const db = require('../db/pool');
    const n = await new PgStore(db).reindexar();
    console.log(`knowledge-reindex: ${n} fragmentos indexados`);
    process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
