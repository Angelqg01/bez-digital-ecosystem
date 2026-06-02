# API Patterns — BeZhas Blockchain
> Patrones establecidos para el API (Express.js)

## Stack
- **Runtime**: Node.js
- **Framework**: Express 4.22
- **Blockchain**: ethers 6.16
- **DB**: PostgreSQL (pg pool)
- **Cache**: Redis 4
- **Auth**: JWT (jsonwebtoken)
- **Port**: 3001

## Route Convention
```
/api/{module}/{action}
/api/{module}/{:param}
```

### Registered Routes
```javascript
app.use('/api/network', networkRoutes);
app.use('/api/edge-nodes', edgeNodeRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/bridge', bridgeRoutes);
app.use('/api/staking', stakingRoutes);
app.use('/api/farming', farmingRoutes);
app.use('/api/depin', depinRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/ecosystem', ecosystemRoutes);
app.use('/api/wallet', walletRoutes);
```

## Service Pattern
```javascript
// services/{name}Service.js
const { getContract } = require('./contractService');
const pool = require('../db/pool');
const redis = require('../cache/redis');

async function getInfo(address) {
    // 1. Check cache
    const cached = await redis.get(`key:${address}`);
    if (cached) return JSON.parse(cached);
    
    // 2. On-chain read
    const contract = await getContract('ContractName');
    const data = await contract.methodName(address);
    
    // 3. Cache result
    await redis.setEx(`key:${address}`, 300, JSON.stringify(result));
    return result;
}

module.exports = { getInfo };
```

## Route Pattern
```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const service = require('../services/nameService');

router.get('/endpoint', authenticateToken, async (req, res) => {
    try {
        const result = await service.getInfo(req.params.id);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Module Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
```

## Error Response Format
```json
{
    "success": false,
    "error": "Descriptive error message"
}
```

## Success Response Format
```json
{
    "success": true,
    "data": { ... }
}
```

## Contract Interaction via contractService
```javascript
const { getContract, getSignedContract } = require('./contractService');

// Read-only
const contract = await getContract('SmartWallet', address);
const info = await contract.getWalletInfo();

// Write (requires signer)
const signed = await getSignedContract('Paymaster');
const tx = await signed.sponsorGas(user, gas);
await tx.wait();
```

## Auth Middleware
```javascript
// middleware/auth.js exports:
authenticateToken  // JWT verification
optionalAuth       // Optional — req.user may be null
```
