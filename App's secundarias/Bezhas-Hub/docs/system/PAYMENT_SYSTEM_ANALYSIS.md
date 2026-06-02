# 🔍 Análisis Completo del Sistema de Pagos - BeZhas

**Fecha:** 19 de Enero de 2026  
**Estado:** En Desarrollo

---

## 📊 Resumen Ejecutivo

### ✅ **Completado (70%)**
- Configuración de credenciales Stripe (LIVE)
- Estructura de rutas backend
- Componentes frontend de pago
- Servicios de distribución de tokens
- Contratos inteligentes (código)

### 🚧 **Pendiente (30%)**
- Lógica de webhook para distribución automática
- Despliegue de contratos en Amoy
- Fondeo de Hot Wallet
- Testing end-to-end
- Sistema de logging de transacciones

---

## 1️⃣ **STRIPE INTEGRATION**

### ✅ **Completado:**
```
✓ Claves LIVE configuradas (.env, backend/.env, frontend/.env)
  - STRIPE_PUBLISHABLE_KEY: pk_live_YOUR_KEY_HERE
  - STRIPE_SECRET_KEY: sk_live_YOUR_KEY_HERE
  - STRIPE_WEBHOOK_SECRET: whsec_YOUR_SECRET_HERE

✓ Rutas activadas en server.js
  - /api/stripe/* (stripe.routes.js)
  - /api/vip/* (vip.routes.js)
  - /api/payment/* (payment.routes.js)

✓ Servicios implementados
  - stripe.service.js (NFTs, Subscriptions, Tokens)
  - vip.service.js (Suscripciones mensuales)
```

### 🚧 **Pendiente:**

#### **CRÍTICO - Webhook de Distribución de Tokens**
**Archivo:** `backend/routes/payment.routes.js` línea 47

**Código Actual:**
```javascript
case 'payment_intent.succeeded':
    logger.info('Payment succeeded:', event.data.object);
    // TODO: Implement token distribution logic here
    break;
```

**Implementación Necesaria:**
```javascript
case 'payment_intent.succeeded':
    const paymentIntent = event.data.object;
    const metadata = paymentIntent.metadata;
    
    // 1. Validar metadata
    if (!metadata.walletAddress || !metadata.bezAmount) {
        logger.error('Missing metadata in payment intent');
        break;
    }
    
    // 2. Llamar al servicio de distribución
    try {
        const { dispenseTokens } = require('../services/fiatGateway.service');
        const result = await dispenseTokens({
            recipientAddress: metadata.walletAddress,
            amount: parseFloat(metadata.bezAmount),
            paymentIntentId: paymentIntent.id
        });
        
        logger.info('Tokens dispensed:', result);
        
        // 3. Guardar en BD
        await Transaction.create({
            type: 'stripe_purchase',
            paymentIntentId: paymentIntent.id,
            walletAddress: metadata.walletAddress,
            amount: metadata.bezAmount,
            status: 'completed',
            txHash: result.txHash
        });
        
    } catch (error) {
        logger.error('Error dispensing tokens:', error);
        // TODO: Implementar sistema de retry
    }
    break;
```

#### **Sistema de Logging de Transacciones**
Crear modelo MongoDB:
```javascript
// backend/models/Payment.model.js
const PaymentSchema = new mongoose.Schema({
    type: { type: String, enum: ['stripe', 'crypto', 'vip'], required: true },
    paymentIntentId: String,
    walletAddress: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    bezAmount: Number,
    txHash: String,
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    metadata: Object,
    createdAt: { type: Date, default: Date.now }
});
```

---

## 2️⃣ **CONTRATOS INTELIGENTES**

### ✅ **Completado:**
```
✓ Código de contratos (contracts/BezhasToken.sol, BeZhasQualityEscrow.sol)
✓ Script de despliegue (scripts/deploy-quality-oracle.js)
✓ Configuración de redes en hardhat.config.js
✓ Dirección configurada: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
```

### 🚧 **Pendiente:**

#### **1. Desplegar en Polygon Amoy**
```bash
# Comando necesario:
pnpm exec hardhat run scripts/deploy-quality-oracle.js --network amoy

# Prerequisitos:
# - Cuenta debe tener MATIC en Amoy (faucet: https://faucet.polygon.technology)
# - PRIVATE_KEY en .env debe estar correcta
# - AMOY_RPC_URL debe estar activa
```

**Resultado Esperado:**
- BezCoin Token desplegado en nueva dirección
- QualityEscrow desplegado
- Roles configurados (MINTER_ROLE)

#### **2. Actualizar Direcciones Post-Deploy**
Después del despliegue, actualizar:
- `.env` (raíz)
- `backend/.env`
- `frontend/.env`
- `backend/config.json`

#### **3. Verificar Contratos en Polygonscan**
```bash
npx hardhat verify --network amoy <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

---

## 3️⃣ **HOT WALLET & DISTRIBUCIÓN DE TOKENS**

### ✅ **Completado:**
```
✓ Hot Wallet configurada en .env
  - HOT_WALLET_PRIVATE_KEY: (configurar en .env)
  - Dirección: (se deriva de la private key)

✓ Servicio fiatGateway.service.js implementado
  - dispenseTokens() - Transfiere tokens al usuario
  - checkAllowance() - Verifica permisos
```

### 🚧 **Pendiente:**

#### **1. Fondear Hot Wallet con MATIC**
**Por qué es necesario:** La Hot Wallet paga el gas de las transacciones cuando dispensa tokens.

**Cantidad recomendada:** 
- Desarrollo: 5-10 MATIC en Amoy
- Producción: 100-500 MATIC en Polygon Mainnet

**Obtener MATIC Testnet:**
1. https://faucet.polygon.technology
2. Conectar wallet: 0x52Df82920CBAE522880dD7657e43d1A754eD044E
3. Solicitar MATIC para Amoy

#### **2. Aprobar Gasto de Tokens (Safe Wallet)**
Si los tokens están en una Safe Wallet, necesitas aprobar que la Hot Wallet pueda gastarlos:

```javascript
// En Remix o Hardhat Console:
const bezToken = await ethers.getContractAt(
    "BezhasToken",
    "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"
);

// Aprobar 1 millón de BEZ para la Hot Wallet
await bezToken.approve(
    "0x52Df82920CBAE522880dD7657e43d1A754eD044E",
    ethers.parseEther("1000000")
);
```

#### **3. Testing de Distribución**
Crear script de prueba:
```javascript
// scripts/test-token-distribution.js
const { dispenseTokens } = require('../backend/services/fiatGateway.service');

async function testDistribution() {
    const result = await dispenseTokens({
        recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        amount: 100, // 100 BEZ tokens
        reference: 'test_payment_123'
    });
    
    console.log('Distribution result:', result);
}

testDistribution();
```

---

## 4️⃣ **FRONTEND**

### ✅ **Completado:**
```
✓ Componente StripeElementsCheckout.jsx
✓ Integración en BeVIP.jsx
✓ Servicio bezCoinService.js
✓ Configuración VITE_STRIPE_PUBLIC_KEY
```

### 🚧 **Pendiente:**

#### **1. Flujo Completo de Compra de Tokens BEZ**
Crear página dedicada: `frontend/src/pages/BuyBezCoin.jsx`

**Features necesarias:**
- Selector de cantidad de tokens
- Calculadora de precio en tiempo real
- Preview de bonificaciones VIP
- Integración con Stripe Elements
- Confirmación de transacción blockchain

#### **2. Dashboard de Transacciones del Usuario**
`frontend/src/pages/MyTransactions.jsx`

**Mostrar:**
- Historial de compras (Stripe + Crypto)
- Estados de transacciones pendientes
- Links a Polygonscan para txHash
- Recibos descargables

#### **3. Manejo de Errores Avanzado**
Agregar en `bezCoinService.js`:
```javascript
// Casos a manejar:
- Pago exitoso en Stripe pero fallo en blockchain
- Timeout en distribución de tokens
- Wallet sin fondos para gas
- Contrato pausado
```

---

## 5️⃣ **BACKEND SERVICES**

### ✅ **Completado:**
```
✓ fiatGateway.service.js (Distribución de tokens)
✓ stripe.service.js (Procesamiento de pagos)
✓ vip.service.js (Suscripciones)
```

### 🚧 **Pendiente:**

#### **1. Sistema de Retry para Fallos**
Si la distribución de tokens falla, reintentar automáticamente:

```javascript
// backend/services/paymentRetry.service.js
const retryQueue = new BullMQ('payment-retry', {
    connection: redis
});

async function addToRetryQueue(paymentData) {
    await retryQueue.add('distribute-tokens', paymentData, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        }
    });
}
```

#### **2. Notificaciones por Email**
Enviar confirmación al usuario cuando se completa el pago:

```javascript
// backend/services/notification.service.js
async function sendPaymentConfirmation(email, paymentData) {
    await sendEmail({
        to: email,
        subject: 'Compra de BEZ-Coin Completada',
        template: 'payment-success',
        data: {
            amount: paymentData.bezAmount,
            txHash: paymentData.txHash,
            polygonscanUrl: `https://amoy.polygonscan.com/tx/${paymentData.txHash}`
        }
    });
}
```

#### **3. API Endpoint para Consultar Balance de Hot Wallet**
```javascript
// backend/routes/admin.routes.js
router.get('/hot-wallet/status', requireAdmin, async (req, res) => {
    const { checkHotWalletBalance } = require('../services/fiatGateway.service');
    const status = await checkHotWalletBalance();
    
    res.json({
        address: status.address,
        maticBalance: status.maticBalance,
        bezBalance: status.bezBalance,
        lowFunds: status.maticBalance < ethers.parseEther('1')
    });
});
```

---

## 6️⃣ **TESTING**

### 🚧 **Pendiente:**

#### **1. Tests Unitarios**
```javascript
// backend/tests/payment.test.js
describe('Payment System', () => {
    it('should process Stripe payment and dispense tokens', async () => {
        // Test completo
    });
    
    it('should handle payment failures gracefully', async () => {
        // Test de error
    });
});
```

#### **2. Tests de Integración**
- Stripe Webhook -> Backend -> Blockchain -> Confirmación
- Timeout scenarios
- Concurrency (múltiples pagos simultáneos)

#### **3. Tests End-to-End**
Usar Cypress o Playwright:
```javascript
// e2e/buy-tokens.spec.js
describe('Buy BEZ Tokens', () => {
    it('complete purchase flow', () => {
        cy.visit('/buy-bez-coin');
        cy.selectTokenAmount(100);
        cy.clickBuy();
        cy.fillStripeCard('4242424242424242');
        cy.confirmPayment();
        cy.waitForTokens();
        cy.checkWalletBalance();
    });
});
```

---

## 7️⃣ **SEGURIDAD**

### ✅ **Completado:**
```
✓ Webhook signature verification
✓ Private keys en .env (no en código)
✓ CORS configurado
```

### 🚧 **Recomendaciones:**

#### **1. Implementar Rate Limiting en Webhooks**
```javascript
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100 // 100 requests por minuto
});

app.use('/api/payment/webhook', webhookLimiter);
```

#### **2. Validación de Montos**
```javascript
// Prevenir distribución excesiva
const MAX_BEZ_PER_TRANSACTION = 10000;

if (bezAmount > MAX_BEZ_PER_TRANSACTION) {
    throw new Error('Amount exceeds maximum allowed');
}
```

#### **3. Monitoring de Hot Wallet**
Alert si:
- Balance MATIC < 1
- Balance BEZ < 1000
- Más de 10 transacciones fallidas consecutivas

---

## 8️⃣ **ROADMAP DE IMPLEMENTACIÓN**

### **Semana 1 - CRÍTICO**
- [x] Configurar Stripe (COMPLETADO)
- [ ] Implementar lógica de webhook (línea 47)
- [ ] Desplegar contratos en Amoy
- [ ] Fondear Hot Wallet con MATIC
- [ ] Testing básico end-to-end

### **Semana 2 - IMPORTANTE**
- [ ] Sistema de logging de transacciones
- [ ] Dashboard de transacciones en frontend
- [ ] Notificaciones por email
- [ ] Página de compra de BEZ-Coin

### **Semana 3 - NICE-TO-HAVE**
- [ ] Sistema de retry automático
- [ ] Tests unitarios y de integración
- [ ] Monitoring de Hot Wallet
- [ ] Documentación de API

---

## 🚨 **BLOQUEADORES ACTUALES**

### **1. Webhook Sin Lógica de Distribución**
**Impacto:** ALTO - Los pagos se procesan pero los tokens no se entregan

**Solución:** Implementar código en `payment.routes.js` línea 47

### **2. Contratos No Desplegados en Amoy**
**Impacto:** ALTO - No se pueden hacer transacciones reales

**Solución:** Ejecutar script de deploy

### **3. Hot Wallet Sin MATIC**
**Impacto:** CRÍTICO - No se pueden enviar transacciones

**Solución:** Usar faucet de Polygon Amoy

---

## 📞 **Próximos Pasos Inmediatos**

```bash
# 1. Obtener MATIC de Faucet
# Visitar: https://faucet.polygon.technology
# Wallet: 0x52Df82920CBAE522880dD7657e43d1A754eD044E

# 2. Desplegar Contratos
pnpm exec hardhat run scripts/deploy-quality-oracle.js --network amoy

# 3. Actualizar Direcciones en .env

# 4. Implementar Webhook (Ver sección 1.2)

# 5. Probar Flujo Completo
```

---

## ✅ **Checklist de Validación**

Antes de considerar el sistema "completo":

- [ ] Webhook distribuye tokens automáticamente
- [ ] Transacciones se guardan en MongoDB
- [ ] Usuario recibe email de confirmación
- [ ] Dashboard muestra transacciones
- [ ] Hot Wallet tiene fondos suficientes
- [ ] Contratos verificados en Polygonscan
- [ ] Tests end-to-end pasan
- [ ] Documentación actualizada
- [ ] Monitoring configurado
- [ ] Rate limiting activo

---

**Estado General:** 🟡 **70% Completo - Requiere Implementación de Distribución Automática**
