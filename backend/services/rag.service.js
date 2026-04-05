/**
 * ============================================================================
 * BEZHAS RAG SERVICE — Retrieval-Augmented Generation with ChromaDB
 * ============================================================================
 *
 * Full RAG pipeline that:
 * 1. Embeds payment/blockchain metadata into vector space
 * 2. Stores embeddings in ChromaDB
 * 3. Retrieves relevant context for chatbot queries
 * 4. Supports real-time indexing from MCP server + blockchain events
 *
 * Collections:
 *   - bezhas_payments     : Stripe/Crypto payment transactions
 *   - bezhas_blockchain   : On-chain events (transfers, staking, governance)
 *   - bezhas_platform     : Platform knowledge base (docs, FAQs, guides)
 *
 * @requires chromadb
 * @requires @google/generative-ai (for embeddings)
 */

const { ChromaClient } = require('chromadb');
const crypto = require('crypto');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const COLLECTION_PAYMENTS = 'bezhas_payments';
const COLLECTION_BLOCKCHAIN = 'bezhas_blockchain';
const COLLECTION_PLATFORM = 'bezhas_platform';
const MAX_RESULTS = 5;
const EMBEDDING_DIM = 384; // MiniLM-L6 compatible

class RAGService {
    constructor() {
        this.client = null;
        this.collections = {};
        this.initialized = false;
        this._initPromise = null;
    }

    // ─── INITIALIZATION ────────────────────────────────────────────────────────
    async initialize() {
        if (this.initialized) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._doInitialize();
        return this._initPromise;
    }

    async _doInitialize() {
        try {
            this.client = new ChromaClient({ path: CHROMA_URL });

            // Heartbeat check
            const heartbeat = await this.client.heartbeat();
            console.log('✅ ChromaDB connected:', heartbeat);

            // Create or get collections
            this.collections[COLLECTION_PAYMENTS] = await this.client.getOrCreateCollection({
                name: COLLECTION_PAYMENTS,
                metadata: { description: 'Payment transaction metadata for RAG context' },
            });

            this.collections[COLLECTION_BLOCKCHAIN] = await this.client.getOrCreateCollection({
                name: COLLECTION_BLOCKCHAIN,
                metadata: { description: 'Blockchain events and on-chain data' },
            });

            this.collections[COLLECTION_PLATFORM] = await this.client.getOrCreateCollection({
                name: COLLECTION_PLATFORM,
                metadata: { description: 'Platform knowledge base, FAQs, and guides' },
            });

            this.initialized = true;
            console.log('✅ RAG Service initialized with 3 collections');
        } catch (error) {
            console.warn('⚠️  RAG Service ChromaDB unavailable, running in degraded mode:', error.message);
            this.initialized = false;
        }
    }

    // ─── EMBEDDING GENERATION ──────────────────────────────────────────────────
    /**
     * Generate a lightweight embedding vector using a simple hash-based approach.
     * In production with Gemini/OpenAI, replace with proper embedding API calls.
     * For ChromaDB default embedding function, we can also pass raw documents.
     */
    _generateSimpleEmbedding(text) {
        // Deterministic pseudo-embedding based on text hash
        // ChromaDB can also use its built-in sentence-transformers
        const hash = crypto.createHash('sha256').update(text).digest();
        const embedding = [];
        for (let i = 0; i < EMBEDDING_DIM; i++) {
            embedding.push((hash[i % hash.length] / 255.0) * 2 - 1);
        }
        return embedding;
    }

    /**
     * Generate embedding using Google Generative AI (Gemini) if available.
     * Falls back to simple hash-based embedding.
     */
    async generateEmbedding(text) {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const apiKey = process.env.GEMINI_API_KEY;
            if (apiKey && apiKey.startsWith('AIza') && apiKey.length > 30) {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
                const result = await model.embedContent(text);
                return result.embedding.values;
            }
        } catch (e) {
            // Fallback silently
        }
        // Let ChromaDB handle embedding with its default model
        return null;
    }

    // ─── INDEXING — PAYMENTS ───────────────────────────────────────────────────
    /**
     * Index a payment event into the RAG system.
     * @param {Object} payment - Payment data
     * @param {string} payment.id - Unique payment ID
     * @param {string} payment.type - 'stripe' | 'crypto' | 'fiat'
     * @param {number} payment.amount - Amount in USD
     * @param {string} payment.currency - Currency code
     * @param {string} payment.walletAddress - User wallet
     * @param {string} payment.status - 'completed' | 'pending' | 'failed'
     * @param {string} payment.txHash - Blockchain TX hash (if crypto)
     * @param {number} payment.tokenAmount - BEZ tokens received
     * @param {Date}   payment.timestamp - When the payment occurred
     */
    async indexPayment(payment) {
        if (!this.initialized) return;

        const doc = `Payment ${payment.type}: ${payment.amount} ${payment.currency} → ${payment.tokenAmount || 0} BEZ | Status: ${payment.status} | Wallet: ${payment.walletAddress || 'N/A'} | TX: ${payment.txHash || 'N/A'} | Time: ${payment.timestamp || new Date().toISOString()}`;

        const metadata = {
            type: payment.type || 'unknown',
            amount: payment.amount || 0,
            currency: payment.currency || 'USD',
            status: payment.status || 'unknown',
            walletAddress: payment.walletAddress || '',
            txHash: payment.txHash || '',
            tokenAmount: payment.tokenAmount || 0,
            timestamp: (payment.timestamp || new Date()).toISOString(),
            source: 'payment_system',
        };

        try {
            const collection = this.collections[COLLECTION_PAYMENTS];
            await collection.add({
                ids: [payment.id || `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`],
                documents: [doc],
                metadatas: [metadata],
            });
        } catch (error) {
            console.error('RAG indexing error (payment):', error.message);
        }
    }

    // ─── INDEXING — BLOCKCHAIN EVENTS ──────────────────────────────────────────
    /**
     * Index a blockchain event.
     * @param {Object} event
     * @param {string} event.id - Event ID
     * @param {string} event.eventName - e.g., 'Transfer', 'Staked', 'ProposalCreated'
     * @param {string} event.contractAddress - Smart contract address
     * @param {string} event.contractName - e.g. 'BEZToken', 'StakingPool'
     * @param {Object} event.args - Event arguments
     * @param {string} event.txHash - Transaction hash
     * @param {number} event.blockNumber - Block number
     */
    async indexBlockchainEvent(event) {
        if (!this.initialized) return;

        const argsStr = event.args ? JSON.stringify(event.args) : '{}';
        const doc = `Blockchain Event: ${event.eventName} on ${event.contractName || event.contractAddress} | Args: ${argsStr} | Block: ${event.blockNumber || 'N/A'} | TX: ${event.txHash || 'N/A'}`;

        const metadata = {
            eventName: event.eventName || 'unknown',
            contractAddress: event.contractAddress || '',
            contractName: event.contractName || '',
            txHash: event.txHash || '',
            blockNumber: event.blockNumber || 0,
            timestamp: new Date().toISOString(),
            source: 'blockchain_listener',
        };

        try {
            const collection = this.collections[COLLECTION_BLOCKCHAIN];
            await collection.add({
                ids: [event.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`],
                documents: [doc],
                metadatas: [metadata],
            });
        } catch (error) {
            console.error('RAG indexing error (blockchain):', error.message);
        }
    }

    // ─── INDEXING — PLATFORM KNOWLEDGE ─────────────────────────────────────────
    /**
     * Index platform documentation/knowledge.
     * @param {Object} doc
     * @param {string} doc.id
     * @param {string} doc.title
     * @param {string} doc.content
     * @param {string} doc.category - 'faq' | 'guide' | 'tokenomics' | 'security'
     */
    async indexPlatformKnowledge(doc) {
        if (!this.initialized) return;

        const text = `${doc.title}: ${doc.content}`;
        const metadata = {
            title: doc.title || '',
            category: doc.category || 'general',
            timestamp: new Date().toISOString(),
            source: 'platform_knowledge',
        };

        try {
            const collection = this.collections[COLLECTION_PLATFORM];
            await collection.add({
                ids: [doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`],
                documents: [text],
                metadatas: [metadata],
            });
        } catch (error) {
            console.error('RAG indexing error (platform):', error.message);
        }
    }

    // ─── RETRIEVAL ─────────────────────────────────────────────────────────────
    /**
     * Query the RAG system for documents relevant to the user's chat message.
     * Searches all 3 collections and merges results by relevance.
     *
     * @param {string} query - User's chat message
     * @param {Object} opts
     * @param {number} opts.nResults - Max results per collection
     * @param {string[]} opts.collections - Which collections to search
     * @returns {Promise<{context: string, sources: Array}>}
     */
    async retrieveContext(query, opts = {}) {
        const nResults = opts.nResults || MAX_RESULTS;
        const targetCollections = opts.collections || [
            COLLECTION_PAYMENTS,
            COLLECTION_BLOCKCHAIN,
            COLLECTION_PLATFORM,
        ];

        if (!this.initialized) {
            return { context: '', sources: [], error: 'RAG not initialized' };
        }

        const allResults = [];

        for (const collName of targetCollections) {
            const collection = this.collections[collName];
            if (!collection) continue;

            try {
                const results = await collection.query({
                    queryTexts: [query],
                    nResults,
                });

                if (results && results.documents && results.documents[0]) {
                    results.documents[0].forEach((doc, i) => {
                        allResults.push({
                            text: doc,
                            collection: collName,
                            distance: results.distances?.[0]?.[i] || 999,
                            metadata: results.metadatas?.[0]?.[i] || {},
                        });
                    });
                }
            } catch (error) {
                console.warn(`RAG query error on ${collName}:`, error.message);
            }
        }

        // Sort by distance (lower = more relevant)
        allResults.sort((a, b) => a.distance - b.distance);
        const topResults = allResults.slice(0, nResults);

        // Build context string for AI prompt injection
        const contextParts = topResults.map((r, i) =>
            `[${i + 1}] (${r.collection}) ${r.text}`
        );
        const context = contextParts.length > 0
            ? `\n--- CONTEXTO RAG (datos en tiempo real de BeZhas) ---\n${contextParts.join('\n')}\n--- FIN CONTEXTO RAG ---\n`
            : '';

        return {
            context,
            sources: topResults.map(r => ({
                collection: r.collection,
                distance: r.distance,
                metadata: r.metadata,
            })),
        };
    }

    // ─── STATS ─────────────────────────────────────────────────────────────────
    async getStats() {
        if (!this.initialized) {
            return { initialized: false, collections: {} };
        }
        const stats = { initialized: true, collections: {} };
        for (const [name, collection] of Object.entries(this.collections)) {
            try {
                const count = await collection.count();
                stats.collections[name] = { count };
            } catch (e) {
                stats.collections[name] = { error: e.message };
            }
        }
        return stats;
    }

    // ─── BULK INDEX ────────────────────────────────────────────────────────────
    /**
     * Bulk index multiple documents at once.
     */
    async bulkIndex(collectionName, documents) {
        if (!this.initialized) return;
        const collection = this.collections[collectionName];
        if (!collection) return;

        try {
            await collection.add({
                ids: documents.map(d => d.id),
                documents: documents.map(d => d.text),
                metadatas: documents.map(d => d.metadata || {}),
            });
            console.log(`✅ Bulk indexed ${documents.length} docs into ${collectionName}`);
        } catch (error) {
            console.error(`RAG bulk index error (${collectionName}):`, error.message);
        }
    }
}

// Singleton export
module.exports = new RAGService();
