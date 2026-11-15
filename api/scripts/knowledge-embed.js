#!/usr/bin/env node
'use strict';
/**
 * Calcula los vectores que faltan en knowledge_chunks (fragmentos nuevos o calculados con otro modelo).
 *   KNOWLEDGE_EMBEDDER=ollama KNOWLEDGE_EMBED_MODEL=nomic-embed-text node scripts/knowledge-embed.js [--lote 32]
 * Idempotente: sólo toca lo que no tiene vector del modelo actual. Necesita la migración 081.
 */
const { crearEmbedder } = require('../services/knowledge/embedder');
const { PgStore } = require('../services/knowledge/store');

async function main() {
    const embedder = crearEmbedder();
    if (!embedder) { console.error('Define KNOWLEDGE_EMBEDDER (p. ej. ollama).'); process.exit(2); }
    const arg = process.argv.indexOf('--lote');
    const lote = arg > 0 ? Number(process.argv[arg + 1]) || 32 : 32;
    const store = new PgStore(require('../db/pool'));
    let total = 0;
    for (;;) {
        const filas = await store.sinVector(embedder.id, lote);
        if (!filas.length) break;
        const vectores = await embedder.embedDocuments(filas.map((f) => f.content));
        for (let i = 0; i < filas.length; i++) await store.guardarVector(filas[i].id, vectores[i], embedder.id);
        total += filas.length;
        console.log(`  ${total} fragmentos con vector (${embedder.id})`);
    }
    console.log(`Hecho: ${total} fragmentos.`);
    process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
