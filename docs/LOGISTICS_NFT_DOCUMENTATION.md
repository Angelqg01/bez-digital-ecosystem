# BeZhas Logistics NFT Manifest - Complete System Documentation

## 🎯 Overview
BeZhas Cargo Manifest NFT is an industrial dApp on Polygon L2 that digitizes cargo manifests as immutable NFTs (ERC-721), acting as digital manifests following DCSA v3.0 standards. Payments and registration fees are handled using BEZ-Coin (0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8).

## 📋 System Architecture

### Smart Contract: `CargoManifestNFT.sol`
**Address**: Deploy to Polygon Mainnet  
**Standard**: ERC-721 (OpenZeppelin)  
**Token Name**: "BeZhas Cargo Manifest"  
**Symbol**: BCM

### Key Features

#### 1. **Manifest Registration** (`registerManifest`)
Creates a new cargo manifest NFT with complete shipping details.

**Parameters**:
- `containerId` - Unique container identifier (e.g., "ABCD1234567")
- `transportMode` - Maritime, Air, Road, or Rail
- `commodityDescription` - Description of cargo
- `weightMT` - Weight in metric tons (scaled by 1000 for precision)
- `vesselVoyage` - Vessel/flight/truck identification
- `hsCode` - Harmonized System code for customs
- `consignee` - Wallet address of consignee
- `originPort` - Origin port code (UNLOC format)
- `destinationPort` - Destination port code
- `manifestURI` - IPFS URI with full manifest metadata
- `isHazardous` - Boolean for dangerous goods
- `isReefered` - Boolean for temperature-controlled cargo
- `isOOG` - Boolean for out-of-gauge cargo

**Cost**: Registration fee in BEZ-Coin (~$0.05 USD) + Gas

**Returns**: Token ID (uint256)

**Emits**: `ManifestRegistered(tokenId, containerId, shipper, consignee, originPort, destinationPort)`

#### 2. **Hazardous Cargo Appendix** (`attachHazardousAppendix`)
Attaches Material Safety Data Sheet (MSDS) for dangerous goods.

**Required When**: `isHazardous = true`

**Parameters**:
- `tokenId` - NFT token ID
- `msdsURI` - IPFS URI with MSDS document
- `unClass` - UN Classification (e.g., "Class 3 - Flammable Liquids")

**Access**: Manifest owner only

**Emits**: `HazardousAppendixAttached(tokenId, msdsURI)`

#### 3. **Reefer Cargo Appendix** (`attachReeferAppendix`)
Attaches temperature and humidity configuration for refrigerated cargo.

**Required When**: `isReefered = true`

**Parameters**:
- `tokenId` - NFT token ID
- `tempDataURI` - IPFS URI with temperature/humidity settings and IoT sensor data

**Access**: Manifest owner only

**Emits**: `ReeferAppendixAttached(tokenId, tempDataURI)`

#### 4. **OOG Cargo Appendix** (`attachOOGAppendix`)
Attaches dimensions and special handling instructions for oversized cargo.

**Required When**: `isOOG = true`

**Parameters**:
- `tokenId` - NFT token ID
- `dimensionsURI` - IPFS URI with dimensions and handling instructions

**Access**: Manifest owner only

**Emits**: `OOGAppendixAttached(tokenId, dimensionsURI)`

#### 5. **Commercial Documents**
Three mandatory commercial documents must be attached:

##### a) **Commercial Invoice** (`attachCommercialInvoice`)
```solidity
attachCommercialInvoice(uint256 tokenId, string invoiceURI)
```

##### b) **Packing List** (`attachPackingList`)
```solidity
attachPackingList(uint256 tokenId, string packingListURI)
```

##### c) **Certificate of Origin** (`attachCertificateOfOrigin`)
```solidity
attachCertificateOfOrigin(uint256 tokenId, string certURI)
```

**Emits**: `DocumentAttached(tokenId, documentType, uri)`

#### 6. **Ownership Verification** (`verifyOwnership`)
Validates manifest ownership following MLETR principles (UNCITRAL Model Law on Electronic Transferable Records).

```solidity
function verifyOwnership(uint256 tokenId) external view returns (address)
```

**Returns**: Current owner wallet address

**Use Cases**:
- Legal proof of title transfer
- Customs clearance
- Consignee verification
- Bill of lading validation

#### 7. **Status Management** (`updateStatus`)
Updates manifest status throughout the shipping lifecycle.

**Status Enum**:
```solidity
enum ManifestStatus {
    REGISTERED,          // 0 - Initial registration
    IN_TRANSIT,          // 1 - Cargo in transit
    CUSTOMS_CLEARANCE,   // 2 - Customs processing
    DELIVERED,           // 3 - Delivered to consignee
    CANCELLED            // 4 - Shipment cancelled
}
```

**Access**: Owner or contract admin

**Emits**: `StatusUpdated(tokenId, newStatus)`

#### 8. **Fee Calculation** (`calculateFees`)
Returns current registration fee in BEZ-Coin.

```solidity
function calculateFees() external view returns (uint256)
```

**Gas Optimization**:
- Uses `uint256` for weights/dimensions
- Minimal storage slots
- Efficient event emissions
- Polygon L2 gas: ~160-280 Gwei

**Fee Structure**:
- Base Registration: 0.5 BEZ (~$0.05 USD)
- Appendix Attachments: Gas only
- Document Uploads: Gas only
- Status Updates: Gas only

## 🌍 Global Ports Library

### `GlobalPorts.ts`
Comprehensive database of 100+ major world ports organized by region.

#### Regions:
1. **North America** (8 ports)
2. **Central America & Caribbean** (7 ports)
3. **South America** (8 ports)
4. **Europe** (10 ports)
5. **Africa** (8 ports)
6. **Central Asia** (4 ports)
7. **Asia** (13 ports)
8. **Australia & Oceania** (7 ports)

#### Helper Functions:

```typescript
// Get all ports
const allPorts = getAllPorts();

// Search by name/code/country
const results = searchPorts("Singapore");

// Get ports by region
const asianPorts = getPortsByRegion("ASIA");

// Validate port code
const isValid = isValidPort("CNSHA"); // true

// Get port details
const port = getPortByCode("SGSIN");
// Returns: { code, name, country, region, coordinates }
```

#### Port Data Structure:
```typescript
interface Port {
  code: string;        // UNLOC code (e.g., "CNSHA")
  name: string;        // Port name
  country: string;     // Country name
  region: string;      // Geographic region
  coordinates?: {
    lat: number;
    lng: number;
  };
}
```

## 🔗 Frontend Integration

### `useCargoManifestContract.js`
React hook for contract interaction.

#### Available Functions:

```javascript
const {
  contract,              // Contract instance
  loading,               // Loading state
  registrationFee,       // Current fee in BEZ
  bezBalance,            // User's BEZ balance
  registerManifest,      // Register new manifest
  attachHazardousAppendix,
  attachReeferAppendix,
  attachOOGAppendix,
  attachDocument,        // Attach invoice/packing/certificate
  updateManifestStatus,
  verifyOwnership,
  getManifest,           // Get manifest data
  calculateFees
} = useCargoManifestContract(contractAddress);
```

#### Example Usage:

```javascript
// Register manifest
const result = await registerManifest({
  containerId: "ABCD1234567",
  transportMode: "Maritime",
  commodityDescription: "Electronics",
  weightMT: 25.5,
  vesselVoyage: "MSC Oscar V.234R",
  hsCode: "8471.30",
  consignee: "0x...",
  originPort: "CNSHA",
  destinationPort: "USLAX",
  isHazardous: false,
  isReefered: false,
  isOOG: false
});

// Returns: { success: true, tokenId: "1", transactionHash: "0x..." }
```

## 📝 UI Components

### Create.jsx - Multi-Step Form

#### Step 1: Basic Information
- Container ID validation
- Transport mode selection (Maritime/Air/Road/Rail)
- Port search with autocomplete
- Weight and HS code
- Consignee wallet address
- Special cargo classification checkboxes

#### Step 2: Appendices (Conditional)
- **Hazardous**: UN Class + MSDS upload
- **Reefer**: Temperature/Humidity + IoT data
- **OOG**: Dimensions (L×W×H) + Handling instructions

#### Step 3: Documents
- Commercial Invoice (required)
- Packing List (required)
- Certificate of Origin (required)
- Privacy/Visibility settings

### Privacy & Access Control

**Visibility Options**:
1. **Public** - Visible in marketplace to all
2. **Private** - Draft/hidden, owner-only view
3. **Exclusive** - Members-only with BEZ access fee

## 🚀 Deployment Guide

### Prerequisites:
```bash
npm install @openzeppelin/contracts ethers hardhat dotenv
```

### Configuration (.env):
```env
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_deployer_private_key
POLYGONSCAN_API_KEY=your_polygonscan_key
REACT_APP_CARGO_MANIFEST_CONTRACT=deployed_contract_address
```

### Deploy to Polygon:
```bash
npx hardhat run scripts/deploy-cargo-manifest.js --network polygon
```

### Verify on PolygonScan:
```bash
npx hardhat verify --network polygon DEPLOYED_ADDRESS "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8" "500000000000000000"
```

## 📊 Metadata Schema (IPFS)

### DCSA v3.0 Compliant JSON:
```json
{
  "name": "Cargo Manifest #1",
  "description": "Digital Bill of Lading",
  "image": "ipfs://...",
  "attributes": [
    { "trait_type": "Container ID", "value": "ABCD1234567" },
    { "trait_type": "Transport Mode", "value": "Maritime" },
    { "trait_type": "Origin", "value": "CNSHA - Shanghai" },
    { "trait_type": "Destination", "value": "USLAX - Los Angeles" },
    { "trait_type": "Weight (MT)", "value": 25.5 },
    { "trait_type": "Commodity", "value": "Electronics" },
    { "trait_type": "HS Code", "value": "8471.30" },
    { "trait_type": "Status", "value": "IN_TRANSIT" }
  ],
  "documents": {
    "invoice": "ipfs://...",
    "packingList": "ipfs://...",
    "certificate": "ipfs://..."
  },
  "appendices": {
    "hazardous": null,
    "reefer": null,
    "oog": null
  }
}
```

## 🔐 Security Features

1. **Access Control**: Only manifest owner can attach documents
2. **BEZ-Coin Payment**: Prevents spam registrations
3. **MLETR Compliance**: Legal framework for electronic transferable records
4. **Immutable Record**: Blockchain-based audit trail
5. **Input Validation**: Container ID uniqueness, address validation

## 💡 Use Cases

1. **International Shipping**: Digital bill of lading
2. **Customs Clearance**: Automated document verification
3. **Supply Chain Finance**: NFT-backed trade finance
4. **Insurance Claims**: Immutable cargo evidence
5. **Smart Logistics**: IoT integration for real-time tracking

## 📞 Support & Resources

- **Contract Repository**: `/contracts/CargoManifestNFT.sol`
- **Frontend Hook**: `/frontend/src/hooks/useCargoManifestContract.js`
- **Ports Database**: `/frontend/src/utils/GlobalPorts.ts`
- **UI Component**: `/frontend/src/pages/Create.jsx`
- **Deployment Script**: `/scripts/deploy-cargo-manifest.js`

---

**Version**: 1.0.0  
**Last Updated**: December 2025  
**Network**: Polygon Mainnet  
**Standard**: ERC-721 + DCSA v3.0  
**License**: MIT
