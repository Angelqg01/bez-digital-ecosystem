# Revenue Stream Native - Comandos Útiles

## 🚀 Setup Inicial

### Generar Wallet para Backend
```bash
# Generar nueva wallet con ethers.js
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

### Instalar Dependencias
```bash
# Backend
cd backend
npm install ethers@^6.0.0 @openzeppelin/contracts hardhat @nomicfoundation/hardhat-toolbox

# Frontend
cd frontend
npm install ethers@^6.0.0 axios
```

### Configurar Environment
```bash
# Backend
cd backend
cp .env.revenue-stream .env
# Editar .env con valores reales

# Frontend
cd frontend
cat >> .env << EOF
VITE_BEZ_LIQUIDITY_RAMP_ADDRESS=0xYourContractAddress
VITE_CHAIN_ID=137
VITE_POLYGON_RPC_URL=https://polygon-rpc.com
EOF
```

---

## 📦 Smart Contract

### Compilar
```bash
cd backend
npx hardhat compile
```

### Deploy en Testnet (Mumbai)
```bash
# Editar scripts/deployLiquidityRamp.js primero
npx hardhat run scripts/deployLiquidityRamp.js --network mumbai
```

### Deploy en Mainnet (Polygon)
```bash
npx hardhat run scripts/deployLiquidityRamp.js --network polygon
```

### Verificar en Polygonscan
```bash
# Manual verification (si el script falla)
npx hardhat verify --network polygon \
  <CONTRACT_ADDRESS> \
  <ROUTER_ADDRESS> \
  <BEZ_TOKEN_ADDRESS> \
  <USDC_ADDRESS> \
  <ADMIN_ADDRESS> \
  <TREASURY_ADDRESS>
```

### Interactuar con Contrato (Hardhat Console)
```bash
npx hardhat console --network polygon

# En la console:
const contract = await ethers.getContractAt("BezLiquidityRamp", "0xContractAddress");

# Ver configuración
await contract.platformFeeBps();  // 50 (0.5%)
await contract.treasuryWallet();  // Treasury address

# Ver estadísticas
const [volume, fees, txCount] = await contract.getStats();
console.log("Volume:", ethers.formatUnits(volume, 6), "USDC");
console.log("Fees:", ethers.formatUnits(fees, 6), "USDC");
console.log("Transactions:", txCount.toString());

# Otorgar SIGNER_ROLE
const SIGNER_ROLE = await contract.SIGNER_ROLE();
await contract.grantRole(SIGNER_ROLE, "0xBackendWalletAddress");

# Verificar role
await contract.hasRole(SIGNER_ROLE, "0xBackendWalletAddress");  // true

# Cambiar treasury (solo admin)
await contract.setTreasury("0xNewTreasuryAddress");

# Cambiar fee (solo admin, max 5%)
await contract.setPlatformFee(100);  // 1%

# Recuperar tokens stuck (emergencia)
await contract.recoverERC20("0xTokenAddress", "0xRecipient");
```

---

## 🧪 Testing

### Run All Tests
```bash
cd backend
npm test
```

### Run Specific Test
```bash
npm test test/BezLiquidityRamp.test.js
```

### Test with Coverage
```bash
npx hardhat coverage
```

### Gas Report
```bash
REPORT_GAS=true npm test
```

---

## 🖥️ Backend (AI Risk Engine)

### Iniciar Servidor de Desarrollo
```bash
cd backend
npm run dev
```

### Iniciar en Producción
```bash
npm start
```

### Test Manual del API
```bash
# Health check
curl http://localhost:5000/api/health

# Request signature
curl -X POST http://localhost:5000/api/ai/sign-swap \
  -H "Content-Type: application/json" \
  -d '{
    "telemetry": {
      "address": "0xUserAddress",
      "balance": "1.5",
      "nonce": 10,
      "isContract": false,
      "kycLevel": 2,
      "vpnDetected": false,
      "userAgent": "Mozilla/5.0...",
      "screenResolution": "1920x1080",
      "timezone": "America/New_York"
    },
    "amountUSDC": 1000,
    "serviceId": "LIQUIDITY_RAMP"
  }'

# Get AI stats
curl http://localhost:5000/api/ai/stats

# Check sanctions
curl -X POST http://localhost:5000/api/ai/check-sanctions \
  -H "Content-Type: application/json" \
  -d '{"address": "0xUserAddress"}'
```

### Ver Logs en Tiempo Real
```bash
# Si usas PM2
pm2 logs bezhas-backend

# Si usas systemd
journalctl -u bezhas-backend -f

# Docker logs
docker logs -f bezhas-backend
```

---

## 🌐 Frontend

### Iniciar Servidor de Desarrollo
```bash
cd frontend
npm run dev
```

### Build para Producción
```bash
npm run build
```

### Preview Build
```bash
npm run preview
```

### Linting
```bash
npm run lint
```

---

## 🔍 Monitoreo y Analytics

### Ver Balance del Treasury
```bash
# Usando ethers.js
node -e "
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
const usdc = new ethers.Contract(
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  ['function balanceOf(address) view returns (uint256)'],
  provider
);
usdc.balanceOf('0xTreasuryAddress').then(balance => {
  console.log('Treasury Balance:', ethers.formatUnits(balance, 6), 'USDC');
});
"
```

### Escuchar Eventos en Tiempo Real
```bash
# Node script
node -e "
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
const contract = new ethers.Contract(
  '0xContractAddress',
  [
    'event PlatformFeeCollected(address indexed user, uint256 feeAmount, string serviceId)',
    'event AutoSwapExecuted(address indexed user, uint256 amountIn, uint256 bezReceived, string serviceId)'
  ],
  provider
);

console.log('Listening for events...');

contract.on('PlatformFeeCollected', (user, feeAmount, serviceId) => {
  console.log('💰 Fee:', ethers.formatUnits(feeAmount, 6), 'USDC from', user);
});

contract.on('AutoSwapExecuted', (user, amountIn, bezReceived, serviceId) => {
  console.log('✅ Swap:', ethers.formatUnits(amountIn, 6), 'USDC →', ethers.formatEther(bezReceived), 'BEZ');
});
"
```

### Consultar Historial de Fees (Ethers.js)
```javascript
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');

const contract = new ethers.Contract(
  '0xContractAddress',
  ['event PlatformFeeCollected(address indexed user, uint256 feeAmount, string serviceId)'],
  provider
);

// Get last 100 fee collection events
const filter = contract.filters.PlatformFeeCollected();
const events = await contract.queryFilter(filter, -10000, 'latest');

let totalFees = 0n;
for (const event of events) {
  totalFees += event.args.feeAmount;
  console.log(
    'Fee:', ethers.formatUnits(event.args.feeAmount, 6), 'USDC',
    'from', event.args.user,
    'service:', event.args.serviceId
  );
}

console.log('Total Fees Collected:', ethers.formatUnits(totalFees, 6), 'USDC');
```

### Consultar con The Graph (si está indexado)
```graphql
# GraphQL query
{
  platformFeeCollecteds(first: 100, orderBy: timestamp, orderDirection: desc) {
    id
    user
    feeAmount
    serviceId
    timestamp
  }
  
  stats: bezLiquidityRampStats(id: "1") {
    totalVolumeProcessed
    totalFeesCollected
    totalTransactions
  }
}
```

---

## 📊 Analytics Queries (Hardhat)

### Total Revenue Today
```javascript
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');

const contract = new ethers.Contract(
  process.env.BEZ_LIQUIDITY_RAMP_ADDRESS,
  ['event PlatformFeeCollected(address indexed user, uint256 feeAmount, string serviceId)'],
  provider
);

// Get current block
const currentBlock = await provider.getBlockNumber();

// Calculate block 24h ago (30k blocks per day on Polygon)
const fromBlock = currentBlock - 30000;

// Query events
const filter = contract.filters.PlatformFeeCollected();
const events = await contract.queryFilter(filter, fromBlock, 'latest');

// Sum fees
let totalFeesToday = 0n;
for (const event of events) {
  totalFeesToday += event.args.feeAmount;
}

console.log('Revenue Today:', ethers.formatUnits(totalFeesToday, 6), 'USDC');
```

### Top Users by Volume
```javascript
const events = await contract.queryFilter(
  contract.filters.AutoSwapExecuted(),
  -100000,
  'latest'
);

const userVolumes = {};
for (const event of events) {
  const user = event.args.user;
  const amount = event.args.amountIn;
  
  if (!userVolumes[user]) {
    userVolumes[user] = 0n;
  }
  userVolumes[user] += amount;
}

// Sort by volume
const sorted = Object.entries(userVolumes)
  .sort((a, b) => Number(b[1] - a[1]))
  .slice(0, 10);

console.log('Top 10 Users by Volume:');
for (const [user, volume] of sorted) {
  console.log(user, ':', ethers.formatUnits(volume, 6), 'USDC');
}
```

---

## 🛠️ Troubleshooting

### Check if Backend is Running
```bash
curl http://localhost:5000/api/health
```

### Check if Backend Wallet has SIGNER_ROLE
```javascript
const contract = await ethers.getContractAt("BezLiquidityRamp", "0x...");
const SIGNER_ROLE = await contract.SIGNER_ROLE();
const hasRole = await contract.hasRole(SIGNER_ROLE, "0xBackendWallet");
console.log("Has SIGNER_ROLE:", hasRole);
```

### Test Signature Generation (Backend)
```javascript
const ethers = require('ethers');

const privateKey = process.env.AI_SIGNER_PRIVATE_KEY;
const aiSigner = new ethers.Wallet(privateKey);

const userAddress = "0xUserAddress";
const amountUSDC = ethers.parseUnits("1000", 6);
const serviceId = "LIQUIDITY_RAMP";
const deadline = Math.floor(Date.now() / 1000) + 300;
const contractAddress = process.env.BEZ_LIQUIDITY_RAMP_ADDRESS;

const messageHash = ethers.solidityPackedKeccak256(
  ["address", "uint256", "string", "uint256", "address"],
  [userAddress, amountUSDC, serviceId, deadline, contractAddress]
);

const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

console.log("Message Hash:", messageHash);
console.log("Signature:", signature);
console.log("Signer Address:", aiSigner.address);
```

### Verify Signature On-Chain
```javascript
const contract = await ethers.getContractAt("BezLiquidityRamp", "0x...");

// This will revert if signature is invalid
await contract.swapFiatToBezWithSignature(
  amountUSDC,
  0,
  serviceId,
  deadline,
  signature,
  { from: userAddress }
);
```

### Check Gas Prices
```bash
curl https://gasstation-mainnet.matic.network/v2
```

### Reset Local Hardhat Network
```bash
npx hardhat clean
npx hardhat node  # In separate terminal
```

---

## 🔐 Security Commands

### Backup Private Keys
```bash
# Encrypt private key with GPG
echo "AI_SIGNER_PRIVATE_KEY=0x..." | gpg --encrypt --recipient your@email.com > backend-key.gpg

# Decrypt when needed
gpg --decrypt backend-key.gpg
```

### Rotate Backend Wallet
```bash
# 1. Generate new wallet
node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"

# 2. Update .env with new key

# 3. Revoke old SIGNER_ROLE
const contract = await ethers.getContractAt("BezLiquidityRamp", "0x...");
const SIGNER_ROLE = await contract.SIGNER_ROLE();
await contract.revokeRole(SIGNER_ROLE, "0xOldBackendWallet");

# 4. Grant to new wallet
await contract.grantRole(SIGNER_ROLE, "0xNewBackendWallet");
```

### Emergency Pause (if implemented)
```javascript
const contract = await ethers.getContractAt("BezLiquidityRamp", "0x...");
await contract.pause();  // Stop all swaps
// Fix issue...
await contract.unpause();  // Resume
```

---

## 📱 Discord/Slack Alerts

### Send Discord Webhook
```bash
curl -X POST "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "embeds": [{
      "title": "💰 Platform Revenue",
      "description": "Fee collected: $5.00 USDC",
      "color": 65280,
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
    }]
  }'
```

### Send Slack Webhook
```bash
curl -X POST "https://hooks.slack.com/services/YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "💰 Platform Revenue: $5.00 USDC collected"
  }'
```

---

## 🚀 Production Deployment

### Deploy Backend (PM2)
```bash
cd backend
npm install -g pm2
pm2 start npm --name "bezhas-backend" -- start
pm2 save
pm2 startup  # Auto-start on reboot
```

### Deploy Frontend (Vercel)
```bash
cd frontend
npm install -g vercel
vercel --prod
```

### Deploy Frontend (Nginx)
```bash
cd frontend
npm run build

# Copy to nginx
sudo cp -r dist/* /var/www/bezhas/

# Nginx config
sudo nano /etc/nginx/sites-available/bezhas

# Restart nginx
sudo systemctl restart nginx
```

### Deploy with Docker
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

---

## 📚 Documentation

### Generate JSDoc
```bash
cd backend
npm install -g jsdoc
jsdoc -r controllers/ services/ -d docs/
```

### Generate Solidity Docs
```bash
npm install -g solidity-docgen
npx hardhat docgen
```

---

**Este archivo contiene todos los comandos que necesitarás para trabajar con el Revenue Stream Native system!** 🚀

Guárdalo como referencia rápida.
