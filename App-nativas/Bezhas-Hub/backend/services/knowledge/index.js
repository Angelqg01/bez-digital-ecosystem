const path = require('path');
const { KnowledgeService } = require('./knowledge.service');
const { MemoryStore } = require('./store');

// Persistencia local opcional; por defecto en backend/data (ignorado por git).
const defaultPath = process.env.NODE_ENV === 'test' || process.env.KNOWLEDGE_PERSIST === 'false' ? null : (process.env.KNOWLEDGE_STORE_PATH || path.join(__dirname, '../../data/knowledge-store.json'));
const knowledge = new KnowledgeService({ store: new MemoryStore({ filePath: defaultPath }) });

module.exports = { knowledge, KnowledgeService, MemoryStore };
