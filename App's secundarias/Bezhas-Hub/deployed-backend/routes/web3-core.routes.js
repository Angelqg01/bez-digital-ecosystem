/**
 * Web3 Core API Routes
 * Endpoints for blockchain indexer, account abstraction, and storage
 * 
 * @module routes/web3-core.routes
 */

const express = require('express');
const router = express.Router();
const pino = require('pino');
const rateLimiter = require('../middleware/intelligentRateLimiter');

// Import services
const web3Core = require('../services/web3-core.init');
const {
    blockchainIndexer,
    blockchainQueue,
    accountAbstraction,
    decentralizedStorage,
    didService,
    cacheService
} = web3Core;

const { JOB_TYPES, QUEUE_NAMES } = require('../services/blockchain-queue.service');
const { STORAGE_TIERS } = require('../services/decentralized-storage.service');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============ HEALTH & STATUS ============

/**
 * @route GET /api/web3/health
 * @desc Health check for all Web3 services
 */
router.get('/health', async (req, res) => {
    try {
        const health = await web3Core.healthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

/**
 * @route GET /api/web3/status
 * @desc Get detailed status of Web3 services
 */
router.get('/status', async (req, res) => {
    try {
        const status = web3Core.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ BLOCKCHAIN INDEXER ============

/**
 * @route GET /api/web3/indexer/stats
 * @desc Get blockchain indexer statistics
 */
router.get('/indexer/stats', rateLimiter.read(), async (req, res) => {
    try {
        const stats = await blockchainIndexer.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/indexer/events
 * @desc Query indexed blockchain events
 */
router.get('/indexer/events', rateLimiter.read(), async (req, res) => {
    try {
        const {
            contractName,
            eventName,
            userAddress,
            fromBlock,
            toBlock,
            fromDate,
            toDate,
            limit = 50,
            skip = 0
        } = req.query;

        const events = await blockchainIndexer.queryEvents({
            contractName,
            eventName,
            userAddress,
            fromBlock: fromBlock ? parseInt(fromBlock) : undefined,
            toBlock: toBlock ? parseInt(toBlock) : undefined,
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });

        res.json({ events, count: events.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/indexer/user/:address/activity
 * @desc Get user's blockchain activity summary
 */
router.get('/indexer/user/:address/activity', rateLimiter.read(), async (req, res) => {
    try {
        const { address } = req.params;
        const activity = await blockchainIndexer.getUserActivity(address);
        res.json({ address, activity });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ TRANSACTION QUEUE ============

/**
 * @route POST /api/web3/queue/submit
 * @desc Submit a blockchain transaction to the queue
 */
router.post('/queue/submit', rateLimiter.blockchain(), async (req, res) => {
    try {
        const { type, payload, priority } = req.body;

        if (!type || !payload) {
            return res.status(400).json({ error: 'type and payload required' });
        }

        // Validate job type
        if (!Object.values(JOB_TYPES).includes(type)) {
            return res.status(400).json({
                error: 'Invalid job type',
                validTypes: Object.values(JOB_TYPES)
            });
        }

        const result = await blockchainQueue.addBlockchainJob(type, payload, {
            userAddress: req.user?.address || req.body.userAddress,
            priority: priority || 0
        });

        res.status(202).json({
            success: true,
            message: 'Transaction queued',
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/queue/job/:queue/:jobId
 * @desc Get status of a queued job
 */
router.get('/queue/job/:queue/:jobId', rateLimiter.read(), async (req, res) => {
    try {
        const { queue, jobId } = req.params;

        const status = await blockchainQueue.getJobStatus(queue, jobId);

        if (!status) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/queue/stats
 * @desc Get queue statistics
 */
router.get('/queue/stats', rateLimiter.read(), async (req, res) => {
    try {
        const stats = await blockchainQueue.getQueueStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ACCOUNT ABSTRACTION ============

/**
 * @route GET /api/web3/aa/account/:owner
 * @desc Get smart account address for an owner
 */
router.get('/aa/account/:owner', rateLimiter.read(), async (req, res) => {
    try {
        const { owner } = req.params;
        const { salt = 0 } = req.query;

        const smartAccountAddress = await accountAbstraction.getSmartAccountAddress(owner, parseInt(salt));
        const isDeployed = await accountAbstraction.isAccountDeployed(smartAccountAddress);

        res.json({
            owner,
            smartAccountAddress,
            isDeployed,
            salt: parseInt(salt)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/aa/sponsorship/:address
 * @desc Check user's gas sponsorship status
 */
router.get('/aa/sponsorship/:address', rateLimiter.read(), async (req, res) => {
    try {
        const { address } = req.params;
        const status = await accountAbstraction.getSponsorshipStatus(address);
        res.json({ address, ...status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/web3/aa/prepare
 * @desc Prepare a gasless transaction for signing
 */
router.post('/aa/prepare', rateLimiter.blockchain(), async (req, res) => {
    try {
        const { ownerAddress, targetContract, functionName, functionArgs, contractAbi } = req.body;

        if (!ownerAddress || !targetContract || !functionName || !contractAbi) {
            return res.status(400).json({
                error: 'ownerAddress, targetContract, functionName, and contractAbi required'
            });
        }

        const prepared = await accountAbstraction.prepareGaslessTransaction({
            ownerAddress,
            targetContract,
            functionName,
            functionArgs: functionArgs || [],
            contractAbi
        });

        res.json(prepared);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/web3/aa/execute
 * @desc Execute a signed gasless transaction
 */
router.post('/aa/execute', rateLimiter.blockchain(), async (req, res) => {
    try {
        const { ownerAddress, targetContract, functionName, functionArgs, contractAbi, signature } = req.body;

        if (!signature) {
            return res.status(400).json({ error: 'signature required' });
        }

        const result = await accountAbstraction.executeGaslessTransaction({
            ownerAddress,
            targetContract,
            functionName,
            functionArgs: functionArgs || [],
            contractAbi,
            signature
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/aa/status
 * @desc Get Account Abstraction service status
 */
router.get('/aa/status', rateLimiter.read(), async (req, res) => {
    try {
        const status = accountAbstraction.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ DECENTRALIZED STORAGE ============

/**
 * @route POST /api/web3/storage/upload
 * @desc Upload content to decentralized storage
 */
router.post('/storage/upload', rateLimiter.upload(), async (req, res) => {
    try {
        const { content, tier = 'standard', filename, contentType, metadata } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'content required' });
        }

        // Validate tier
        if (!Object.values(STORAGE_TIERS).includes(tier)) {
            return res.status(400).json({
                error: 'Invalid storage tier',
                validTiers: Object.values(STORAGE_TIERS)
            });
        }

        const result = await decentralizedStorage.upload(
            Buffer.from(content, 'base64'),
            { tier, filename, contentType, metadata }
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/web3/storage/upload-json
 * @desc Upload JSON metadata to IPFS
 */
router.post('/storage/upload-json', rateLimiter.upload(), async (req, res) => {
    try {
        const { json, tier = 'standard', filename } = req.body;

        if (!json) {
            return res.status(400).json({ error: 'json required' });
        }

        const result = await decentralizedStorage.uploadJSONToIPFS(json, {
            tier,
            filename: filename || 'metadata.json'
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/storage/retrieve/:identifier
 * @desc Retrieve content by CID or Arweave ID
 */
router.get('/storage/retrieve/:identifier', rateLimiter.read(), async (req, res) => {
    try {
        const { identifier } = req.params;
        const content = await decentralizedStorage.retrieve(identifier);

        // Return as base64
        res.json({
            identifier,
            content: content.toString('base64'),
            size: content.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/web3/storage/pin
 * @desc Pin existing content by CID
 */
router.post('/storage/pin', rateLimiter.write(), async (req, res) => {
    try {
        const { cid, name, metadata } = req.body;

        if (!cid) {
            return res.status(400).json({ error: 'cid required' });
        }

        const result = await decentralizedStorage.pinByHash(cid, { name, metadata });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route DELETE /api/web3/storage/unpin/:cid
 * @desc Unpin content from IPFS
 */
router.delete('/storage/unpin/:cid', rateLimiter.write(), async (req, res) => {
    try {
        const { cid } = req.params;
        const result = await decentralizedStorage.unpinFromIPFS(cid);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/storage/status
 * @desc Get storage service status
 */
router.get('/storage/status', rateLimiter.read(), async (req, res) => {
    try {
        const status = decentralizedStorage.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/web3/storage/estimate
 * @desc Estimate storage cost
 */
router.post('/storage/estimate', rateLimiter.read(), async (req, res) => {
    try {
        const { size, tier = 'standard' } = req.body;

        if (!size) {
            return res.status(400).json({ error: 'size required' });
        }

        const estimate = await decentralizedStorage.estimateCost(parseInt(size), tier);
        res.json({ size, tier, ...estimate });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ DID & VERIFIABLE CREDENTIALS ============

/**
 * @route POST /api/web3/did/create
 * @desc Create a BeZhas DID for user
 */
router.post('/did/create', rateLimiter.write(), async (req, res) => {
    try {
        const { userId, address } = req.body;

        if (!userId || !address) {
            return res.status(400).json({ error: 'userId and address required' });
        }

        const result = await didService.createBeZhasDID(userId, address);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/did/resolve/:did
 * @desc Resolve a DID to its DID Document
 */
router.get('/did/resolve/:did(*)', rateLimiter.read(), async (req, res) => {
    try {
        const { did } = req.params;
        const document = await didService.resolveDID(did);
        res.json(document);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

/**
 * @route POST /api/web3/did/credential/issue
 * @desc Issue a Verifiable Credential
 */
router.post('/did/credential/issue', rateLimiter.write(), async (req, res) => {
    try {
        const { subjectDID, credentialType, claims } = req.body;

        if (!subjectDID || !credentialType || !claims) {
            return res.status(400).json({
                error: 'subjectDID, credentialType, and claims required'
            });
        }

        const credential = await didService.issueCredential(subjectDID, credentialType, claims);
        res.json(credential);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/web3/did/credential/verify
 * @desc Verify a Verifiable Credential
 */
router.post('/did/credential/verify', rateLimiter.read(), async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ error: 'credential required' });
        }

        const verification = await didService.verifyCredential(credential);
        res.json(verification);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/did/credentials/:did
 * @desc Get user's credentials
 */
router.get('/did/credentials/:did(*)', rateLimiter.read(), async (req, res) => {
    try {
        const { did } = req.params;
        const credentials = await didService.getUserCredentials(did);
        res.json({ did, credentials, count: credentials.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/web3/did/status
 * @desc Get DID service status
 */
router.get('/did/status', rateLimiter.read(), async (req, res) => {
    try {
        const status = didService.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CACHE ============

/**
 * @route GET /api/web3/cache/stats
 * @desc Get cache statistics
 */
router.get('/cache/stats', rateLimiter.read(), async (req, res) => {
    try {
        const stats = cacheService.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
