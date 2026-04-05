# 🪙 Integración BEZ-Coin en BeZhas Platform

## 📋 Información del Contrato

**Contrato Desplegado**: `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`  
**Red Blockchain**: Polygon Mainnet (Chain ID: 137)  
**Token**: BEZ-Coin (BEZ)  
**Estándar**: ERC-20  
**Suministro Total**: 3,000,000,000 BEZ (3 mil millones)  
**Decimales**: 18  
**Explorer**: https://polygonscan.com/token/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
**Verificación Sourcify**: https://repo.sourcify.dev/137/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8/
**Verificación Blockscout**: https://polygon.blockscout.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8?tab=contract
**Pool QuickSwap**: https://dapp.quickswap.exchange/pool/positions/v2/0x4edc77de01f2a2c87611c2f8e9249be43df745a9?chainId=137

### 🔧 Características del Contrato

El contrato BEZ-Coin implementa:
- ✅ **ERC-20**: Token estándar compatible con todos los wallets y exchanges
- ✅ **ERC20Burnable**: Permite quemar (burn) tokens permanentemente
- ✅ **ERC20Pausable**: El owner puede pausar/despausar transferencias
- ✅ **ERC20Permit**: Permite aprobaciones sin gas usando firmas (gasless approvals)
- ✅ **Ownable**: Control de gobernanza por el propietario

### 📜 Funciones Principales

#### Funciones de Lectura (View)
```solidity
// Balance de una dirección
balanceOf(address account) → uint256

// Suministro total circulante
totalSupply() → uint256

// Allowance aprobado
allowance(address owner, address spender) → uint256

// Información del token
name() → string ("BEZ-Coin")
symbol() → string ("BEZ")
decimals() → uint8 (18)

// Estado del contrato
paused() → bool
owner() → address
```

#### Funciones de Escritura (Transacciones)
```solidity
// Transferir tokens
transfer(address to, uint256 amount) → bool

// Transferir desde allowance
transferFrom(address from, address to, uint256 amount) → bool

// Aprobar gasto
approve(address spender, uint256 amount) → bool

// Quemar tokens propios
burn(uint256 value)

// Quemar tokens de otro (requiere allowance)
burnFrom(address account, uint256 value)
```

#### Funciones de Gobernanza (Solo Owner)
```solidity
// Acuñar nuevos tokens
mint(address to, uint256 amount)

// Pausar transferencias
pause()

// Despausar transferencias
unpause()

// Transferir propiedad
transferOwnership(address newOwner)
```

---

## 🚀 Implementación en BeZhas

### 1. Archivos Creados/Modificados

#### ✅ ABI del Contrato
**Archivo**: `frontend/src/lib/blockchain/abis/BEZCoin.json`
- ABI completo compilado desde OpenZeppelin Contracts 5.5.0
- 51 funciones + eventos + errores custom

#### ✅ Configuración de Contratos
**Archivo**: `frontend/src/lib/blockchain/contracts.js`
- Importación del ABI: `import BEZCoinABI from './abis/BEZCoin.json'`
- Export: `export const bezCoinAbi = BEZCoinABI`
- Dirección agregada a `contractAddresses.bezCoin`
- Configuración de redes Polygon y Localhost

#### ✅ Direcciones de Contratos
**Archivos actualizados**:
- `frontend/src/contract-addresses.json`: Agregado `"BEZCoinAddress"`
- `frontend/src/contract-config.js`: Export `BEZCoinAddress`

#### ✅ Servicio BEZ-Coin
**Archivo**: `frontend/src/services/bezCoin.service.js`
- Servicio completo para interactuar con BEZ-Coin
- 11 funciones exportadas (balance, transfer, approve, burn, etc.)
- Validación automática de red Polygon
- Formateo de cantidades
- Manejo de errores

#### ✅ Hook React
**Archivo**: `frontend/src/hooks/useBEZCoin.js`
- Hook personalizado `useBEZCoin()`
- Estado reactivo del balance y token info
- Detección automática de red incorrecta
- Auto-refresh cada 30 segundos
- 10+ acciones disponibles

#### ✅ Componente de Wallet
**Archivo**: `frontend/src/components/wallet/BEZWalletCard.jsx`
- UI completa para gestionar BEZ-Coin
- Mostrar balance en tiempo real
- Enviar tokens
- Quemar tokens
- Cambiar a Polygon
- Agregar token a MetaMask

---

## 💻 Uso en el Código

### Opción 1: Usar el Hook (Recomendado)

```jsx
import { useBEZCoin } from '../hooks/useBEZCoin';

function MyComponent() {
  const {
    balance,          // Balance del usuario
    tokenInfo,        // Info del token (name, symbol, totalSupply)
    networkStatus,    // Estado de la red
    loading,          // Cargando
    isConnected,      // Wallet conectada
    address,          // Dirección del usuario
    
    // Acciones
    transfer,         // Transferir BEZ
    approve,          // Aprobar gasto
    burn,             // Quemar tokens
    switchToPolygon,  // Cambiar a Polygon
    addToWallet,      // Agregar a MetaMask
    refresh,          // Refrescar datos
    
    // Utilidades
    needsNetworkSwitch,  // true si debe cambiar red
    canTransact          // true si puede hacer transacciones
  } = useBEZCoin();

  // Mostrar balance
  return (
    <div>
      <h2>Balance: {balance.display} BEZ</h2>
      
      {needsNetworkSwitch && (
        <button onClick={switchToPolygon}>
          Cambiar a Polygon
        </button>
      )}
      
      <button 
        onClick={() => transfer('0x...', '100')}
        disabled={!canTransact}
      >
        Enviar 100 BEZ
      </button>
    </div>
  );
}
```

### Opción 2: Usar el Servicio Directamente

```javascript
import bezCoinService from '../services/bezCoin.service';
import { useProvider, useSigner } from 'wagmi';

function MyComponent() {
  const provider = useProvider();
  const { data: signer } = useSigner();

  // Obtener balance
  const checkBalance = async (address) => {
    const balance = await bezCoinService.getBEZBalance(address, provider);
    console.log(balance.display); // "1,234.56"
  };

  // Transferir tokens
  const sendTokens = async () => {
    const result = await bezCoinService.transferBEZ(
      '0xRecipientAddress',
      '100', // cantidad en BEZ
      signer
    );
    
    if (result.success) {
      console.log('TX Hash:', result.txHash);
      console.log('Ver en:', result.explorerUrl);
    }
  };

  // Aprobar gasto
  const approveSpending = async () => {
    const result = await bezCoinService.approveBEZ(
      '0xContractAddress',
      '1000000', // cantidad máxima
      signer
    );
  };

  // Verificar red
  const checkNetwork = async () => {
    const status = await bezCoinService.checkNetwork(provider);
    
    if (!status.isCorrectNetwork) {
      // Cambiar a Polygon
      await bezCoinService.switchToPolygon();
    }
  };

  return <div>...</div>;
}
```

### Opción 3: Usar el Componente Completo

```jsx
import BEZWalletCard from '../components/wallet/BEZWalletCard';

function Dashboard() {
  return (
    <div>
      <h1>Mi Dashboard</h1>
      
      {/* Card completa con todas las funciones */}
      <BEZWalletCard />
    </div>
  );
}
```

---

## 🎨 Integración en la UI

### 1. Dashboard del Usuario
```jsx
// frontend/src/pages/Dashboard.jsx
import BEZWalletCard from '../components/wallet/BEZWalletCard';

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Card de BEZ-Coin */}
      <BEZWalletCard />
      
      {/* Otros componentes */}
      <StatsCard />
      <NFTGallery />
    </div>
  );
}
```

### 2. Marketplace (Pagos con BEZ)
```jsx
import { useBEZCoin } from '../hooks/useBEZCoin';

function BuyNFT({ nftPrice, nftId }) {
  const { balance, approve, canTransact } = useBEZCoin();
  const [purchasing, setPurchasing] = useState(false);

  const buyWithBEZ = async () => {
    try {
      setPurchasing(true);
      
      // 1. Aprobar gasto al contrato del marketplace
      const approvalResult = await approve(
        MARKETPLACE_CONTRACT_ADDRESS,
        nftPrice
      );
      
      if (approvalResult.success) {
        // 2. Llamar a la función de compra del marketplace
        // (el marketplace transferirá los BEZ del comprador al vendedor)
        await marketplaceContract.buyNFT(nftId);
        
        toast.success('¡NFT comprado exitosamente!');
      }
    } catch (error) {
      toast.error('Error en la compra');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div>
      <p>Precio: {nftPrice} BEZ</p>
      <p>Tu balance: {balance.display} BEZ</p>
      
      <button
        onClick={buyWithBEZ}
        disabled={!canTransact || purchasing}
      >
        {purchasing ? 'Comprando...' : 'Comprar con BEZ'}
      </button>
    </div>
  );
}
```

### 3. Sistema de Propinas (Tips)
```jsx
import { useBEZCoin } from '../hooks/useBEZCoin';

function TipButton({ recipientAddress, postId }) {
  const { transfer, canTransact } = useBEZCoin();
  const [amount, setAmount] = useState('10');

  const sendTip = async () => {
    const result = await transfer(recipientAddress, amount);
    
    if (result.success) {
      toast.success(`¡${amount} BEZ enviados! 🎉`);
      
      // Registrar en backend
      await fetch('/api/tips', {
        method: 'POST',
        body: JSON.stringify({
          postId,
          amount,
          txHash: result.txHash
        })
      });
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Cantidad BEZ"
      />
      <button onClick={sendTip} disabled={!canTransact}>
        💰 Enviar Propina
      </button>
    </div>
  );
}
```

### 4. Staking Pool
```jsx
import { useBEZCoin } from '../hooks/useBEZCoin';

function StakingPanel({ stakingPoolAddress }) {
  const { balance, approve, getAllowance } = useBEZCoin();
  const [stakeAmount, setStakeAmount] = useState('');

  const stakeTokens = async () => {
    // 1. Verificar allowance
    const allowance = await getAllowance(stakingPoolAddress);
    
    // 2. Si no hay allowance suficiente, aprobar
    if (parseFloat(allowance.formatted) < parseFloat(stakeAmount)) {
      await approve(stakingPoolAddress, stakeAmount);
    }
    
    // 3. Hacer stake en el pool
    await stakingContract.stake(ethers.parseEther(stakeAmount));
    
    toast.success(`¡${stakeAmount} BEZ en staking!`);
  };

  return (
    <div>
      <h3>Hacer Staking de BEZ</h3>
      <p>Balance disponible: {balance.display} BEZ</p>
      
      <input
        type="number"
        value={stakeAmount}
        onChange={(e) => setStakeAmount(e.target.value)}
        placeholder="Cantidad a stakear"
      />
      
      <button onClick={stakeTokens}>
        Stakear BEZ
      </button>
    </div>
  );
}
```

---

## 🔗 Integración con Backend

### 1. Verificar Transacciones de BEZ
```javascript
// backend/services/bezCoin.verification.js
const { ethers } = require('ethers');
const BEZ_COIN_ABI = require('./abis/BEZCoin.json');

const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
const bezCoinContract = new ethers.Contract(
  '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  BEZ_COIN_ABI,
  provider
);

// Verificar transacción
async function verifyBEZTransaction(txHash) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { verified: false, reason: 'Transacción no encontrada' };
    }
    
    if (receipt.status !== 1) {
      return { verified: false, reason: 'Transacción falló' };
    }
    
    // Decodificar logs para obtener Transfer event
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const transferLog = receipt.logs.find(log => 
      log.topics[0] === transferTopic &&
      log.address.toLowerCase() === '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'.toLowerCase()
    );
    
    if (transferLog) {
      const decoded = bezCoinContract.interface.parseLog(transferLog);
      
      return {
        verified: true,
        from: decoded.args.from,
        to: decoded.args.to,
        amount: ethers.formatEther(decoded.args.value),
        blockNumber: receipt.blockNumber,
        timestamp: (await provider.getBlock(receipt.blockNumber)).timestamp
      };
    }
    
    return { verified: false, reason: 'No es transacción de BEZ' };
  } catch (error) {
    console.error('Error verificando transacción:', error);
    return { verified: false, reason: error.message };
  }
}

module.exports = { verifyBEZTransaction };
```

### 2. API Endpoints para BEZ
```javascript
// backend/routes/bezCoin.routes.js
const express = require('express');
const router = express.Router();
const { verifyBEZTransaction } = require('../services/bezCoin.verification');

// Obtener información del token
router.get('/info', async (req, res) => {
  res.json({
    name: 'BEZ-Coin',
    symbol: 'BEZ',
    decimals: 18,
    totalSupply: '3000000000',
    address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    network: 'Polygon',
    chainId: 137
  });
});

// Verificar transacción
router.post('/verify-transaction', async (req, res) => {
  const { txHash } = req.body;
  
  if (!txHash) {
    return res.status(400).json({ error: 'txHash requerido' });
  }
  
  const result = await verifyBEZTransaction(txHash);
  res.json(result);
});

// Registrar compra con BEZ
router.post('/purchases', async (req, res) => {
  const { userId, itemId, amount, txHash } = req.body;
  
  // Verificar transacción
  const verification = await verifyBEZTransaction(txHash);
  
  if (!verification.verified) {
    return res.status(400).json({ 
      error: 'Transacción inválida',
      reason: verification.reason 
    });
  }
  
  // Guardar en DB
  const purchase = await Purchase.create({
    userId,
    itemId,
    amount: verification.amount,
    currency: 'BEZ',
    txHash,
    status: 'completed'
  });
  
  res.json({ success: true, purchase });
});

module.exports = router;
```

---

## 📱 Casos de Uso

### 1. **Marketplace de NFTs**
Los usuarios pueden comprar/vender NFTs usando BEZ como moneda de pago.

### 2. **Sistema de Propinas**
Enviar BEZ como propinas a creadores de contenido.

### 3. **Staking y Farming**
Stakear BEZ para ganar recompensas.

### 4. **Gobernanza DAO**
Usar BEZ como token de votación (1 BEZ = 1 voto).

### 5. **Pagos de Suscripciones**
Suscripciones mensuales pagadas en BEZ.

### 6. **Recompensas de Airdrops**
Distribuir BEZ como recompensas por completar tareas.

### 7. **Trading**
Intercambiar BEZ por otros tokens en DEXs de Polygon.

---

## 🔒 Seguridad

### Mejores Prácticas Implementadas

✅ **Validación de Red**: Verifica que el usuario esté en Polygon  
✅ **Validación de Direcciones**: Usa `ethers.isAddress()`  
✅ **Manejo de Errores**: Try-catch en todas las funciones  
✅ **Formateo Seguro**: `ethers.parseEther()` y `formatEther()`  
✅ **Loading States**: Deshabilita botones durante transacciones  
✅ **Confirmación de Transacciones**: Espera con `tx.wait()`  
✅ **Explorador de Bloques**: Links directos a PolygonScan  

### Consideraciones Importantes

⚠️ **Aprobaciones**: Limita los allowances a cantidades específicas, no MAX_UINT256  
⚠️ **Pausable**: El owner puede pausar transferencias en emergencias  
⚠️ **Mint**: Solo el owner puede acuñar nuevos tokens  
⚠️ **Burn**: Las quemas son irreversibles  

---

## 🧪 Testing

### Test en Consola del Navegador

```javascript
// Verificar que el hook funciona
const { useBEZCoin } = await import('./hooks/useBEZCoin');

// Obtener instancia del servicio
const bezCoinService = await import('./services/bezCoin.service');

// Probar funciones
const provider = new ethers.BrowserProvider(window.ethereum);
const balance = await bezCoinService.getBEZBalance('0x...', provider);
console.log('Balance:', balance.display);
```

### Test de Transacciones

1. Conectar wallet en Polygon
2. Ir a `/dashboard`
3. Ver BEZWalletCard
4. Click en "Enviar"
5. Ingresar dirección y cantidad
6. Confirmar transacción en MetaMask
7. Verificar en PolygonScan

---

## 📚 Recursos

- **Contrato en PolygonScan**: https://polygonscan.com/token/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
- **Verificación Sourcify**: https://repo.sourcify.dev/137/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8/
- **Verificación Blockscout**: https://polygon.blockscout.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8?tab=contract
- **Pool QuickSwap**: https://dapp.quickswap.exchange/pool/positions/v2/0x4edc77de01f2a2c87611c2f8e9249be43df745a9?chainId=137
- **Documentación OpenZeppelin**: https://docs.openzeppelin.com/contracts/5.x/
- **Red Polygon**: https://polygon.technology/
- **Ethers.js Docs**: https://docs.ethers.org/v6/

---

## ✅ Checklist de Implementación

- [x] ABI del contrato creado
- [x] Servicio bezCoin.service.js completo
- [x] Hook useBEZCoin.js funcional
- [x] Componente BEZWalletCard.jsx con UI
- [x] Configuración de redes (Polygon)
- [x] Validación de red automática
- [x] Formateo de cantidades
- [x] Manejo de errores
- [x] Loading states
- [x] Modales de transferencia y burn
- [x] Integración con MetaMask
- [x] Links a PolygonScan
- [x] Auto-refresh de balance
- [ ] Integrar en páginas principales
- [ ] Tests E2E
- [ ] Documentación de usuario final

---

## 🚀 Próximos Pasos

1. **Integrar BEZWalletCard** en Dashboard principal
2. **Habilitar pagos con BEZ** en Marketplace
3. **Sistema de propinas** en posts sociales
4. **Staking pool** para BEZ
5. **Trading DEX** integrado (QuickSwap/Uniswap)
6. **Graficas de precio** en tiempo real
7. **Notificaciones** de transacciones
8. **Historial** de movimientos de BEZ

---

**¡BEZ-Coin está completamente integrado y listo para usar en Polygon! 🎉**
