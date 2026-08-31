/**
 * Decentralized Storage Service
 * Combines IPFS (Pinata) + Arweave for optimal storage strategy
 * IPFS: Fast, good for mutable content
 * Arweave: Permanent, good for NFTs and important documents
 * 
 * @module services/decentralized-storage.service
 */

const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const pino = require('pino');
const cacheService = require('./cache.service');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Configuration
const CONFIG = {
    // Pinata (IPFS)
    pinata: {
        apiKey: process.env.PINATA_API_KEY || '',
        secretKey: process.env.PINATA_SECRET_KEY || '',
        apiUrl: 'https://api.pinata.cloud/pinning',
        gateway: process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
    },
    // Arweave
    arweave: {
        host: process.env.ARWEAVE_HOST || 'arweave.net',
        port: 443,
        protocol: 'https',
        gateway: 'https://arweave.net/',
        bundlrNode: process.env.BUNDLR_NODE || 'https://node1.bundlr.network'
    },
    // Defaults
    defaults: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        defaultTTL: 86400 * 365, // 1 year pin
    }
};

/**
 * Storage tiers for different content types
 */
const STORAGE_TIERS = {
    TEMPORARY: 'temporary',    // IPFS only, short-term
    STANDARD: 'standard',      // IPFS with pinning
    PERMANENT: 'permanent',    // IPFS + Arweave
    NFT: 'nft'                 // Arweave primary, IPFS fallback
};

class DecentralizedStorageService {
    constructor() {
        this.isInitialized = false;
        this.capabilities = {
            ipfs: false,
            arweave: false
        };
    }

    /**
     * Initialize the storage service
     */
    async initialize() {
        // Check IPFS/Pinata availability
        if (CONFIG.pinata.apiKey && CONFIG.pinata.secretKey) {
            try {
                await this.testPinataConnection();
                this.capabilities.ipfs = true;
                logger.info('✅ IPFS (Pinata) storage available');
            } catch (error) {
                logger.warn({ error: error.message }, 'IPFS (Pinata) not available');
            }
        }

        // Check Arweave availability
        if (process.env.ARWEAVE_KEY || process.env.BUNDLR_PRIVATE_KEY) {
            try {
                await this.testArweaveConnection();
                this.capabilities.arweave = true;
                logger.info('✅ Arweave storage available');
            } catch (error) {
                logger.warn({ error: error.message }, 'Arweave not available');
            }
        }

        this.isInitialized = true;
        logger.info({ capabilities: this.capabilities }, 'Decentralized storage service initialized');

        return this.capabilities;
    }

    /**
     * Test Pinata connection
     */
    async testPinataConnection() {
        const response = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
            headers: {
                'pinata_api_key': CONFIG.pinata.apiKey,
                'pinata_secret_api_key': CONFIG.pinata.secretKey
            }
        });
        return response.data;
    }

    /**
     * Test Arweave connection
     */
    async testArweaveConnection() {
        const response = await axios.get(`${CONFIG.arweave.gateway}info`);
        return response.data;
    }

    // ============ IPFS METHODS ============

    /**
     * Upload content to IPFS via Pinata
     */
    async uploadToIPFS(content, options = {}) {
        const {
            filename = `file_${Date.now()}`,
            contentType = 'application/octet-stream',
            metadata = {},
            wrapWithDirectory = false
        } = options;

        if (!this.capabilities.ipfs) {
            logger.warn('IPFS not available, returning mock');
            return this.createMockIPFSResult(content, filename);
        }

        try {
            const formData = new FormData();

            // Handle different content types
            const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
            formData.append('file', buffer, { filename, contentType });

            // Pinata metadata
            const pinataMetadata = {
                name: filename,
                keyvalues: {
                    app: 'BeZhas',
                    uploadedAt: new Date().toISOString(),
                    ...metadata
                }
            };
            formData.append('pinataMetadata', JSON.stringify(pinataMetadata));

            // Pinata options
            const pinataOptions = {
                cidVersion: 1,
                wrapWithDirectory
            };
            formData.append('pinataOptions', JSON.stringify(pinataOptions));

            const response = await axios.post(
                `${CONFIG.pinata.apiUrl}/pinFileToIPFS`,
                formData,
                {
                    headers: {
                        'pinata_api_key': CONFIG.pinata.apiKey,
                        'pinata_secret_api_key': CONFIG.pinata.secretKey,
                        ...formData.getHeaders()
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );

            const result = {
                success: true,
                storage: 'ipfs',
                cid: response.data.IpfsHash,
                ipfsUrl: `ipfs://${response.data.IpfsHash}`,
                gatewayUrl: `${CONFIG.pinata.gateway}${response.data.IpfsHash}`,
                size: buffer.length,
                timestamp: response.data.Timestamp,
                pinSize: response.data.PinSize
            };

            // Cache the result
            await cacheService.set(`ipfs:${result.cid}`, result, 86400 * 30);

            logger.info({ cid: result.cid, size: buffer.length }, 'Content uploaded to IPFS');
            return result;

        } catch (error) {
            logger.error({ error: error.message }, 'IPFS upload failed');
            throw new Error(`IPFS upload failed: ${error.message}`);
        }
    }

    /**
     * Upload JSON to IPFS
     */
    async uploadJSONToIPFS(json, options = {}) {
        const content = JSON.stringify(json);
        return this.uploadToIPFS(content, {
            ...options,
            filename: options.filename || 'metadata.json',
            contentType: 'application/json'
        });
    }

    /**
     * Pin existing content by CID
     */
    async pinByHash(cid, options = {}) {
        if (!this.capabilities.ipfs) {
            return { success: false, reason: 'IPFS not available' };
        }

        try {
            const response = await axios.post(
                `${CONFIG.pinata.apiUrl}/pinByHash`,
                {
                    hashToPin: cid,
                    pinataMetadata: {
                        name: options.name || cid,
                        keyvalues: options.metadata || {}
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'pinata_api_key': CONFIG.pinata.apiKey,
                        'pinata_secret_api_key': CONFIG.pinata.secretKey
                    }
                }
            );

            return {
                success: true,
                cid: response.data.IpfsHash,
                gatewayUrl: `${CONFIG.pinata.gateway}${response.data.IpfsHash}`
            };
        } catch (error) {
            logger.error({ error: error.message, cid }, 'Failed to pin by hash');
            throw error;
        }
    }

    /**
     * Unpin content from IPFS
     */
    async unpinFromIPFS(cid) {
        if (!this.capabilities.ipfs) {
            return { success: false, reason: 'IPFS not available' };
        }

        try {
            await axios.delete(`${CONFIG.pinata.apiUrl}/unpin/${cid}`, {
                headers: {
                    'pinata_api_key': CONFIG.pinata.apiKey,
                    'pinata_secret_api_key': CONFIG.pinata.secretKey
                }
            });

            // Invalidate cache
            await cacheService.delete(`ipfs:${cid}`);

            return { success: true, cid };
        } catch (error) {
            logger.error({ error: error.message, cid }, 'Failed to unpin');
            return { success: false, error: error.message };
        }
    }

    // ============ ARWEAVE METHODS ============

    /**
     * Upload content to Arweave (permanent storage)
     * Uses Bundlr for easier uploads and lower minimum sizes
     */
    async uploadToArweave(content, options = {}) {
        const {
            contentType = 'application/octet-stream',
            tags = [],
            filename = null
        } = options;

        if (!this.capabilities.arweave) {
            logger.warn('Arweave not available, falling back to IPFS');
            return this.uploadToIPFS(content, options);
        }

        try {
            const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

            // Standard Arweave tags
            const defaultTags = [
                { name: 'Content-Type', value: contentType },
                { name: 'App-Name', value: 'BeZhas' },
                { name: 'App-Version', value: '1.0.0' },
                { name: 'Unix-Time', value: Math.floor(Date.now() / 1000).toString() }
            ];

            if (filename) {
                defaultTags.push({ name: 'File-Name', value: filename });
            }

            const allTags = [...defaultTags, ...tags];

            // Use Bundlr for easier uploads
            const response = await this.uploadViaBundlr(buffer, allTags);

            const result = {
                success: true,
                storage: 'arweave',
                id: response.id,
                arweaveUrl: `ar://${response.id}`,
                gatewayUrl: `${CONFIG.arweave.gateway}${response.id}`,
                size: buffer.length,
                permanent: true,
                timestamp: new Date().toISOString()
            };

            // Cache permanently
            await cacheService.set(`arweave:${result.id}`, result, 86400 * 365);

            logger.info({ id: result.id, size: buffer.length }, 'Content uploaded to Arweave');
            return result;

        } catch (error) {
            logger.error({ error: error.message }, 'Arweave upload failed');

            // Fallback to IPFS if Arweave fails
            logger.info('Falling back to IPFS');
            return this.uploadToIPFS(content, options);
        }
    }

    /**
     * Upload via Bundlr network (easier Arweave uploads)
     */
    async uploadViaBundlr(buffer, tags) {
        // In production, use @bundlr-network/client
        // For now, use direct HTTP API

        const privateKey = process.env.BUNDLR_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('BUNDLR_PRIVATE_KEY not configured');
        }

        // Create transaction data
        const data = {
            data: buffer.toString('base64'),
            tags: tags
        };

        const response = await axios.post(
            `${CONFIG.arweave.bundlrNode}/tx`,
            data,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': privateKey
                }
            }
        );

        return response.data;
    }

    /**
     * Get Arweave transaction status
     */
    async getArweaveStatus(txId) {
        try {
            const response = await axios.get(`${CONFIG.arweave.gateway}tx/${txId}/status`);
            return {
                confirmed: response.data.number_of_confirmations > 0,
                confirmations: response.data.number_of_confirmations,
                blockHeight: response.data.block_height
            };
        } catch (error) {
            return { confirmed: false, error: error.message };
        }
    }

    // ============ UNIFIED UPLOAD METHODS ============

    /**
     * Smart upload - chooses storage based on tier
     */
    async upload(content, options = {}) {
        const {
            tier = STORAGE_TIERS.STANDARD,
            filename,
            contentType,
            metadata = {}
        } = options;

        switch (tier) {
            case STORAGE_TIERS.TEMPORARY:
                // IPFS only, might be unpinned later
                return this.uploadToIPFS(content, { filename, contentType, metadata });

            case STORAGE_TIERS.STANDARD:
                // IPFS with long-term pinning
                return this.uploadToIPFS(content, {
                    filename,
                    contentType,
                    metadata: { ...metadata, tier: 'standard' }
                });

            case STORAGE_TIERS.PERMANENT:
                // Upload to both IPFS and Arweave
                return this.uploadWithRedundancy(content, options);

            case STORAGE_TIERS.NFT:
                // Arweave primary (permanent), IPFS as fallback gateway
                return this.uploadForNFT(content, options);

            default:
                return this.uploadToIPFS(content, { filename, contentType, metadata });
        }
    }

    /**
     * Upload with redundancy (IPFS + Arweave)
     */
    async uploadWithRedundancy(content, options = {}) {
        const results = {
            ipfs: null,
            arweave: null,
            success: false
        };

        // Upload to IPFS first (faster)
        try {
            results.ipfs = await this.uploadToIPFS(content, options);
        } catch (error) {
            logger.error({ error: error.message }, 'IPFS upload failed in redundancy upload');
        }

        // Upload to Arweave for permanence
        try {
            results.arweave = await this.uploadToArweave(content, options);
        } catch (error) {
            logger.error({ error: error.message }, 'Arweave upload failed in redundancy upload');
        }

        results.success = results.ipfs?.success || results.arweave?.success;

        // Return primary gateway URL (prefer IPFS for speed)
        results.primaryUrl = results.ipfs?.gatewayUrl || results.arweave?.gatewayUrl;
        results.permanentUrl = results.arweave?.gatewayUrl;

        return results;
    }

    /**
     * Upload content for NFT metadata (requires permanence)
     */
    async uploadForNFT(content, options = {}) {
        const {
            filename = 'metadata.json',
            contentType = 'application/json',
            ...rest
        } = options;

        // For NFTs, we want Arweave for permanence
        const arweaveResult = await this.uploadToArweave(content, {
            filename,
            contentType,
            tags: [
                { name: 'Type', value: 'NFT-Metadata' },
                ...(options.tags || [])
            ]
        });

        // Also upload to IPFS for faster initial access
        let ipfsResult = null;
        try {
            ipfsResult = await this.uploadToIPFS(content, {
                filename,
                contentType,
                metadata: {
                    arweaveId: arweaveResult.id,
                    type: 'nft-metadata'
                }
            });
        } catch (error) {
            logger.warn({ error: error.message }, 'IPFS backup failed for NFT');
        }

        return {
            success: true,
            storage: 'nft',
            arweave: arweaveResult,
            ipfs: ipfsResult,
            // For NFT, prefer Arweave URL (permanent)
            tokenUri: arweaveResult.arweaveUrl,
            // But provide IPFS for faster access
            gatewayUrl: ipfsResult?.gatewayUrl || arweaveResult.gatewayUrl
        };
    }

    /**
     * Retrieve content by CID or Arweave ID
     */
    async retrieve(identifier, options = {}) {
        const cacheKey = `content:${identifier}`;

        // Check cache first
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;

        let content = null;

        // Determine storage type
        if (identifier.startsWith('Qm') || identifier.startsWith('bafy')) {
            // IPFS CID
            content = await this.retrieveFromIPFS(identifier);
        } else if (identifier.length === 43) {
            // Arweave transaction ID
            content = await this.retrieveFromArweave(identifier);
        } else {
            throw new Error('Unknown identifier format');
        }

        // Cache the result
        if (content) {
            await cacheService.set(cacheKey, content, options.cacheTTL || 3600);
        }

        return content;
    }

    /**
     * Retrieve from IPFS
     */
    async retrieveFromIPFS(cid) {
        try {
            const response = await axios.get(`${CONFIG.pinata.gateway}${cid}`, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            return Buffer.from(response.data);
        } catch (error) {
            // Try public IPFS gateway as fallback
            const response = await axios.get(`https://ipfs.io/ipfs/${cid}`, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            return Buffer.from(response.data);
        }
    }

    /**
     * Retrieve from Arweave
     */
    async retrieveFromArweave(txId) {
        const response = await axios.get(`${CONFIG.arweave.gateway}${txId}`, {
            responseType: 'arraybuffer',
            timeout: 60000
        });
        return Buffer.from(response.data);
    }

    // ============ UTILITY METHODS ============

    /**
     * Create mock IPFS result for development
     */
    createMockIPFSResult(content, filename) {
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        const mockCid = 'Qm' + hash.substring(0, 44);

        return {
            success: true,
            storage: 'ipfs-mock',
            cid: mockCid,
            ipfsUrl: `ipfs://${mockCid}`,
            gatewayUrl: `https://ipfs.io/ipfs/${mockCid}`,
            size: buffer.length,
            timestamp: new Date().toISOString(),
            mock: true
        };
    }

    /**
     * Get storage service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            capabilities: this.capabilities,
            ipfsGateway: CONFIG.pinata.gateway,
            arweaveGateway: CONFIG.arweave.gateway
        };
    }

    /**
     * Calculate storage cost estimate
     */
    async estimateCost(size, tier = STORAGE_TIERS.STANDARD) {
        const costs = {
            ipfs: {
                monthly: size * 0.00002, // ~$0.02/GB/month
                currency: 'USD'
            },
            arweave: {
                oneTime: size * 0.000005, // ~$5/GB one-time
                currency: 'AR'
            }
        };

        switch (tier) {
            case STORAGE_TIERS.TEMPORARY:
                return { total: costs.ipfs.monthly, breakdown: { ipfs: costs.ipfs } };
            case STORAGE_TIERS.STANDARD:
                return { total: costs.ipfs.monthly * 12, breakdown: { ipfs: costs.ipfs } };
            case STORAGE_TIERS.PERMANENT:
            case STORAGE_TIERS.NFT:
                return {
                    total: costs.arweave.oneTime,
                    breakdown: { ipfs: costs.ipfs, arweave: costs.arweave },
                    permanent: true
                };
            default:
                return { total: costs.ipfs.monthly, breakdown: { ipfs: costs.ipfs } };
        }
    }
}

// Export storage tiers
module.exports.STORAGE_TIERS = STORAGE_TIERS;

// Singleton instance
const storageService = new DecentralizedStorageService();
module.exports = storageService;
