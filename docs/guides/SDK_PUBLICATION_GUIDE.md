# BeZhas SDK - Publication Guide

## 📦 SDK Publication Status

**Version:** 2.0.0  
**Package Name:** `@bezhas/sdk`  
**Status:** ✅ Ready for Publication  
**Size:** 69.1 kB (compressed) / 474.4 kB (unpacked)  
**Files:** 36 files included

---

## 🔑 Step 1: Authenticate with npm

### Option A: Interactive Login (Recommended)

```bash
npm login
```

You'll be prompted for:
- **Username:** Your npm username
- **Password:** Your npm password
- **Email:** Your npm email
- **OTP (if enabled):** Two-factor authentication code

### Option B: Using Access Token

If you have an npm access token:

```bash
# Set the token
npm config set //registry.npmjs.org/:_authToken YOUR_NPM_TOKEN

# Or add to .npmrc file
echo "//registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN" >> ~/.npmrc
```

To create a token:
1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click "Generate New Token"
3. Select "Automation" or "Publish"
4. Copy the token

---

## 📤 Step 2: Publish to npm

```bash
cd sdk
npm publish --access public
```

**Expected Output:**
```
npm notice 📦  @bezhas/sdk@2.0.0
npm notice === Tarball Contents ===
npm notice 36 files
npm notice === Tarball Details ===
npm notice name:          @bezhas/sdk
npm notice version:       2.0.0
npm notice package size:  69.1 kB
npm notice unpacked size: 474.4 kB
npm notice total files:   36
+ @bezhas/sdk@2.0.0
```

---

## 📤 Step 3: Publish to pnpm (Optional)

pnpm uses the same npm registry, so the package will be automatically available:

```bash
# Verify it's available
pnpm view @bezhas/sdk

# Or explicitly publish
cd sdk
pnpm publish --access public --no-git-checks
```

---

## ✅ Step 4: Verify Publication

### Check on npm

```bash
# View package info
npm view @bezhas/sdk

# Install and test
npm install @bezhas/sdk
```

### Check on npmjs.com

Visit: https://www.npmjs.com/package/@bezhas/sdk

---

## 🏷️ Step 5: Create GitHub Release

### Using GitHub CLI (gh)

```bash
# Create release
gh release create v2.0.0 \
  --title "BeZhas SDK v2.0.0 - Platform Services Integration" \
  --notes "$(cat RELEASE_NOTES.md)"

# Or create manually on GitHub
```

### Manual Release on GitHub

1. Go to: https://github.com/Angelqg01/BeZhas_web3/releases/new
2. Tag: `v2.0.0`
3. Title: `BeZhas SDK v2.0.0 - Platform Services Integration`
4. Description: See RELEASE_NOTES.md below

---

## 📝 Release Notes Template

```markdown
# BeZhas SDK v2.0.0 - Platform Services Integration

## 🎉 Major Release

This release integrates all BeZhas platform services into a unified SDK with cross-platform support.

## ✨ New Features

### Service Modules (7 new modules)

- **VIP Subscriptions** (`vip.js`) - Manage VIP tiers and subscriptions via Stripe
- **Staking** (`staking.js`) - Stake BEZ tokens and claim rewards
- **Payments** (`payments.js`) - Process Stripe and crypto payments (USDT, USDC, MATIC)
- **RWA** (`rwa.js`) - Tokenize real-world assets (real estate, vehicles, art)
- **Logistics** (`logistics.js`) - Manage shipments with Maersk, FedEx, DHL
- **MCP Integration** (`mcp-integration.js`) - AI-powered automation tools
- **API Client** (`api-client.js`) - Unified client wrapper for all services

### Platform Support

- ✅ Windows (x64, ARM64)
- ✅ Linux (x64, ARM64)
- ✅ macOS (Intel, Apple Silicon)

### Installation Methods

- npm: `npm install @bezhas/sdk`
- pnpm: `pnpm add @bezhas/sdk`
- Browser CDN: `https://cdn.bezhas.com/sdk/v2/bezhas-sdk.min.js`

## 📚 Documentation

- [Quick Start Guide](./sdk/QUICKSTART.md)
- [API Documentation](./sdk/README.md)
- [Examples Repository](https://github.com/bezhas/sdk-examples)

## 🔧 Usage Example

```javascript
const { BeZhasAPIClient } = require('@bezhas/sdk');

const bezhas = new BeZhasAPIClient({
  apiUrl: 'https://api.bezhas.com',
  network: 'polygon'
});

// VIP Subscriptions
const tiers = await bezhas.vip.getTiers();

// Staking
const info = await bezhas.staking.getStakingInfo('0xAddress');

// Payments
const quote = await bezhas.payments.getQuote(100, 'USD', 'BEZ');
```

## 📦 Package Details

- **Size:** 69.1 kB (compressed) / 474.4 kB (unpacked)
- **Files:** 36 files
- **Dependencies:** axios, ethers
- **Node.js:** >=16.0.0

## 🔗 Links

- npm: https://www.npmjs.com/package/@bezhas/sdk
- Repository: https://github.com/Angelqg01/BeZhas_web3
- Documentation: https://docs.bezhas.com/sdk

## 🙏 Contributors

- BeZhas Enterprise DAO
- Community Contributors

---

**Full Changelog:** https://github.com/Angelqg01/BeZhas_web3/compare/v1.0.0...v2.0.0
```

---

## 🚀 Post-Publication Checklist

- [ ] Verify package on npmjs.com
- [ ] Test installation: `npm install @bezhas/sdk`
- [ ] Create GitHub Release v2.0.0
- [ ] Update documentation website
- [ ] Announce on social media
- [ ] Create example projects
- [ ] Update main README.md with installation instructions

---

## 🐛 Troubleshooting

### Error: ENEEDAUTH

**Solution:** Run `npm login` first

### Error: 403 Forbidden

**Solution:** Check package name is available and you have permissions

### Error: Version already exists

**Solution:** Increment version in package.json

### Error: Unclean working tree (pnpm)

**Solution:** Commit changes or use `--no-git-checks`

---

## 📞 Support

If you encounter issues:
1. Check npm logs: `~/.npm/_logs/`
2. Verify authentication: `npm whoami`
3. Check package.json is valid: `npm pack --dry-run`

---

**Last Updated:** February 9, 2026  
**Status:** Ready for Publication
