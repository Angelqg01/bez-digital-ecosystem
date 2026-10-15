#!/usr/bin/env node
'use strict';

/**
 * Rellena `knowledge_chunks.tokens` en las filas anteriores a la migración 065. Idempotente: sólo toca las que
 * están a NULL. Con `--all` recalcula todas (necesario si cambia el tokenizador de services/knowledge/bm25.js).
 * Uso: `node scripts/knowledge-reindex.js [--all]` (con DATABASE_URL / PG* del entorno).
 */
const { PgStore } = require('../services/knowledge/store');

(async () => {
    const db = require('../db/pool');
    const n = await new PgStore(db).reindexar({ todo: process.argv.includes('--all') });
    console.log(`knowledge-reindex: ${n} fragmentos indexados`);
    process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
