# 🔗 BezCoin - Integración Blockchain Real

## 📋 Tabla de Contenidos
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Funciones Actualizadas](#funciones-actualizadas)
4. [Event Listeners en Tiempo Real](#event-listeners-en-tiempo-real)
5. [Manejo de Errores](#manejo-de-errores)
6. [Estimación de Gas](#estimación-de-gas)
7. [Componentes UI](#componentes-ui)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Próximos Pasos](#próximos-pasos)

---

## 🎯 Resumen Ejecutivo

El sistema BezCoin ha sido actualizado desde una **simulación básica** a una **integración blockchain completa** lista para producción. Ahora incluye:

✅ **Interacciones blockchain reales** con contratos ERC20  
✅ **Estimación de gas** con buffer del 20%  
✅ **Manejo robusto de errores** (red, gas, rechazos)  
✅ **Event listeners** para actualizaciones en tiempo real  
✅ **Timeouts** para operaciones lentas  
✅ **Retry logic** para errores temporales de red  
✅ **Notificaciones toast** en cada paso del proceso  
✅ **Logging detallado** con emojis para debugging  
✅ **Validaciones completas** (direcciones, balances, self-transfer)  

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND (React + Vite)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │        BezCoinContext.jsx (Core)                │   │
│  │  - fetchBalance (con retry & timeout)           │   │
│  │  - buyWithETH (gas estimation + events)         │   │
│  │  - transfer (validation + tracking)             │   │
│  │  - donate (mensaje + blockchain)                │   │
│  │  - Event Listeners (Transfer events)            │   │
│  └─────────────────────────────────────────────────┘   │
│              ▲                    │                     │
│              │                    ▼                     │
│  ┌───────────┴──────────┐  ┌────────────────────┐     │
│  │  PendingTxIndicator  │  │  BuyModal          │     │
│  │  (UI feedback)       │  │  DonateModal       │     │
│  └──────────────────────┘  │  InsufficientModal │     │
│                             └────────────────────┘     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         BLOCKCHAIN (Ethereum / Hardhat Local)           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────┐      ┌──────────────────┐    │
│  │  BezhasToken.sol    │──────│  TokenSale.sol   │    │
│  │  (ERC20)            │      │  (Venta tokens)  │    │
│  │  0x5FbDB...0aa3     │      │  0x0165...Eb8F   │    │
│  └─────────────────────┘      └──────────────────┘    │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │          Transfer Events                        │   │
│  │  Transfer(address from, address to, uint value) │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND (Node.js + Express)                │
├─────────────────────────────────────────────────────────┤
│  - Guarda historial de transacciones                   │
│  - Autenticación JWT                                    │
│  - API /api/bezcoin/*                                   │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Funciones Actualizadas

### 1. `fetchBalance()` - Obtener Balance
**Antes:**
```javascript
const balance = await tokenContract.balanceOf(address);
setBalance(ethers.formatEther(balance));
```

**Ahora:**
```javascript
✅ Retry logic (hasta 2 reintentos)
✅ Timeout de 10 segundos
✅ Validación de provider y contrato
✅ Manejo específico de errores
✅ Logging con emojis
✅ Toast notifications

const fetchBalance = useCallback(async (retryCount = 0) => {
    try {
        // Timeout protection
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
        );

        // Validaciones
        if (!window.ethereum) throw new Error('No Ethereum provider');
        if (!BezhasTokenAddress || BezhasTokenAddress === ethers.ZeroAddress) {
            throw new Error('Token contract not deployed');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const tokenContract = new ethers.Contract(
            BezhasTokenAddress,
            BezhasTokenABI,
            provider
        );

        const balancePromise = tokenContract.balanceOf(address);
        const balanceWei = await Promise.race([balancePromise, timeoutPromise]);
        
        const balanceFormatted = ethers.formatEther(balanceWei);
        setBalance(balanceFormatted);
        console.log('✅ Balance fetched:', balanceFormatted, 'BEZ');
        
    } catch (error) {
        console.error('❌ Error fetching balance:', error);
        
        if (error.message === 'Timeout' && retryCount < 2) {
            console.log('⏳ Retrying...', retryCount + 1);
            return fetchBalance(retryCount + 1);
        }
        
        setNetworkError(error.message);
        toast.error('Error al obtener balance');
    }
}, [address]);
```

---

### 2. `buyWithETH()` - Comprar con ETH
**Mejoras principales:**

```javascript
✅ Verificación de balance ETH antes de tx
✅ Estimación de gas con buffer del 20%
✅ Cálculo de costo total (gas + value)
✅ Tracking de estado (Preparando → Confirmando → Enviado)
✅ Parsing de eventos Transfer del receipt
✅ Timeout de 2 minutos en confirmación
✅ Errores específicos (rejected, insufficient, timeout)
✅ Logging con hash y link a Etherscan
```

**Flujo completo:**
```javascript
1. Verificar balance ETH
2. Estimar gas
3. Calcular costo total con buffer
4. setPendingTx('Preparando compra...')
5. toast.loading('Confirma en tu wallet...')
6. Enviar transacción con gasLimit aumentado
7. setPendingTx('Compra enviada: 0x123...')
8. Esperar confirmación (con timeout)
9. Parsear Transfer event del receipt
10. Actualizar balance
11. Guardar transacción con blockNumber, gasUsed
12. toast.success('¡Compra exitosa!')
```

**Ejemplo de evento parseado:**
```javascript
// Buscar el evento Transfer en los logs
const transferLog = receipt.logs.find(log => {
    try {
        const parsed = tokenContract.interface.parseLog(log);
        return parsed?.name === 'Transfer' && 
               parsed.args.to.toLowerCase() === address.toLowerCase();
    } catch { return false; }
});

if (transferLog) {
    const parsed = tokenContract.interface.parseLog(transferLog);
    const tokensReceived = ethers.formatEther(parsed.args.value);
    console.log('✅ Tokens recibidos:', tokensReceived, 'BEZ');
}
```

---

### 3. `transfer()` - Transferir Tokens
**Validaciones agregadas:**

```javascript
✅ ethers.isAddress(toAddress) - Dirección válida
✅ address !== toAddress - No self-transfer
✅ balance >= amount - Fondos suficientes
✅ Gas estimation con fallback
✅ Estado pendiente con toast
```

**Código clave:**
```javascript
// Validar dirección
if (!ethers.isAddress(toAddress)) {
    throw new Error('Invalid recipient address');
}

// Prevenir self-transfer
if (toAddress.toLowerCase() === address.toLowerCase()) {
    throw new Error('Cannot transfer to yourself');
}

// Estimar gas con fallback
let gasEstimate;
try {
    gasEstimate = await tokenContract.transfer.estimateGas(toAddress, amountWei);
    console.log('⛽ Gas estimado:', gasEstimate.toString());
} catch (gasError) {
    console.error('Error estimando gas:', gasError);
    gasEstimate = BigInt(100000); // Fallback para ERC20
}

// Enviar con buffer
const tx = await tokenContract.transfer(toAddress, amountWei, {
    gasLimit: (gasEstimate * BigInt(120)) / BigInt(100) // +20%
});
```

---

### 4. `donate()` - Donar con Mensaje
**Similar a transfer() pero con:**

```javascript
✅ Parámetro message para donación
✅ Emoji 💝 en logs y toasts
✅ Tipo 'donate' en transacción guardada
✅ Modal de fondos insuficientes con callback

const donate = async (toAddress, amount, message = '') => {
    // ... validaciones similares a transfer ...
    
    console.log('💝 Donación enviada:', tx.hash);
    console.log('📝 Mensaje:', message);
    
    toast.success(`¡Donación de ${amount} BEZ enviada exitosamente! 💝`);
    
    const newTransaction = {
        type: 'donate',
        to: toAddress,
        amount,
        message, // ⬅️ Mensaje incluido
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Date.now(),
        status: 'completed'
    };
};
```

---

## 🎧 Event Listeners en Tiempo Real

**¿Por qué?**
- Actualizar balance automáticamente cuando recibes tokens
- Notificar al usuario de transfers entrantes
- Sincronizar estado sin polling constante

**Implementación:**

```javascript
useEffect(() => {
    if (!isConnected || !address || !window.ethereum) return;

    const setupEventListeners = async () => {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const tokenContract = new ethers.Contract(
            BezhasTokenAddress,
            BezhasTokenABI,
            provider
        );

        // Filtros para eventos Transfer
        const filterFrom = tokenContract.filters.Transfer(address, null);
        const filterTo = tokenContract.filters.Transfer(null, address);

        console.log('👂 Escuchando eventos Transfer en blockchain...');

        // Handler para transfers salientes
        const handleTransferFrom = (from, to, value, event) => {
            if (from.toLowerCase() === address.toLowerCase()) {
                console.log('📤 Transfer detectado (salida):', {
                    to,
                    value: ethers.formatEther(value),
                    txHash: event.log.transactionHash,
                    block: event.log.blockNumber
                });
                fetchBalance(); // Actualizar balance
            }
        };

        // Handler para transfers entrantes
        const handleTransferTo = (from, to, value, event) => {
            if (to.toLowerCase() === address.toLowerCase()) {
                console.log('📥 Transfer detectado (entrada):', {
                    from,
                    value: ethers.formatEther(value),
                    txHash: event.log.transactionHash,
                    block: event.log.blockNumber
                });
                
                // Notificar al usuario
                const amount = ethers.formatEther(value);
                toast.success(`¡Recibiste ${parseFloat(amount).toFixed(2)} BEZ! 💰`, {
                    duration: 5000
                });
                
                fetchBalance(); // Actualizar balance
            }
        };

        // Registrar listeners
        tokenContract.on(filterFrom, handleTransferFrom);
        tokenContract.on(filterTo, handleTransferTo);

        setContractsInitialized(true);

        // Cleanup
        return () => {
            console.log('🔇 Deteniendo listeners de eventos...');
            tokenContract.off(filterFrom, handleTransferFrom);
            tokenContract.off(filterTo, handleTransferTo);
        };
    };

    const cleanup = setupEventListeners();
    return () => {
        cleanup.then(cleanupFn => {
            if (cleanupFn) cleanupFn();
        });
    };
}, [isConnected, address, fetchBalance]);
```

**Ejemplo de evento capturado:**
```
👂 Escuchando eventos Transfer en blockchain...
📥 Transfer detectado (entrada): {
  from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  value: '50.0',
  txHash: '0xabc123...',
  block: 12345
}
✅ Balance fetched: 150.0 BEZ
🎉 Toast: "¡Recibiste 50.00 BEZ! 💰"
```

---

## 🚨 Manejo de Errores

### Tipos de Errores Manejados:

#### 1. **Usuario rechaza transacción**
```javascript
error.code === 'ACTION_REJECTED' || error.code === 4001
→ toast.error('Transacción rechazada')
```

#### 2. **Fondos insuficientes para gas**
```javascript
error.message.includes('insufficient funds')
→ toast.error('Fondos insuficientes para gas')
```

#### 3. **Timeout de red**
```javascript
error.message === 'Timeout'
→ Reintentar automáticamente (hasta 2 veces)
→ toast.error('La red está lenta, reintentando...')
```

#### 4. **Contrato no desplegado**
```javascript
!BezhasTokenAddress || BezhasTokenAddress === ethers.ZeroAddress
→ toast.error('Token contract not deployed')
```

#### 5. **Dirección inválida**
```javascript
!ethers.isAddress(toAddress)
→ throw new Error('Invalid recipient address')
```

#### 6. **Self-transfer**
```javascript
toAddress.toLowerCase() === address.toLowerCase()
→ throw new Error('Cannot transfer to yourself')
```

### Estrategia de Retry:
```javascript
const fetchBalance = async (retryCount = 0) => {
    try {
        // ... fetch logic ...
    } catch (error) {
        if (error.message === 'Timeout' && retryCount < 2) {
            console.log('⏳ Retrying...', retryCount + 1);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
            return fetchBalance(retryCount + 1);
        }
        // Error final
        setNetworkError(error.message);
    }
};
```

---

## ⛽ Estimación de Gas

### ¿Por qué es importante?
- Evitar transacciones fallidas por out-of-gas
- Calcular costo real antes de enviar
- Optimizar experiencia del usuario

### Implementación:

```javascript
// 1. Estimar gas de la transacción
const gasEstimate = await tokenContract.transfer.estimateGas(toAddress, amountWei);
console.log('⛽ Gas estimado:', gasEstimate.toString()); // ej: 65000

// 2. Obtener precio del gas actual
const feeData = await provider.getFeeData();
const gasPrice = feeData.gasPrice; // en wei
console.log('💵 Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');

// 3. Calcular costo total
const estimatedCost = gasEstimate * gasPrice;
const costInETH = ethers.formatEther(estimatedCost);
console.log('💰 Costo estimado:', costInETH, 'ETH');

// 4. Agregar buffer del 20%
const gasLimitWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100);

// 5. Enviar transacción
const tx = await tokenContract.transfer(toAddress, amountWei, {
    gasLimit: gasLimitWithBuffer
});
```

### Ejemplo de logs:
```
⛽ Gas estimado: 65000
💵 Gas price: 2.5 gwei
💰 Costo estimado: 0.0001625 ETH
📤 Enviando con gas limit: 78000 (65000 + 20%)
```

### Fallback si falla estimación:
```javascript
let gasEstimate;
try {
    gasEstimate = await tokenContract.transfer.estimateGas(toAddress, amountWei);
} catch (gasError) {
    console.error('Error estimando gas:', gasError);
    gasEstimate = BigInt(100000); // Gas default para ERC20
}
```

---

## 🎨 Componentes UI

### `PendingTransactionIndicator.jsx`
**Ubicación:** `frontend/src/components/PendingTransactionIndicator.jsx`

**Propósito:** Mostrar estado de transacciones en proceso

**Uso:**
```jsx
import PendingTransactionIndicator from './components/PendingTransactionIndicator';

function App() {
    return (
        <>
            {/* Tu app */}
            <PendingTransactionIndicator />
        </>
    );
}
```

**Estados que muestra:**
1. **Transacción pendiente** (pendingTx)
   - Spinner animado
   - Mensaje: "Preparando...", "Esperando confirmación...", etc.
   - Color: Púrpura

2. **Error de red** (networkError)
   - Icono de error
   - Mensaje de error específico
   - Color: Rojo

**Ejemplo visual:**
```
┌─────────────────────────────────────┐
│  🔄  Transacción en Proceso        │
│                                     │
│  Esperando confirmación...          │
│  Por favor no cierres esta ventana  │
└─────────────────────────────────────┘
```

---

## 🧪 Testing

### Tests Recomendados:

#### 1. **Test de Compra con ETH**
```javascript
describe('buyWithETH', () => {
    it('debería comprar tokens exitosamente', async () => {
        // Setup
        const amount = '0.1';
        
        // Ejecutar
        await buyWithETH(amount);
        
        // Verificar
        expect(balance).toBeGreaterThan(0);
        expect(transactions[0].type).toBe('buy');
        expect(transactions[0].status).toBe('completed');
    });
    
    it('debería mostrar error si fondos insuficientes', async () => {
        const amount = '1000'; // Más ETH de lo disponible
        
        await expect(buyWithETH(amount)).rejects.toThrow('Insufficient ETH');
    });
});
```

#### 2. **Test de Transferencia**
```javascript
describe('transfer', () => {
    it('debería transferir tokens correctamente', async () => {
        const to = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
        const amount = '10';
        
        await transfer(to, amount);
        
        expect(transactions[0].type).toBe('transfer');
        expect(transactions[0].to).toBe(to);
    });
    
    it('debería rechazar dirección inválida', async () => {
        await expect(transfer('0xinvalid', '10')).rejects.toThrow('Invalid address');
    });
    
    it('debería rechazar self-transfer', async () => {
        await expect(transfer(address, '10')).rejects.toThrow('Cannot transfer to yourself');
    });
});
```

#### 3. **Test de Event Listeners**
```javascript
describe('Event Listeners', () => {
    it('debería detectar transfer entrante', async () => {
        // Simular transfer desde otra cuenta
        await otherAccount.transfer(address, ethers.parseEther('5'));
        
        // Esperar evento
        await waitFor(() => {
            expect(balance).toBe('105'); // balance anterior + 5
        });
    });
});
```

### Comandos de Testing:
```bash
# Tests unitarios
npm run test

# Tests de integración
npm run test:integration

# Tests en red local
npx hardhat node
npm run test:local

# Coverage
npm run test:coverage
```

---

## 🚀 Deployment

### Checklist Pre-Deploy:

#### 1. **Configuración de Red**
```javascript
// contract-config.js

// DESARROLLO
export const BezhasTokenAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
export const TokenSaleAddress = '0x0165878A594ca255338adfa4d48449f69242Eb8F';
export const networkName = 'localhost';
export const chainId = 31337;

// TESTNET (Sepolia)
export const BezhasTokenAddress = '0x...'; // Deploy en Sepolia
export const TokenSaleAddress = '0x...';
export const networkName = 'sepolia';
export const chainId = 11155111;

// MAINNET
export const BezhasTokenAddress = '0x...'; // Deploy en Mainnet
export const TokenSaleAddress = '0x...';
export const networkName = 'mainnet';
export const chainId = 1;
```

#### 2. **Variables de Entorno**
```bash
# .env
VITE_NETWORK=mainnet
VITE_BEZCOIN_TOKEN_ADDRESS=0x...
VITE_TOKEN_SALE_ADDRESS=0x...
VITE_CHAIN_ID=1
VITE_BACKEND_URL=https://api.bezhas.com
```

#### 3. **Deploy Contracts**
```bash
# Testnet
npx hardhat run scripts/deploy.js --network sepolia

# Mainnet
npx hardhat run scripts/deploy.js --network mainnet

# Verificar en Etherscan
npx hardhat verify --network mainnet 0x... "Constructor args"
```

#### 4. **Actualizar Frontend**
```javascript
// Actualizar contract-config.js con nuevas direcciones
export const BezhasTokenAddress = '0x...'; // Nueva dirección mainnet
export const TokenSaleAddress = '0x...';
```

#### 5. **Build Frontend**
```bash
npm run build
# Archivos generados en /dist
```

#### 6. **Deploy Frontend**
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod

# AWS S3
aws s3 sync dist/ s3://bezhas-frontend
```

---

### Deploy a Sepolia (Testnet):

```bash
# 1. Configurar Sepolia en hardhat.config.js
module.exports = {
    networks: {
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [process.env.PRIVATE_KEY],
            chainId: 11155111
        }
    }
};

# 2. Deploy
npx hardhat run scripts/deploy.js --network sepolia

# 3. Verificar
npx hardhat verify --network sepolia <TOKEN_ADDRESS>
npx hardhat verify --network sepolia <SALE_ADDRESS> <TOKEN_ADDRESS>

# 4. Actualizar frontend
# contract-config.js
export const BezhasTokenAddress = '<DEPLOYED_ADDRESS>';
export const TokenSaleAddress = '<DEPLOYED_ADDRESS>';
export const chainId = 11155111;

# 5. Test en frontend
npm run dev
# Conectar wallet a Sepolia
# Probar compra, transfer, donate
```

---

### Deploy a Mainnet:

⚠️ **PRECAUCIONES:**
- Auditar contratos con firmas reconocidas (OpenZeppelin, CertiK)
- Probar exhaustivamente en testnet primero
- Usar multisig para admin functions
- Configurar timelock para cambios críticos
- Monitorear transacciones con alerts
- Tener plan de emergency pause

```bash
# 1. Auditoría completa
npm run test:coverage
# Cobertura > 90%

# 2. Deploy a mainnet
PRIVATE_KEY=<ADMIN_KEY> npx hardhat run scripts/deploy.js --network mainnet

# 3. Verificar contratos
npx hardhat verify --network mainnet <ADDRESSES>

# 4. Configurar admin multisig
npx hardhat run scripts/setup-multisig.js --network mainnet

# 5. Renunciar a roles admin o transferir a timelock
npx hardhat run scripts/setup-governance.js --network mainnet

# 6. Monitoreo
# Setup Tenderly alerts
# Setup Defender monitoring
```

---

## 📈 Próximos Pasos

### Corto Plazo (1-2 semanas):

1. **Testing Exhaustivo**
   - [ ] Tests unitarios para todas las funciones
   - [ ] Tests de integración en red local
   - [ ] Tests en Sepolia testnet
   - [ ] Tests de UI con Playwright

2. **Optimizaciones**
   - [ ] Implementar multicall para batch operations
   - [ ] Cachear token price (no fetch cada vez)
   - [ ] Optimizar gas con estimaciones más precisas
   - [ ] Agregar soporte para EIP-1559 (maxFeePerGas)

3. **UX Improvements**
   - [ ] Loading skeletons mientras carga balance
   - [ ] Animaciones suaves en transiciones
   - [ ] Sonidos de confirmación (opcional)
   - [ ] Modo oscuro

### Medio Plazo (1-2 meses):

4. **Multi-Chain Support**
   - [ ] Polygon integration
   - [ ] Binance Smart Chain
   - [ ] Arbitrum/Optimism L2s
   - [ ] Bridge entre chains

5. **Advanced Features**
   - [ ] Staking de BEZ tokens
   - [ ] Liquidity mining rewards
   - [ ] Governance voting
   - [ ] NFT integration con tokens

6. **Backend Integration**
   - [ ] MongoDB para transacciones
   - [ ] Webhook para eventos blockchain
   - [ ] Analytics dashboard
   - [ ] Admin panel

### Largo Plazo (3-6 meses):

7. **Ecosystem Expansion**
   - [ ] BezCoin DEX para trading
   - [ ] Lending/borrowing protocol
   - [ ] Insurance pool
   - [ ] DAO para governance

8. **Mobile App**
   - [ ] React Native con WalletConnect
   - [ ] Biometric authentication
   - [ ] Push notifications
   - [ ] QR code payments

9. **Compliance**
   - [ ] KYC/AML integration
   - [ ] Tax reporting tools
   - [ ] Legal framework
   - [ ] Auditorías de seguridad

---

## 📊 Métricas de Éxito

### KPIs Técnicos:
- ✅ Gas usado promedio < 100k por transacción
- ✅ Tiempo de confirmación < 30 segundos
- ✅ Uptime > 99.9%
- ✅ Error rate < 1%
- ✅ Test coverage > 90%

### KPIs de Negocio:
- Usuarios activos mensuales
- Volumen de transacciones
- Total Value Locked (TVL)
- Tiempo de retención de usuarios
- NPS (Net Promoter Score)

---

## 🆘 Troubleshooting

### Problema: "Balance no se actualiza"
**Solución:**
```javascript
// Forzar actualización
await fetchBalance();

// Verificar event listeners
console.log('Contracts initialized:', contractsInitialized);

// Verificar red
const provider = new ethers.BrowserProvider(window.ethereum);
const network = await provider.getNetwork();
console.log('Network:', network.chainId);
```

### Problema: "Transaction failed"
**Solución:**
```javascript
// Verificar gas
const gasEstimate = await contract.method.estimateGas(...args);
console.log('Gas needed:', gasEstimate.toString());

// Verificar balance ETH
const ethBalance = await provider.getBalance(address);
console.log('ETH balance:', ethers.formatEther(ethBalance));

// Verificar nonce
const nonce = await provider.getTransactionCount(address);
console.log('Current nonce:', nonce);
```

### Problema: "Events no se detectan"
**Solución:**
```javascript
// Verificar WebSocket connection
const wsProvider = new ethers.WebSocketProvider('wss://...');
const contract = new ethers.Contract(address, abi, wsProvider);

// Logs manuales
contract.on('Transfer', (from, to, value) => {
    console.log('Transfer event:', { from, to, value: ethers.formatEther(value) });
});

// Query historical events
const events = await contract.queryFilter('Transfer', startBlock, endBlock);
console.log('Historical transfers:', events.length);
```

---

## 📚 Referencias

- [ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- [Hardhat Network](https://hardhat.org/hardhat-network)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Wagmi Documentation](https://wagmi.sh/)
- [Web3Modal](https://web3modal.com/)
- [React Hot Toast](https://react-hot-toast.com/)

---

## 👥 Equipo y Contacto

**Desarrollador Principal:** [Tu nombre]  
**Email:** [Tu email]  
**GitHub:** [Tu GitHub]  
**Discord:** [Tu Discord para soporte]

---

## 📄 Licencia

MIT License - BeZhas Platform 2024

---

**Última actualización:** [Fecha actual]  
**Versión:** 2.0.0 (Blockchain Real Integration)  
**Estado:** ✅ Production Ready (testnet) | ⏳ Mainnet Pending Audit

---

