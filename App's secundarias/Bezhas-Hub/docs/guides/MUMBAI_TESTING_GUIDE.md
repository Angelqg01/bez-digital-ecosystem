# Mumbai Testnet Testing Guide

Guía completa para probar el Revenue Stream Native en Mumbai testnet.

## 🎯 Objetivos

Probar el sistema completo en un entorno controlado antes del lanzamiento a mainnet:

- ✅ Deploy de contratos
- ✅ Swaps funcionales
- ✅ Monitoreo de eventos
- ✅ Notificaciones automáticas
- ✅ Service delivery
- ✅ Base de datos
- ✅ Analytics

---

## 🚀 Quick Start

### 1. Preparación

```bash
# Get Mumbai MATIC from faucet
# https://faucet.polygon.technology/

# Configure .env for Mumbai
cp backend/.env.example backend/.env
nano backend/.env
```

Agregar configuración de Mumbai:

```env
# Mumbai Testnet
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY
MUMBAI_PRIVATE_KEY=your_testnet_private_key
```

### 2. Deploy to Mumbai

```bash
# Automated setup script
npx hardhat run backend/scripts/mumbaiSetup.js --network mumbai

# O deployment manual
npx hardhat run scripts/deploy.js --network mumbai
```

### 3. Start Monitoring

```bash
# Use Mumbai RPC
POLYGON_RPC_URL=$MUMBAI_RPC_URL \
BEZ_LIQUIDITY_RAMP_ADDRESS=$MUMBAI_CONTRACT_ADDRESS \
node backend/scripts/monitorRevenue.js
```

### 4. Execute Test Swaps

```bash
# Frontend testing
cd frontend
npm start

# Or script-based testing (included in mumbaiSetup.js)
```

---

## 📋 Complete Testing Checklist

### Smart Contract Tests

- [ ] Deploy BezToken successfully
- [ ] Deploy BezLiquidityRamp successfully
- [ ] Verify contracts on Mumbai Polygonscan
- [ ] Grant SIGNER_ROLE correctly
- [ ] Set treasury address

### Swap Functionality

- [ ] Approve USDC spending
- [ ] Execute successful swap
- [ ] Verify BEZ received
- [ ] Check fee collection (0.5%)
- [ ] Confirm treasury receives fees
- [ ] Test different serviceIds

### AI Risk Engine

- [ ] Risk assessment returns score
- [ ] Low risk (< 50) allows swap
- [ ] Medium risk (50-70) allows with warning
- [ ] High risk (> 70) blocks swap
- [ ] Admin override works

### Event Monitoring

- [ ] Event listener connects to Mumbai RPC
- [ ] AutoSwapExecuted event detected
- [ ] PlatformFeeCollected event detected
- [ ] Event data parsed correctly
- [ ] Events saved to database

### Notifications

- [ ] Discord webhook sends alerts
- [ ] Slack webhook works (if configured)
- [ ] Email notifications sent
- [ ] High-value alerts triggered ($5000+)
- [ ] Daily reports scheduled

### Service Delivery

- [ ] NFT delivery triggered
- [ ] Subscription activation works
- [ ] Product fulfillment called
- [ ] Delivery status tracked in DB
- [ ] Retry logic works for failures

### Database Integration

- [ ] Swaps saved to database
- [ ] Fees recorded correctly
- [ ] Daily stats aggregated
- [ ] Wallet analytics updated
- [ ] Health checks logged

### Analytics & Metrics

- [ ] API endpoints respond
- [ ] `/api/analytics/overview` works
- [ ] `/api/analytics/swaps` returns data
- [ ] `/api/analytics/fees` calculates correctly
- [ ] `/api/monitoring/stats` shows current state

### Prometheus & Grafana

- [ ] Metrics endpoint exposes data
- [ ] Grafana connects to Prometheus
- [ ] Dashboard displays metrics
- [ ] Graphs update in real-time
- [ ] Alerts configured

### Frontend Integration

- [ ] SwapWithAI component loads
- [ ] Wallet connection works
- [ ] Swap execution successful
- [ ] RevenueAnalytics dashboard shows data
- [ ] Error handling works

---

## 🧪 Test Scenarios

### Scenario 1: First-Time User Swap

**Setup**: New wallet with no history

**Steps**:
1. Connect wallet
2. Approve USDC
3. Execute swap for 100 USDC
4. Service: LIQUIDITY_RAMP

**Expected**:
- ✅ AI Risk Engine: Low score (~20-30)
- ✅ Swap executes successfully
- ✅ User receives ~99.5 BEZ (after 0.5% fee)
- ✅ Fee (0.5 USDC) sent to treasury
- ✅ Event detected by monitor
- ✅ Discord notification sent
- ✅ Database updated
- ✅ No service delivery triggered (LIQUIDITY_RAMP)

### Scenario 2: NFT Purchase

**Setup**: Existing wallet with history

**Steps**:
1. Execute swap for 500 USDC
2. Service: NFT_PURCHASE

**Expected**:
- ✅ Risk assessment considers history
- ✅ Swap executes
- ✅ Fee collected
- ✅ Service delivery triggered
- ✅ `deliver-nft` event emitted
- ✅ NFT minting service called
- ✅ Delivery status tracked in DB
- ✅ User notified of NFT

### Scenario 3: High-Value Transaction

**Setup**: Whale wallet

**Steps**:
1. Execute swap for 10,000 USDC
2. Service: PREMIUM_SUBSCRIPTION

**Expected**:
- ✅ High-value alert triggered ($5000+ threshold)
- ✅ Special notification to ops channel
- ✅ Extra validation checks
- ✅ Subscription service delivery
- ✅ Premium status activated
- ✅ Confirmation email sent

### Scenario 4: Suspicious Activity

**Setup**: New wallet trying large swap

**Steps**:
1. New address
2. No transaction history
3. Attempt 5,000 USDC swap

**Expected**:
- ✅ AI Risk Engine: High score (> 70)
- ✅ Swap blocked by gatekeeper
- ✅ User shown error message
- ✅ Risk alert sent to ops
- ✅ Event logged in alerts table
- ✅ No funds transferred

### Scenario 5: System Recovery

**Setup**: Monitor crashes during swap

**Steps**:
1. Stop monitor
2. Execute 5 swaps
3. Restart monitor

**Expected**:
- ✅ Historical event query catches up
- ✅ Missed events processed
- ✅ Database synced
- ✅ No data loss
- ✅ Recovery notification sent

---

## 🔍 Debugging

### Check Contract State

```bash
# Using Hardhat console
npx hardhat console --network mumbai

# In console:
const Ramp = await ethers.getContractFactory('BezLiquidityRamp');
const ramp = await Ramp.attach('YOUR_CONTRACT_ADDRESS');

// Get stats
const stats = await ramp.getStats();
console.log('Volume:', stats[0].toString());
console.log('Fees:', stats[1].toString());
console.log('Swaps:', stats[2].toString());

// Check treasury
const treasury = await ramp.treasury();
console.log('Treasury:', treasury);

// Check roles
const SIGNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SIGNER_ROLE'));
const hasSigner = await ramp.hasRole(SIGNER_ROLE, 'YOUR_ADDRESS');
console.log('Has Signer Role:', hasSigner);
```

### Check Database

```bash
# Connect to database
npx prisma studio

# Or query directly
node -e "
const { getDatabaseService } = require('./backend/services/databaseService');
(async () => {
  const db = getDatabaseService();
  const swaps = await db.getSwaps({ limit: 10 });
  console.log('Recent swaps:', swaps);
})();
"
```

### Check Event Listener

```bash
# Test standalone
node -e "
const { getEventListener } = require('./backend/services/revenueEventListener');
(async () => {
  const listener = getEventListener({
    rpcUrl: process.env.MUMBAI_RPC_URL,
    contractAddress: process.env.MUMBAI_CONTRACT_ADDRESS
  });
  await listener.start();
  console.log('Listening for events...');
})();
"
```

### View Logs

```bash
# PM2 logs
pm2 logs revenue-monitor --lines 100

# Or direct output
tail -f logs/revenue-monitor-out.log
tail -f logs/revenue-monitor-err.log
```

---

## 📊 Performance Metrics

### Expected Latencies

| Operation | Target | Acceptable |
|-----------|--------|-----------|
| Swap execution | < 5s | < 10s |
| Event detection | < 30s | < 60s |
| Database write | < 100ms | < 500ms |
| Notification delivery | < 1min | < 5min |
| API response | < 200ms | < 1s |

### Resource Usage

| Component | CPU | Memory | Network |
|-----------|-----|--------|---------|
| Monitor | < 5% | < 100MB | < 1MB/min |
| Database | < 10% | < 500MB | - |
| API | < 5% | < 200MB | Variable |

---

## 🐛 Common Issues

### Issue: RPC Connection Failed

**Symptoms**: Monitor can't connect

**Solutions**:
```bash
# Test RPC
curl $MUMBAI_RPC_URL \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Use backup RPC
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com \
node backend/scripts/monitorRevenue.js
```

### Issue: Transaction Reverted

**Symptoms**: Swap fails with revert

**Check**:
1. USDC balance sufficient
2. USDC approved
3. Contract has BEZ tokens
4. Signature valid
5. Deadline not expired

```bash
# Check balances
npx hardhat console --network mumbai
const usdc = await ethers.getContractAt('IERC20', 'USDC_ADDRESS');
const balance = await usdc.balanceOf('YOUR_ADDRESS');
console.log('Balance:', balance.toString());
```

### Issue: Events Not Detected

**Symptoms**: Swaps execute but monitor doesn't see them

**Solutions**:
1. Check contract address in .env
2. Verify RPC supports event logs
3. Check fromBlock is not too old
4. Restart monitor

```bash
# Query events manually
node -e "
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider(process.env.MUMBAI_RPC_URL);
(async () => {
  const logs = await provider.getLogs({
    address: 'CONTRACT_ADDRESS',
    fromBlock: -1000,
    toBlock: 'latest'
  });
  console.log('Events found:', logs.length);
})();
"
```

---

## ✅ Pre-Mainnet Checklist

Antes de deployar a mainnet, asegúrate de que:

### Smart Contracts
- [ ] All tests passing on Mumbai
- [ ] Security audit completed
- [ ] Gas optimizations done
- [ ] Emergency pause tested
- [ ] Role management verified

### Backend
- [ ] 1000+ test swaps processed
- [ ] Zero data loss in 24h run
- [ ] All notifications working
- [ ] Database queries optimized
- [ ] Error handling robust

### Monitoring
- [ ] Event listener stable for 72h
- [ ] Auto-reconnect works
- [ ] Health checks passing
- [ ] Metrics accurate
- [ ] Alerts timely

### Infrastructure
- [ ] PM2 configured for production
- [ ] Database backups automated
- [ ] Grafana dashboards ready
- [ ] On-call rotation defined
- [ ] Incident response plan

### Documentation
- [ ] All guides updated
- [ ] Runbook complete
- [ ] API docs current
- [ ] Team trained

---

## 🎓 Learning Resources

### Mumbai Testnet
- Faucet: https://faucet.polygon.technology/
- Explorer: https://mumbai.polygonscan.com/
- RPC: https://rpc-mumbai.maticvigil.com/

### Tools
- Hardhat: https://hardhat.org/
- Ethers.js: https://docs.ethers.org/
- Prisma: https://www.prisma.io/docs/

### Community
- Discord: https://discord.gg/polygon
- Forum: https://forum.polygon.technology/

---

**Happy Testing!** 🚀

*Mumbai Testing Guide v1.0 - Enero 2026*
