# BeZhas SDK - Quick Start Guide

## Installation

### Via npm (All Platforms)

```bash
npm install @bezhas/sdk
```

### Platform-Specific Installation

#### Windows
```powershell
# Option 1: npm (Recommended)
npm install -g @bezhas/sdk

# Option 2: Direct download
# Download from GitHub Releases
```

#### Linux
```bash
# Option 1: npm
npm install -g @bezhas/sdk

# Option 2: apt (Debian/Ubuntu)
curl -fsSL https://pkg.bezhas.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/bezhas-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/bezhas-archive-keyring.gpg] https://pkg.bezhas.com/apt stable main" | sudo tee /etc/apt/sources.list.d/bezhas.list
sudo apt update
sudo apt install bezhas-sdk
```

#### macOS
```bash
# Option 1: npm
npm install -g @bezhas/sdk

# Option 2: Homebrew
brew tap bezhas/sdk
brew install bezhas-sdk
```

---

## Basic Usage

### Node.js

```javascript
const { BeZhasAPIClient } = require('@bezhas/sdk');

// Initialize client
const bezhas = new BeZhasAPIClient({
  apiUrl: 'https://api.bezhas.com',
  network: 'polygon',
  apiKey: 'your-api-key' // Optional
});

// Use services
async function example() {
  // VIP Subscriptions
  const tiers = await bezhas.vip.getTiers();
  console.log('VIP Tiers:', tiers);

  // Staking
  const stakingInfo = await bezhas.staking.getStakingInfo('0xYourAddress');
  console.log('Staking Info:', stakingInfo);

  // Payments
  const quote = await bezhas.payments.getQuote(100, 'USD', 'BEZ');
  console.log('Payment Quote:', quote);

  // RWA
  const assets = await bezhas.rwa.listAssets('0xYourAddress');
  console.log('Your Assets:', assets);

  // Logistics
  const shipments = await bezhas.logistics.listShipments();
  console.log('Shipments:', shipments);
}

example();
```

### Browser (CDN)

```html
<script src="https://cdn.bezhas.com/sdk/v2/bezhas-sdk.min.js"></script>
<script>
  const bezhas = new BeZhasSDK({
    apiUrl: 'https://api.bezhas.com',
    network: 'polygon'
  });

  // Use services
  bezhas.payments.getQuote(100, 'USD', 'BEZ')
    .then(quote => console.log('Quote:', quote));
</script>
```

---

## Service Examples

### VIP Subscriptions

```javascript
// Get available tiers
const tiers = await bezhas.vip.getTiers();

// Create subscription
const session = await bezhas.vip.createSubscription(
  'gold',
  'user@example.com'
);
console.log('Checkout URL:', session.checkoutUrl);

// Check VIP status
const status = await bezhas.vip.checkVIPStatus();
console.log('VIP Status:', status);
```

### Staking

```javascript
const { ethers } = require('ethers');

// Connect wallet
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Stake BEZ tokens
const result = await bezhas.staking.stake(1000, signer);
console.log('Staked:', result);

// Claim rewards
const claimed = await bezhas.staking.claimRewards(signer);
console.log('Claimed:', claimed);
```

### Payments

```javascript
// Get quote for crypto payment
const quote = await bezhas.payments.getQuote(100, 'USDT', 'BEZ');
console.log('You will receive:', quote.quote.toAmount, 'BEZ');

// Process Stripe payment
const payment = await bezhas.payments.processStripePayment(
  'userId',
  '0xWalletAddress',
  100,
  'user@example.com'
);
console.log('Payment URL:', payment.checkoutUrl);
```

### RWA (Real World Assets)

```javascript
// Tokenize real estate
const asset = await bezhas.rwa.tokenizeAsset({
  type: 'real_estate',
  metadata: {
    address: '123 Main St',
    city: 'New York',
    sqft: 2000
  },
  value: 500000
}, signer);

console.log('Asset Token ID:', asset.tokenId);

// List your assets
const myAssets = await bezhas.rwa.listAssets('0xYourAddress');
console.log('My Assets:', myAssets);
```

### Logistics

```javascript
// Create shipment
const shipment = await bezhas.logistics.createShipment({
  carrier: 'fedex',
  origin: { city: 'New York', country: 'US' },
  destination: { city: 'Los Angeles', country: 'US' },
  items: [{ name: 'Package', weight: 5 }]
});

console.log('Tracking Number:', shipment.trackingNumber);

// Track shipment
const tracking = await bezhas.logistics.trackShipment(shipment.shipmentId);
console.log('Status:', tracking.status);
```

### MCP Integration (AI Tools)

```javascript
// Connect to MCP server
await bezhas.mcp.connect();

// List available tools
const tools = await bezhas.mcp.listAvailableTools();
console.log('Available Tools:', tools);

// Use payment tools
const quote = await bezhas.mcp.getPaymentQuote(100, 'USD', 'BEZ');
console.log('MCP Quote:', quote);
```

---

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# API Configuration
REACT_APP_API_URL=https://api.bezhas.com
POLYGON_RPC_URL=https://polygon-bor.publicnode.com

# Contract Addresses
BEZCOIN_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
LIQUIDITY_FARMING_ADDRESS=0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26
RWA_FACTORY=0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0

# Optional
BEZHAS_API_KEY=your-api-key
MCP_SERVER_URL=http://localhost:3002
```

---

## Error Handling

All SDK methods return a consistent response format:

```javascript
const result = await bezhas.payments.getQuote(100, 'USD', 'BEZ');

if (result.success) {
  console.log('Quote:', result.quote);
} else {
  console.error('Error:', result.error);
}
```

---

## Next Steps

- [Full API Documentation](https://docs.bezhas.com/sdk)
- [Examples Repository](https://github.com/bezhas/sdk-examples)
- [Support](https://discord.gg/bezhas)

---

**Version:** 2.0.0  
**License:** MIT  
**Repository:** https://github.com/Angelqg01/BeZhas_web3
