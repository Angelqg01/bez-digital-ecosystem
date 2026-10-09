'use strict';

/**
 * Instancia del Knowledge Plane. En producción guarda en Postgres (Cloud SQL):
 * persiste entre reinicios y la comparten todas las instancias. En los tests,
 * en memoria.
 */
const { KnowledgeService } = require('./knowledge.service');
const { MemoryStore, PgStore } = require('./store');

function crearStore() {
    if (process.env.NODE_ENV === 'test' || process.env.KNOWLEDGE_STORE === 'memory') return new MemoryStore();
    return new PgStore(require('../../db/pool'));
}

const knowledge = new KnowledgeService({ store: crearStore() });

module.exports = { knowledge, KnowledgeService, MemoryStore, PgStore };
