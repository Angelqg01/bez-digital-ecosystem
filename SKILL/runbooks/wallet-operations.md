# Runbook: Wallet Operations
> Procedimientos para operaciones de wallet, staking, farming, DAO

## SmartWallet — Crear Wallet

### Via SDK
```javascript
const sdk = new BeZhasSDK({ apiUrl: 'http://localhost:3001' });
sdk.setAuthToken(jwt);
const result = await sdk.createSmartWallet('0xGuardianAddr', 100); // 100 ETH daily limit
// → { success: true, walletAddress: '0x...', txHash: '0x...' }
```

### Via API
```bash
POST /api/wallet/create
Authorization: Bearer <jwt>
Body: { "guardian": "0x...", "dailyLimit": 100 }
```

## SmartWallet — Ejecutar Transacción

### Directa (owner conectado)
```javascript
await sdk.executeSmartWalletTx(walletAddr, targetAddr, '1.0', '0x');
```

### Por firma (meta-tx, gasless)
```javascript
// La wallet firma, un relayer envía
const hash = ethers.solidityPackedKeccak256(
  ['address','address','uint256','bytes','uint256','uint256'],
  [walletAddr, target, value, data, nonce, chainId]
);
const signature = await signer.signMessage(ethers.getBytes(hash));
```

## MultiSig — Flujo de Aprobación

### 1. Submitter crea transacción
```solidity
msig.submitTransaction(target, value, data, "Descripción");
// Auto-confirms (1/N)
```

### 2. Otros firmantes confirman
```solidity
msig.confirmTransaction(txId);
// Cuando confirmaciones >= required → ejecutable
```

### 3. Ejecución
```solidity
msig.executeTransaction(txId);
// Si value > largeOpThreshold → esperar timelock (48h)
```

## Staking

### Stake BEZ
```javascript
// 1. Approve tokens
await bezToken.approve(stakingPoolAddr, amount);
// 2. Stake
await stakingPool.stake(amount);
```

### Claim Rewards
```javascript
await stakingPool.getReward();
```

### Exit (unstake + claim)
```javascript
await stakingPool.exit();
```

## Farming

### Deposit LP
```javascript
await lpToken.approve(farmingAddr, amount);
await farming.deposit(poolId, amount);
```

### Claim BEZ
```javascript
await farming.deposit(poolId, 0); // claim sin depositar
```

## Paymaster — Gas Sponsorship

### Empresa registra y deposita
```javascript
await paymaster.registerEnterprise(dailyLimit, maxGasPerTx);
await bez.approve(paymasterAddr, amount);
await paymaster.deposit(amount);
```

### Empresa autoriza usuarios y contratos
```javascript
await paymaster.addUser(userAddr);
await paymaster.whitelistContract(contractAddr);
```

### Relayer ejecuta sponsorship
```javascript
await paymaster.sponsorGas(enterprise, user, target, gasCost);
```

## Emergencies

### Bloquear wallet
```javascript
// Owner o Guardian
await smartWallet.lockWallet();
```

### Pausa global
```javascript
// Cualquier guardian
await securityModule.activateGlobalPause();
```

### Recovery social
```javascript
// Guardian inicia (72h delay)
await smartWallet.initiateRecovery(newOwnerAddr);
// Después de 72h, guardian ejecuta
await smartWallet.executeRecovery();
// Owner puede cancelar en cualquier momento
await smartWallet.cancelRecovery();
```
