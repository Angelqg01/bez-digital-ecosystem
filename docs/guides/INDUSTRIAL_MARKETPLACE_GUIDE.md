# 🏭 BeZhas Industrial Marketplace - Guía Completa

## 📋 Resumen Ejecutivo

BeZhas ahora soporta **dos tipos de ventas**:
- ✅ **NFTs Digitales** (Arte, Coleccionables, Inmuebles Virtuales)
- ✅ **Productos Físicos Industriales** (Ventas por peso, volumen, MOQ, bulk, etc.)

---

## 🎯 Arquitectura del Sistema

### **1. Frontend Components**

#### **CreateProductWizard.jsx** (Wizard de 6 Pasos)
**Ubicación:** `frontend/src/components/marketplace/CreateProductWizard.jsx`

**Funcionalidad:**
- **Paso 1:** Selección de Categoría y Tipo de Venta
  - 11 categorías (Industria, Electrónica, Agricultura, Construcción, etc.)
  - 7 tipos de venta (Unidad, Peso/Ton, Volumen/Litros, Área/m², Longitud/m, MOQ Bulk, Custom)
  
- **Paso 2:** Información Básica
  - Nombre del producto
  - Descripción detallada
  - Subida de imágenes (hasta 5, max 10MB cada una)
  
- **Paso 3:** Precio y Stock
  - Precio base por unidad seleccionada
  - Stock disponible (no aplica para NFTs)
  - MOQ (Cantidad Mínima de Pedido) si es venta bulk
  - Regalías por reventa (solo NFTs)
  
- **Paso 4:** Especificaciones Técnicas
  - Peso y dimensiones
  - Material, marca, modelo
  - País de fabricación (200+ países)
  - Certificaciones (ISO 9001, CE, FDA, RoHS, etc.)
  - Blockchain selection (solo NFTs)
  
- **Paso 5:** Logística
  - Métodos de envío (Standard, Express, Pallet, Container 20ft/40ft, Bulk, Refrigerado, etc.)
  - Tiempo de entrega (Lead Time)
  - Capacidad de producción
  - Métodos de pago aceptados (Tarjeta, PayPal, Transferencia, Escrow, Crypto, Carta de Crédito)
  
- **Paso 6:** Revisión Final
  - Vista previa del producto
  - Checkbox de términos y condiciones
  - Botón "Publicar Producto"

**Props:**
```javascript
<CreateProductWizard
  onComplete={(productData) => { /* Guardar producto */ }}
  onCancel={() => { /* Cerrar wizard */ }}
/>
```

**Estado del Producto:**
```javascript
{
  // Tipo y Categoría
  category: 'industry', // ID de categoría
  saleType: 'weight_ton', // ID de tipo de venta
  
  // Información Básica
  name: 'Panel Solar 500W Monocristalino',
  description: 'Panel solar de alta eficiencia...',
  images: ['url1', 'url2', 'url3'],
  
  // Precios y Stock
  price: '850',
  currency: 'BEZ',
  stock: '1000',
  moq: '100', // Solo si requiresMOQ
  bulkPricing: [
    { minQty: 100, price: 850 },
    { minQty: 500, price: 800 },
    { minQty: 1000, price: 750 }
  ],
  
  // Especificaciones
  specifications: {
    weight: '25 kg',
    dimensions: '2000x1000x40 mm',
    material: 'Silicio monocristalino',
    brand: 'SolarTech',
    model: 'ST-500M',
    country: 'CN', // Código ISO
    certifications: ['iso_9001', 'ce', 'rohs']
  },
  
  // Logística
  shippingMethods: ['palletized', 'container_20ft', 'container_40ft'],
  leadTime: '15_30_days',
  productionCapacity: '10,000 unidades/mes',
  
  // Pago
  paymentMethods: ['crypto', 'bank_transfer', 'escrow'],
  
  // NFT (solo si isNFT)
  royalties: 10, // %
  blockchain: 'ethereum',
  metadata: { tokenURI: 'ipfs://...' }
}
```

---

#### **marketplaceConstants.js** (Configuración Central)
**Ubicación:** `frontend/src/data/marketplaceConstants.js`

**Exports:**
```javascript
// Categorías (11 grupos)
export const MARKETPLACE_CATEGORIES = [
  {
    id: 'industry',
    label: '🏭 Industria & Manufactura',
    description: 'Equipos industriales, maquinaria pesada',
    saleTypes: ['unit', 'weight_ton', 'moq_bulk', 'custom']
  },
  // ... 10 más
];

// Tipos de Venta (7 tipos)
export const SALE_TYPES = {
  // NFTs
  nft_unique: { id: 'nft_unique', label: 'NFT Único', icon: '🎨', requiresMOQ: false },
  nft_edition: { id: 'nft_edition', label: 'Edición Limitada', icon: '🖼️' },
  nft_fractional: { id: 'nft_fractional', label: 'NFT Fraccionado', icon: '💎' },
  
  // Retail/B2B
  unit: { 
    id: 'unit', 
    label: 'Por Unidad', 
    icon: '📦', 
    units: ['pieza', 'caja', 'set'],
    requiresMOQ: false
  },
  
  // Industrial
  weight_ton: { 
    id: 'weight_ton', 
    label: 'Por Peso (Toneladas)', 
    icon: '⚖️', 
    units: ['ton', 'kg'],
    requiresMOQ: true
  },
  volume_liters: { 
    id: 'volume_liters', 
    label: 'Por Volumen', 
    icon: '🛢️', 
    units: ['L', 'm³', 'gal'],
    requiresMOQ: true
  },
  area_m2: { 
    id: 'area_m2', 
    label: 'Por Área', 
    icon: '📐', 
    units: ['m²', 'ft²'],
    requiresMOQ: false
  },
  length_meters: { 
    id: 'length_meters', 
    label: 'Por Longitud', 
    icon: '📏', 
    units: ['m', 'km', 'ft'],
    requiresMOQ: false
  },
  
  // Bulk
  moq_bulk: { 
    id: 'moq_bulk', 
    label: 'Venta al Mayor (MOQ)', 
    icon: '📦', 
    requiresMOQ: true,
    description: 'Requiere cantidad mínima de pedido'
  },
  
  // Custom
  custom: { 
    id: 'custom', 
    label: 'Cotización Personalizada', 
    icon: '📋',
    requiresMOQ: false
  }
};

// Métodos de Envío (10 opciones)
export const SHIPPING_METHODS = [
  { id: 'standard', name: 'Envío Estándar', estimatedTime: '5-7 días' },
  { id: 'express', name: 'Envío Express', estimatedTime: '2-3 días' },
  { id: 'palletized', name: 'Envío Paletizado', estimatedTime: '7-10 días' },
  { id: 'container_20ft', name: 'Contenedor 20ft', estimatedTime: '15-30 días' },
  { id: 'container_40ft', name: 'Contenedor 40ft', estimatedTime: '15-30 días' },
  { id: 'bulk_shipping', name: 'Envío a Granel', estimatedTime: '30-45 días' },
  { id: 'tank_truck', name: 'Camión Cisterna', estimatedTime: '5-10 días' },
  { id: 'refrigerated', name: 'Transporte Refrigerado', estimatedTime: '7-14 días' },
  { id: 'air_freight', name: 'Carga Aérea', estimatedTime: '3-5 días' },
  { id: 'maritime', name: 'Transporte Marítimo', estimatedTime: '30-60 días' }
];

// Métodos de Pago (8 opciones)
export const PAYMENT_METHODS = [
  { id: 'card', name: 'Tarjeta' },
  { id: 'paypal', name: 'PayPal' },
  { id: 'bank_transfer', name: 'Transferencia Bancaria' },
  { id: 'escrow', name: 'Escrow (Protección)' },
  { id: 'business_credit', name: 'Crédito Empresarial' },
  { id: 'crypto', name: 'Criptomonedas (BEZ, ETH, BTC)' },
  { id: 'cash', name: 'Efectivo en Entrega' },
  { id: 'letter_of_credit', name: 'Carta de Crédito (L/C)' }
];

// Certificaciones (8 tipos)
export const CERTIFICATIONS = [
  { id: 'iso_9001', name: 'ISO 9001', description: 'Gestión de Calidad' },
  { id: 'iso_14001', name: 'ISO 14001', description: 'Gestión Ambiental' },
  { id: 'ce', name: 'CE', description: 'Conformidad Europea' },
  { id: 'fda', name: 'FDA', description: 'Food & Drug Admin' },
  { id: 'rohs', name: 'RoHS', description: 'Sin sustancias peligrosas' },
  { id: 'fcc', name: 'FCC', description: 'Telecomunicaciones US' },
  { id: 'ul', name: 'UL', description: 'Underwriters Laboratories' },
  { id: 'reach', name: 'REACH', description: 'Regulación química EU' }
];

// Países de Fabricación (200+ países)
export const MANUFACTURING_COUNTRIES = [
  { code: 'CN', name: 'China' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'DE', name: 'Alemania' },
  { code: 'JP', name: 'Japón' },
  { code: 'MX', name: 'México' },
  // ... 195+ más
];

// Lead Times (Tiempos de Entrega)
export const LEAD_TIMES = [
  { id: 'immediate', label: 'Inmediato (Stock disponible)' },
  { id: '1_7_days', label: '1-7 días' },
  { id: '7_15_days', label: '7-15 días' },
  { id: '15_30_days', label: '15-30 días' },
  { id: '30_60_days', label: '30-60 días' },
  { id: '60_90_days', label: '60-90 días' },
  { id: 'custom', label: 'Personalizado (Bajo pedido)' }
];
```

**Helper Functions:**
```javascript
// Obtener tipos de venta por categoría
export const getSaleTypesForCategory = (categoryId) => {
  const category = MARKETPLACE_CATEGORIES.find(c => c.id === categoryId);
  return category.saleTypes.map(typeId => SALE_TYPES[typeId]);
};

// Calcular precio bulk
export const calculateBulkPrice = (quantity, bulkPricingTiers) => {
  const tier = bulkPricingTiers
    .filter(t => quantity >= t.minQty)
    .sort((a, b) => b.minQty - a.minQty)[0];
  return tier ? tier.price * quantity : 0;
};

// Estimar costo de envío
export const estimateShippingCost = (weight, shippingMethod, destination) => {
  const rates = {
    standard: 0.5, // por kg
    express: 2.0,
    palletized: 0.3,
    container_20ft: 5000, // flat rate
    container_40ft: 8000,
    bulk_shipping: 0.1,
    tank_truck: 3000,
    refrigerated: 1.5,
    air_freight: 5.0,
    maritime: 0.05
  };
  
  const baseRate = rates[shippingMethod] || 1;
  // Aplicar factores adicionales (distancia, urgencia, etc.)
  return baseRate * weight;
};
```

---

### **2. Integración en Marketplace**

#### **MarketplaceUnified.jsx** (Tab "Crear NFT" Actualizado)
**Ubicación:** `frontend/src/pages/MarketplaceUnified.jsx`

**Cambios:**
```javascript
const CreateNFTTab = ({ address, contracts }) => {
  const [showWizard, setShowWizard] = useState(false);
  
  const handleProductCreated = async (productData) => {
    const isNFT = productData.saleType?.startsWith('nft_');
    
    if (isNFT) {
      // Flujo tradicional: Mintear + Listar
      const newTokenId = await mintNFT(...);
      await createListing(...);
    } else {
      // Flujo industrial:
      // 1. Subir imágenes a IPFS
      // 2. Crear metadata extendida con specs
      // 3. Guardar en backend MongoDB
      // 4. Crear listing con metadata enriquecida
    }
  };
  
  return (
    <>
      <button onClick={() => setShowWizard(true)}>
        Crear Nuevo Producto
      </button>
      
      {showWizard && (
        <CreateProductWizard
          onComplete={handleProductCreated}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </>
  );
};
```

**Stats Cards:**
- Saldo BEZ actual
- 7 tipos de venta disponibles
- 11 categorías de productos

---

## 🔄 Flujo de Creación de Producto

### **A. NFT Digital (Arte, Coleccionable)**

1. Usuario selecciona **Categoría: Digital Art**
2. Sistema muestra **Tipos de Venta: NFT Único, Edición Limitada, NFT Fraccionado**
3. Usuario completa:
   - Nombre y descripción
   - Subida de artwork
   - Precio base
   - Regalías (0-50%)
   - Blockchain (Ethereum, Polygon, etc.)
4. Backend:
   - Sube imagen a IPFS
   - Crea metadata JSON con atributos
   - Sube metadata a IPFS
   - Mintea NFT en blockchain
   - Crea listing en marketplace
5. NFT listado y visible en "Explorar"

### **B. Producto Físico Industrial (Bulk)**

1. Usuario selecciona **Categoría: Industria & Manufactura**
2. Sistema muestra **Tipos de Venta: Unidad, Peso/Ton, Volumen, MOQ Bulk**
3. Usuario elige **"Venta al Mayor (MOQ)"**
4. Completa wizard:
   - Paso 1: Producto (Ej: Panel Solar 500W)
   - Paso 2: Descripción y fotos del producto
   - Paso 3: Precio $850/unidad, MOQ 100 unidades
   - Paso 4: Especificaciones (25kg, 2000x1000x40mm, ISO 9001, CE)
   - Paso 5: Envío paletizado/contenedor, Lead Time 15-30 días
   - Paso 6: Revisar y publicar
5. Backend:
   - Sube imágenes a IPFS
   - Crea metadata extendida:
     ```json
     {
       "name": "Panel Solar 500W",
       "description": "...",
       "images": ["ipfs://...", "ipfs://..."],
       "category": "industry",
       "saleType": "moq_bulk",
       "price": 850,
       "currency": "BEZ",
       "moq": 100,
       "stock": 1000,
       "bulkPricing": [
         { "minQty": 100, "price": 850 },
         { "minQty": 500, "price": 800 }
       ],
       "specifications": {
         "weight": "25 kg",
         "dimensions": "2000x1000x40 mm",
         "material": "Silicio monocristalino",
         "certifications": ["ISO 9001", "CE", "RoHS"]
       },
       "shipping": {
         "methods": ["palletized", "container_20ft"],
         "leadTime": "15-30 días",
         "productionCapacity": "10,000/mes"
       },
       "payment": ["crypto", "bank_transfer", "escrow"]
     }
     ```
   - Guarda en MongoDB (colección `products`)
   - Crea listing en smart contract (o referencia offchain)
6. Producto listado con badge "MOQ 100 unidades"

---

## 📂 Estructura de Archivos

```
frontend/
├── src/
│   ├── components/
│   │   └── marketplace/
│   │       ├── CreateProductWizard.jsx ✨ NUEVO
│   │       └── BeZhasMarketplace.jsx
│   │
│   ├── data/
│   │   └── marketplaceConstants.js ✨ NUEVO
│   │
│   └── pages/
│       └── MarketplaceUnified.jsx 🔄 ACTUALIZADO
│
backend/
├── models/
│   └── Product.js ⏳ PENDIENTE (Schema MongoDB)
│
└── routes/
    └── products.js ⏳ PENDIENTE (API REST)

contracts/
└── BeZhasMarketplace.sol 🔄 ACTUALIZAR (Soporte bulk metadata)
```

---

## 🚀 Estado Actual

### ✅ **COMPLETADO**

1. ✅ **CreateProductWizard.jsx** - Wizard completo de 6 pasos
   - Formulario intuitivo con validación
   - Soporte NFTs + Productos Físicos
   - Animaciones con Framer Motion
   - Dark mode support
   - Responsive (mobile/desktop)

2. ✅ **marketplaceConstants.js** - Configuración centralizada
   - 11 categorías principales
   - 7 tipos de venta con metadata
   - 10 métodos de envío
   - 8 métodos de pago
   - 8 certificaciones industriales
   - 200+ países de fabricación
   - Helper functions (pricing, shipping)

3. ✅ **MarketplaceUnified.jsx** - Integración
   - Reemplazó formulario simple con wizard
   - Stats cards (Saldo BEZ, Tipos, Categorías)
   - Modal fullscreen para wizard
   - Lógica de decisión NFT vs Físico

4. ✅ **Documentación** - Esta guía completa

---

### ⏳ **PENDIENTE (Next Steps)**

#### **1. Backend API (Node.js + MongoDB)**

**Archivo:** `backend/models/Product.js`
```javascript
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // Básico
  name: { type: String, required: true },
  description: { type: String, required: true },
  images: [String],
  
  // Clasificación
  category: { type: String, required: true },
  saleType: { type: String, required: true },
  
  // Precio
  price: { type: Number, required: true },
  currency: { type: String, default: 'BEZ' },
  stock: { type: Number, default: 0 },
  moq: { type: Number, default: 1 },
  bulkPricing: [{
    minQty: Number,
    price: Number
  }],
  
  // Especificaciones
  specifications: {
    weight: String,
    dimensions: String,
    material: String,
    brand: String,
    model: String,
    country: String,
    certifications: [String]
  },
  
  // Logística
  shippingMethods: [String],
  leadTime: String,
  productionCapacity: String,
  
  // Pago
  paymentMethods: [String],
  
  // NFT (opcional)
  isNFT: { type: Boolean, default: false },
  tokenId: { type: String, sparse: true },
  blockchain: String,
  royalties: Number,
  
  // Metadata
  seller: { type: String, required: true }, // Wallet address
  status: { type: String, enum: ['draft', 'active', 'sold', 'inactive'], default: 'draft' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
```

**Archivo:** `backend/routes/products.js`
```javascript
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET /api/products - Listar todos (con filtros)
router.get('/', async (req, res) => {
  const { category, saleType, minPrice, maxPrice, search } = req.query;
  
  let query = { status: 'active' };
  if (category) query.category = category;
  if (saleType) query.saleType = saleType;
  if (minPrice || maxPrice) query.price = { $gte: minPrice, $lte: maxPrice };
  if (search) query.$text = { $search: search };
  
  const products = await Product.find(query).sort({ createdAt: -1 });
  res.json(products);
});

// POST /api/products - Crear producto
router.post('/', async (req, res) => {
  const productData = req.body;
  const newProduct = new Product(productData);
  await newProduct.save();
  res.status(201).json(newProduct);
});

// GET /api/products/:id - Detalle de producto
router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

// PUT /api/products/:id - Actualizar producto
router.put('/:id', async (req, res) => {
  const updated = await Product.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedAt: Date.now() },
    { new: true }
  );
  res.json(updated);
});

// DELETE /api/products/:id - Eliminar producto
router.delete('/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Producto eliminado' });
});

module.exports = router;
```

**Agregar en `backend/server.js`:**
```javascript
const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);
```

---

#### **2. Subida de Imágenes a IPFS**

**Archivo:** `frontend/src/utils/ipfsUpload.js`
```javascript
import axios from 'axios';

const PINATA_API_KEY = process.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.VITE_PINATA_SECRET_KEY;

export const uploadImageToIPFS = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
      }
    }
  );

  return `ipfs://${response.data.IpfsHash}`;
};

export const uploadJSONToIPFS = async (metadata) => {
  const response = await axios.post(
    'https://api.pinata.cloud/pinning/pinJSONToIPFS',
    metadata,
    {
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
      }
    }
  );

  return `ipfs://${response.data.IpfsHash}`;
};
```

**Uso en Wizard:**
```javascript
// En CreateProductWizard.jsx - Paso 2 (Imágenes)
const handleImageUpload = async (files) => {
  const uploadedURLs = [];
  
  for (const file of files) {
    const ipfsURL = await uploadImageToIPFS(file);
    uploadedURLs.push(ipfsURL);
  }
  
  updateField('images', uploadedURLs);
};
```

---

#### **3. Smart Contract Update**

**Archivo:** `contracts/BeZhasMarketplace.sol`

Agregar soporte para metadata extendida:

```solidity
struct Listing {
    uint256 listingId;
    address seller;
    address nftContract;
    uint256 tokenId;
    uint256 price;
    bool active;
    string metadataURI; // ✨ NUEVO: Apunta a JSON con specs industriales
    string saleType;    // ✨ NUEVO: 'nft_unique', 'weight_ton', 'moq_bulk', etc.
    uint256 moq;        // ✨ NUEVO: Minimum Order Quantity
}

function createListing(
    address _nftContract,
    uint256 _tokenId,
    uint256 _price,
    string memory _metadataURI,
    string memory _saleType,
    uint256 _moq
) external {
    // ... lógica existente +
    listings[nextListingId] = Listing({
        listingId: nextListingId,
        seller: msg.sender,
        nftContract: _nftContract,
        tokenId: _tokenId,
        price: _price,
        active: true,
        metadataURI: _metadataURI,
        saleType: _saleType,
        moq: _moq
    });
    // ...
}
```

---

#### **4. Sistema de Cotización (RFQ)**

**Archivo:** `backend/models/Quotation.js`
```javascript
const QuotationSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  buyer: { type: String, required: true }, // Wallet address
  quantity: { type: Number, required: true },
  message: String,
  status: { type: String, enum: ['pending', 'quoted', 'accepted', 'rejected'], default: 'pending' },
  vendorResponse: {
    price: Number,
    leadTime: String,
    message: String,
    respondedAt: Date
  },
  createdAt: { type: Date, default: Date.now }
});
```

**Flujo:**
1. Comprador ve producto bulk con MOQ alto
2. Click "Request Quotation"
3. Llena formulario (cantidad, comentarios)
4. Vendor recibe notificación
5. Vendor responde con precio/tiempo personalizado
6. Comprador acepta y procede al pago

---

#### **5. Filtros Avanzados en Marketplace**

**Actualizar `ExploreTab` en MarketplaceUnified.jsx:**

```javascript
const [filters, setFilters] = useState({
  category: '',
  saleType: '',
  minPrice: 0,
  maxPrice: 10000,
  certifications: [],
  shippingMethods: [],
  countries: []
});

// Agregar sidebar con filtros
<div className="flex gap-6">
  {/* Sidebar Filters */}
  <div className="w-64 space-y-4">
    <h3>Filtros</h3>
    
    {/* Categoría */}
    <select onChange={(e) => setFilters({...filters, category: e.target.value})}>
      <option value="">Todas las categorías</option>
      {MARKETPLACE_CATEGORIES.map(cat => (
        <option key={cat.id} value={cat.id}>{cat.label}</option>
      ))}
    </select>
    
    {/* Tipo de Venta */}
    <div>
      <h4>Tipo de Venta</h4>
      {Object.values(SALE_TYPES).map(type => (
        <label key={type.id}>
          <input
            type="checkbox"
            checked={filters.saleType === type.id}
            onChange={(e) => setFilters({...filters, saleType: e.target.checked ? type.id : ''})}
          />
          {type.icon} {type.label}
        </label>
      ))}
    </div>
    
    {/* Rango de Precio */}
    <div>
      <h4>Precio (BEZ)</h4>
      <input
        type="range"
        min="0"
        max="10000"
        value={filters.maxPrice}
        onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
      />
      <span>0 - {filters.maxPrice} BEZ</span>
    </div>
    
    {/* Certificaciones */}
    <div>
      <h4>Certificaciones</h4>
      {CERTIFICATIONS.map(cert => (
        <label key={cert.id}>
          <input
            type="checkbox"
            checked={filters.certifications.includes(cert.id)}
            onChange={(e) => {
              const updated = e.target.checked
                ? [...filters.certifications, cert.id]
                : filters.certifications.filter(c => c !== cert.id);
              setFilters({...filters, certifications: updated});
            }}
          />
          {cert.name}
        </label>
      ))}
    </div>
  </div>
  
  {/* Product Grid */}
  <div className="flex-1">
    <NFTGrid listingIds={filteredListingIds} />
  </div>
</div>
```

---

## 🎨 Mejoras de UX Pendientes

1. **Drag & Drop Images** - Implementar zona de arrastre para fotos
2. **Bulk Pricing Calculator** - Widget interactivo que muestra descuentos según cantidad
3. **Shipping Cost Estimator** - Calcular costo de envío según destino y peso
4. **Product Comparison Table** - Comparar hasta 4 productos lado a lado
5. **Vendor Profile** - Página de perfil del vendedor con ratings y reviews
6. **Chat en Vivo** - Sistema de mensajería entre buyer/seller
7. **Wishlist** - Guardar productos favoritos
8. **Order Tracking** - Seguimiento de pedidos con estados (Pending, Shipped, Delivered)

---

## 🔐 Consideraciones de Seguridad

1. **Validación Backend:** Nunca confiar en datos del frontend
2. **Escrow Smart Contract:** Retener fondos hasta confirmación de entrega
3. **KYC para Vendedores:** Verificación de identidad para ventas bulk
4. **Dispute Resolution:** Sistema de resolución de conflictos
5. **Gas Optimization:** Minimizar interacciones on-chain para productos físicos (usar off-chain storage)

---

## 📊 Métricas Propuestas

**Panel de Vendor:**
- Total ventas (BEZ/USD)
- Productos activos
- Pedidos pendientes
- Rating promedio
- Top productos vendidos
- Mapa de compradores (geolocalización)

**Panel de Admin:**
- Total GMV (Gross Merchandise Volume)
- Productos por categoría
- Métodos de pago más usados
- Países con más actividad
- Certificaciones más solicitadas

---

## 🌍 Roadmap

### **Fase 1: MVP (Actual)** ✅
- [x] Wizard de creación completo
- [x] Constantes y configuración
- [x] Integración en marketplace

### **Fase 2: Backend + IPFS** ⏳
- [ ] MongoDB schema y API REST
- [ ] Subida de imágenes a IPFS
- [ ] Smart contract metadata extendida

### **Fase 3: UX Avanzado** 🔜
- [ ] Filtros y búsqueda avanzada
- [ ] Cotizaciones (RFQ)
- [ ] Comparador de productos
- [ ] Vendor profiles

### **Fase 4: Logística** 🔮
- [ ] Integración con APIs de envío (DHL, FedEx)
- [ ] Tracking de pedidos
- [ ] Escrow con liberación automática
- [ ] Dispute resolution

### **Fase 5: B2B Features** 🚀
- [ ] Net 30/60 payment terms
- [ ] Bulk order templates
- [ ] Purchase orders (PO) system
- [ ] EDI integration
- [ ] Multi-currency support

---

## 📞 Soporte

**Documentación Técnica:**
- `marketplaceConstants.js` - Referencia de todas las constantes
- `CreateProductWizard.jsx` - Código del wizard comentado
- `INDUSTRIAL_MARKETPLACE_GUIDE.md` - Esta guía

**Contacto:**
- GitHub Issues: Para bugs y feature requests
- Discord: Canal #marketplace-dev
- Email: dev@bez.digital

---

## 🎯 Resumen

**Lo que está funcionando AHORA:**
✅ Wizard de 6 pasos con validación
✅ Soporte NFTs + Productos Físicos
✅ 11 categorías, 7 tipos de venta
✅ Especificaciones técnicas completas
✅ Métodos de envío y pago

**Lo que falta implementar:**
⏳ Backend API (MongoDB + Express)
⏳ Subida de imágenes a IPFS
⏳ Smart contract update
⏳ Sistema de cotizaciones (RFQ)
⏳ Filtros avanzados en marketplace

**Siguiente Paso Inmediato:**
1. Crear `backend/models/Product.js`
2. Crear `backend/routes/products.js`
3. Implementar `uploadImageToIPFS()` en wizard
4. Actualizar smart contract con `metadataURI` y `saleType`

---

**¡El marketplace industrial de BeZhas está listo para despegar! 🚀**
