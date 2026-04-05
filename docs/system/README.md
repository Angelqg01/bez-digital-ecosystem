# BeZhas Web3 Platform Documentation

## Overview

BeZhas is a comprehensive Web3 platform that combines NFT marketplace functionality, DeFi staking, gamification features, and advanced user management. Built on Ethereum blockchain with modern React frontend and robust smart contract architecture.

## Table of Contents

- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [API Reference](#api-reference)
- [SDK Usage](#sdk-usage)
- [Frontend Components](#frontend-components)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- MetaMask or compatible Web3 wallet
- Ethereum testnet ETH for testing

### Installation

1. Clone the repository:
```bash
git clone https://github.com/bezhas/bezhas-web3.git
cd bezhas-web3
```

2. Install dependencies:
```bash
# Install frontend dependencies
cd frontend
npm install

# Install API dependencies
cd ../api
npm install

# Install SDK dependencies
cd ../sdk
npm install
```

3. Configure environment variables:
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
REACT_APP_INFURA_PROJECT_ID=your_infura_project_id
REACT_APP_CONTRACT_ADDRESS=deployed_contract_address
PRIVATE_KEY=your_private_key_for_deployment
```

4. Start development servers:
```bash
# Start frontend (port 3000)
cd frontend
npm start

# Start API server (port 3001)
cd ../api
npm run dev
```

## Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Server    │    │ Smart Contracts │
│   (React)       │◄──►│   (Express)     │◄──►│   (Solidity)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web3 SDK     │    │   Database      │    │   IPFS Storage  │
│   (JavaScript)  │    │   (MongoDB)     │    │   (Metadata)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

1. **Smart Contracts**: Core blockchain logic
2. **Frontend**: User interface and Web3 integration
3. **API Server**: Backend services and data management
4. **SDK**: Developer tools and integration library
5. **Database**: Off-chain data storage
6. **IPFS**: Decentralized file storage

## Smart Contracts

### Core Contracts

#### BezhasToken (ERC-20)
Main utility token for the platform.

```solidity
// Key functions
function transfer(address to, uint256 amount) external returns (bool)
function approve(address spender, uint256 amount) external returns (bool)
function stake(uint256 amount) external
function unstake(uint256 amount) external
```

#### BezhasNFT (ERC-721)
NFT collection contract with marketplace integration.

```solidity
// Key functions
function mint(address to, string memory tokenURI) external
function setApprovalForAll(address operator, bool approved) external
function transferFrom(address from, address to, uint256 tokenId) external
```

#### Marketplace
Decentralized marketplace for trading NFTs.

```solidity
// Key functions
function listItem(uint256 tokenId, uint256 price) external
function buyItem(uint256 tokenId) external payable
function cancelListing(uint256 tokenId) external
```

#### StakingPool
Token staking with rewards distribution.

```solidity
// Key functions
function stake(uint256 amount) external
function unstake(uint256 amount) external
function claimRewards() external
function getStakedAmount(address user) external view returns (uint256)
```

#### GamificationSystem
Achievement and leveling system.

```solidity
// Key functions
function awardPoints(address user, uint256 points) external
function unlockAchievement(address user, uint256 achievementId) external
function joinChallenge(uint256 challengeId) external
function getUserProfile(address user) external view returns (UserProfile memory)
```

### Contract Addresses

#### Mainnet
- BezhasToken: `0x...`
- BezhasNFT: `0x...`
- Marketplace: `0x...`
- StakingPool: `0x...`
- GamificationSystem: `0x...`

#### Testnet (Sepolia)
- BezhasToken: `0x...`
- BezhasNFT: `0x...`
- Marketplace: `0x...`
- StakingPool: `0x...`
- GamificationSystem: `0x...`

## API Reference

### Base URL
- Production: `https://api.bezhas.com`
- Development: `http://localhost:3001`

### Authentication

All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

To obtain a token, sign a message with your wallet and call the login endpoint.

### Endpoints

#### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "address": "0x...",
  "signature": "0x...",
  "message": "Login to BeZhas at 2024-01-01T00:00:00.000Z"
}
```

#### User Profile
```http
GET /api/user/profile/:address
PUT /api/user/profile (authenticated)
```

#### NFTs
```http
GET /api/nfts?page=1&limit=20&category=art
GET /api/nfts/:id
```

#### Market Data
```http
GET /api/market/stats
GET /api/market/collections
```

#### Gamification
```http
GET /api/gamification/profile/:address
GET /api/gamification/leaderboard/:type
```

#### Analytics
```http
GET /api/analytics/platform (authenticated)
GET /api/analytics/user/:address
```

### Rate Limiting

- General endpoints: 100 requests per 15 minutes
- Sensitive endpoints: 10 requests per 15 minutes

### Error Responses

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "errors": [
    {
      "field": "field_name",
      "message": "Field-specific error"
    }
  ]
}
```

## SDK Usage

### Installation

```bash
npm install bezhas-sdk
```

### Basic Usage

```javascript
import BeZhasSDK from 'bezhas-sdk';

// Initialize SDK
const sdk = new BeZhasSDK({
  network: 'mainnet', // or 'testnet'
  apiUrl: 'https://api.bezhas.com'
});

// Connect wallet
const connection = await sdk.connectWallet('metamask');
if (connection.success) {
  console.log('Connected:', connection.address);
}

// Get token balance
const balance = await sdk.getTokenBalance();
console.log('Balance:', balance.balance, 'BEZ');

// Transfer tokens
const transfer = await sdk.transferTokens('0x...', '10');
if (transfer.success) {
  console.log('Transfer successful:', transfer.txHash);
}
```

### Advanced Features

#### NFT Operations
```javascript
// Get user's NFTs
const nfts = await sdk.getNFTsByOwner();

// Mint new NFT
const mint = await sdk.mintNFT('0x...', 'ipfs://...');

// List NFT on marketplace
const listing = await sdk.listNFT(tokenId, '1.5');
```

#### Staking Operations
```javascript
// Stake tokens
const stake = await sdk.stakeTokens('100');

// Check staking info
const info = await sdk.getStakingInfo();
console.log('Staked:', info.stakedAmount);
console.log('Rewards:', info.pendingRewards);

// Claim rewards
const claim = await sdk.claimRewards();
```

#### Gamification
```javascript
// Get user profile
const profile = await sdk.getUserProfile();
console.log('Level:', profile.profile.level);
console.log('Points:', profile.profile.totalPoints);

// Get achievements
const achievements = await sdk.getAchievements();

// Join challenge
const join = await sdk.joinChallenge(challengeId);
```

### Event Listening

```javascript
// Listen for token transfers
sdk.onTokenTransfer((from, to, amount) => {
  console.log('Token transfer:', { from, to, amount });
});

// Listen for NFT transfers
sdk.onNFTTransfer((from, to, tokenId) => {
  console.log('NFT transfer:', { from, to, tokenId });
});

// Listen for marketplace sales
sdk.onMarketplaceSale((seller, buyer, tokenId, price) => {
  console.log('NFT sold:', { seller, buyer, tokenId, price });
});
```

## Frontend Components

### Core Components

#### WalletConnect
Handles wallet connection and management.

```jsx
import { WalletConnect } from './components/WalletConnect';

<WalletConnect 
  onConnect={(address) => console.log('Connected:', address)}
  onDisconnect={() => console.log('Disconnected')}
/>
```

#### NFTMarketplace
Complete marketplace interface.

```jsx
import { NFTMarketplace } from './components/NFTMarketplace';

<NFTMarketplace 
  contracts={contracts}
  userAddress={userAddress}
/>
```

#### StakingInterface
Token staking and rewards management.

```jsx
import { StakingInterface } from './components/StakingInterface';

<StakingInterface 
  stakingContract={stakingContract}
  tokenContract={tokenContract}
  userAddress={userAddress}
/>
```

#### GamificationHub
User profile, achievements, and challenges.

```jsx
import { GamificationHub } from './components/GamificationHub';

<GamificationHub 
  gamificationContract={gamificationContract}
  userAddress={userAddress}
/>
```

### Styling

Components use CSS modules for styling. Import the corresponding CSS file:

```jsx
import styles from './Component.module.css';
```

## Deployment

### Smart Contracts

1. Compile contracts:
```bash
cd contracts
npx hardhat compile
```

2. Deploy to testnet:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

3. Verify contracts:
```bash
npx hardhat verify --network sepolia CONTRACT_ADDRESS
```

### Frontend

1. Build for production:
```bash
cd frontend
npm run build
```

2. Deploy to hosting service:
```bash
# Example: Deploy to Netlify
npm install -g netlify-cli
netlify deploy --prod --dir=build
```

### API Server

1. Set production environment variables
2. Deploy to cloud service (AWS, Heroku, etc.)
3. Configure database connection
4. Set up SSL certificate

### Environment Variables

#### Frontend (.env)
```
REACT_APP_INFURA_PROJECT_ID=your_infura_id
REACT_APP_CONTRACT_ADDRESS=deployed_contract_address
REACT_APP_API_URL=https://api.bezhas.com
REACT_APP_NETWORK=mainnet
```

#### API (.env)
```
NODE_ENV=production
PORT=3001
JWT_SECRET=your_jwt_secret
DATABASE_URL=mongodb://localhost:27017/bezhas
REDIS_URL=redis://localhost:6379
INFURA_PROJECT_ID=your_infura_id
PRIVATE_KEY=deployment_private_key
```

## Security

### Smart Contract Security

1. **Access Control**: Role-based permissions using OpenZeppelin AccessControl
2. **Reentrancy Protection**: ReentrancyGuard on state-changing functions
3. **Pausability**: Emergency pause functionality for critical contracts
4. **Input Validation**: Comprehensive validation of all inputs
5. **Audit**: Regular security audits by third-party firms

### API Security

1. **Authentication**: JWT-based authentication with wallet signatures
2. **Rate Limiting**: Protection against DDoS and abuse
3. **Input Validation**: Sanitization and validation of all inputs
4. **CORS**: Restricted cross-origin requests
5. **Helmet**: Security headers and CSP policies

### Frontend Security

1. **CSP**: Content Security Policy headers
2. **Input Sanitization**: XSS protection
3. **Secure Storage**: Encrypted local storage for sensitive data
4. **HTTPS**: Enforced secure connections
5. **Wallet Security**: Best practices for wallet integration

### Best Practices

1. Never store private keys in code or config files
2. Use environment variables for sensitive configuration
3. Implement proper error handling without exposing sensitive information
4. Regular security updates and dependency audits
5. Multi-signature wallets for contract administration

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards

- Use ESLint and Prettier for code formatting
- Follow Solidity style guide for smart contracts
- Write comprehensive tests for all new features
- Document all public functions and components
- Use semantic commit messages

### Testing

```bash
# Run frontend tests
cd frontend
npm test

# Run API tests
cd api
npm test

# Run smart contract tests
cd contracts
npx hardhat test
```

### Pull Request Process

1. Update documentation for any new features
2. Add tests that cover the new functionality
3. Ensure CI/CD pipeline passes
4. Request review from maintainers
5. Address any feedback or requested changes

## Support

- Documentation: https://docs.bezhas.com
- Discord: https://discord.gg/bezhas
- Twitter: @BeZhasOfficial
- Email: support@bezhas.com

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
