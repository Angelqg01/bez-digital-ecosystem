# BeZhas Real World Assets (RWA) System - Documentación Completa

## 📋 Índice
1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Smart Contracts](#smart-contracts)
4. [Frontend Integration](#frontend-integration)
5. [Guía de Deployment](#guía-de-deployment)
6. [Uso del Sistema](#uso-del-sistema)
7. [Casos de Uso](#casos-de-uso)

---

## 🎯 Visión General

El sistema BeZhas RWA permite la tokenización de activos físicos del mundo real en la blockchain de Polygon, utilizando el estándar **ERC-1155** para fracciones y **BEZ-Coin** como medio de pago.

### Activos Soportados
- 🏢 **Inmuebles**: Casas, apartamentos, edificios
- 🏨 **Hoteles**: Resorts, hostales, propiedades turísticas
- 🏪 **Locales Comerciales**: Tiendas, oficinas
- 👕 **Moda/Ropa**: Colecciones de diseñador, textiles
- 🚗 **Vehículos**: Coches de lujo, clásicos
- ⛵ **Barcos/Yates**: Embarcaciones recreativas
- 🚁 **Helicópteros**: Aeronaves privadas
- 💎 **Objetos de Lujo**: Arte, joyas, coleccionables

### Características Principales
- ✅ Tokenización con **100 BEZ** de fee
- ✅ Fracciones ERC-1155 (divisibles)
- ✅ **Sistema de Dividendos** automático
- ✅ Documentación legal en **IPFS** (inmutable)
- ✅ **KYC verification** para activos de alto valor
- ✅ Marketplace P2P integrado

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (React)                    │
│  - RealEstateRWAForm.jsx (Multi-step)               │
│  - useRWAContracts.js (Hook)                        │
│  - ipfs.service.js (Pinata)                         │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│            SMART CONTRACTS (Polygon)                 │
│                                                      │
│  ┌──────────────────────────────────────────┐      │
│  │  BeZhasRWAFactory.sol (ERC-1155)         │      │
│  │  - tokenizeAsset()                       │      │
│  │  - getAsset()                            │      │
│  │  - verifyInvestor() (KYC)                │      │
│  └──────────────────────────────────────────┘      │
│                     │                               │
│                     ▼                               │
│  ┌──────────────────────────────────────────┐      │
│  │  BeZhasVault.sol                         │      │
│  │  - depositMonthlyRent()                  │      │
│  │  - claimDividends()                      │      │
│  │  - getPendingRewards()                   │      │
│  └──────────────────────────────────────────┘      │
│                     │                               │
│                     ▼                               │
│  ┌──────────────────────────────────────────┐      │
│  │  BEZ-Coin (ERC-20)                       │      │
│  │  0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8 │  │
│  └──────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              IPFS (Pinata Gateway)                   │
│  - Legal Documents (PDFs)                           │
│  - Asset Images                                     │
│  - Metadata JSON                                    │
└─────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contracts

### 1. BeZhasRWAFactory.sol

**Purpose**: Factory contract para crear y gestionar activos tokenizados.

#### Key Functions

```solidity
function tokenizeAsset(
    string memory _name,
    AssetCategory _category,  // 0-7 (INMUEBLE, HOTEL, etc.)
    string memory _legalCID,  // IPFS CID de docs legales
    string memory _imagesCID, // IPFS CID de imágenes
    uint256 _supply,          // Total de fracciones
    uint256 _valuationUSD,    // Valoración en USD
    uint256 _pricePerFraction,// Precio en BEZ por fracción
    uint256 _estimatedYield,  // APY en basis points (850 = 8.5%)
    string memory _location   // Ubicación física
) external returns (uint256 assetId)
```

**Events**:
```solidity
event AssetTokenized(
    uint256 indexed assetId, 
    string name, 
    AssetCategory category,
    address indexed creator,
    uint256 totalSupply,
    uint256 valuationUSD
);
```

#### Asset Categories
```solidity
enum AssetCategory { 
    INMUEBLE,      // 0
    HOTEL,         // 1
    LOCAL,         // 2
    ROPA,          // 3
    COCHE,         // 4
    BARCO,         // 5
    HELICOPTERO,   // 6
    OBJETO         // 7
}
```

#### Security Features
- ✅ **ReentrancyGuard**: Protección contra ataques de reentrada
- ✅ **Pausable**: Sistema de pausa de emergencia
- ✅ **Ownable**: Control de acceso por roles
- ✅ **KYC Verification**: Para activos de alto valor (>10% del supply)

---

### 2. BeZhasVault.sol

**Purpose**: Gestión de dividendos y rentas pasivas para holders.

#### Key Functions

```solidity
// El manager deposita rentas mensuales
function depositMonthlyRent(uint256 _assetId, uint256 _amount) external

// Inversor consulta sus ganancias pendientes
function getPendingRewards(uint256 _assetId, address _user) public view returns (uint256)

// Inversor reclama sus dividendos
function claimDividends(uint256 _assetId) external
```

#### Dividend Distribution Logic
```javascript
// Fórmula de cálculo proporcional
userReward = (totalDividends * userShares) / totalSupply - alreadyClaimed
```

**Events**:
```solidity
event MonthlyRentDeposited(uint256 indexed assetId, uint256 amount, address indexed depositor);
event DividendsClaimed(uint256 indexed assetId, address indexed investor, uint256 amount);
```

---

## 💻 Frontend Integration

### Hook: useRWAContracts.js

```javascript
import { useRWAContracts } from '../hooks/useRWAContracts';

function MyComponent() {
    const {
        // Contracts
        factoryContract,
        vaultContract,
        
        // State
        loading,
        tokenizationFee,  // "100" BEZ
        bezBalance,       // User's BEZ balance
        
        // Functions
        tokenizeAsset,
        getAsset,
        getMyFractions,
        getPendingDividends,
        claimDividends
    } = useRWAContracts();
    
    // Tokenize a new asset
    const handleTokenize = async () => {
        const result = await tokenizeAsset({
            name: "Hotel Playa Sol",
            category: 1, // HOTEL
            legalCID: "Qm...",
            imagesCID: "Qm...",
            totalSupply: 1000,
            valuationUSD: 5000000,
            pricePerFraction: "500",
            estimatedYield: 850, // 8.5%
            location: "Cancún, México"
        });
        
        console.log("Asset ID:", result.assetId);
    };
}
```

### IPFS Service

```javascript
import ipfsService from '../services/ipfs.service';

// Upload single file
const result = await ipfsService.uploadToIPFS(pdfFile);
// { success: true, cid: "Qm...", url: "https://..." }

// Upload multiple files
const images = await ipfsService.uploadMultipleToIPFS(fileList);

// Upload JSON metadata
const metadata = await ipfsService.uploadJSONToIPFS({
    name: "Asset Name",
    description: "...",
    attributes: []
});
```

### Component: RealEstateRWAForm.jsx

Formulario multi-paso con **4 etapas**:

1. **Categoría**: Selector visual de tipo de activo
2. **Detalles**: Nombre, valoración, ubicación (campos dinámicos según categoría)
3. **Tokenización**: Total supply, precio por fracción, APY
4. **Documentos**: Upload a IPFS de PDFs e imágenes

```jsx
<RealEstateRWAForm onSuccess={(data) => {
    console.log("Asset tokenized:", data.assetId);
    navigate('/marketplace');
}} />
```

---

## 🚀 Guía de Deployment

### 1. Preparación

```bash
cd bezhas-web3

# Instalar dependencias
npm install --save-dev @openzeppelin/contracts

# Compilar contratos
npx hardhat compile
```

### 2. Configuración de Polygon

**hardhat.config.js**:
```javascript
networks: {
    polygon: {
        url: "https://polygon-rpc.com",
        accounts: [process.env.PRIVATE_KEY],
        chainId: 137
    }
}
```

### 3. Deploy a Polygon Mainnet

```bash
npx hardhat run scripts/deploy-rwa-system.js --network polygon
```

**Output esperado**:
```
🚀 Deploying BeZhas RWA System to Polygon...

✅ BeZhasRWAFactory deployed to: 0x1234...
✅ BeZhasVault deployed to: 0x5678...

📝 Add these to your .env file:
─────────────────────────────────────────
VITE_RWA_FACTORY_ADDRESS=0x1234...
VITE_RWA_VAULT_ADDRESS=0x5678...
VITE_BEZ_COIN_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
─────────────────────────────────────────
```

### 4. Configurar Frontend

**frontend/.env**:
```env
VITE_RWA_FACTORY_ADDRESS=0x...
VITE_RWA_VAULT_ADDRESS=0x...
VITE_BEZ_COIN_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8

# IPFS (Pinata)
VITE_PINATA_API_KEY=your_key
VITE_PINATA_SECRET_KEY=your_secret
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

### 5. Restart Frontend

```bash
cd frontend
npm run dev
```

Navegar a: **http://localhost:5173/create** → Seleccionar "Real Estate (RWA)"

---

## 📖 Uso del Sistema

### Flujo de Tokenización

```
1. Usuario selecciona categoría (Hotel, Coche, etc.)
   ↓
2. Completa detalles del activo
   ↓
3. Define parámetros de tokenización (Supply, Precio, Yield)
   ↓
4. Sube documentación legal a IPFS (automático)
   ↓
5. Sistema cobra 100 BEZ de fee
   ↓
6. Smart Contract mintea fracciones al creador
   ↓
7. Activo disponible en Marketplace
```

### Flujo de Inversión

```
1. Inversor compra fracciones en Marketplace
   ↓
2. Manager del activo deposita rentas mensuales en Vault
   ↓
3. Inversor reclama dividendos proporcionales
   ↓
4. BEZ-Coin transferido automáticamente
```

---

## 💡 Casos de Uso

### Caso 1: Tokenizar un Hotel

```javascript
const hotelData = {
    name: "Hotel Paradise Beach Resort",
    category: ASSET_CATEGORIES.HOTEL,
    legalCID: "Qm...", // Licencia turística, escrituras
    imagesCID: "Qm...", // Fotos del hotel
    totalSupply: 5000,  // 5000 fracciones
    valuationUSD: 10000000, // $10M USD
    pricePerFraction: "200", // 200 BEZ/fracción
    estimatedYield: 1000, // 10% APY
    location: "Playa del Carmen, México"
};

await tokenizeAsset(hotelData);
// Result: AssetID #1 creado
```

**Resultado**:
- Inversor compra 100 fracciones = 20,000 BEZ
- Hotel genera $1M USD/año en rentas
- Inversor (100/5000 = 2%) recibe $20,000 USD/año
- Pagado en BEZ-Coin mensualmente

---

### Caso 2: Tokenizar un Coche de Lujo

```javascript
const carData = {
    name: "Ferrari F8 Tributo 2023",
    category: ASSET_CATEGORIES.COCHE,
    legalCID: "Qm...", // Título de propiedad, seguro
    imagesCID: "Qm...",
    totalSupply: 100, // Solo 100 fracciones
    valuationUSD: 300000, // $300K USD
    pricePerFraction: "300", // 300 BEZ
    estimatedYield: 500, // 5% APY (renta de alquiler)
    location: "Ferrari Roma - Matrícula: ABC123"
};

await tokenizeAsset(carData);
```

---

### Caso 3: Depósito de Rentas Mensuales

```javascript
// Manager del Hotel deposita rentas
await depositMonthlyRent(
    1, // Asset ID
    ethers.utils.parseEther("50000") // 50,000 BEZ
);

// Inversor reclama sus dividendos
const pending = await getPendingRewards(1, userAddress);
// "1000.00" BEZ (2% de 50,000)

await claimDividends(1);
// ✅ 1000 BEZ transferidos a la wallet del inversor
```

---

## 🔒 Seguridad y Compliance

### KYC Verification
Para activos de **alto valor** (Inmuebles, Hoteles, Barcos, Helicópteros):
- Compras >10% del supply requieren verificación KYC
- Solo el `owner` de la plataforma puede verificar inversores
- Bloqueo automático si no hay KYC

```solidity
function verifyInvestor(uint256 assetId, address investor) external onlyOwner {
    isVerified[assetId][investor] = true;
}
```

### Audit Checklist
- ✅ **ReentrancyGuard** en todas las funciones de transferencia
- ✅ **Pausable** para emergencias
- ✅ **Checks-Effects-Interactions** pattern
- ✅ **SafeERC20** para transferencias de BEZ-Coin
- ✅ Validación de inputs en frontend y backend

---

## 📊 Métricas del Sistema

| Métrica | Valor |
|---------|-------|
| **Fee de Tokenización** | 100 BEZ (~$1 USD) |
| **Categorías Soportadas** | 8 tipos de activos |
| **Red** | Polygon Mainnet (Chain ID: 137) |
| **Token de Pago** | BEZ-Coin (0xEcBa...11A8) |
| **Estándar de Fracciones** | ERC-1155 |
| **Almacenamiento Legal** | IPFS (Pinata) |
| **Gas Estimado** | ~0.05 MATIC por tokenización |

---

## 🛠️ Troubleshooting

### Error: "Tokenization fee payment failed"
**Causa**: Usuario no aprobó BEZ-Coin o balance insuficiente

**Solución**:
```javascript
// 1. Aprobar BEZ-Coin
await bezCoinContract.approve(
    RWA_FACTORY_ADDRESS,
    ethers.constants.MaxUint256
);

// 2. Verificar balance
const balance = await bezCoinContract.balanceOf(userAddress);
console.log("Balance:", ethers.utils.formatEther(balance), "BEZ");
```

---

### Error: "KYC verification required"
**Causa**: Compra de >10% del supply sin KYC

**Solución**:
1. Completar KYC en plataforma BeZhas
2. Admin ejecuta: `verifyInvestor(assetId, userAddress)`
3. Reintentar compra

---

## 🎓 Mejores Prácticas

1. **Documentación Legal**: Siempre subir PDFs verificables a IPFS
2. **Valoración Realista**: Usar tasadores certificados
3. **Yield Estimado**: Basarse en datos históricos, no especulativos
4. **Imágenes HD**: Mínimo 3 fotos por activo
5. **Categoría Correcta**: Facilita búsqueda en marketplace
6. **Supply Razonable**: 100-10,000 fracciones según valoración
7. **Precio Accesible**: Permitir pequeños inversores (ej: 50 BEZ/fracción)

---

## 📞 Soporte

- **GitHub**: [bezhas-web3/issues](https://github.com/bezhas/bezhas-web3)
- **Discord**: BeZhas Community
- **Email**: support@bez.digital

---

## 🚀 Roadmap

- [ ] **Q1 2026**: Integración con oráculos de precios (Chainlink)
- [ ] **Q2 2026**: Marketplace P2P con ofertas
- [ ] **Q3 2026**: Gobernanza DAO para asset managers
- [ ] **Q4 2026**: Cross-chain bridge (Ethereum, BSC)

---

**Desarrollado por BeZhas Team** 🚀  
**Última actualización**: Diciembre 2025  
**Versión**: 1.0.0
