# 📚 Guía de Integración de Contratos - BeZhas Platform

**Versión**: 1.0  
**Network**: Polygon Mainnet (ChainID: 137)  
**Última actualización**: Enero 2026

## 📋 Tabla de Contenidos

1. [Contratos Desplegados](#contratos-desplegados)
2. [Integración Backend](#integración-backend)
3. [Integración Frontend](#integración-frontend)
4. [ABIs y Tipos](#abis-y-tipos)
5. [Eventos a Escuchar](#eventos-a-escuchar)
6. [Ejemplos de Uso](#ejemplos-de-uso)
7. [Testing y Validación](#testing-y-validación)

---

## 🎯 Contratos Desplegados

| Contrato | Dirección | Función Principal |
|----------|-----------|-------------------|
| **BEZ-Coin** | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` | Token principal de la plataforma |
| **BeZhasQualityEscrow** | `0x3088573c025F197A886b97440761990c9A9e83C9` | Validación de calidad de posts |
| **BeZhasRWAFactory** | `0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0` | Creación de activos RWA |
| **BeZhasVault** | `0xCDd23058bf8143680f0A320318604bB749f701ED` | Gestión de RWA |
| **GovernanceSystem** | `0x304Fd77f64C03482edcec0923f0Cd4A066a305F3` | DAO y votaciones |
| **BeZhasCore** | `0x260A9fBcE1c6817c04e51c170b5BFd8d594c0d8A` | Sistema de rewards y automatización |
| **LiquidityFarming** | `0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26` | Staking y farming |
| **NFTOffers** | `0x0C9Bf667b838f6d466619ddb90a08d6c9A64d0A4` | Ofertas en NFTs |
| **NFTRental** | `0x96B1754BbfdC5a2f6013A8a04cB6AF2E4090C024` | Alquiler de NFTs |
| **BeZhasMarketplace** | `0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE` | Marketplace de productos |
| **BeZhasAdminRegistry** | `0xfCe2F7dcf1786d1606b9b858E9ba04dA499F1e3C` | Gestión de admins |

### 🔗 Enlaces de Verificación

Todos los contratos están verificados en Polygonscan:
```
https://polygonscan.com/address/<CONTRACT_ADDRESS>#code
```

---

## 🔧 Integración Backend

### 1. Configuración Inicial

**Archivo**: `backend/config/contracts.js`

```javascript
const { ethers } = require('ethers');

// RPC Provider (Polygon Mainnet)
const provider = new ethers.providers.JsonRpcProvider(
  process.env.POLYGON_MAINNET_RPC || 'https://polygon-bor.publicnode.com'
);

// Direcciones de contratos desde .env
const CONTRACTS = {
  BEZCOIN: process.env.BEZCOIN_ADDRESS,
  QUALITY_ESCROW: process.env.QUALITY_ESCROW_ADDRESS,
  RWA_FACTORY: process.env.RWA_FACTORY,
  RWA_VAULT: process.env.RWA_VAULT,
  GOVERNANCE: process.env.GOVERNANCE_SYSTEM_ADDRESS,
  CORE: process.env.BEZHAS_CORE_ADDRESS,
  FARMING: process.env.LIQUIDITY_FARMING_ADDRESS,
  NFT_OFFERS: process.env.NFT_OFFERS_ADDRESS,
  NFT_RENTAL: process.env.NFT_RENTAL_ADDRESS,
  MARKETPLACE: process.env.BEZHAS_MARKETPLACE_ADDRESS,
  ADMIN_REGISTRY: process.env.ADMIN_REGISTRY_ADDRESS
};

// ABIs (importar desde artifacts)
const BEZHAS_CORE_ABI = require('../../artifacts/contracts/BeZhasCore.sol/BeZhasCore.json').abi;
const MARKETPLACE_ABI = require('../../artifacts/contracts/BeZhasMarketplace.sol/BeZhasMarketplace.json').abi;
// ... importar otros ABIs necesarios

module.exports = {
  provider,
  CONTRACTS,
  BEZHAS_CORE_ABI,
  MARKETPLACE_ABI
  // ... exportar otros ABIs
};
```

### 2. Listener de Eventos

**Archivo**: `backend/services/blockchain/eventListener.js`

```javascript
const { ethers } = require('ethers');
const { provider, CONTRACTS, MARKETPLACE_ABI } = require('../../config/contracts');

class BlockchainEventListener {
  constructor() {
    this.marketplace = new ethers.Contract(
      CONTRACTS.MARKETPLACE,
      MARKETPLACE_ABI,
      provider
    );
  }

  async startListening() {
    console.log('🔊 Escuchando eventos blockchain...');

    // Evento: Producto Creado
    this.marketplace.on('ProductCreated', async (id, seller, price, metadataCID, event) => {
      console.log('📦 Nuevo producto creado:', {
        id: id.toString(),
        seller,
        price: ethers.utils.formatEther(price),
        metadataCID
      });

      // Sincronizar con tu base de datos
      await this.syncProductToDatabase({
        contractId: id.toString(),
        seller,
        price: ethers.utils.formatEther(price),
        metadataCID,
        txHash: event.transactionHash
      });
    });

    // Evento: Producto Vendido
    this.marketplace.on('ProductSold', async (id, buyer, price, timestamp, event) => {
      console.log('💰 Producto vendido:', {
        id: id.toString(),
        buyer,
        price: ethers.utils.formatEther(price)
      });

      await this.updateProductSoldStatus(id.toString(), buyer, event.transactionHash);
    });

    // Evento: Vendor Registrado
    this.marketplace.on('VendorStatusUpdated', async (user, status, timestamp) => {
      console.log('👤 Vendor actualizado:', { user, status });
      await this.syncVendorStatus(user, status);
    });
  }

  async syncProductToDatabase(productData) {
    // Implementar lógica para guardar en MongoDB
    // Ejemplo:
    // const Product = require('../../models/Product');
    // await Product.create(productData);
  }

  async updateProductSoldStatus(productId, buyer, txHash) {
    // Actualizar estado del producto en DB
  }

  async syncVendorStatus(userAddress, isVendor) {
    // Actualizar estado de vendor en User model
  }

  stopListening() {
    this.marketplace.removeAllListeners();
    console.log('🔇 Event listeners detenidos');
  }
}

module.exports = new BlockchainEventListener();
```

### 3. Servicio de Interacción con Contratos

**Archivo**: `backend/services/blockchain/contractService.js`

```javascript
const { ethers } = require('ethers');
const { provider, CONTRACTS, BEZHAS_CORE_ABI } = require('../../config/contracts');

class ContractService {
  constructor() {
    // Wallet con private key para transacciones automatizadas
    this.wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
    this.coreContract = new ethers.Contract(CONTRACTS.CORE, BEZHAS_CORE_ABI, this.wallet);
  }

  /**
   * Distribuir rewards diarios a un usuario
   */
  async distributeRewards(userAddress, amount) {
    try {
      const amountWei = ethers.utils.parseEther(amount.toString());
      
      const tx = await this.coreContract.distributeRewards(userAddress, amountWei, {
        maxPriorityFeePerGas: ethers.utils.parseUnits('50', 'gwei'),
        maxFeePerGas: ethers.utils.parseUnits('500', 'gwei')
      });

      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error distribuyendo rewards:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verificar si un usuario es admin
   */
  async isUserAdmin(address) {
    const adminRegistry = new ethers.Contract(
      CONTRACTS.ADMIN_REGISTRY,
      ['function isAdmin(address) view returns (bool)'],
      provider
    );

    return await adminRegistry.isAdmin(address);
  }

  /**
   * Obtener balance de BEZ de un usuario
   */
  async getUserBezBalance(address) {
    const bezToken = new ethers.Contract(
      CONTRACTS.BEZCOIN,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );

    const balance = await bezToken.balanceOf(address);
    return ethers.utils.formatEther(balance);
  }
}

module.exports = new ContractService();
```

### 4. Endpoints de API

**Archivo**: `backend/routes/blockchain.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const contractService = require('../services/blockchain/contractService');
const { authenticate } = require('../middleware/auth');

// GET balance de BEZ del usuario
router.get('/balance/:address', async (req, res) => {
  try {
    const balance = await contractService.getUserBezBalance(req.params.address);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST distribuir rewards (admin only)
router.post('/rewards/distribute', authenticate, async (req, res) => {
  try {
    const { userAddress, amount } = req.body;
    
    // Verificar que el solicitante es admin
    const isAdmin = await contractService.isUserAdmin(req.user.wallet);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result = await contractService.distributeRewards(userAddress, amount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET verificar admin status
router.get('/admin/check/:address', async (req, res) => {
  try {
    const isAdmin = await contractService.isUserAdmin(req.params.address);
    res.json({ isAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### 5. Inicialización en server.js

**Archivo**: `backend/server.js` (agregar)

```javascript
// ... imports existentes

const eventListener = require('./services/blockchain/eventListener');
const blockchainRoutes = require('./routes/blockchain.routes');

// ... configuración de Express

// Rutas blockchain
app.use('/api/blockchain', blockchainRoutes);

// Iniciar event listener si está habilitado
if (process.env.AUTOMATION_ENABLED === 'true') {
  eventListener.startListening().catch(console.error);
}

// ... resto del código
```

---

## ⚛️ Integración Frontend

### 1. Configuración de Wagmi/Viem

**Archivo**: `frontend/src/config/web3.js`

```javascript
import { createConfig, http } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const CONTRACTS = {
  BEZCOIN: import.meta.env.VITE_BEZCOIN_ADDRESS,
  QUALITY_ESCROW: import.meta.env.VITE_QUALITY_ESCROW_ADDRESS,
  RWA_FACTORY: import.meta.env.VITE_RWA_FACTORY_ADDRESS,
  RWA_VAULT: import.meta.env.VITE_RWA_VAULT_ADDRESS,
  GOVERNANCE: import.meta.env.VITE_GOVERNANCE_SYSTEM_ADDRESS,
  CORE: import.meta.env.VITE_BEZHAS_CORE_ADDRESS,
  FARMING: import.meta.env.VITE_LIQUIDITY_FARMING_ADDRESS,
  NFT_OFFERS: import.meta.env.VITE_NFT_OFFERS_ADDRESS,
  NFT_RENTAL: import.meta.env.VITE_NFT_RENTAL_ADDRESS,
  MARKETPLACE: import.meta.env.VITE_BEZHAS_MARKETPLACE_ADDRESS,
  ADMIN_REGISTRY: import.meta.env.VITE_ADMIN_REGISTRY_ADDRESS
};

export const config = createConfig({
  chains: [polygon],
  connectors: [
    injected(),
    walletConnect({ projectId: 'YOUR_WALLETCONNECT_PROJECT_ID' })
  ],
  transports: {
    [polygon.id]: http()
  }
});
```

### 2. Hooks Personalizados

**Archivo**: `frontend/src/hooks/useBeZhasContracts.js`

```javascript
import { useReadContract, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { CONTRACTS } from '../config/web3';
import MarketplaceABI from '../abis/BeZhasMarketplace.json';

export function useMarketplace() {
  const { writeContract } = useWriteContract();

  // Registrarse como vendor
  const registerAsVendor = async () => {
    return writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MarketplaceABI.abi,
      functionName: 'registerAsVendor',
      args: []
    });
  };

  // Crear producto
  const createProduct = async (price, metadataCID) => {
    return writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MarketplaceABI.abi,
      functionName: 'createProduct',
      args: [parseEther(price.toString()), metadataCID]
    });
  };

  return {
    registerAsVendor,
    createProduct
  };
}

export function useIsAdmin(address) {
  return useReadContract({
    address: CONTRACTS.ADMIN_REGISTRY,
    abi: [{ name: 'isAdmin', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] }],
    functionName: 'isAdmin',
    args: [address]
  });
}

export function useBezBalance(address) {
  return useReadContract({
    address: CONTRACTS.BEZCOIN,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: [address]
  });
}
```

### 3. Componente de Ejemplo

**Archivo**: `frontend/src/components/Marketplace/CreateProduct.jsx`

```jsx
import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { useMarketplace } from '../../hooks/useBeZhasContracts';
import { toast } from 'react-hot-toast';

export default function CreateProduct() {
  const { address } = useAccount();
  const { createProduct } = useMarketplace();
  const [price, setPrice] = useState('');
  const [metadataCID, setMetadataCID] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tx = await createProduct(price, metadataCID);
      toast.success('Producto creado! Tx: ' + tx.hash);
      
      // Limpiar formulario
      setPrice('');
      setMetadataCID('');
    } catch (error) {
      console.error(error);
      toast.error('Error creando producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label>Precio (BEZ)</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div>
        <label>IPFS CID (Metadata)</label>
        <input
          type="text"
          value={metadataCID}
          onChange={(e) => setMetadataCID(e.target.value)}
          required
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !address}
        className="w-full bg-blue-500 text-white p-2 rounded disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear Producto'}
      </button>
    </form>
  );
}
```

---

## 📡 Eventos a Escuchar

### BeZhasMarketplace

```solidity
event VendorStatusUpdated(address indexed user, bool status, uint256 timestamp);
event ProductCreated(uint256 indexed id, address indexed seller, uint256 price, string metadataCID);
event ProductSold(uint256 indexed id, address indexed buyer, uint256 price, uint256 timestamp);
event PriceUpdated(uint256 indexed id, uint256 newPrice);
```

### NFTOffers

```solidity
event OfferCreated(bytes32 indexed offerId, address indexed offerer, address indexed nftContract, uint256 tokenId, uint256 amount);
event OfferAccepted(bytes32 indexed offerId, address indexed seller);
event OfferCancelled(bytes32 indexed offerId);
event OfferExpired(bytes32 indexed offerId);
```

### BeZhasCore

```solidity
event RewardDistributed(address indexed user, uint256 amount, string reason);
event UserStaked(address indexed user, uint256 amount);
event UserUnstaked(address indexed user, uint256 amount);
```

---

## 🧪 Testing y Validación

### Script de Testing

**Archivo**: `scripts/test-integration.js`

```javascript
const { ethers } = require('ethers');
require('dotenv').config();

async function testIntegration() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_MAINNET_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log('🧪 Testing Integration...');

  // 1. Test: Verificar balance de BEZ
  const bezToken = new ethers.Contract(
    process.env.BEZCOIN_ADDRESS,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  const balance = await bezToken.balanceOf(wallet.address);
  console.log('✅ BEZ Balance:', ethers.utils.formatEther(balance));

  // 2. Test: Verificar si es admin
  const adminRegistry = new ethers.Contract(
    process.env.ADMIN_REGISTRY_ADDRESS,
    ['function isAdmin(address) view returns (bool)'],
    provider
  );
  const isAdmin = await adminRegistry.isAdmin(wallet.address);
  console.log('✅ Is Admin:', isAdmin);

  // 3. Test: Leer contador de productos
  const marketplace = new ethers.Contract(
    process.env.BEZHAS_MARKETPLACE_ADDRESS,
    ['function productCounter() view returns (uint256)'],
    provider
  );
  const productCount = await marketplace.productCounter();
  console.log('✅ Product Count:', productCount.toString());

  console.log('\n🎉 All tests passed!');
}

testIntegration().catch(console.error);
```

---

## 📝 Notas Importantes

1. **Gas Fees**: Todas las transacciones en Polygon Mainnet requieren MATIC para gas
2. **Approvals**: Los usuarios deben aprobar BEZ tokens antes de usar contratos que lo requieran
3. **Rate Limiting**: Implementar rate limiting en endpoints que llamen a la blockchain
4. **Error Handling**: Siempre manejar errores de transacciones (revert, out of gas, etc.)
5. **Security**: Nunca exponer private keys en el frontend, solo en backend con variables de entorno

---

## 🔗 Referencias

- [Polygonscan](https://polygonscan.com)
- [Wagmi Documentation](https://wagmi.sh)
- [Ethers.js Documentation](https://docs.ethers.org/v5/)
- [Hardhat Documentation](https://hardhat.org/docs)

---

**Última actualización**: Enero 2026  
**Mantenedor**: BeZhas Development Team
