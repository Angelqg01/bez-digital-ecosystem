# 🚀 Guía de Despliegue: Contratos Industriales BeZhas

## 📋 Tabla de Contenidos

1. [Pre-requisitos](#pre-requisitos)
2. [Configuración del Entorno](#configuración-del-entorno)
3. [Compilación de Contratos](#compilación-de-contratos)
4. [Despliegue por Contrato](#despliegue-por-contrato)
5. [Verificación en Explorer](#verificación-en-explorer)
6. [Scripts Útiles](#scripts-útiles)
7. [Troubleshooting](#troubleshooting)

---

## ✅ Pre-requisitos

### Software Requerido
```bash
# Node.js (v18+)
node --version  # v18.0.0 o superior

# npm o yarn
npm --version   # 9.0.0 o superior

# Hardhat
npx hardhat --version  # 2.19.0 o superior

# Git
git --version
```

### Dependencias del Proyecto
```bash
# Instalar dependencias
cd bezhas-web3
npm install

# Verificar instalación
npm list @openzeppelin/contracts
npm list hardhat
npm list ethers
```

### Wallets y Fondos

**Para Testnet (Amoy):**
1. Crear wallet en MetaMask
2. Obtener POL testnet de: https://faucet.polygon.technology/
3. Mínimo recomendado: 1 POL para gas fees

**Para Mainnet (Polygon):**
1. Preparar wallet con fondos reales
2. Verificar balance suficiente para gas
3. Realizar despliegue en horarios de bajo tráfico

---

## 🔧 Configuración del Entorno

### 1. Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# =====================================================
# BLOCKCHAIN CONFIGURATION
# =====================================================

# Private Key (SIN el prefijo 0x)
PRIVATE_KEY=tu_private_key_sin_0x

# RPC URLs
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_RPC_URL=https://polygon-rpc.com

# Alternative RPC (más rápidos)
# Alchemy
# POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
# POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Infura
# POLYGON_AMOY_RPC_URL=https://polygon-amoy.infura.io/v3/YOUR_PROJECT_ID
# POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID

# =====================================================
# EXPLORER API KEYS (Para verificación)
# =====================================================

POLYGONSCAN_API_KEY=your_polygonscan_api_key
# Obtener en: https://polygonscan.com/apis

# =====================================================
# CONTRACT ADDRESSES (Se llenan después del deploy)
# =====================================================

BEZHAS_TOKEN_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
LOGISTICS_CONTRACT_ADDRESS=
REALESTATE_CONTRACT_ADDRESS=
NFT_RENTAL_ADDRESS=
PROPERTY_NFT_ADDRESS=
PROPERTY_FRACTIONALIZER_ADDRESS=
```

### 2. Verificar Configuración

```bash
# Test de conexión RPC
npx hardhat run scripts/check-balance.js --network amoy

# Verificar configuración de Hardhat
npx hardhat config
```

---

## 🔨 Compilación de Contratos

### Compilar Todos los Contratos

```bash
# Limpiar artifacts anteriores
npx hardhat clean

# Compilar contratos
npx hardhat compile

# Verificar compilación exitosa
ls artifacts/contracts/
```

**Output esperado:**
```
✅ Compiled 47 Solidity files successfully

artifacts/contracts/
├── LogisticsContainer.sol/
│   └── LogisticsContainer.json
├── BeZhasRealEstate.sol/
│   └── BeZhasRealEstate.json
├── NFTRental.sol/
│   └── NFTRental.json
├── PropertyNFT.sol/
│   └── PropertyNFT.json
└── PropertyFractionalizer.sol/
    └── PropertyFractionalizer.json
```

### Compilar Contrato Específico

```bash
# Solo LogisticsContainer
npx hardhat compile --force contracts/LogisticsContainer.sol

# Solo BeZhasRealEstate
npx hardhat compile --force contracts/BeZhasRealEstate.sol
```

---

## 🚀 Despliegue por Contrato

### 1. LogisticsContainer

#### Script de Despliegue

Crear `scripts/deploy-logistics.js`:

```javascript
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const networkName = hre.network.name;

    console.log(`\n🚀 Desplegando LogisticsContainer en ${networkName}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    
    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} POL\n`);

    // Deploy contract
    console.log("📦 Desplegando contrato...");
    const Logistics = await hre.ethers.getContractFactory("LogisticsContainer");
    const logistics = await Logistics.deploy();
    await logistics.waitForDeployment();

    const address = await logistics.getAddress();
    console.log(`✅ LogisticsContainer desplegado en: ${address}`);

    // Wait for confirmations
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("⏳ Esperando 5 confirmaciones...");
        await logistics.deploymentTransaction().wait(5);
        console.log("✅ Confirmaciones recibidas");
    }

    // Save to config
    const configPath = path.join(__dirname, "../backend/config.json");
    let config = {};
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    
    config.contractAddresses = config.contractAddresses || {};
    config.contractAddresses.LogisticsContainerAddress = address;
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`💾 Dirección guardada en config.json`);

    // Save deployment info
    const deploymentInfo = {
        network: networkName,
        contractName: "LogisticsContainer",
        address: address,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber()
    };

    const deploymentPath = path.join(__dirname, "../deployments", `logistics-${networkName}.json`);
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n📋 Resumen del Despliegue:");
    console.log(`   Network: ${networkName}`);
    console.log(`   Contract: LogisticsContainer`);
    console.log(`   Address: ${address}`);
    console.log(`   Deployer: ${deployer.address}`);
    
    // Instructions for verification
    if (networkName === "amoy" || networkName === "polygon") {
        console.log("\n🔍 Para verificar en PolygonScan:");
        console.log(`   npx hardhat verify --network ${networkName} ${address}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

#### Comandos de Despliegue

```bash
# Testnet (Amoy)
npx hardhat run scripts/deploy-logistics.js --network amoy

# Mainnet (Polygon)
npx hardhat run scripts/deploy-logistics.js --network polygon

# Local (para testing)
npx hardhat run scripts/deploy-logistics.js --network localhost
```

---

### 2. BeZhasRealEstate

#### Script de Despliegue

Crear `scripts/deploy-realestate.js`:

```javascript
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const networkName = hre.network.name;

    console.log(`\n🏠 Desplegando BeZhasRealEstate en ${networkName}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} POL\n`);

    // Deploy contract
    console.log("📦 Desplegando contrato...");
    const RealEstate = await hre.ethers.getContractFactory("BeZhasRealEstate");
    const realEstate = await RealEstate.deploy();
    await realEstate.waitForDeployment();

    const address = await realEstate.getAddress();
    console.log(`✅ BeZhasRealEstate desplegado en: ${address}`);

    // Wait for confirmations
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("⏳ Esperando 5 confirmaciones...");
        await realEstate.deploymentTransaction().wait(5);
        console.log("✅ Confirmaciones recibidas");
    }

    // Save to config
    const configPath = path.join(__dirname, "../backend/config.json");
    let config = {};
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    
    config.contractAddresses = config.contractAddresses || {};
    config.contractAddresses.BeZhasRealEstateAddress = address;
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`💾 Dirección guardada en config.json`);

    // Test initial setup
    console.log("\n🧪 Verificando funcionalidad básica...");
    try {
        // Crear propiedad de prueba
        const testTx = await realEstate.createProperty(
            1, // property ID
            10000, // total shares
            hre.ethers.parseEther("0.001"), // price per share
            "Test Property - Oceanview Villa"
        );
        await testTx.wait();
        console.log("✅ Propiedad de prueba creada exitosamente");
        
        const property = await realEstate.properties(1);
        console.log(`   Nombre: ${property.name}`);
        console.log(`   Shares: ${property.totalShares}`);
        console.log(`   Precio: ${hre.ethers.formatEther(property.sharePrice)} ETH/share`);
    } catch (error) {
        console.log("⚠️ No se pudo crear propiedad de prueba:", error.message);
    }

    console.log("\n📋 Resumen del Despliegue:");
    console.log(`   Network: ${networkName}`);
    console.log(`   Contract: BeZhasRealEstate`);
    console.log(`   Address: ${address}`);
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Standard: ERC1155`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

#### Comandos de Despliegue

```bash
# Testnet (Amoy)
npx hardhat run scripts/deploy-realestate.js --network amoy

# Mainnet (Polygon)
npx hardhat run scripts/deploy-realestate.js --network polygon
```

---

### 3. NFTRental

#### Script de Despliegue

Crear `scripts/deploy-nft-rental.js`:

```javascript
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const networkName = hre.network.name;

    console.log(`\n🎮 Desplegando NFTRental en ${networkName}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} POL\n`);

    // Get BEZ Token address
    const BEZ_TOKEN_ADDRESS = process.env.BEZHAS_TOKEN_ADDRESS || 
                              "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    
    console.log(`🪙 BEZ Token: ${BEZ_TOKEN_ADDRESS}`);
    console.log(`💰 Fee Recipient: ${deployer.address}\n`);

    // Deploy contract
    console.log("📦 Desplegando NFTRental...");
    const NFTRental = await hre.ethers.getContractFactory("NFTRental");
    const nftRental = await NFTRental.deploy(
        BEZ_TOKEN_ADDRESS,  // Payment token
        deployer.address    // Fee recipient
    );
    await nftRental.waitForDeployment();

    const address = await nftRental.getAddress();
    console.log(`✅ NFTRental desplegado en: ${address}`);

    // Wait for confirmations
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("⏳ Esperando 5 confirmaciones...");
        await nftRental.deploymentTransaction().wait(5);
        console.log("✅ Confirmaciones recibidas");
    }

    // Configure allowed NFT contracts
    console.log("\n⚙️ Configurando contratos NFT permitidos...");
    
    // Allow BezhasNFT (example)
    const BEZHAS_NFT = process.env.BEZHAS_NFT_ADDRESS;
    if (BEZHAS_NFT) {
        const allowTx = await nftRental.allowNFTContract(BEZHAS_NFT, true);
        await allowTx.wait();
        console.log(`✅ BezhasNFT permitido: ${BEZHAS_NFT}`);
    }

    // Save to config
    const configPath = path.join(__dirname, "../backend/config.json");
    let config = {};
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    
    config.contractAddresses = config.contractAddresses || {};
    config.contractAddresses.NFTRentalAddress = address;
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`💾 Dirección guardada en config.json`);

    // Test configuration
    console.log("\n🧪 Verificando configuración...");
    const paymentToken = await nftRental.paymentToken();
    const feeRecipient = await nftRental.feeRecipient();
    const protocolFee = await nftRental.protocolFee();
    
    console.log(`   Payment Token: ${paymentToken}`);
    console.log(`   Fee Recipient: ${feeRecipient}`);
    console.log(`   Protocol Fee: ${protocolFee / 100}%`);

    console.log("\n📋 Resumen del Despliegue:");
    console.log(`   Network: ${networkName}`);
    console.log(`   Contract: NFTRental`);
    console.log(`   Address: ${address}`);
    console.log(`   Payment Token: ${BEZ_TOKEN_ADDRESS}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

#### Comandos de Despliegue

```bash
# Testnet (Amoy)
npx hardhat run scripts/deploy-nft-rental.js --network amoy

# Mainnet (Polygon)
npx hardhat run scripts/deploy-nft-rental.js --network polygon
```

---

### 4. PropertyNFT y PropertyFractionalizer

#### Script de Despliegue

Crear `scripts/deploy-property-system.js`:

```javascript
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const networkName = hre.network.name;

    console.log(`\n🏘️ Desplegando Property System en ${networkName}`);
    console.log(`👤 Deployer: ${deployer.address}\n`);

    // 1. Deploy PropertyNFT
    console.log("📦 1/2 Desplegando PropertyNFT...");
    const PropertyNFT = await hre.ethers.getContractFactory("PropertyNFT");
    const propertyNFT = await PropertyNFT.deploy();
    await propertyNFT.waitForDeployment();
    const nftAddress = await propertyNFT.getAddress();
    console.log(`✅ PropertyNFT desplegado en: ${nftAddress}`);

    // Wait for confirmations
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("⏳ Esperando confirmaciones...");
        await propertyNFT.deploymentTransaction().wait(3);
    }

    // 2. Mint test property
    console.log("\n🏠 Minteando propiedad de prueba...");
    const testPropertyURI = "ipfs://QmTest...PropertyMetadata";
    const mintTx = await propertyNFT.mintProperty(deployer.address, testPropertyURI);
    const mintReceipt = await mintTx.wait();
    const propertyTokenId = 1; // First token
    console.log(`✅ Propiedad NFT #${propertyTokenId} minteada`);

    // 3. Deploy PropertyFractionalizer
    console.log("\n📦 2/2 Desplegando PropertyFractionalizer...");
    const PropertyFractionalizer = await hre.ethers.getContractFactory("PropertyFractionalizer");
    const fractionalizer = await PropertyFractionalizer.deploy(
        nftAddress,
        propertyTokenId
    );
    await fractionalizer.waitForDeployment();
    const fractionalizerAddress = await fractionalizer.getAddress();
    console.log(`✅ PropertyFractionalizer desplegado en: ${fractionalizerAddress}`);

    // Wait for confirmations
    if (networkName !== "hardhat" && networkName !== "localhost") {
        await fractionalizer.deploymentTransaction().wait(3);
    }

    // 4. Approve fractionalizer to take NFT
    console.log("\n🔐 Aprobando transferencia de NFT...");
    const approveTx = await propertyNFT.approve(fractionalizerAddress, propertyTokenId);
    await approveTx.wait();
    console.log("✅ Aprobación concedida");

    // 5. Fractionalize property
    console.log("\n🔨 Fraccionalizando propiedad...");
    const fractTx = await fractionalizer.fractionalize(
        "Luxury Villa Shares",       // Name
        "LVILLA",                     // Symbol
        10000,                        // Total shares
        hre.ethers.parseEther("0.01") // Price per share (0.01 ETH)
    );
    await fractTx.wait();
    console.log("✅ Propiedad fraccionada exitosamente");

    // Get ShareToken address
    const shareTokenAddress = await fractionalizer.shareToken();
    console.log(`   ShareToken desplegado en: ${shareTokenAddress}`);

    // Save to config
    const configPath = path.join(__dirname, "../backend/config.json");
    let config = {};
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    
    config.contractAddresses = config.contractAddresses || {};
    config.contractAddresses.PropertyNFTAddress = nftAddress;
    config.contractAddresses.PropertyFractionalizerAddress = fractionalizerAddress;
    config.contractAddresses.PropertyShareTokenAddress = shareTokenAddress;
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n💾 Direcciones guardadas en config.json`);

    console.log("\n📋 Resumen del Despliegue:");
    console.log(`   Network: ${networkName}`);
    console.log(`   PropertyNFT: ${nftAddress}`);
    console.log(`   PropertyFractionalizer: ${fractionalizerAddress}`);
    console.log(`   ShareToken: ${shareTokenAddress}`);
    console.log(`   Property Token ID: ${propertyTokenId}`);
    console.log(`   Total Shares: 10,000`);
    console.log(`   Price per Share: 0.01 ETH`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

#### Comandos de Despliegue

```bash
# Testnet (Amoy)
npx hardhat run scripts/deploy-property-system.js --network amoy

# Mainnet (Polygon)
npx hardhat run scripts/deploy-property-system.js --network polygon
```

---

## 🔍 Verificación en Explorer

### Verificar Contratos en PolygonScan

#### Método 1: Hardhat Verify

```bash
# LogisticsContainer
npx hardhat verify --network amoy <CONTRACT_ADDRESS>

# BeZhasRealEstate
npx hardhat verify --network amoy <CONTRACT_ADDRESS>

# NFTRental (con constructor args)
npx hardhat verify --network amoy <CONTRACT_ADDRESS> \
  "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8" \
  "0xYourFeeRecipientAddress"

# PropertyFractionalizer (con constructor args)
npx hardhat verify --network amoy <CONTRACT_ADDRESS> \
  "0xPropertyNFTAddress" \
  1
```

#### Método 2: Script de Verificación

Crear `scripts/verify-all.js`:

```javascript
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const configPath = path.join(__dirname, "../backend/config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const addresses = config.contractAddresses;

    console.log("\n🔍 Verificando contratos en PolygonScan...\n");

    // LogisticsContainer
    if (addresses.LogisticsContainerAddress) {
        console.log("📦 Verificando LogisticsContainer...");
        try {
            await hre.run("verify:verify", {
                address: addresses.LogisticsContainerAddress,
                constructorArguments: []
            });
            console.log("✅ LogisticsContainer verificado");
        } catch (error) {
            console.log("⚠️ Error:", error.message);
        }
    }

    // BeZhasRealEstate
    if (addresses.BeZhasRealEstateAddress) {
        console.log("\n📦 Verificando BeZhasRealEstate...");
        try {
            await hre.run("verify:verify", {
                address: addresses.BeZhasRealEstateAddress,
                constructorArguments: []
            });
            console.log("✅ BeZhasRealEstate verificado");
        } catch (error) {
            console.log("⚠️ Error:", error.message);
        }
    }

    // NFTRental
    if (addresses.NFTRentalAddress) {
        console.log("\n📦 Verificando NFTRental...");
        try {
            await hre.run("verify:verify", {
                address: addresses.NFTRentalAddress,
                constructorArguments: [
                    addresses.BezhasTokenAddress,
                    process.env.FEE_RECIPIENT || addresses.owner
                ]
            });
            console.log("✅ NFTRental verificado");
        } catch (error) {
            console.log("⚠️ Error:", error.message);
        }
    }

    console.log("\n✅ Verificación completada");
}

main();
```

Ejecutar:
```bash
npx hardhat run scripts/verify-all.js --network amoy
```

---

## 🛠️ Scripts Útiles

### 1. Check Balance

```javascript
// scripts/check-balance.js
const hre = require("hardhat");

async function main() {
    const [signer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(signer.address);
    
    console.log("\n💰 Balance Check");
    console.log(`   Address: ${signer.address}`);
    console.log(`   Balance: ${hre.ethers.formatEther(balance)} POL`);
    console.log(`   Network: ${hre.network.name}\n`);
}

main();
```

### 2. Sync ABIs to Frontend

```javascript
// scripts/sync-abis.js
const fs = require("fs");
const path = require("path");

const contracts = [
    "LogisticsContainer",
    "BeZhasRealEstate",
    "NFTRental",
    "PropertyNFT",
    "PropertyFractionalizer"
];

const artifactsDir = path.join(__dirname, "../artifacts/contracts");
const frontendAbisDir = path.join(__dirname, "../frontend/src/abis");

// Create frontend abis directory
fs.mkdirSync(frontendAbisDir, { recursive: true });

console.log("\n📋 Sincronizando ABIs al frontend...\n");

for (const contract of contracts) {
    const artifactPath = path.join(artifactsDir, `${contract}.sol`, `${contract}.json`);
    const frontendPath = path.join(frontendAbisDir, `${contract}.json`);
    
    if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        const abi = { abi: artifact.abi };
        
        fs.writeFileSync(frontendPath, JSON.stringify(abi, null, 2));
        console.log(`✅ ${contract} → frontend/src/abis/${contract}.json`);
    } else {
        console.log(`⚠️ ${contract} artifact not found`);
    }
}

console.log("\n✅ Sincronización completada\n");
```

### 3. Test Contract Interaction

```javascript
// scripts/test-logistics.js
const hre = require("hardhat");

async function main() {
    const [signer] = await hre.ethers.getSigners();
    const contractAddress = process.env.LOGISTICS_CONTRACT_ADDRESS;
    
    if (!contractAddress) {
        console.error("❌ LOGISTICS_CONTRACT_ADDRESS no configurado");
        process.exit(1);
    }

    console.log("\n🧪 Testing LogisticsContainer...\n");
    
    const Logistics = await hre.ethers.getContractFactory("LogisticsContainer");
    const logistics = Logistics.attach(contractAddress);

    // Create container
    console.log("📦 Creando contenedor de prueba...");
    const tx = await logistics.createContainer(
        "TEST-" + Date.now(),
        "Port of Los Angeles",
        "Created"
    );
    const receipt = await tx.wait();
    console.log(`✅ Container creado - TxHash: ${receipt.hash}`);

    // Get container
    const containerId = "TEST-" + (Date.now() - 1000);
    try {
        const container = await logistics.getContainer(containerId);
        console.log("\n📋 Container Info:");
        console.log(`   ID: ${container.containerId}`);
        console.log(`   Location: ${container.location}`);
        console.log(`   Status: ${container.status}`);
        console.log(`   Owner: ${container.owner}`);
    } catch (error) {
        console.log("⚠️ Container no encontrado");
    }

    console.log("\n✅ Test completado\n");
}

main();
```

---

## 🐛 Troubleshooting

### Error: Insufficient Funds

```bash
Error: insufficient funds for intrinsic transaction cost
```

**Solución:**
1. Verificar balance: `npx hardhat run scripts/check-balance.js --network amoy`
2. Obtener POL testnet: https://faucet.polygon.technology/
3. Para mainnet: Transferir más POL a la wallet

### Error: Nonce Too High

```bash
Error: nonce has already been used
```

**Solución:**
```bash
# Resetear nonce en MetaMask:
# Settings → Advanced → Clear activity tab data

# O usar flag en Hardhat:
npx hardhat run scripts/deploy-logistics.js --network amoy --reset
```

### Error: Contract Verification Failed

```bash
Error: Contract source code already verified
```

**Solución:**
- El contrato ya está verificado (esto está bien)
- Si necesitas re-verificar, contacta a PolygonScan support

### Error: RPC Provider Timeout

```bash
Error: timeout exceeded
```

**Solución:**
1. Cambiar a RPC alternativo en `.env`:
```env
# Usar Alchemy o Infura en lugar del RPC público
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
```

2. Aumentar timeout en `hardhat.config.js`:
```javascript
networks: {
    amoy: {
        url: process.env.POLYGON_AMOY_RPC_URL,
        accounts: getPrivateKey(),
        timeout: 60000 // 60 segundos
    }
}
```

### Error: Contract Size Too Large

```bash
Error: contract code size exceeds limit
```

**Solución:**
1. Habilitar optimizer en `hardhat.config.js`:
```javascript
solidity: {
    version: "0.8.24",
    settings: {
        optimizer: {
            enabled: true,
            runs: 200 // Reduce para menor tamaño, aumenta para menor gas
        }
    }
}
```

2. Si persiste, dividir contrato en módulos más pequeños

---

## 📝 Checklist de Despliegue

### Pre-Despliegue
- [ ] Compilar contratos sin errores
- [ ] Verificar balance suficiente (mínimo 1 POL)
- [ ] Configurar variables de entorno (.env)
- [ ] Backup de private key en lugar seguro
- [ ] Test en network local primero

### Durante Despliegue
- [ ] Ejecutar script de despliegue
- [ ] Guardar dirección del contrato
- [ ] Esperar confirmaciones (mínimo 3)
- [ ] Verificar en explorer

### Post-Despliegue
- [ ] Actualizar config.json con direcciones
- [ ] Actualizar .env con direcciones
- [ ] Sincronizar ABIs al frontend
- [ ] Verificar contratos en PolygonScan
- [ ] Test de interacción básica
- [ ] Documentar deployment en README

---

## 🔗 Enlaces Útiles

### Testnet (Amoy)
- **Explorer:** https://amoy.polygonscan.com/
- **Faucet:** https://faucet.polygon.technology/
- **RPC:** https://rpc-amoy.polygon.technology
- **Chain ID:** 80002

### Mainnet (Polygon)
- **Explorer:** https://polygonscan.com/
- **RPC:** https://polygon-rpc.com
- **Chain ID:** 137
- **Bridge:** https://wallet.polygon.technology/

### Herramientas
- **Hardhat Docs:** https://hardhat.org/docs
- **OpenZeppelin Docs:** https://docs.openzeppelin.com/
- **Ethers.js Docs:** https://docs.ethers.org/
- **Remix IDE:** https://remix.ethereum.org/

---

**Última Actualización:** 27 de Diciembre, 2025  
**Versión:** 1.0
