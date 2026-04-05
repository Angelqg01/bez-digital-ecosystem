# Quality Oracle System - Complete Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Smart Contracts](#smart-contracts)
4. [Backend Services](#backend-services)
5. [Frontend Components](#frontend-components)
6. [API Reference](#api-reference)
7. [User Guide](#user-guide)
8. [Developer Guide](#developer-guide)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## 📖 Overview

### What is Quality Oracle?

Quality Oracle is a blockchain-based quality assurance system that uses escrow mechanisms and reputation tracking to ensure service quality. Providers lock collateral in BEZ tokens, which is returned based on the actual quality delivered.

### Key Features

- 🎯 **Quality-Based Escrow**: Collateral locked and released based on quality scores
- 📊 **Real-Time Analytics**: Comprehensive metrics and visualizations
- 🏆 **Reputation System**: 6-tier provider ranking with achievements
- 🔔 **Live Notifications**: WebSocket-based real-time updates
- ⚖️ **Dispute Resolution**: Oracle-mediated quality disputes
- 🔐 **Safe Wallet Integration**: Multi-sig support for admin operations

### Tech Stack

**Blockchain**:
- Solidity 0.8.20
- Hardhat development environment
- Polygon Amoy Testnet
- Safe Wallet for admin multi-sig

**Backend**:
- Node.js + Express
- WebSocket server for real-time events
- Pino logger
- ethers.js for blockchain interaction

**Frontend**:
- React 18.2
- wagmi for Web3 integration
- Recharts for analytics visualization
- Tailwind CSS + custom styling

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Escrow   │  │Analytics │  │Reputation│  │ Notifs  │ │
│  │ Manager  │  │Dashboard │  │ Display  │  │ Center  │ │
│  └─────┬────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│        │            │              │              │      │
│        └────────────┴──────────────┴──────────────┘      │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                ┌───────────┴──────────┐
                │                      │
        ┌───────▼──────┐      ┌───────▼────────┐
        │  REST API    │      │  WebSocket     │
        │  (Express)   │      │  Server        │
        └───────┬──────┘      └───────┬────────┘
                │                     │
        ┌───────┴──────────────────────┴────────┐
        │         Backend Services               │
        │  ┌─────────┐  ┌─────────┐  ┌────────┐│
        │  │Quality  │  │Reputation│  │Notif   ││
        │  │Escrow   │  │System    │  │Service ││
        │  │Routes   │  └─────────┘  └────────┘│
        │  └────┬────┘                          │
        └───────┼───────────────────────────────┘
                │
        ┌───────▼──────┐
        │   ethers.js  │
        └───────┬──────┘
                │
        ┌───────▼──────┐
        │  Blockchain  │
        │  ┌──────────┐│
        │  │Quality   ││
        │  │Escrow    ││
        │  │Contract  ││
        │  └──────────┘│
        │  ┌──────────┐│
        │  │BezCoin   ││
        │  │Token     ││
        │  └──────────┘│
        └──────────────┘
```

### Data Flow

1. **Service Creation**:
   ```
   User → Frontend → API → Smart Contract → Blockchain
   ↓
   Event Emitted → Backend Service → Notification Service → WebSocket → Frontend
   ```

2. **Service Finalization**:
   ```
   Provider → Frontend → API → Smart Contract → Quality Check
   ↓
   Collateral Release/Penalty → Reputation Update → Analytics Update → Notification
   ```

3. **Real-Time Updates**:
   ```
   Blockchain Event → Backend Listener → Notification Service
   ↓
   WebSocket Broadcast → Connected Clients → UI Update
   ```

---

## 📝 Smart Contracts

### QualityEscrow.sol

**Location**: `contracts/QualityEscrow.sol`

#### Main Functions

```solidity
// Create new quality-guaranteed service
function createService(
    address clientWallet,
    uint256 collateralAmount,
    uint8 initialQuality
) external returns (uint256)

// Finalize service with quality score
function finalizeService(
    uint256 serviceId,
    uint8 finalQuality
) external onlyBusinessWallet

// Raise dispute on quality
function raiseDispute(uint256 serviceId) external onlyClient

// Resolve dispute (Oracle only)
function resolveDispute(
    uint256 serviceId,
    bool inProviderFavor,
    uint8 adjustedQuality
) external onlyOracle
```

#### Events

```solidity
event ServiceCreated(uint256 indexed serviceId, address business, address client);
event ServiceFinalized(uint256 indexed serviceId, uint8 quality, uint256 returned);
event DisputeRaised(uint256 indexed serviceId, address by);
event DisputeResolved(uint256 indexed serviceId, bool providerFavor);
```

#### Quality Penalty Calculation

```
if (finalQuality >= initialQuality):
    returnAmount = collateralAmount (full return)
else:
    qualityDiff = initialQuality - finalQuality
    penaltyPercentage = qualityDiff * 2  // 2% per quality point
    penaltyAmount = collateralAmount * penaltyPercentage / 100
    returnAmount = collateralAmount - penaltyAmount
```

**Example**:
- Initial Quality: 90%
- Final Quality: 70%
- Difference: 20 points
- Penalty: 40% (20 * 2%)
- Return: 60% of collateral

---

## 🔧 Backend Services

### 1. Quality Escrow Routes

**File**: `backend/routes/qualityEscrow.js`

#### Endpoints

```javascript
POST   /api/quality-escrow/create
GET    /api/quality-escrow/:id
POST   /api/quality-escrow/finalize
POST   /api/quality-escrow/dispute
GET    /api/quality-escrow/stats
GET    /api/quality-escrow/analytics
GET    /api/quality-escrow/reputation/:address
GET    /api/quality-escrow/leaderboard
```

#### Request Examples

**Create Service**:
```bash
curl -X POST http://localhost:3001/api/quality-escrow/create \
  -H "Content-Type: application/json" \
  -d '{
    "clientWallet": "0x...",
    "collateralAmount": "100",
    "initialQuality": 85
  }'
```

**Get Analytics**:
```bash
curl http://localhost:3001/api/quality-escrow/analytics?timeRange=7d
```

**Get Reputation**:
```bash
curl http://localhost:3001/api/quality-escrow/reputation/0x...
```

---

### 2. Quality Reputation System

**File**: `backend/services/qualityReputationSystem.js`

#### Tier System

| Tier | Min Score | Color | Badge |
|------|-----------|-------|-------|
| LEGENDARY | 950 | Gold | 👑 |
| MASTER | 900 | Purple | 🏆 |
| EXPERT | 850 | Blue | ⭐ |
| PROFESSIONAL | 800 | Cyan | 💎 |
| INTERMEDIATE | 700 | Green | 🌟 |
| BEGINNER | 0 | Gray | 🔰 |

#### Score Calculation

```javascript
score = (
  qualityScore * 0.40 +        // 40% weight
  completionRate * 0.25 +      // 25% weight
  consistency * 0.15 +         // 15% weight
  disputeResolution * 0.15 +   // 15% weight
  longevityBonus * 0.05        // 5% weight
)
```

**Factors**:

1. **Quality Score**: Average of all quality scores (0-100)
2. **Completion Rate**: (completedServices / totalServices) * 100
3. **Consistency**: 100 - (standardDeviation of quality scores)
4. **Dispute Resolution**: 100 - (disputesLost / totalDisputes) * 100
5. **Longevity Bonus**: min((daysSinceFirstService / 365) * 100, 100)

#### Achievements

| Achievement | Requirement | Points |
|-------------|-------------|--------|
| 🎯 First Service | Complete 1 service | +10 |
| 🏅 Veteran (10) | Complete 10 services | +20 |
| 🎖️ Veteran (50) | Complete 50 services | +50 |
| 💯 Centurion | Complete 100 services | +100 |
| 🌟 Perfectionist | 5 consecutive 95%+ | +30 |
| 🔥 Consistent Excellence | 10 consecutive 90%+ | +40 |
| 🛡️ Dispute-Free | 50 services, 0 disputes | +50 |
| 🏆 Master Tier | Reach Master tier | +75 |
| 👑 Legendary Tier | Reach Legendary tier | +100 |

---

### 3. Notification Service

**File**: `backend/services/qualityNotificationService.js`

#### Event Types

1. **service_created**: New service created
2. **service_finalized**: Service completed
3. **dispute_opened**: Quality dispute raised
4. **dispute_resolved**: Dispute settled
5. **quality_warning**: Quality below threshold
6. **collateral_released**: Collateral returned
7. **penalty_applied**: Quality penalty charged

#### Notification Structure

```javascript
{
  id: 'notif_123',
  type: 'quality_oracle:service_finalized',
  title: 'Service Finalized',
  message: 'Service #45 completed with 92% quality',
  priority: 'high',
  data: {
    serviceId: 45,
    qualityScore: 92,
    collateralReturned: 95
  },
  actionUrl: '/admin/quality-oracle#service-45',
  timestamp: 1704297600000,
  read: false
}
```

#### Priority Levels

- **critical**: Major issues, disputes, penalties
- **high**: Service completions, quality warnings
- **medium**: Service creation, updates
- **low**: Daily summaries, stats

---

## 🎨 Frontend Components

### 1. QualityEscrowManager

**File**: `frontend/src/components/admin/QualityEscrowManager.jsx`

**Features**:
- Create new quality-guaranteed services
- View all user services
- Finalize services with quality slider
- Raise disputes on quality issues
- Real-time stats dashboard

**Props**: None (uses Web3Context)

**Usage**:
```jsx
import QualityEscrowManager from './components/admin/QualityEscrowManager';

<QualityEscrowManager />
```

---

### 2. QualityAnalytics

**File**: `frontend/src/components/admin/QualityAnalytics.jsx`

**Features**:
- 6 chart visualizations (Area, Bar, Pie, Line)
- Time range selector (24h, 7d, 30d, 90d)
- Export functionality (JSON, CSV)
- Top providers leaderboard
- Real-time refresh

**Charts**:
1. **Services Over Time**: AreaChart with gradient
2. **Quality Distribution**: BarChart (4 ranges)
3. **Status Distribution**: PieChart (active/completed/disputed)
4. **Collateral Flow**: LineChart (locked/released/penalties)
5. **Hourly Activity**: BarChart (24-hour pattern)
6. **Top Providers**: Table with 5 columns

**Usage**:
```jsx
import QualityAnalytics from './components/admin/QualityAnalytics';

<QualityAnalytics />
```

---

### 3. QualityReputation

**File**: `frontend/src/components/admin/QualityReputation.jsx`

**Features**:
- Provider tier display with badge
- Score progress bar to next tier
- Stats grid (services, quality, completion rate)
- Achievements showcase
- Recent history (5 latest actions)
- Leaderboard view (top 50 providers)

**Props**:
```jsx
provider: string  // Wallet address
```

**Usage**:
```jsx
import QualityReputation from './components/admin/QualityReputation';

<QualityReputation provider="0x..." />
```

---

### 4. QualityNotifications

**File**: `frontend/src/components/QualityNotifications.jsx`

**Features**:
- Bell icon with unread badge
- Connection status indicator
- Dropdown notification panel
- Mark as read / Clear actions
- Click to navigate to actionUrl
- Real-time WebSocket updates

**Props**: None (uses useQualityNotifications hook)

**Usage**:
```jsx
import QualityNotifications from './components/QualityNotifications';

// Fixed position in top-right
<div className="fixed top-6 right-6 z-50">
  <QualityNotifications />
</div>
```

---

## 🔌 API Reference

### Base URL
```
Production: https://api.bezhas.com
Development: http://localhost:3001
```

### Authentication
All API requests require a valid wallet signature or admin authorization.

### Endpoints

#### POST /api/quality-escrow/create

Create a new quality-guaranteed service.

**Request Body**:
```json
{
  "clientWallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "collateralAmount": "100",
  "initialQuality": 85
}
```

**Response**:
```json
{
  "success": true,
  "serviceId": 123,
  "transaction": {
    "hash": "0xabc...",
    "blockNumber": 12345678
  }
}
```

---

#### GET /api/quality-escrow/:id

Get service details by ID.

**Response**:
```json
{
  "success": true,
  "service": {
    "id": 123,
    "businessWallet": "0x...",
    "clientWallet": "0x...",
    "collateralAmount": "100",
    "initialQuality": 85,
    "finalQuality": 92,
    "status": "COMPLETED",
    "timestamp": "2026-01-03T10:30:00Z"
  }
}
```

---

#### POST /api/quality-escrow/finalize

Finalize service with quality score.

**Request Body**:
```json
{
  "serviceId": 123,
  "finalQuality": 92
}
```

**Response**:
```json
{
  "success": true,
  "collateralReturned": "95",
  "penalty": "5",
  "reputation": {
    "score": 875,
    "tier": "EXPERT",
    "achievements": ["VETERAN_10", "PERFECTIONIST"]
  }
}
```

---

#### GET /api/quality-escrow/analytics

Get comprehensive analytics data.

**Query Parameters**:
- `timeRange`: `24h` | `7d` | `30d` | `90d` (default: `7d`)

**Response**:
```json
{
  "success": true,
  "analytics": {
    "overview": {
      "totalServices": 156,
      "activeServices": 23,
      "averageQuality": 87.5,
      "totalCollateral": "15600",
      "successRate": 95.8
    },
    "timeline": [...],
    "qualityDistribution": [...],
    "topProviders": [...]
  }
}
```

---

#### GET /api/quality-escrow/reputation/:address

Get provider reputation.

**Response**:
```json
{
  "success": true,
  "reputation": {
    "provider": "0x...",
    "score": 875,
    "tier": "EXPERT",
    "tierInfo": {
      "name": "Expert",
      "color": "#3b82f6",
      "badge": "⭐",
      "minScore": 850
    },
    "totalServices": 45,
    "completedServices": 43,
    "averageQuality": 89.5,
    "achievements": [...],
    "recentHistory": [...]
  }
}
```

---

#### GET /api/quality-escrow/leaderboard

Get top providers.

**Query Parameters**:
- `limit`: number (default: 50, max: 100)

**Response**:
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "provider": "0x...",
      "score": 965,
      "tier": "LEGENDARY",
      "totalServices": 120,
      "averageQuality": 96.5
    },
    ...
  ]
}
```

---

## 📚 User Guide

### For Service Providers

#### 1. Creating a Service

1. Navigate to Admin Dashboard
2. Click on "Quality Oracle" tab
3. Click "New Service" button
4. Fill in the form:
   - **Client Wallet**: Address of the client
   - **Collateral Amount**: BEZ tokens to lock (e.g., 100)
   - **Initial Quality**: Expected quality score (1-100%)
5. Click "Create Service"
6. Approve the transaction in your wallet
7. Wait for confirmation

#### 2. Finalizing a Service

1. Find your service in the list
2. Click "Finalize" button
3. Adjust the quality slider to match actual delivery
4. Click "Confirm"
5. Approve the transaction

**Quality Impact**:
- Met/exceeded quality → Full collateral returned
- Below quality → Penalty of 2% per quality point

**Example**:
- Promised: 90%
- Delivered: 85%
- Difference: 5 points
- Penalty: 10% (5 * 2%)
- Return: 90% of collateral

#### 3. Building Reputation

Track your reputation in the "Reputation" view:
- **Score**: Overall reputation (0-1000)
- **Tier**: BEGINNER → LEGENDARY
- **Achievements**: Unlock by hitting milestones
- **Leaderboard**: See how you rank

**Tips for High Reputation**:
- ✅ Consistently deliver high quality (90%+)
- ✅ Complete all services (avoid cancellations)
- ✅ Avoid disputes
- ✅ Build long-term track record

---

### For Clients

#### 1. Monitoring Services

- View all services in the Quality Oracle dashboard
- Check real-time status updates
- Receive notifications for milestones

#### 2. Raising Disputes

If quality is unacceptable:
1. Find the service in your list
2. Click "Raise Dispute"
3. Provide evidence (optional, off-chain)
4. Wait for oracle resolution

**Dispute Process**:
1. Dispute raised → Service frozen
2. Oracle reviews evidence
3. Decision: Provider fault or Client fault
4. Collateral distributed accordingly

---

## 👨‍💻 Developer Guide

### Environment Setup

1. **Clone Repository**:
```bash
git clone https://github.com/yourusername/bezhas-web3.git
cd bezhas-web3
```

2. **Install Dependencies**:
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

3. **Configure Environment**:

**.env (Root)**:
```env
# Blockchain
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
PRIVATE_KEY=your_private_key
SAFE_WALLET_ADDRESS=0x3EfC42095E8503d41Ad8001328FC23388E00e8a3

# Contracts (after deployment)
QUALITY_ESCROW_ADDRESS=0x...
BEZCOIN_ADDRESS=0x...

# API
API_PORT=3001
WS_PORT=3002
```

**frontend/.env**:
```env
VITE_POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
VITE_QUALITY_ESCROW_ADDRESS=0x...
VITE_BEZCOIN_ADDRESS=0x...
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
```

4. **Start Development**:
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: WebSocket Server
cd backend
npm run ws-server
```

---

### Adding New Features

#### 1. New Smart Contract Function

**contracts/QualityEscrow.sol**:
```solidity
function newFunction() external {
    // Implementation
    emit NewEvent();
}
```

**backend/routes/qualityEscrow.js**:
```javascript
router.post('/new-endpoint', async (req, res) => {
    const contract = getQualityEscrowContract();
    const tx = await contract.newFunction();
    await tx.wait();
    res.json({ success: true });
});
```

**frontend/src/hooks/useQualityEscrow.js**:
```javascript
const newFunction = async () => {
    const contract = getQualityEscrowContract();
    const tx = await contract.newFunction();
    await tx.wait();
    return true;
};
```

#### 2. New Notification Type

**backend/services/qualityNotificationService.js**:
```javascript
async notifyNewEvent(serviceId, data) {
    const notification = {
        type: 'quality_oracle:new_event',
        title: 'New Event',
        message: `Event occurred for service #${serviceId}`,
        priority: 'medium',
        data
    };
    this.broadcast(notification);
}
```

**frontend/src/hooks/useQualityNotifications.js**:
```javascript
// Handle in message switch
case 'quality_oracle:new_event':
    // Process notification
    break;
```

---

## 🚀 Deployment

### Prerequisites

- [ ] MATIC for gas fees (0.17+ recommended)
- [ ] BezCoin tokens deployed
- [ ] Safe Wallet configured as admin
- [ ] Environment variables configured

### Deployment Steps

1. **Deploy Contracts**:
```bash
npm run deploy:quality-oracle
```

This will:
- Deploy QualityEscrow contract
- Set Safe Wallet as oracle
- Verify contracts on PolygonScan

2. **Update Environment**:
Copy deployed addresses to `.env` files

3. **Verify Deployment**:
```bash
npm run verify-deployment
```

4. **Start Backend**:
```bash
cd backend
pm2 start ecosystem.config.js
```

5. **Build Frontend**:
```bash
cd frontend
npm run build
```

6. **Deploy Frontend**:
```bash
# Using Firebase/Vercel/Netlify
npm run deploy
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "Insufficient funds for gas"

**Solution**: Fund your wallet with MATIC
```bash
# Check balance
npm run check-balance

# Visit faucet
https://faucet.polygon.technology/
```

#### 2. "Contract not configured"

**Solution**: Set contract addresses in `.env`
```bash
VITE_QUALITY_ESCROW_ADDRESS=0x...
VITE_BEZCOIN_ADDRESS=0x...
```

#### 3. "WebSocket connection failed"

**Solution**: Start WebSocket server
```bash
cd backend
npm run ws-server
```

#### 4. "Transaction reverted"

**Possible causes**:
- Insufficient token allowance
- Not authorized (only business/client can call)
- Service in wrong state
- Quality score out of range (0-100)

**Debug**:
```bash
# Check transaction on PolygonScan
https://amoy.polygonscan.com/tx/0x...
```

---

## 📊 Monitoring

### Logs

**Backend**:
```bash
tail -f backend/logs/app.log
```

**Frontend** (Console):
```javascript
localStorage.setItem('debug', 'quality-oracle:*');
```

### Metrics

Track in analytics dashboard:
- Total services created
- Average quality score
- Success rate (services without disputes)
- Total collateral locked/released

---

## 🔒 Security

### Best Practices

1. **Never commit private keys**
2. **Use Safe Wallet for admin functions**
3. **Validate all inputs**
4. **Rate limit API endpoints**
5. **Audit smart contracts before mainnet**

### Audit Checklist

- [ ] Reentrancy protection
- [ ] Integer overflow/underflow checks
- [ ] Access control on sensitive functions
- [ ] Input validation on all parameters
- [ ] Event emission for all state changes

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 👥 Contributors

- **GitHub Copilot** - AI Assistant
- **BeZhas Team** - Platform Development

---

## 📞 Support

- **Documentation**: https://docs.bezhas.com
- **Discord**: https://discord.gg/bezhas
- **Email**: support@bezhas.com

---

**Last Updated**: 2026-01-03  
**Version**: 1.0.0  
**Status**: ✅ Production Ready (pending MATIC funding)
