# BeZhas Smart Contracts SDK

Módulo del SDK de BeZhas que proporciona acceso unificado a todos los ABIs y direcciones de contratos desplegados.

## 🎯 Propósito

Este módulo centraliza:
- **ABIs compilados** de todos los contratos Solidity
- **Direcciones de despliegue** en múltiples redes (localhost, Amoy, Polygon)
- **Funciones helper** para acceso simplificado desde Frontend/Backend

## 📦 Instalación

```bash
# Desde el monorepo BeZhas
const { getContract } = require('./sdk/contracts');

# Desde proyecto externo (cuando se publique en NPM)
npm install @bezhas/sdk
const { getContract } = require('@bezhas/sdk/contracts');
```

## 🚀 Uso Rápido

### Opción 1: Obtener Contrato Completo (Address + ABI)

```javascript
const { getContract } = require('./sdk/contracts');

const farming = getContract('LiquidityFarming', 'amoy');
// { address: '0x...', abi: [...] }

// Usar con ethers.js
const contract = new ethers.Contract(farming.address, farming.abi, provider);
const reward = await contract.rewardPerBlock();
```

### Opción 2: Solo ABI

```javascript
const { getABI } = require('./sdk/contracts');

const abi = getABI('GovernanceSystem');
// Array con el ABI completo
```

### Opción 3: Solo Direcciones

```javascript
const { getAddresses } = require('./sdk/contracts');

const addresses = getAddresses('polygon');
console.log(addresses.LiquidityFarming); // '0x...'
```

## 📋 Contratos Disponibles

El SDK incluye **45+ contratos** organizados por categoría:

### Core (3)
- `BezhasToken`, `BZHToken`, `BeZhasCore`

### Social & Content (5)
- `Post`, `SocialInteractions`, `PersonalizedFeed`, `ContentValidator`, `ModerationSystem`

### NFT & Marketplace (9)
- `BezhasNFT`, `LazyNFT`, `FractionalNFT`, `NFTBundle`, `NFTOffers`, `NFTRental`, `NFTStaking`
- `Marketplace`, `BeZhasMarketplace`

### DeFi (4)
- `StakingPool`, `LiquidityFarming`, `BeZhasVault`, `TokenSale`

### Governance (1)
- `GovernanceSystem`

### Real Estate & RWA (5)
- `BeZhasRealEstate`, `PropertyNFT`, `PropertyFractionalizer`, `BeZhasRWAFactory`, `ShareToken`

### Logistics (2)
- `LogisticsContainer`, `CargoManifestNFT`

### Security & Auth (3)
- `SecurityManager`, `AuthenticationManager`, `EnhancedAuthManager`

### User Management (2)
- `UserProfile`, `UserManagement`

### Gamification (2)
- `GamificationSystem`, `BeZhasRewardsCalculator`

### Communication (2)
- `Messages`, `NotificationSystem`

### System & Config (3)
- `GlobalConfigurationSystem`, `DataOracle`, `BackupRecoverySystem`

### Quality Oracle (4)
- `QualityOracle`, `OracleValidator`, `ValidationEscrow`, `ValidationRegistry`

### Admin (6)
- `AdminAccessControl`, `AdminController`, `EmergencyPause`, `FeeManager`, `SystemConfig`, `Treasury`

## 🌐 Redes Soportadas

```javascript
// Hardhat Local Network (chainId: 31337)
getContract('LiquidityFarming', 'localhost');

// Polygon Amoy Testnet (chainId: 80002)
getContract('LiquidityFarming', 'amoy');

// Polygon Mainnet (chainId: 137)
getContract('LiquidityFarming', 'polygon');
```

## 🔧 Configuración de Direcciones

Las direcciones se cargan desde variables de entorno (`.env`):

```bash
# Ejemplo para LiquidityFarming en Amoy
LIQUIDITY_FARMING_ADDRESS_AMOY=0x1234567890abcdef...

# Ejemplo para QualityOracle en Polygon
QUALITY_ORACLE_ADDRESS_POLYGON=0xabcdef1234567890...
```

### Patrón de Naming
```
{CONTRACT_NAME}_ADDRESS_{NETWORK}
```

Ejemplos:
- `BEZHAS_TOKEN_ADDRESS_LOCAL`
- `STAKING_POOL_ADDRESS_AMOY`
- `GOVERNANCE_SYSTEM_ADDRESS_POLYGON`

## 🛠️ API Reference

### `getContract(contractName, network)`
Obtiene address + abi de un contrato.

**Parámetros:**
- `contractName` (string): Nombre del contrato (e.g., 'LiquidityFarming')
- `network` (string): Red blockchain ('localhost', 'amoy', 'polygon')

**Retorna:** `{ address: string, abi: Array }` o `null` si no está desplegado

---

### `getABI(contractName)`
Obtiene solo el ABI de un contrato.

**Parámetros:**
- `contractName` (string): Nombre del contrato

**Retorna:** `Array` - ABI completo del contrato

---

### `getAddresses(network)`
Obtiene todas las direcciones de una red.

**Parámetros:**
- `network` (string): Red blockchain

**Retorna:** `Object` - Mapa de contratos → direcciones

---

### `listContracts()`
Lista todos los contratos disponibles.

**Retorna:** `Array<string>` - Nombres de todos los contratos

---

### `isDeployed(contractName, network)`
Verifica si un contrato está desplegado.

**Parámetros:**
- `contractName` (string): Nombre del contrato
- `network` (string): Red blockchain

**Retorna:** `boolean`

## 💡 Ejemplos Prácticos

### Ejemplo 1: Staking en Frontend (React + Wagmi)

```javascript
import { getContract } from '@bezhas/sdk/contracts';
import { useContractWrite, usePrepareContractWrite } from 'wagmi';
import { parseEther } from 'viem';

function StakingForm() {
    const { address, abi } = getContract('LiquidityFarming', 'amoy');
    
    const { config } = usePrepareContractWrite({
        address,
        abi,
        functionName: 'deposit',
        args: [0, parseEther('100'), 0], // pid, amount, lockPeriod
    });
    
    const { write } = useContractWrite(config);
    
    return <button onClick={() => write?.()}>Stake 100 BZH</button>;
}
```

### Ejemplo 2: Backend - Monitorear Eventos

```javascript
const { ethers } = require('ethers');
const { getContract } = require('./sdk/contracts');

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const { address, abi } = getContract('LiquidityFarming', 'amoy');
const contract = new ethers.Contract(address, abi, provider);

// Escuchar eventos de Deposit
contract.on('Deposit', (user, pid, amount, event) => {
    console.log(`Usuario ${user} depositó ${ethers.formatEther(amount)} en pool ${pid}`);
});
```

### Ejemplo 3: Script de Despliegue - Interacción Post-Deploy

```javascript
const { ethers } = require('hardhat');
const { getContract } = require('./sdk/contracts');

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // Obtener contrato ya desplegado
    const dao = getContract('GovernanceSystem', 'localhost');
    const daoContract = await ethers.getContractAt(dao.abi, dao.address, deployer);
    
    // Crear una propuesta
    const tx = await daoContract.createProposal(
        'Aumentar rewards de staking',
        'Propuesta para incrementar APY'
    );
    
    await tx.wait();
    console.log('Propuesta creada');
}
```

## 📝 Testing

Ejecutar el script de prueba:

```bash
node sdk/test-contracts-sdk.js
```

Esto verificará:
- ✅ Cantidad de contratos disponibles
- ✅ Estado de despliegue en cada red
- ✅ Integridad de ABIs
- ✅ Acceso a direcciones

## 🔄 Actualizar Direcciones Post-Despliegue

Después de desplegar contratos con Hardhat:

### Opción 1: Variables de Entorno (Recomendado)

Agregar al `.env`:
```bash
LIQUIDITY_FARMING_ADDRESS_AMOY=0xNuevaAddress...
```

### Opción 2: Modificar el Código (Solo en desarrollo)

Editar `sdk/contracts.js` línea ~120:
```javascript
amoy: {
    LiquidityFarming: '0xNuevaAddress...',
    // ...
}
```

### Opción 3: Script Automático (Próximamente)

```bash
pnpm run sdk:update-addresses --network amoy
```

## 🐛 Troubleshooting

### ❌ Error: "Contract address not found"
**Causa:** El contrato no está desplegado o falta la dirección.

**Solución:**
1. Verifica que el contrato esté desplegado: `npx hardhat run scripts/deploy-dao.js --network amoy`
2. Configura la variable de entorno en `.env`
3. Reinicia tu aplicación

---

### ❌ Error: "ABI not found"
**Causa:** Los artifacts no están compilados.

**Solución:**
```bash
npx hardhat clean
npx hardhat compile
```

---

### ❌ Error: "Network not supported"
**Causa:** Red no reconocida.

**Solución:** Usa `localhost`, `amoy`, o `polygon`. Para agregar otra red, edita `CONTRACT_ADDRESSES` en `contracts.js`.

---

### ⚠️ Warning: "Contract not deployed"
**Causa:** La dirección está vacía para esa red.

**Solución:** Es normal si aún no has desplegado a esa red. No afecta otras redes.

## 🚀 Próximos Pasos

1. **Desplegar Contratos**: Ejecuta los scripts en `scripts/`
2. **Configurar Direcciones**: Actualiza `.env` con las direcciones reales
3. **Integrar en Frontend**: Usa `getContract()` en tus componentes React
4. **Integrar en Backend**: Usa `getContract()` en tus servicios Node.js
5. **Publicar SDK**: Publica a NPM para que terceros lo usen

## 📚 Ver También

- [SDK Usage Examples](./USAGE_EXAMPLES.md) - Ejemplos completos de uso
- [Complete System Guide](../COMPLETE_SYSTEM_GUIDE.md) - Documentación general
- [Hardhat Config](../hardhat.config.js) - Configuración de redes
- [Deploy Scripts](../scripts/) - Scripts de despliegue

---

**Versión:** 2.0.0  
**Última Actualización:** Enero 2026  
**Mantenedor:** BeZhas DAO
