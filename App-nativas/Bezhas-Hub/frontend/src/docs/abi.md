# Smart Contracts ABI

Interfaces de los contratos inteligentes de BeZhas. Para desarrolladores blockchain.

## Contratos principales

### BeZhasPayment.sol

Procesa pagos en BEZ.

**Address**:
- Polygon: `0x89c23890c742d710265dD61be789C71dC8999b12`
- BSC: `0x89c23890c742d710265dD61be789C71dC8999b12`

**Funciones clave**:

```solidity
function createPayment(
  address merchant,
  uint256 amount,
  bytes32 orderId,
  bytes calldata metadata
) external returns (bytes32 paymentId);

function settlePayment(bytes32 paymentId) external;

function getPaymentStatus(bytes32 paymentId) 
  external view returns (PaymentStatus);
```

### BeZhasSettlement.sol

Liquida pagos y gestiona staking.

```solidity
function settle(bytes32 paymentId, bool includeStaking) 
  external returns (uint256 settled, uint256 staking);

function getMerchantBalance(address merchant) 
  external view returns (uint256);

function stakingRewards(address merchant) 
  external view returns (uint256);
```

### BezhasToken (ERC-20)

Token BEZ nativo.

```solidity
function transfer(address to, uint256 amount) 
  external returns (bool);

function approve(address spender, uint256 amount) 
  external returns (bool);

function balanceOf(address account) 
  external view returns (uint256);
```

## ABIs JSON

Descarga desde:
```
https://bez.digital/contracts/abi/BeZhasPayment.json
https://bez.digital/contracts/abi/BeZhasSettlement.json
https://bez.digital/contracts/abi/BezhasToken.json
```

## Uso con ethers.js

```javascript
import { ethers } from 'ethers';
import BeZhasPaymentABI from '@bezhas/contracts/abi/BeZhasPayment.json';

const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
const contract = new ethers.Contract(
  '0x89c23890c742d710265dD61be789C71dC8999b12',
  BeZhasPaymentABI,
  provider
);

// Leer estado
const status = await contract.getPaymentStatus(paymentId);

// Escribir transacción (requiere wallet)
const signer = provider.getSigner();
const contractWithSigner = contract.connect(signer);
const tx = await contractWithSigner.settlePayment(paymentId);
```

## Uso con web3.js

```javascript
import Web3 from 'web3';
import BeZhasPaymentABI from '@bezhas/contracts/abi/BeZhasPayment.json';

const web3 = new Web3('https://polygon-rpc.com');
const contract = new web3.eth.Contract(
  BeZhasPaymentABI,
  '0x89c23890c742d710265dD61be789C71dC8999b12'
);

// Leer
const status = await contract.methods.getPaymentStatus(paymentId).call();
```

## Eventos (Logs)

```solidity
event PaymentCreated(
  bytes32 indexed paymentId,
  address indexed merchant,
  uint256 amount,
  uint256 timestamp
);

event PaymentSettled(
  bytes32 indexed paymentId,
  uint256 settled,
  uint256 staking,
  bytes32 txHash
);

event StakingRewardClaimed(
  address indexed merchant,
  uint256 reward
);
```

Escuchar eventos:

```javascript
contract.on('PaymentSettled', (paymentId, settled, staking) => {
  console.log('Pago liquidado:', paymentId, settled);
});
```

## Documentación Solidity

Código fuente comentado:
https://github.com/bezhas/smart-contracts

## Auditoría

Auditoría de seguridad: 
- Realizada por: CertiK
- Fecha: 2026-05-15
- Resultado: ✅ PASS

Reporte: https://bez.digital/contracts/audit-report.pdf

## Testnet

**Polygon Mumbai**:
- BeZhasPayment: `0x...`
- BeZhasSettlement: `0x...`

**BSC Testnet**:
- BeZhasPayment: `0x...`

Faucet de test BEZ: https://bez.digital/faucet
