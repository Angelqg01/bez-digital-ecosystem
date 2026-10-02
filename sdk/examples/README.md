# BeZhas SDK - Examples

This directory contains practical examples demonstrating how to use the BeZhas SDK.

## 📁 Available Examples

### 1. VIP Subscription Example
**File:** `vip-subscription-example.js`

Demonstrates:
- Fetching VIP tiers
- Creating subscriptions
- Checking VIP status
- Upgrading/downgrading tiers
- Payment history

**Run:**
```bash
node examples/vip-subscription-example.js
```

### 2. Staking Example
**File:** `staking-example.js`

Demonstrates:
- Connecting wallet
- Staking BEZ tokens
- Claiming rewards
- Calculating APY
- Unstaking tokens

**Run:**
```bash
PRIVATE_KEY=your_private_key node examples/staking-example.js
```

### 3. Complete Platform Example
**File:** `complete-platform-example.js`

Demonstrates:
- Health check
- VIP subscriptions
- Payment processing
- Staking
- RWA tokenization
- Logistics management
- MCP AI tools

**Run:**
```bash
PRIVATE_KEY=your_private_key node examples/complete-platform-example.js
```

## 🔧 Setup

### 1. Install Dependencies

```bash
npm install @bezhas/sdk ethers dotenv
```

### 2. Create `.env` File

```bash
# API Configuration
BEZHAS_API_URL=https://api.bezhas.com
POLYGON_RPC_URL=https://polygon-bor.publicnode.com
MCP_SERVER_URL=http://localhost:3002

# Authentication (optional)
BEZHAS_API_KEY=your_api_key

# Wallet (for staking and RWA examples)
PRIVATE_KEY=your_private_key_here
```

### 3. Run Examples

```bash
# Load environment variables
source .env  # Linux/macOS
# or
set -a; source .env; set +a  # Alternative

# Run example
node examples/vip-subscription-example.js
```

## 📚 Example Structure

Each example follows this pattern:

```javascript
const { BeZhasAPIClient } = require('@bezhas/sdk');

// Initialize SDK
const bezhas = new BeZhasAPIClient({
  apiUrl: process.env.BEZHAS_API_URL,
  network: 'polygon'
});

async function example() {
  try {
    // Your code here
    const result = await bezhas.vip.getTiers();
    console.log(result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

example();
```

## 🎯 Common Use Cases

### Creating a VIP Subscription

```javascript
const subscription = await bezhas.vip.createSubscription(
  'gold',
  'user@example.com'
);

// Redirect user to checkout
window.location.href = subscription.checkoutUrl;
```

### Staking Tokens

```javascript
const { ethers } = require('ethers');

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const result = await bezhas.staking.stake(1000, signer);
console.log('Staked:', result.transactionHash);
```

### Processing Payments

```javascript
// Get quote
const quote = await bezhas.payments.getQuote(100, 'USDT', 'BEZ');

// Process payment
const payment = await bezhas.payments.processStripePayment(
  userId,
  walletAddress,
  100,
  email
);
```

### Tokenizing Real Estate

```javascript
const asset = await bezhas.rwa.tokenizeAsset({
  type: 'real_estate',
  metadata: {
    address: '123 Main St',
    city: 'New York',
    sqft: 2000
  },
  value: 500000
}, signer);
```

### Creating Shipments

```javascript
const shipment = await bezhas.logistics.createShipment({
  carrier: 'fedex',
  origin: { city: 'New York', country: 'US' },
  destination: { city: 'Los Angeles', country: 'US' },
  items: [{ name: 'Package', weight: 5 }]
});
```

## 🐛 Troubleshooting

### Error: ENEEDAUTH
**Solution:** Set `BEZHAS_API_KEY` in your `.env` file

### Error: Invalid private key
**Solution:** Ensure `PRIVATE_KEY` is set correctly (without 0x prefix)

### Error: Network error
**Solution:** Check `BEZHAS_API_URL` and ensure backend is running

### Error: Insufficient funds
**Solution:** Ensure wallet has enough MATIC for gas fees

## 📞 Support

- **Documentation:** [../QUICKSTART.md](../QUICKSTART.md)
- **Issues:** https://github.com/Angelqg01/BeZhas_web3/issues
- **Discord:** https://discord.gg/bezhas

## 📄 License

MIT
