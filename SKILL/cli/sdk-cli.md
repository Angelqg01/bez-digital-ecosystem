# SDK CLI Reference — BeZhas Blockchain
> Uso del SDK desde código y scripts

## Instalación
```javascript
const BeZhasSDK = require('./sdk/bezhas-sdk');
const sdk = new BeZhasSDK('http://localhost:3001');
```

## Autenticación
```javascript
await sdk.setAuthToken('jwt-token-here');
// O login directo si implementado
```

## Wallet Methods
```javascript
// Crear SmartWallet
const wallet = await sdk.createSmartWallet(guardians, dailyLimit);

// Listar mis wallets
const wallets = await sdk.getMySmartWallets();

// Info de wallet
const info = await sdk.getSmartWalletInfo(walletAddress);

// Portfolio (balance + tokens)
const portfolio = await sdk.getWalletPortfolio();

// Límite diario restante
const limit = await sdk.getWalletDailyLimit(walletAddress);

// Ejecutar transacción
const tx = await sdk.executeSmartWalletTx(walletAddress, to, value, data);

// Lock/Unlock
await sdk.lockSmartWallet(walletAddress);
await sdk.unlockSmartWallet(walletAddress);
```

## MultiSig Methods
```javascript
const msInfo = await sdk.getMultiSigInfo(msAddress);
const pending = await sdk.getMultiSigPendingTxs(msAddress);
```

## Security Methods
```javascript
const status = await sdk.getSecurityStatus();
const logs = await sdk.getAuditLogs(limit);
```

## Guardian Methods
```javascript
const guardians = await sdk.getWalletGuardians(walletAddress);
const score = await sdk.getGuardianTrustScore(guardianAddress);
```

## Network Methods
```javascript
const health = await sdk.getNetworkHealth();
const stats = await sdk.getNetworkStats();
```

## Staking Methods
```javascript
const pools = await sdk.getStakingPools();
const userStake = await sdk.getStakingInfo(userAddress);
```

## Governance Methods
```javascript
const proposals = await sdk.getGovernanceProposals();
```
