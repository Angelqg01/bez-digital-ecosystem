# BeZhas Universal SDK - Guía de Implementación Multi-Sector

## 📋 Tabla de Contenidos
- [Instalación](#instalación)
- [Configuración Rápida](#configuración-rápida)
- [Sectores Disponibles](#sectores-disponibles)
- [Uso por Sector](#uso-por-sector)
- [Sistema de Permisos](#sistema-de-permisos)
- [Ejemplos Prácticos](#ejemplos-prácticos)

---

## 🚀 Instalación

El SDK de BeZhas se distribuye como un paquete profesional a través de NPM y CDN.
**No copie y pegue código fuente en su proyecto** para garantizar seguridad y actualizaciones.

### Opción A: Node.js / React / Vue (Recomendado)
Para aplicaciones modernas, instale el paquete vía NPM:

```bash
npm install @bezhas/sdk
```

Uso:
```javascript
import { BeZhas } from '@bezhas/sdk';

const client = new BeZhas({
  apiKey: 'bz_prod_xxxxxxxxxxxxx',
  endpoint: 'https://api.bezhas.com/v1'
});
```

### Opción B: HTML / CDN (Legacy)
Para sitios web estáticos o sin proceso de build, use nuestra CDN global:

```html
<script src="https://cdn.bezhas.com/sdk/v1/bezhas-sdk.min.js"></script>

<script>
  // 'BeZhas' está disponible globalmente en window.BeZhas
  const client = new BeZhas.BeZhas({
    apiKey: 'bz_prod_xxxxxxxxxxxxx'
  });
</script>
```

### Opción C: Plugins Nativos (No-Code)
Si usa una plataforma CMS, descargue el plugin oficial:
- [Wordpress / WooCommerce Plugin](https://plugins.bezhas.com/wordpress)
- [Shopify App](https://apps.shopify.com/bezhas)
- [Magento Extension](https://marketplace.magento.com/bezhas)

---

## ⚡ Configuración Rápida

### 1. Obtener API Key
Accede a [Developer Console](https://bezhas.com/developer) y crea una API Key:
- Selecciona tu sector de negocio
- Configura permisos granulares
- Copia la API Key (solo se muestra una vez)

### 2. Inicializar SDK
```javascript
const BeZhas = new BeZhasUniversal({
  apiKey: 'bz_prod_xxxxxxxxxxxxx',
  endpoint: 'https://api.bezhas.com/v1',
  debug: true // Solo en desarrollo
});
```

---

## 🏢 Sectores Disponibles

### Tier 1 - Alta Demanda
| Sector | Módulo | Casos de Uso |
|--------|--------|--------------|
| 🏠 **Real Estate** | `BeZhas.realestate` | Tokenización de propiedades, fraccionamiento, rentas |
| 🏥 **Healthcare** | `BeZhas.healthcare` | Supply chain médico, registros HIPAA, prescripciones |
| 🚗 **Automotive** | `BeZhas.automotive` | Tokenización de vehículos, historial mantenimiento |
| 🏭 **Manufacturing** | `BeZhas.manufacturing` | IoT industrial, gemelos digitales, certificación ISO |
| ⚡ **Energy** | `BeZhas.energy` | Trading de créditos renovables, balance de red |
| 🌾 **Agriculture** | `BeZhas.agriculture` | Farm-to-table, certificación orgánica, tokenización |

### Tier 2 - Crecimiento
| Sector | Módulo | Casos de Uso |
|--------|--------|--------------|
| 🎓 **Education** | `BeZhas.education` | Credenciales NFT, certificados verificables |
| 🛡️ **Insurance** | `BeZhas.insurance` | Seguros paramétricos, claims automáticos |
| 🎬 **Entertainment** | `BeZhas.entertainment` | NFTs creativos, royalties automáticos |
| ⚖️ **Legal** | `BeZhas.legal` | Smart contracts legales, notarización blockchain |

### Tier 3 - Innovación
| Sector | Módulo | Casos de Uso |
|--------|--------|--------------|
| 📦 **Supply Chain** | `BeZhas.supply` | Trazabilidad provenance, customs clearance |
| 🏛️ **Government** | `BeZhas.government` | Identidad digital, votación, registros públicos |
| 🌱 **Carbon** | `BeZhas.carbon` | Trading de créditos, offset verification |

---

## 💻 Uso por Sector

### 🏠 Real Estate
```javascript
// Tokenizar propiedad
const property = await BeZhas.realestate.tokenizeProperty({
  address: '123 Main St, Miami, FL',
  propertyType: 'residential',
  valuation: 500000,
  cadastralReference: 'CAD-123456',
  legalDocuments: ['deed.pdf', 'inspection.pdf']
});

// Fraccionar propiedad (10 inversores)
const fractions = await BeZhas.realestate.fractionateProperty(
  property.tokenId,
  10
);

// Cobrar renta mensual
const rent = await BeZhas.realestate.collectRent({
  propertyId: property.tokenId,
  amount: 2500,
  month: '2026-01'
});
```

### 🏥 Healthcare
```javascript
// Verificar prescripción médica
const prescription = await BeZhas.healthcare.verifyPrescription({
  prescriptionId: 'RX-789456',
  patientId: 'PATIENT-123',
  medicationCode: 'NDC-12345',
  prescribingDoctor: 'DR-987'
});

// Tracking cadena de frío
const supply = await BeZhas.healthcare.trackSupply({
  batchId: 'VAC-2026-001',
  origin: 'Pfizer Lab NY',
  destination: 'Hospital General Miami',
  temperatureRange: '2-8°C',
  checkpoints: ['NY-Hub', 'Miami-Airport', 'Hospital']
});
```

### 🚗 Automotive
```javascript
// Tokenizar vehículo
const vehicle = await BeZhas.automotive.tokenizeVehicle({
  vin: '1HGCM82633A123456',
  make: 'Tesla',
  model: 'Model 3',
  year: 2024,
  mileage: 15000
});

// Registrar mantenimiento
const maintenance = await BeZhas.automotive.logMaintenance({
  vehicleId: vehicle.tokenId,
  serviceType: 'tire_rotation',
  mileage: 15300,
  serviceProvider: 'Tesla Service Center'
});

// Transferir propiedad
const transfer = await BeZhas.automotive.transferOwnership({
  vehicleId: vehicle.tokenId,
  newOwner: '0xABCDEF...',
  salePrice: 35000
});
```

### 🏭 Manufacturing
```javascript
// Leer sensores IoT
const sensors = await BeZhas.manufacturing.readIoTSensors({
  factoryId: 'FAC-001',
  sensorTypes: ['temperature', 'pressure', 'vibration'],
  timeRange: 'last_24h'
});

// Certificar calidad (ISO 9001)
const cert = await BeZhas.manufacturing.certifyQuality({
  productBatch: 'BATCH-2026-Q1-001',
  standard: 'ISO_9001',
  inspectionResults: { defectRate: 0.02, passed: true }
});

// Crear gemelo digital
const twin = await BeZhas.manufacturing.createDigitalTwin({
  assetId: 'MACHINE-CNC-007',
  sensorData: sensors.data,
  maintenanceHistory: []
});
```

### ⚡ Energy
```javascript
// Trading de créditos renovables
const trade = await BeZhas.energy.tradeEnergyCredits({
  creditType: 'solar',
  amount: 1000, // kWh
  price: 0.12,
  buyer: '0x123...',
  seller: '0x456...'
});

// Balance de red eléctrica
const balance = await BeZhas.energy.balanceGrid({
  gridId: 'GRID-EU-WEST-1',
  excessSupply: 500, // kWh
  demandShortfall: 300
});
```

### 🌾 Agriculture
```javascript
// Certificar cosecha orgánica
const harvest = await BeZhas.agriculture.certifyHarvest({
  farmId: 'FARM-001',
  cropType: 'tomatoes',
  harvestDate: '2026-01-15',
  quantity: 5000, // kg
  certification: 'USDA_Organic'
});

// Verificar certificación orgánica
const organic = await BeZhas.agriculture.verifyOrganic({
  productId: 'PROD-TOMATO-001',
  certificationBody: 'USDA'
});

// Tokenizar tierra agrícola
const land = await BeZhas.agriculture.tokenizeLand({
  coordinates: { lat: 40.7128, lng: -74.0060 },
  area: 50, // hectáreas
  soilType: 'loam',
  currentCrop: 'corn'
});
```

### 🎓 Education
```javascript
// Emitir credencial académica
const diploma = await BeZhas.education.issueCredential({
  studentId: 'STU-2026-001',
  degree: 'Bachelor of Science',
  institution: 'MIT',
  gpa: 3.9,
  graduationDate: '2026-06-01'
});

// Verificar credencial
const verified = await BeZhas.education.verifyCredential({
  credentialId: diploma.tokenId,
  verifier: 'Google HR'
});
```

### 🛡️ Insurance
```javascript
// Crear seguro paramétrico (clima)
const policy = await BeZhas.insurance.createParametric({
  policyType: 'crop_insurance',
  insuredValue: 100000,
  trigger: { event: 'drought', threshold: '30_days_no_rain' },
  premium: 5000
});

// Procesar claim automático
const claim = await BeZhas.insurance.processClaim({
  policyId: policy.id,
  triggerEvent: { type: 'drought', duration: 35 },
  oracleData: 'WeatherAPI_verified'
});
```

### 🎬 Entertainment
```javascript
// Mintear NFT artístico
const nft = await BeZhas.entertainment.mintNFT({
  assetType: 'music_album',
  title: 'Summer Vibes 2026',
  creator: '0xArtist123',
  royaltyPercentage: 10,
  metadata: { genre: 'electronic', duration: '45:30' }
});

// Distribuir royalties
const royalties = await BeZhas.entertainment.distributeRoyalties({
  nftId: nft.tokenId,
  totalRevenue: 50000,
  recipients: [
    { address: '0xArtist123', share: 70 },
    { address: '0xProducer456', share: 30 }
  ]
});
```

### ⚖️ Legal
```javascript
// Crear contrato legal inteligente
const contract = await BeZhas.legal.deployContract({
  contractType: 'real_estate_purchase',
  parties: ['0xBuyer', '0xSeller'],
  terms: { price: 500000, escrowPeriod: 30 },
  jurisdiction: 'Florida_USA'
});

// Notarizar documento
const notarized = await BeZhas.legal.notarizeDocument({
  documentHash: '0x123abc...',
  documentType: 'power_of_attorney',
  notaryId: 'NOTARY-FL-12345'
});
```

### 📦 Supply Chain
```javascript
// Tracking provenance
const provenance = await BeZhas.supply.trackProvenance('PROD-001');

// Verificar compliance aduanal
const customs = await BeZhas.supply.clearCustoms({
  shipmentId: 'SHIP-2026-001',
  hsCode: '8471.30.01', // Laptops
  declaredValue: 50000,
  documents: ['invoice.pdf', 'packing_list.pdf']
});

// Offset de carbono
const offset = await BeZhas.supply.offsetCarbon({
  shipmentId: 'SHIP-2026-001',
  distance: 5000, // km
  weight: 1000, // kg
  mode: 'air',
  offsetAmount: 1.5 // tons CO2
});
```

### 🏛️ Government
```javascript
// Emitir identidad digital
const identity = await BeZhas.government.issueIdentity({
  citizenId: 'CIT-123456',
  biometrics: { fingerprint: '...', facial: '...' },
  documents: ['birth_cert.pdf'],
  authority: 'US_Dept_State'
});

// Votación blockchain
const vote = await BeZhas.government.castVote({
  electionId: 'ELEC-2026-PRES',
  voterId: identity.id,
  vote: 'encrypted_choice' // Zero-knowledge proof
});
```

### 🌱 Carbon Credits
```javascript
// Emitir créditos de carbono
const credits = await BeZhas.carbon.issueCredits({
  projectId: 'REFOREST-AMZ-001',
  amount: 1000, // tons CO2
  type: 'reforestation',
  verifier: 'Verra',
  vintage: 2026
});

// Trading de créditos
const trade = await BeZhas.carbon.tradeCredits({
  action: 'buy',
  creditId: credits.id,
  quantity: 100,
  price: 15.50
});

// Verificar offset
const verified = await BeZhas.carbon.verifyOffset({
  creditId: credits.id,
  amount: 50,
  beneficiary: 'COMPANY-XYZ'
});
```

---

## 🔐 Sistema de Permisos

### Permisos por Sector (Ejemplos)

#### Real Estate
- `realestate:tokenize` - Tokenizar propiedades
- `realestate:fractionate` - Crear fracciones
- `realestate:rent` - Gestionar rentas
- `realestate:transfer` - Transferir propiedad

#### Healthcare
- `healthcare:prescriptions` - Verificar prescripciones
- `healthcare:supply_chain` - Tracking médico
- `healthcare:records` - Acceso a registros
- `healthcare:compliance` - Auditorías HIPAA

### Configuración en Developer Console
```javascript
// Al crear API Key, selecciona permisos:
{
  sector: 'realestate',
  permissions: [
    'realestate:tokenize',
    'realestate:fractionate',
    'realestate:rent'
  ],
  rateLimit: {
    requestsPerMinute: 100,
    requestsPerDay: 10000
  }
}
```

---

## 📊 Analytics & Monitoring

### Consultar uso de API
```javascript
// Desde Developer Console o via API
const usage = await fetch('https://api.bezhas.com/v1/developer/keys/bz_xxx/usage', {
  headers: { 'X-API-Key': 'bz_prod_xxx' }
});

// Response:
{
  totalRequests: 8543,
  by_endpoint: {
    '/realestate/tokenize': 120,
    '/realestate/fractionate': 45
  },
  avgResponseTime: '89ms',
  errorRate: 0.02
}
```

---

## 🛡️ Rate Limiting

Cada API Key tiene límites configurables:
- **Free Tier**: 100 req/min, 10k req/día
- **Pro Tier**: 1000 req/min, 1M req/día
- **Enterprise**: Custom

### Manejo de Rate Limits
```javascript
try {
  const result = await BeZhas.realestate.tokenizeProperty(data);
} catch (error) {
  if (error.status === 429) {
    console.log('Rate limit exceeded. Retry after:', error.retryAfter);
  }
}
```

---

## 🌐 Ambientes

### Development
```javascript
const BeZhas = new BeZhasUniversal({
  apiKey: 'bz_dev_xxxxxxxxxxxxx',
  endpoint: 'https://api-dev.bezhas.com/v1'
});
```

### Staging
```javascript
const BeZhas = new BeZhasUniversal({
  apiKey: 'bz_stg_xxxxxxxxxxxxx',
  endpoint: 'https://api-staging.bezhas.com/v1'
});
```

### Production
```javascript
const BeZhas = new BeZhasUniversal({
  apiKey: 'bz_prod_xxxxxxxxxxxxx',
  endpoint: 'https://api.bezhas.com/v1'
});
```

---

## 🔄 Versionado

El SDK sigue Semantic Versioning:
- **Major**: Cambios breaking (v1 → v2)
- **Minor**: Nuevas features (v1.0 → v1.1)
- **Patch**: Bugfixes (v1.0.0 → v1.0.1)

Especifica versión en endpoint:
```javascript
endpoint: 'https://api.bezhas.com/v1/bridge' // v1 estable
endpoint: 'https://api.bezhas.com/v2/bridge' // v2 beta
```

---

## 🆘 Soporte

- **Documentación**: https://docs.bezhas.com
- **Discord**: https://discord.gg/bezhas
- **Email**: dev-support@bezhas.com
- **Status**: https://status.bezhas.com

---

## 📝 Changelog

### v1.0.0 (2026-01-06)
- ✅ 17 sectores implementados
- ✅ Sistema de permisos granular
- ✅ Rate limiting automático
- ✅ Analytics integrado
- ✅ Developer Console

---

## 🎯 Roadmap

### Q1 2026
- [ ] Webhooks para eventos
- [ ] SDK Python/Ruby
- [ ] GraphQL API

### Q2 2026
- [ ] AI-powered API recommendations
- [ ] Auto-scaling rate limits
- [ ] Multi-region deployment

---

**© 2026 BeZhas - Universal Web3 Bridge for Every Industry**
