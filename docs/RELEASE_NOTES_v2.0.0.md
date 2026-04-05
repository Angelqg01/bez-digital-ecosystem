# BeZhas SDK v2.0.0 - Platform Services Integration

## 🎉 Major Release

This release integrates all BeZhas platform services into a unified SDK with cross-platform support.

## ✨ New Features

### Service Modules (7 new modules)

- **VIP Subscriptions** (`vip.js`) - Manage VIP tiers and subscriptions via Stripe
  - Create/cancel/upgrade subscriptions
  - Check VIP status
  - Payment history tracking

- **Staking** (`staking.js`) - Stake BEZ tokens and claim rewards
  - Stake/unstake BEZ tokens
  - Real-time reward calculation
  - APY estimation

- **Payments** (`payments.js`) - Process Stripe and crypto payments
  - Multi-currency support (USDT, USDC, MATIC)
  - Real-time quotes
  - Transaction tracking

- **RWA** (`rwa.js`) - Tokenize real-world assets
  - Real estate tokenization
  - Vehicle tokenization
  - Asset verification system

- **Logistics** (`logistics.js`) - Manage shipments
  - Multi-carrier support (Maersk, FedEx, DHL)
  - Real-time tracking
  - Label generation

- **MCP Integration** (`mcp-integration.js`) - AI-powered automation
  - 5 payment tools integrated
  - Tool discovery
  - Async execution support

- **API Client** (`api-client.js`) - Unified client wrapper
  - Single initialization for all services
  - Health check for all endpoints
  - Consistent error handling

### Platform Support

✅ **Windows** (x64, ARM64)
- npm installation
- Direct download option
- .msi installer (planned)

✅ **Linux** (x64, ARM64)
- npm installation
- apt package (Debian/Ubuntu)
- yum package (RHEL/CentOS/Fedora)

✅ **macOS** (Intel, Apple Silicon)
- npm installation
- Homebrew tap
- Native Apple Silicon support

### Installation Methods

```bash
# npm
npm install @bezhas/sdk

# pnpm
pnpm add @bezhas/sdk

# yarn
yarn add @bezhas/sdk
```

**Browser CDN:**
```html
<script src="https://cdn.bezhas.com/sdk/v2/bezhas-sdk.min.js"></script>
```

## 📚 Documentation

- [Quick Start Guide](./sdk/QUICKSTART.md)
- [API Documentation](./sdk/README.md)
- [SDK Integration Plan](./sdk_integration_plan.md)
- [Implementation Walkthrough](./sdk_walkthrough.md)

## 🔧 Usage Example

```javascript
const { BeZhasAPIClient } = require('@bezhas/sdk');

// Initialize client
const bezhas = new BeZhasAPIClient({
  apiUrl: 'https://api.bezhas.com',
  network: 'polygon',
  apiKey: 'your-api-key' // Optional
});

// VIP Subscriptions
const tiers = await bezhas.vip.getTiers();
const session = await bezhas.vip.createSubscription('gold', 'user@example.com');

// Staking
const { ethers } = require('ethers');
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const result = await bezhas.staking.stake(1000, signer);

// Payments
const quote = await bezhas.payments.getQuote(100, 'USD', 'BEZ');
const payment = await bezhas.payments.processStripePayment(
  'userId',
  '0xWallet',
  100,
  'user@example.com'
);

// RWA
const asset = await bezhas.rwa.tokenizeAsset({
  type: 'real_estate',
  metadata: { address: '123 Main St', city: 'New York' },
  value: 500000
}, signer);

// Logistics
const shipment = await bezhas.logistics.createShipment({
  carrier: 'fedex',
  origin: { city: 'New York', country: 'US' },
  destination: { city: 'Los Angeles', country: 'US' },
  items: [{ name: 'Package', weight: 5 }]
});

// MCP Integration
await bezhas.mcp.connect();
const tools = await bezhas.mcp.listAvailableTools();
```

## 📦 Package Details

- **Name:** `@bezhas/sdk`
- **Version:** 2.0.0
- **Size:** 69.1 kB (compressed) / 474.4 kB (unpacked)
- **Files:** 36 files
- **Dependencies:** axios ^1.6.0, ethers ^6.0.0
- **Node.js:** >=16.0.0
- **License:** MIT

## 🔗 Links

- **npm:** https://www.npmjs.com/package/@bezhas/sdk
- **Repository:** https://github.com/Angelqg01/BeZhas_web3
- **Documentation:** https://docs.bezhas.com/sdk
- **Issues:** https://github.com/Angelqg01/BeZhas_web3/issues
- **Discord:** https://discord.gg/bezhas

## 🏗️ Architecture

### Smart Contract Integration

| Service | Contract | Network |
|---------|----------|---------|
| BEZ Token | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` | Polygon Mainnet |
| Staking | `0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26` | Polygon Mainnet |
| RWA Factory | `0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0` | Polygon Mainnet |
| Governance | `0x304Fd77f64C03482edcec0923f0Cd4A066a305F3` | Polygon Mainnet |

### Backend Services

All SDK modules integrate with BeZhas backend services:
- VIP: `/api/vip/*`
- Payments: `/api/crypto/*`, `/api/stripe/*`
- Logistics: `/api/logistics/*`
- MCP: `http://localhost:3002` (configurable)

## 🧪 Testing

```bash
# Install SDK
npm install @bezhas/sdk

# Test in Node.js
node -e "const sdk = require('@bezhas/sdk'); console.log(Object.keys(sdk));"

# Expected output:
# [
#   'BeZhas',
#   'VIPSubscriptionManager',
#   'StakingManager',
#   'PaymentsManager',
#   'RWAManager',
#   'LogisticsManager',
#   'MCPClient',
#   'modules',
#   'contracts',
#   ...
# ]
```

## 🔄 Migration from v1.x

If you're upgrading from v1.x:

```javascript
// v1.x
const BeZhas = require('@bezhas/sdk');
const sdk = new BeZhas({ network: 'polygon' });

// v2.0
const { BeZhasAPIClient } = require('@bezhas/sdk');
const sdk = new BeZhasAPIClient({ 
  apiUrl: 'https://api.bezhas.com',
  network: 'polygon' 
});

// New services available
sdk.vip
sdk.staking
sdk.payments
sdk.rwa
sdk.logistics
sdk.mcp
```

## 🙏 Contributors

- **BeZhas Enterprise DAO** - Core development
- **Community Contributors** - Testing and feedback

## 📝 Changelog

### Added
- VIP Subscriptions module with Stripe integration
- Staking module for BEZ token staking
- Payments module for Stripe and crypto payments
- RWA module for real-world asset tokenization
- Logistics module for shipment management
- MCP Integration module for AI automation
- Unified API Client wrapper
- Cross-platform installation support
- Comprehensive documentation and examples

### Changed
- Updated main entry point to export new modules
- Enhanced error handling across all modules
- Improved TypeScript support with better type inference

### Fixed
- Various bug fixes and performance improvements

---

**Full Changelog:** https://github.com/Angelqg01/BeZhas_web3/compare/v1.0.0...v2.0.0

---

**Released:** February 9, 2026  
**Commit:** `99c65d4`
