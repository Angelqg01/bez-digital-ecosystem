# 🚀 GUÍA DE IMPLEMENTACIÓN - Sistema de Validación de Contenido

## 📋 Pre-requisitos

Antes de implementar el sistema, asegúrate de tener:

### Software Requerido
- [x] Node.js v18+ 
- [x] PostgreSQL 14+
- [x] Redis 6+
- [x] Hardhat (para deploy del smart contract)

### Cuentas y Servicios
- [ ] Cuenta de Stripe (modo test)
- [ ] API key de Alchemy/Infura (Polygon RPC)
- [ ] Wallet con MATIC para gas fees (testnet: Amoy faucet)
- [ ] Wallet para backend (validaciones delegadas)

---

## 1️⃣ INSTALACIÓN DE DEPENDENCIAS

### Backend
```bash
cd backend
npm install stripe pino-pretty
```

**Dependencias nuevas:**
- `stripe@^14.12.0` - SDK de Stripe para pagos FIAT
- `pino-pretty@^11.0.0` - Pretty printer para logs

---

## 2️⃣ CONFIGURACIÓN DE BASE DE DATOS

### Crear Base de Datos PostgreSQL

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos y usuario
CREATE DATABASE bezhas_db;
CREATE USER bezhas_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE bezhas_db TO bezhas_user;

# Salir
\q
```

### Ejecutar Migraciones

```bash
cd backend
psql -U bezhas_user -d bezhas_db -f migrations/001_create_validation_tables.sql
```

**Verificar tablas creadas:**
```bash
psql -U bezhas_user -d bezhas_db -c "\dt"
```

Deberías ver:
- `content_validations`
- `pending_validations`
- `validation_events`
- `validation_stats`
- `validator_wallets`

---

## 3️⃣ CONFIGURACIÓN DE STRIPE

### Crear Cuenta de Stripe

1. Ve a [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Activa el **modo test** (toggle en la esquina superior)
3. Obtén las claves:

```
Dashboard → Developers → API keys
```

- **Publishable key:** `pk_test_...`
- **Secret key:** `sk_test_...`

### Configurar Webhook

1. Ve a **Developers → Webhooks**
2. Click **Add endpoint**
3. URL: `http://your-backend-url/api/payment/webhook`
4. Eventos a escuchar:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copia el **Signing secret**: `whsec_...`

### Configurar Variables de Entorno

Añade a `backend/.env`:

```bash
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

---

## 4️⃣ CONFIGURACIÓN DE BLOCKCHAIN

### Obtener RPC URL (Alchemy/Infura)

**Opción A: Alchemy (Recomendado)**
1. Ve a [https://www.alchemy.com/](https://www.alchemy.com/)
2. Crea una app para **Polygon Amoy** (testnet)
3. Copia la URL: `https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY`

**Opción B: Infura**
1. Ve a [https://infura.io/](https://infura.io/)
2. Crea proyecto → Selecciona Polygon
3. Copia la URL del endpoint

### Crear Wallet para Backend

```bash
# Generar nueva wallet (guarda la private key!)
npx hardhat console
> const wallet = ethers.Wallet.createRandom()
> console.log('Address:', wallet.address)
> console.log('Private Key:', wallet.privateKey)
```

**⚠️ IMPORTANTE:** Guarda la private key en un lugar seguro (nunca en Git).

### Obtener MATIC de Testnet

Para Polygon Amoy (testnet):
1. Ve a [https://faucet.polygon.technology/](https://faucet.polygon.technology/)
2. Pega tu wallet address
3. Solicita MATIC

**Necesitarás:**
- ~0.5 MATIC para deploy del contrato
- ~0.5 MATIC para el backend wallet (gas fees)

### Configurar Variables de Entorno

Añade a `backend/.env`:

```bash
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
BACKEND_PRIVATE_KEY=0xYOUR_BACKEND_WALLET_PRIVATE_KEY
TREASURY_WALLET=0xYOUR_TREASURY_WALLET_ADDRESS
```

---

## 5️⃣ DEPLOY DEL SMART CONTRACT

### Configurar Hardhat

Edita `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    amoy: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.BACKEND_PRIVATE_KEY],
      chainId: 80002
    }
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY
    }
  }
};
```

### Compilar Contrato

```bash
npx hardhat compile
```

### Deploy a Testnet (Amoy)

```bash
npx hardhat run scripts/deploy-content-validator.js --network amoy
```

**Output esperado:**
```
🚀 Starting ContentValidator deployment...
📝 Deploying with account: 0x...
💰 Account balance: 0.5 MATIC
...
✅ ContentValidator deployed to: 0xABC123...
```

### Verificar Contrato en PolygonScan

```bash
npx hardhat verify --network amoy 0xCONTRACT_ADDRESS "0xBEZCOIN_ADDRESS" "10000000000000000000" "10000000000000000" "0xTREASURY_ADDRESS"
```

### Actualizar Variables de Entorno

Añade a `backend/.env`:

```bash
CONTENT_VALIDATOR_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

---

## 6️⃣ CONFIGURACIÓN DE REDIS

### Instalar y Configurar Redis

**Windows:**
```bash
# Descargar desde: https://github.com/microsoftarchive/redis/releases
# O usar WSL
wsl --install
wsl
sudo apt update
sudo apt install redis-server
sudo service redis-server start
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

### Verificar Redis

```bash
redis-cli ping
# Debería responder: PONG
```

### Configurar Variables de Entorno

Añade a `backend/.env`:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

---

## 7️⃣ INICIAR SERVICIOS

### Backend

Terminal 1 - Backend Server:
```bash
cd backend
npm start
```

**Logs esperados:**
```
✅ Backend server running on http://127.0.0.1:3001
✅ Blockchain event listener started
✅ Validation queue worker started
```

### Frontend

Terminal 2 - Frontend Dev Server:
```bash
cd frontend
npm run dev
```

**Logs esperados:**
```
VITE v5.x.x ready in xxx ms
➜ Local: http://localhost:5173/
```

---

## 8️⃣ PRUEBAS

### Test 1: Health Check

```bash
curl http://localhost:3001/api/health
# Respuesta: {"ok":true}
```

### Test 2: Iniciar Validación

```bash
curl -X POST http://localhost:3001/api/validation/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "contentData": {"title": "Test Post", "body": "Hello World"},
    "contentType": "post",
    "authorAddress": "0xYOUR_WALLET_ADDRESS"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "contentHash": "0xabc123...",
  "validationId": "temp_1697234567890",
  "fees": {
    "bezCoin": "10.0",
    "matic": "0.01",
    "fiat": 9.99
  }
}
```

### Test 3: Crear Sesión de Stripe

```bash
curl -X POST http://localhost:3001/api/payment/create-validation-session \
  -H "Content-Type: application/json" \
  -d '{
    "contentHash": "0xabc123...",
    "contentData": {"title": "Test"},
    "contentType": "post",
    "authorAddress": "0xYOUR_ADDRESS",
    "amount": 999
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Test 4: Pago de Prueba con Stripe

1. Abre la URL de Stripe del paso anterior
2. Usa tarjeta de prueba: `4242 4242 4242 4242`
3. Fecha: cualquier fecha futura
4. CVC: cualquier 3 dígitos
5. Completa el pago

**Verificar webhook:**
```bash
# Ver logs del backend
# Deberías ver: "✅ Payment successful: cs_test_..."
```

### Test 5: Verificar Validación en Blockchain

```bash
curl http://localhost:3001/api/validation/check/0xYOUR_CONTENT_HASH
```

**Respuesta esperada:**
```json
{
  "success": true,
  "isValidated": true,
  "validation": {
    "contentHash": "0x...",
    "author": "0x...",
    "timestamp": 1697234567,
    "paymentMethod": "FiatDelegated"
  }
}
```

---

## 9️⃣ INTEGRACIÓN EN FRONTEND

### Añadir ValidationModal a CreatePost

```jsx
// frontend/src/pages/CreatePostPage.jsx
import ValidationModal from '../components/content/ValidationModal';

const [showValidationModal, setShowValidationModal] = useState(false);

const handlePublish = () => {
  setShowValidationModal(true);
};

return (
  <>
    {/* Botón publicar */}
    <button onClick={handlePublish}>Publicar</button>
    
    {/* Modal de validación */}
    <ValidationModal
      isOpen={showValidationModal}
      content={postData}
      contentType="post"
      onValidate={(validationData) => {
        // Publicar con badge
        publishPost({ ...postData, validation: validationData });
        setShowValidationModal(false);
      }}
      onSkip={() => {
        // Publicar sin validación
        publishPost(postData);
        setShowValidationModal(false);
      }}
    />
  </>
);
```

### Añadir BlockchainBadge a Posts

```jsx
// frontend/src/components/feed/PostCard.jsx
import BlockchainBadge from '../components/content/BlockchainBadge';

<div className="post-card">
  <BlockchainBadge 
    validation={post.validation} 
    size="md" 
  />
  {/* Resto del post */}
</div>
```

---

## 🔟 PRODUCCIÓN

### Checklist Pre-Producción

- [ ] Cambiar Stripe a **modo live** (quitar `_test_` de las keys)
- [ ] Deploy smart contract a **Polygon Mainnet**
- [ ] Usar RPC URL de **mainnet** (no testnet)
- [ ] Configurar **dominio propio** para webhook de Stripe
- [ ] Activar **HTTPS** (certificado SSL)
- [ ] Configurar **firewall** (solo puertos 443, 80)
- [ ] Setup **monitoring** (Sentry, Datadog)
- [ ] Configurar **backups** de base de datos
- [ ] Auditoría de **seguridad** del smart contract
- [ ] **Load testing** del backend
- [ ] Setup **CI/CD** pipeline

### Deploy del Smart Contract a Mainnet

```bash
# ⚠️ IMPORTANTE: Usa wallet con MATIC real
npx hardhat run scripts/deploy-content-validator.js --network polygon

# Verificar en PolygonScan
npx hardhat verify --network polygon 0xCONTRACT_ADDRESS ...
```

### Variables de Entorno Producción

```bash
NODE_ENV=production
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_PROD_API_KEY
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
DATABASE_URL=postgresql://user:pass@prod-db-host:5432/bezhas_prod
REDIS_URL=redis://prod-redis-host:6379
FRONTEND_URL=https://bez.digital
```

---

## 📊 MONITOREO

### Verificar Estado de los Servicios

```bash
# Backend
curl http://localhost:3001/api/health

# Redis
redis-cli ping

# PostgreSQL
psql -U bezhas_user -d bezhas_db -c "SELECT COUNT(*) FROM content_validations;"

# Blockchain listener
curl http://localhost:3001/api/validation/stats
```

### Logs Importantes

```bash
# Backend logs
cd backend && npm start

# Ver logs de validaciones
tail -f logs/validations.log

# Ver errores
tail -f logs/error.log
```

### Bull Dashboard (opcional)

```bash
npm install -g bull-board
bull-board
# Abre: http://localhost:3000
```

---

## 🐛 TROUBLESHOOTING

### Error: "EADDRINUSE: address already in use"

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/macOS
lsof -ti:3001 | xargs kill -9
```

### Error: "Insufficient funds for gas"

```bash
# Verificar balance
npx hardhat console --network amoy
> const balance = await ethers.provider.getBalance("0xYOUR_ADDRESS");
> console.log(ethers.formatEther(balance));

# Solicitar más MATIC del faucet
```

### Error: "Webhook signature verification failed"

1. Verifica que `STRIPE_WEBHOOK_SECRET` sea correcto
2. En Stripe Dashboard, ve a Webhooks → Editar endpoint
3. Revela el signing secret y actualiza `.env`
4. Reinicia el backend

### Error: "Contract not deployed"

```bash
# Verificar en PolygonScan
https://amoy.polygonscan.com/address/0xYOUR_CONTRACT_ADDRESS

# Si no está deployed, volver a hacer deploy
npx hardhat run scripts/deploy-content-validator.js --network amoy
```

### Blockchain Listener no recibe eventos

```bash
# Verificar conexión RPC
curl -X POST $POLYGON_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Verificar logs del listener
# Deberías ver: "🔊 Starting blockchain event listener..."
```

---

## 📚 RECURSOS ADICIONALES

- [Documentación de Stripe](https://stripe.com/docs)
- [Polygon RPC](https://docs.polygon.technology/tools/rpc-providers/)
- [Hardhat Docs](https://hardhat.org/getting-started/)
- [BullMQ Guide](https://docs.bullmq.io/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

---

## ✅ CHECKLIST COMPLETO

### Setup Inicial
- [ ] Instalar dependencias backend
- [ ] Crear base de datos PostgreSQL
- [ ] Ejecutar migraciones SQL
- [ ] Instalar y configurar Redis
- [ ] Crear cuenta de Stripe (test)
- [ ] Obtener RPC URL (Alchemy/Infura)
- [ ] Generar wallet para backend
- [ ] Obtener MATIC de testnet

### Deployment
- [ ] Compilar smart contract
- [ ] Deploy a testnet (Amoy)
- [ ] Verificar contrato en PolygonScan
- [ ] Actualizar variables de entorno
- [ ] Configurar webhook de Stripe

### Testing
- [ ] Probar health check
- [ ] Probar endpoint de validación
- [ ] Probar creación de sesión Stripe
- [ ] Completar pago de prueba
- [ ] Verificar validación en blockchain
- [ ] Verificar event listener funcionando

### Integración Frontend
- [ ] Añadir ValidationModal a CreatePost
- [ ] Añadir BlockchainBadge a PostCard
- [ ] Probar flujo completo end-to-end

### Producción (Futuro)
- [ ] Auditoría de seguridad
- [ ] Deploy a mainnet
- [ ] Configurar monitoring
- [ ] Setup CI/CD
- [ ] Load testing
- [ ] Documentación completa

---

**¿Necesitas ayuda?** Revisa la documentación completa en `docs/CONTENT-VALIDATION-ARCHITECTURE.md`

🎉 **¡Ya tienes todo listo para validar contenido en blockchain!**
