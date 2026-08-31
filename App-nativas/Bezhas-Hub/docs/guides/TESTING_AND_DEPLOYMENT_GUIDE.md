# Testing & Testnet Deployment Guide
## BeZhas Web3 - Guía de Testing y Deploy a Amoy

---

## 📋 Tabla de Contenidos

1. [Testing Local](#testing-local)
2. [Configuración de API Keys](#configuración-de-api-keys)
3. [Deploy a Amoy Testnet](#deploy-a-amoy-testnet)
4. [Verificación Post-Deploy](#verificación-post-deploy)

---

## 1. Testing Local

### 🧪 Scripts de Testing Disponibles

#### A. Test de Endpoints de Validación
```bash
cd tests
node validation-endpoints.test.js
```

**Tests incluidos:**
- ✅ Health Check
- ✅ GET /api/validation/history (Protected)
- ✅ GET /api/validation/stats (Protected)
- ✅ GET /api/validation/check/:hash (Public)
- ✅ GET /api/validation/:contentHash (Protected)
- ✅ POST /api/validation/initiate (Protected)
- ✅ GET /api/validation/queue-stats

#### B. Test de Sistema VIP
```bash
cd tests
node vip-system.test.js
```

**Tests incluidos:**
- ✅ GET /api/vip/tiers (Public)
- ✅ GET /api/vip/status (Protected)
- ✅ POST /api/vip/subscribe (Protected)
- ✅ VIP Middleware - Access Denied
- ✅ POST /api/vip/cancel
- ✅ POST /api/stripe/webhook (Signature Check)

#### C. Simulador de Webhooks Stripe
```bash
cd tests
node stripe-webhook-simulator.js flow
```

**Eventos simulados:**
1. `subscription_created` - Nueva subscripción VIP
2. `payment_succeeded` - Pago exitoso
3. `subscription_updated` - Upgrade de tier (Bronze → Silver)
4. `payment_failed` - Pago fallido
5. `subscription_deleted` - Cancelación

**Uso individual:**
```bash
# Simular evento específico
node stripe-webhook-simulator.js subscription_created
node stripe-webhook-simulator.js payment_succeeded
node stripe-webhook-simulator.js payment_failed
```

### 📝 Configurar Variables de Test

Antes de ejecutar tests, configura `.env.test`:

```bash
# Copiar template de testing
cp backend/.env.test.example backend/.env.test

# Editar y agregar tokens reales
code backend/.env.test
```

**Variables importantes:**
- `TEST_USER_TOKEN` - JWT de usuario de prueba
- `TEST_ADMIN_TOKEN` - JWT de admin de prueba
- `TEST_WALLET` - Dirección de wallet de prueba
- `API_URL` - URL del backend (default: http://localhost:3001)

---

## 2. Configuración de API Keys

### 🔑 A. Pinata (IPFS Storage)

**Obtener API Keys:**
1. Registrarse: https://app.pinata.cloud/register
2. Ir a: API Keys → New Key
3. Permisos: `pinFileToIPFS`, `pinJSONToIPFS`
4. Copiar: API Key y API Secret

**Configurar en .env:**
```env
PINATA_API_KEY=your-pinata-api-key-here
PINATA_SECRET_KEY=your-pinata-secret-api-key-here
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

**Plan Gratuito:**
- ✅ 1GB de storage
- ✅ 100 NFTs/mes
- ✅ Suficiente para testing

---

### 💳 B. Stripe (VIP Subscriptions)

**Setup Inicial:**
1. Crear cuenta: https://dashboard.stripe.com/register
2. Activar **Test Mode** (toggle superior derecho)
3. Obtener claves de test

**1. API Keys:**
```
Dashboard → Developers → API keys
```
Copiar:
- `Publishable key` (pk_test_...)
- `Secret key` (sk_test_...)

**2. Crear Productos VIP:**
```
Dashboard → Products → Add product
```

Crear 4 productos:

| Tier | Precio | Billing | Price ID |
|------|--------|---------|----------|
| Bronze | $9.99/mes | Monthly | price_xxx_bronze |
| Silver | $19.99/mes | Monthly | price_xxx_silver |
| Gold | $49.99/mes | Monthly | price_xxx_gold |
| Platinum | $99.99/mes | Monthly | price_xxx_platinum |

**3. Configurar Webhook:**
```
Dashboard → Developers → Webhooks → Add endpoint
```

**Endpoint URL (local con Stripe CLI):**
```
http://localhost:3001/api/stripe/webhook
```

**Eventos a escuchar:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Copiar Signing Secret:** `whsec_...`

**Testing Local (sin Stripe CLI):**
```bash
# Usar el simulador incluido
node tests/stripe-webhook-simulator.js flow
```

**Configurar en .env:**
```env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_signing_secret_here

STRIPE_PRICE_BRONZE=price_xxx_bronze
STRIPE_PRICE_SILVER=price_xxx_silver
STRIPE_PRICE_GOLD=price_xxx_gold
STRIPE_PRICE_PLATINUM=price_xxx_platinum
```

---

### ⛓️ C. Alchemy (Polygon RPC)

**Obtener API Key:**
1. Registrarse: https://dashboard.alchemy.com/
2. Create App → Polygon Amoy (Testnet)
3. Copiar API Key

**Configurar en .env:**
```env
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
CHAIN_ID=80002
```

**Plan Gratuito:**
- ✅ 300M compute units/mes
- ✅ Suficiente para desarrollo

**RPC Público (alternativa):**
```env
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
```

---

### 🪙 D. Faucet - Obtener MATIC de Prueba

**Polygon Amoy Faucet:**
```
https://faucet.polygon.technology/
```

**Pasos:**
1. Conectar wallet de prueba
2. Seleccionar: **Polygon Amoy**
3. Solicitar tokens (0.5 MATIC)
4. Esperar confirmación (~30 segundos)

**Verificar balance:**
```bash
# PowerShell
cd scripts
node check-balance.js
```

---

## 3. Deploy a Amoy Testnet

### 🚀 A. Preparación

**1. Verificar configuración:**
```bash
# Verificar .env
cat backend/.env | grep -E "POLYGON_RPC_URL|PRIVATE_KEY|CHAIN_ID"

# Verificar balance
cd scripts
node check-balance.js
```

**Requisitos mínimos:**
- ✅ 0.5 MATIC en wallet
- ✅ PRIVATE_KEY configurada
- ✅ POLYGON_RPC_URL apuntando a Amoy

**2. Compilar contratos:**
```bash
cd ..
npx hardhat compile
```

### 🏗️ B. Ejecutar Deploy

```bash
# Deploy a Amoy Testnet
npx hardhat run scripts/deploy-to-amoy.js --network amoy
```

**Output esperado:**
```
🚀 Deploying BeZhas Core Contracts to Amoy Testnet
================================================================================

📝 Deployer: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
💰 Balance: 1.5 MATIC

📦 Configuration:
   Network: Polygon Amoy (ChainID 80002)
   BEZ Token: 0x0000000000000000000000000000000000000000
   Treasury: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

================================================================================
1️⃣  Deploying ContentValidator...
================================================================================
✅ ContentValidator deployed: 0xABCD1234...
   BezCoin Fee: 10.0 BEZ
   Native Fee: 0.01 MATIC
   Backend Authorized: ✓

================================================================================
2️⃣  Deploying RewardsCalculator...
================================================================================
✅ RewardsCalculator deployed: 0xEFGH5678...
   Base Reward: 1.0 BEZ

================================================================================
3️⃣  Saving Deployment Info...
================================================================================
✅ Deployment saved: amoy-1738000000000.json
✅ Latest deployment updated: amoy-latest.json

================================================================================
🎉 DEPLOYMENT COMPLETE!
================================================================================
```

### 📦 C. Archivos Generados

**deployments/amoy-latest.json:**
```json
{
  "network": "polygon-amoy",
  "chainId": 80002,
  "timestamp": "2026-01-23T10:00:00.000Z",
  "deployer": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "contracts": {
    "contentValidator": {
      "address": "0xABCD1234...",
      "bezCoinFee": "10000000000000000000",
      "nativeFee": "10000000000000000",
      "treasury": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    },
    "rewardsCalculator": {
      "address": "0xEFGH5678...",
      "baseReward": "1000000000000000000"
    }
  }
}
```

---

## 4. Verificación Post-Deploy

### ✅ A. Actualizar Backend Config

**Copiar addresses del deploy a .env:**
```bash
# Leer deployment
cat deployments/amoy-latest.json

# Actualizar backend/.env
code backend/.env
```

**Agregar/Actualizar:**
```env
CONTENT_VALIDATOR_ADDRESS=0xABCD1234...
REWARDS_CALCULATOR_ADDRESS=0xEFGH5678...
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
CHAIN_ID=80002
```

### 🔍 B. Verificar Contratos en PolygonScan

**Explorador Amoy:**
```
https://amoy.polygonscan.com/
```

**Verificar manualmente:**
1. Buscar address del contrato
2. Verificar que el deployer es correcto
3. Verificar balance del contrato

**Verificación de código (opcional):**
```bash
npx hardhat verify --network amoy <CONTRACT_ADDRESS>
```

### 🧪 C. Test de Integración

**1. Reiniciar backend con nuevas addresses:**
```bash
cd backend
npm run dev
```

**2. Ejecutar tests:**
```bash
cd ../tests
node validation-endpoints.test.js
```

**3. Test de validación completo:**
```bash
# POST /api/validation/initiate
curl -X POST http://localhost:3001/api/validation/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentData": {
      "title": "Test Post",
      "content": "Testing validation on Amoy"
    },
    "contentType": "post",
    "authorAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

**Output esperado:**
```json
{
  "success": true,
  "contentHash": "0x1234567890abcdef...",
  "jobId": "validation-job-123",
  "message": "Validation initiated"
}
```

**4. Verificar transacción en blockchain:**
```
https://amoy.polygonscan.com/tx/0x...
```

---

## 📊 Resumen de Comandos

### Testing Completo
```bash
# 1. Tests de endpoints
cd tests
node validation-endpoints.test.js
node vip-system.test.js

# 2. Simulación de webhooks
node stripe-webhook-simulator.js flow

# 3. Verificación de sistemas
cd ../scripts
node verify-critical-systems.js
```

### Deploy a Amoy
```bash
# 1. Compilar
npx hardhat compile

# 2. Deploy
npx hardhat run scripts/deploy-to-amoy.js --network amoy

# 3. Actualizar .env con addresses generadas
code backend/.env

# 4. Reiniciar backend
cd backend
npm run dev
```

### Verificación
```bash
# Balance de wallet
cd scripts
node check-balance.js

# Estado de contratos
npx hardhat console --network amoy
> const validator = await ethers.getContractAt("ContentValidator", "0xABCD...")
> await validator.validationFeeNative()
```

---

## 🚨 Troubleshooting

### Error: "Insufficient balance"
```bash
# Obtener MATIC de faucet
# https://faucet.polygon.technology/

# Verificar balance
cd scripts
node check-balance.js
```

### Error: "nonce too high"
```bash
# Reset nonce en Metamask:
# Settings → Advanced → Reset Account
```

### Error: "Cannot connect to RPC"
```bash
# Verificar RPC URL
echo $POLYGON_RPC_URL

# Probar con RPC público
# POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
```

### Error: "Invalid signature" (Stripe)
```bash
# Verificar webhook secret
echo $STRIPE_WEBHOOK_SECRET

# O usar simulador sin firma
node tests/stripe-webhook-simulator.js flow
```

---

## 📚 Recursos Adicionales

- **Polygon Amoy Faucet:** https://faucet.polygon.technology/
- **Amoy Explorer:** https://amoy.polygonscan.com/
- **Alchemy Dashboard:** https://dashboard.alchemy.com/
- **Pinata Dashboard:** https://app.pinata.cloud/
- **Stripe Test Dashboard:** https://dashboard.stripe.com/test/dashboard
- **Stripe CLI:** https://stripe.com/docs/stripe-cli

---

## ✅ Checklist Pre-Producción

- [ ] Todos los tests pasan (validation + VIP)
- [ ] Webhooks Stripe funcionan correctamente
- [ ] Contratos desplegados y verificados en Amoy
- [ ] Backend conectado a contratos de Amoy
- [ ] Frontend probado con transacciones reales
- [ ] IPFS/Pinata funcionando
- [ ] WebSocket notifications trabajando
- [ ] VIP middleware protegiendo endpoints
- [ ] Logs sin errores críticos

---

**Última actualización:** 23 de Enero, 2026  
**Autor:** BeZhas Development Team
