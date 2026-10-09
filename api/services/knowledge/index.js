const path = require('path');
const { KnowledgeService } = require('./knowledge.service');
const { MemoryStore } = require('./store');

// En Cloud Run el disco es efímero: persistir sólo si se pide expresamente con KNOWLEDGE_STORE_PATH.
const defaultPath = process.env.NODE_ENV === 'test' || process.env.KNOWLEDGE_PERSIST === 'false' ? null : (process.env.KNOWLEDGE_STORE_PATH || null);
const knowledge = new KnowledgeService({ store: new MemoryStore({ filePath: defaultPath }) });

module.exports = { knowledge, KnowledgeService, MemoryStore };
