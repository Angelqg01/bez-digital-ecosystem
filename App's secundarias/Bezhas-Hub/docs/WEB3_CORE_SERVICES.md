# Web3 Core Services - BeZhas Platform

## Overview

This document describes the **HIGH PRIORITY Web3 infrastructure services** implemented for the BeZhas platform. These services enable optimal blockchain performance, gasless transactions for Web2 user onboarding, and decentralized identity management.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           WEB3 CORE SERVICES                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   Blockchain    │    │    Account      │    │   Multi-Level   │          │
│  │    Indexer      │───▶│  Abstraction    │───▶│     Cache       │          │
│  │  (MongoDB)      │    │   (ERC-4337)    │    │  (L1+L2 Redis)  │          │
│  └────────┬────────┘    └─────────────────┘    └─────────────────┘          │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   WebSocket     │    │   Decentralized │    │      DID        │          │
│  │      Hub        │◀──▶│     Storage     │◀──▶│    Service      │          │
│  │ (Redis Pub/Sub) │    │  (IPFS+Arweave) │    │   (W3C Spec)    │          │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘          │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                                  │
│  │   Intelligent   │    │   Transaction   │                                  │
│  │  Rate Limiter   │    │     Queue       │                                  │
│  │ (Redis-backed)  │    │    (BullMQ)     │                                  │
│  └─────────────────┘    └─────────────────┘                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Services

### 1. Blockchain Indexer Service

**File**: `backend/services/blockchain-indexer.service.js`

Indexes blockchain events into MongoDB for fast queries, replacing the need for The Graph.

#### Features:
- Historical event synchronization (batch of 1000 blocks)
- Real-time event listeners for live updates
- Query events by user, contract, or event type
- Cache integration for hot data
- User activity aggregation

#### Usage:
```javascript
const indexer = require('./services/blockchain-indexer.service');

// Start indexing
await indexer.start();

// Query user activity
const activity = await indexer.getUserActivity('0x...');

// Query specific events
const events = await indexer.queryEvents({
    contractName: 'BezhasToken',
    eventName: 'Transfer',
    limit: 100
});
```

### 2. Account Abstraction Service (ERC-4337)

**File**: `backend/services/account-abstraction.service.js`

Enables gasless transactions for seamless Web2 → Web3 user onboarding.

#### Features:
- Smart account deployment (counterfactual addresses)
- User operation creation and signing
- Paymaster integration for gas sponsorship
- Daily gas limits per user
- Bundler submission

#### Usage:
```javascript
const aa = require('./services/account-abstraction.service');

// Get or create smart account for user
const smartAccount = await aa.getSmartAccountAddress('0x...');

// Prepare gasless transaction
const { userOp } = await aa.prepareGaslessTransaction(
    userAddress,
    targetContract,
    callData,
    { value: 0 }
);

// Execute
const result = await aa.executeGaslessTransaction(signedUserOp);
```

### 3. Multi-Level Cache Service

**File**: `backend/services/cache.service.js`

Two-tier caching system with L1 in-memory (NodeCache) and L2 Redis.

#### Features:
- Automatic L1 → L2 fallback
- Pattern-based invalidation
- Specialized methods for blockchain data
- Cache statistics and monitoring
- Configurable TTLs per data type

#### TTL Presets:
| Type | L1 TTL | L2 TTL |
|------|--------|--------|
| User data | 5 min | 30 min |
| Token balance | 1 min | 5 min |
| NFT metadata | 60 min | 24h |
| Gas price | 15 sec | 1 min |
| DAO proposals | 5 min | 30 min |

#### Usage:
```javascript
const cache = require('./services/cache.service');

// Get with automatic fallback
const data = await cache.get('key');

// Get or compute
const balance = await cache.getOrSet('balance:0x...', 
    async () => contract.balanceOf(address),
    { l1TTL: 60, l2TTL: 300 }
);

// Specialized methods
const tokenBalance = await cache.getTokenBalance('0x...', 'BEZ');
const nftMeta = await cache.getNFTMetadata(tokenId);
```

### 4. WebSocket Hub Service

**File**: `backend/services/websocket-hub.service.js`

Enhanced WebSocket server with Redis pub/sub for horizontal scaling.

#### Features:
- Room-based subscriptions (user, feed, DAO, transactions)
- JWT + wallet signature authentication
- Redis adapter for multi-instance scaling
- Event broadcasting and unicasting
- Connection management and heartbeat

#### Room Types:
- `USER:{userId}` - User-specific notifications
- `FEED:{feedType}` - Feed updates (global, following)
- `DAO:{proposalId}` - DAO proposal updates
- `TRANSACTION:{txHash}` - Transaction status
- `NFT:{collection}` - NFT minting events
- `STAKING:{pool}` - Staking rewards
- `MARKETPLACE` - Marketplace listings
- `GLOBAL` - Platform-wide announcements

#### Usage:
```javascript
const wsHub = require('./services/websocket-hub.service');

// Initialize with HTTP server
wsHub.initialize(httpServer);

// Broadcast to room
wsHub.broadcastToRoom('FEED:global', 'NEW_POST', { postId: '...' });

// Send to specific user
wsHub.sendToUser(userId, 'NOTIFICATION', { message: '...' });
```

### 5. Intelligent Rate Limiter

**File**: `backend/middleware/intelligentRateLimiter.js`

Operation-specific rate limiting with Redis backend and VIP detection.

#### Limit Configurations:
| Operation | Limit | Window |
|-----------|-------|--------|
| Read | 100 | 1 min |
| Write | 30 | 1 min |
| Blockchain | 10 | 1 min |
| AI | 20 | 1 min |
| Auth | 5 | 15 min |
| Upload | 10 | 5 min |

#### Features:
- Sliding window algorithm
- VIP user higher limits (3x multiplier)
- API key-based limits
- In-memory fallback when Redis unavailable
- Request ID tracking

#### Usage:
```javascript
const { createRateLimiter, rateLimiter } = require('./middleware/intelligentRateLimiter');

// Apply to routes
app.use('/api/posts', rateLimiter('write'));
app.use('/api/blockchain', rateLimiter('blockchain'));
app.use('/api/ai', rateLimiter('ai'));

// Custom limits
app.use('/api/custom', createRateLimiter({
    max: 50,
    windowMs: 60000,
    message: 'Custom limit exceeded'
}));
```

### 6. Decentralized Storage Service

**File**: `backend/services/decentralized-storage.service.js`

Unified interface for IPFS (Pinata) and Arweave permanent storage.

#### Storage Tiers:
| Tier | Description | Backend |
|------|-------------|---------|
| TEMPORARY | Session data, previews | IPFS (unpinned) |
| STANDARD | Regular content | IPFS (pinned) |
| PERMANENT | Legal docs, proofs | IPFS + Arweave |
| NFT | NFT metadata/media | Arweave primary |

#### Features:
- Automatic tier routing
- Redundant uploads (IPFS + Arweave)
- Metadata extraction and indexing
- Gateway-agnostic retrieval
- Progress callbacks for large files

#### Usage:
```javascript
const storage = require('./services/decentralized-storage.service');

// Upload with automatic tier
const result = await storage.upload(buffer, {
    filename: 'document.pdf',
    contentType: 'application/pdf',
    tier: storage.TIERS.PERMANENT
});

// Upload for NFT (Arweave priority)
const nftResult = await storage.uploadForNFT(imageBuffer, metadata);

// Retrieve content
const data = await storage.retrieve(result.hash);
```

### 7. Decentralized Identity (DID) Service

**File**: `backend/services/did.service.js`

W3C DID standard implementation for decentralized identity.

#### DID Methods Supported:
- `did:ethr` - Ethereum-based DID
- `did:key` - Key-based DID
- `did:web` - Web-based DID
- `did:bezhas` - Custom BeZhas DID

#### Credential Types:
- VerifiedUser
- DAOMember
- ContentCreator
- VIPMember
- QualityValidator
- ReputationBadge

#### Usage:
```javascript
const didService = require('./services/did.service');

// Create DID for user
const did = await didService.createBeZhasDID(walletAddress, userProfile);
// Returns: did:bezhas:137:0x1234...

// Issue verifiable credential
const vc = await didService.issueCredential(issuerDID, subjectDID, 'DAOMember', {
    votingPower: 100,
    joinedAt: Date.now()
});

// Verify credential
const isValid = await didService.verifyCredential(vc);

// Create presentation
const vp = await didService.createPresentation([vc1, vc2], holderDID);
```

### 8. Transaction Queue Service

**File**: `backend/services/blockchain-queue.service.js`

BullMQ-powered transaction queue for reliable blockchain operations.

#### Queue Types:
- BLOCKCHAIN_TX - General transactions
- QUALITY_VALIDATION - Content validation
- AI_PROCESSING - AI job processing
- NFT_MINTING - NFT operations
- NOTIFICATION - Push notifications
- STAKING - Staking operations

#### Features:
- Priority-based processing
- Retry with exponential backoff
- Gas error detection and resubmission
- Transaction status webhooks
- Concurrent worker processing

#### Usage:
```javascript
const queue = require('./services/blockchain-queue.service');

// Add transaction job
const job = await queue.addTransactionJob({
    type: 'TRANSFER_TOKEN',
    from: '0x...',
    to: '0x...',
    amount: '1000000000000000000'
}, { priority: 1 });

// Check job status
const status = await queue.getJobStatus(job.id);
```

## API Endpoints

All Web3 Core services are accessible via the `/api/web3` prefix:

### Health & Status
```
GET /api/web3/health                    # Service health status
GET /api/web3/cache/stats               # Cache statistics
```

### Blockchain Indexer
```
GET /api/web3/indexer/stats             # Indexer statistics
GET /api/web3/indexer/activity/:address # User blockchain activity
GET /api/web3/indexer/events            # Query indexed events
POST /api/web3/indexer/sync             # Trigger manual sync (admin)
```

### Transaction Queue
```
POST /api/web3/queue/job                # Add new transaction job
GET /api/web3/queue/job/:jobId          # Get job status
GET /api/web3/queue/user/:userId/pending # User's pending transactions
```

### Account Abstraction
```
GET /api/web3/aa/account/:address       # Get smart account address
POST /api/web3/aa/prepare               # Prepare gasless transaction
POST /api/web3/aa/execute               # Execute signed user operation
GET /api/web3/aa/allowance/:address     # Check remaining gas allowance
```

### Decentralized Storage
```
POST /api/web3/storage/upload           # Upload to IPFS/Arweave
GET /api/web3/storage/:hash             # Retrieve content
GET /api/web3/storage/:hash/metadata    # Get content metadata
```

### Decentralized Identity (DID)
```
POST /api/web3/did/create               # Create new DID
GET /api/web3/did/:did                  # Resolve DID document
POST /api/web3/did/credential/issue     # Issue verifiable credential
POST /api/web3/did/credential/verify    # Verify credential
GET /api/web3/did/credentials/:did      # Get user's credentials
```

## Environment Variables

Add these to your `backend/.env`:

```env
# Account Abstraction (ERC-4337)
BUNDLER_URL=https://api.stackup.sh/v1/node/...
PAYMASTER_URL=https://api.stackup.sh/v1/paymaster/...
ENTRY_POINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
DAILY_GAS_LIMIT_USD=10

# Decentralized Storage
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
ARWEAVE_KEY=path/to/arweave-key.json

# DID Service
DID_ISSUER_KEY=your_issuer_private_key
DID_PLATFORM_DOMAIN=bezhas.io

# Cache Configuration
CACHE_L1_TTL=300
CACHE_L2_TTL=3600
```

## Database Models

### IndexedEvent Model

**File**: `backend/models/IndexedEvent.model.js`

```javascript
{
    contractName: String,       // 'BezhasToken', 'BeZhasMarketplace', etc.
    eventName: String,          // 'Transfer', 'PostCreated', etc.
    args: Schema.Types.Mixed,   // Raw event arguments
    decodedArgs: {
        from: String,
        to: String,
        user: String,
        tokenId: String,
        amount: String
    },
    blockNumber: Number,
    transactionHash: String,
    logIndex: Number,
    chainId: Number,
    processed: Boolean,
    processedAt: Date,
    metadata: Schema.Types.Mixed
}
```

## Service Initialization

Services are automatically initialized when the server starts:

```javascript
// backend/services/web3-core.init.js
// Initialization order:
// 1. Cache Service (no dependencies)
// 2. WebSocket Hub (requires HTTP server)
// 3. Blockchain Indexer (requires cache, emits to WebSocket)
// 4. Transaction Queue (requires Redis)
// 5. Account Abstraction (requires provider)
// 6. Decentralized Storage (requires IPFS/Arweave keys)
// 7. DID Service (requires provider)
```

## Performance Optimizations

1. **Cache-First Strategy**: All blockchain reads go through L1/L2 cache
2. **Batch Processing**: Indexer processes 1000 blocks at a time
3. **Connection Pooling**: Redis connections are pooled and reused
4. **Event Debouncing**: WebSocket events are batched to reduce overhead
5. **Lazy Loading**: Services initialize only when first accessed

## Monitoring & Health

Access service health at `/api/web3/health`:

```json
{
    "status": "healthy",
    "services": {
        "indexer": { "status": "running", "lastBlock": 45678901 },
        "cache": { "l1Hits": 1234, "l2Hits": 5678, "hitRate": 0.85 },
        "websocket": { "connections": 150, "rooms": 45 },
        "queue": { "pending": 12, "completed": 9876 },
        "storage": { "ipfsConnected": true, "arweaveConnected": true },
        "did": { "issuedCredentials": 456 }
    }
}
```

## Future Improvements

- [ ] Add support for zkSync and Arbitrum (L2 scaling)
- [ ] Implement credential revocation registry
- [ ] Add IPFS cluster for improved reliability
- [ ] Implement event replay for missed blocks
- [ ] Add Prometheus metrics export
- [ ] Implement WebSocket compression

---

*Last Updated: January 2025*
*Version: 1.0.0*
