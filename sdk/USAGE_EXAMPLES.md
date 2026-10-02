# BeZhas SDK - Guía de Uso

Este documento explica cómo integrar el BeZhas SDK en proyectos externos (Frontend, Backend, DApps).

## 📦 Instalación

### Opción 1: NPM/PNPM (Publicado)
```bash
pnpm add @bezhas/sdk
# o
npm install @bezhas/sdk
```

### Opción 2: Instalación Local (Desarrollo)
```bash
# Desde tu proyecto, referencia el SDK local
pnpm add file:../bezhas-web3/sdk
```

## 🚀 Uso Básico

### 1. Importar Contratos Blockchain

```javascript
const { getContract, getABI, listContracts } = require('@bezhas/sdk');

// Obtener configuración completa de un contrato
const liquidityFarming = getContract('LiquidityFarming', 'amoy');
console.log(liquidityFarming);
// { address: '0x...', abi: [...] }

// Usar con ethers.js
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology/');
const signer = provider.getSigner();

const farmingContract = new ethers.Contract(
    liquidityFarming.address,
    liquidityFarming.abi,
    signer
);

// Interactuar con el contrato
const rewardPerBlock = await farmingContract.rewardPerBlock();
console.log('Reward per block:', ethers.formatEther(rewardPerBlock));
```

### 2. Usar con Wagmi (React)

```javascript
import { getContract } from '@bezhas/sdk';
import { useContractRead } from 'wagmi';

function LiquidityFarmingStats() {
    const { address, abi } = getContract('LiquidityFarming', 'amoy');
    
    const { data: rewardPerBlock } = useContractRead({
        address,
        abi,
        functionName: 'rewardPerBlock',
    });
    
    return <div>Reward per block: {rewardPerBlock?.toString()}</div>;
}
```

### 3. Listar Contratos Disponibles

```javascript
const { listContracts, isDeployed } = require('@bezhas/sdk');

// Ver todos los contratos
const allContracts = listContracts();
console.log('Contratos disponibles:', allContracts);

// Verificar si un contrato está desplegado
const isLive = isDeployed('LiquidityFarming', 'polygon');
console.log('¿Está desplegado en Polygon?', isLive);
```

### 4. Obtener Solo ABIs

```javascript
const { getABI } = require('@bezhas/sdk');

const daoAbi = getABI('GovernanceSystem');
console.log('DAO ABI:', daoAbi);
```

### 5. Acceso Directo a Direcciones

```javascript
const { addresses } = require('@bezhas/sdk');

// Ver todas las direcciones de Amoy
console.log('Contratos en Amoy:', addresses.amoy);

// Dirección específica
console.log('Quality Oracle:', addresses.amoy.QualityOracle);
```

## 🌐 Uso del Universal Bridge (Integración Multi-Plataforma)

El Universal Bridge permite conectar plataformas externas (E-commerce, Logística, ERPs) con BeZhas.

### 1. Configuración Inicial

```javascript
const { BeZhas } = require('@bezhas/sdk');

const bezhas = new BeZhas({
    apiKey: 'YOUR_BEZHAS_API_KEY',
    endpoint: 'https://api.bezhas.com/v1/bridge',
    debug: true
});
```

### 2. Sincronizar Inventario (E-commerce → BeZhas)

```javascript
// Ejemplo: Importar productos desde Shopify/Vinted/Amazon
const products = [
    {
        id: 'PROD-12345',
        platform: 'shopify',
        title: 'Laptop Dell XPS 15',
        price: 1200,
        currency: 'USD',
        images: ['https://example.com/laptop.jpg'],
        stock: 5
    },
    // ... más productos
];

const result = await bezhas.syncInventory(products);
console.log('Productos sincronizados:', result);
```

### 3. Actualizar Estado de Envíos (Maersk, DHL → BeZhas)

```javascript
// Ejemplo: Webhook desde proveedor logístico
const shipmentUpdate = {
    trackingId: 'MAERSK-123456',
    status: 'in_transit',
    currentLocation: 'Valencia Port, Spain',
    carrier: 'Maersk',
    estimatedDelivery: '2026-02-15'
};

await bezhas.updateShipmentStatus(shipmentUpdate);
```

### 4. Registrar Pagos (Stripe, PayPal → BeZhas)

```javascript
// Ejemplo: Webhook de Stripe
app.post('/webhooks/stripe', async (req, res) => {
    const payment = req.body;
    
    await bezhas.registerPayment({
        txId: payment.id,
        amount: payment.amount / 100, // Stripe usa centavos
        currency: payment.currency.toUpperCase(),
        status: payment.status,
        method: 'stripe',
        userId: payment.metadata.userId
    });
    
    res.sendStatus(200);
});
```

### 5. Crear Órdenes

```javascript
const order = await bezhas.createOrder({
    id: 'ORDER-789',
    buyer: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    items: [
        { id: 'PROD-12345', quantity: 1, price: 1200 }
    ],
    total: 1200,
    currency: 'USD',
    address: {
        street: '123 Main St',
        city: 'Madrid',
        country: 'Spain'
    }
});
```

### 6. Procesar Webhooks Genéricos

```javascript
// Ejemplo: Webhook de plataforma desconocida
app.post('/webhooks/generic', async (req, res) => {
    const webhook = req.body;
    const source = req.headers['x-webhook-source']; // 'vinted', 'wallapop', etc.
    
    await bezhas.processWebhook(webhook, source);
    res.sendStatus(200);
});
```

## 🏭 Módulos Sectoriales

El SDK incluye módulos especializados para diferentes industrias.

### Real Estate

```javascript
const { BeZhas } = require('@bezhas/sdk');
const bezhas = new BeZhas({ apiKey: 'YOUR_KEY' });

// Tokenizar una propiedad
const property = await bezhas.realestate.tokenizeProperty({
    address: 'Calle Mayor 1, Madrid',
    valuation: 500000,
    shares: 1000,
    metadata: {
        size: 120,
        bedrooms: 3,
        bathrooms: 2
    }
});
```

### Healthcare

```javascript
// Crear registro médico seguro
const record = await bezhas.healthcare.createMedicalRecord({
    patientId: 'PATIENT-123',
    data: encryptedData,
    authorizedDoctors: ['0x...', '0x...']
});
```

### Logistics

```javascript
// Crear contenedor de carga
const container = await bezhas.logistics.createContainer({
    containerId: 'CONT-456',
    origin: 'Shanghai',
    destination: 'Rotterdam',
    cargo: [...]
});
```

## 🔧 Configuración de Variables de Entorno

Para que las direcciones de contratos se carguen correctamente, configura tu `.env`:

```bash
# Polygon Amoy Testnet
LIQUIDITY_FARMING_ADDRESS_AMOY=0x...
GOVERNANCE_SYSTEM_ADDRESS_AMOY=0x...
QUALITY_ORACLE_ADDRESS_AMOY=0x...

# Polygon Mainnet
LIQUIDITY_FARMING_ADDRESS_POLYGON=0x...
GOVERNANCE_SYSTEM_ADDRESS_POLYGON=0x...

# Localhost (Hardhat)
LIQUIDITY_FARMING_ADDRESS_LOCAL=0x...
```

## 📚 Lista Completa de Contratos

El SDK incluye ABIs para todos estos contratos:

### Core
- `BezhasToken`, `BZHToken`, `BeZhasCore`

### Social & Content
- `Post`, `SocialInteractions`, `PersonalizedFeed`, `ContentValidator`, `ModerationSystem`

### NFT & Marketplace
- `BezhasNFT`, `LazyNFT`, `FractionalNFT`, `NFTBundle`, `NFTOffers`, `NFTRental`, `NFTStaking`
- `Marketplace`, `BeZhasMarketplace`

### DeFi
- `StakingPool`, `LiquidityFarming`, `BeZhasVault`, `TokenSale`

### Governance
- `GovernanceSystem`

### Real Estate & RWA
- `BeZhasRealEstate`, `PropertyNFT`, `PropertyFractionalizer`, `BeZhasRWAFactory`, `ShareToken`

### Logistics
- `LogisticsContainer`, `CargoManifestNFT`

### Security & Auth
- `SecurityManager`, `AuthenticationManager`, `EnhancedAuthManager`

### User Management
- `UserProfile`, `UserManagement`

### Gamification
- `GamificationSystem`, `BeZhasRewardsCalculator`

### Communication
- `Messages`, `NotificationSystem`

### System & Config
- `GlobalConfigurationSystem`, `DataOracle`, `BackupRecoverySystem`

### Quality Oracle
- `QualityOracle`, `OracleValidator`, `ValidationEscrow`, `ValidationRegistry`

### Admin
- `AdminAccessControl`, `AdminController`, `EmergencyPause`, `FeeManager`, `SystemConfig`, `Treasury`

## 🐛 Troubleshooting

### Error: "Contract address not found"
Verifica que:
1. El contrato esté desplegado en esa red
2. Las variables de entorno estén configuradas correctamente
3. Estás usando el nombre correcto del contrato (case-sensitive)

### Error: "Network not supported"
Las redes soportadas son: `localhost`, `amoy`, `polygon`

### Error: "ABI not found"
Asegúrate de que Hardhat haya compilado los contratos:
```bash
npx hardhat compile
```

## 📞 Soporte

- Documentación: [Complete System Guide](../COMPLETE_SYSTEM_GUIDE.md)
- Issues: [GitHub Issues](https://github.com/bezhas/bezhas-web3/issues)
- Discord: [BeZhas Community](https://discord.gg/bezhas)
