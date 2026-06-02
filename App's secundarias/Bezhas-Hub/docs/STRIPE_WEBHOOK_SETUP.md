# 🔧 Stripe Webhook Setup Guide

## Configuración del Webhook de Stripe

Este documento explica cómo configurar el webhook de Stripe para que cuando un cliente pague, el sistema le asigne automáticamente los BEZ-Coins en la base de datos de GCP.

---

## Paso 1: Configurar Webhook en Stripe Dashboard

### 1.1 Acceder a Stripe Dashboard

1. Ir a [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Iniciar sesión con tu cuenta
3. Navegar a **Developers** → **Webhooks**

### 1.2 Crear Endpoint de Webhook

1. Click en **"Add endpoint"**
2. Ingresar la URL del endpoint:

**Para Desarrollo Local:**
```
http://localhost:3001/api/stripe/webhook
```

**Para Producción (GCP):**
```
https://api-dot-bezhas-production.uc.r.appspot.com/api/stripe/webhook
```

3. Seleccionar los eventos a escuchar:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `charge.succeeded`
   - ✅ `charge.failed`

4. Click en **"Add endpoint"**

### 1.3 Obtener Webhook Secret

1. Después de crear el endpoint, Stripe mostrará el **Signing secret**
2. Copiar el secret (comienza con `whsec_...`)
3. Agregar a tu archivo `.env`:

```bash
STRIPE_WEBHOOK_SECRET="whsec_tu_webhook_secret_aqui"
```

---

## Paso 2: Configurar Stripe CLI (Para Testing Local)

### 2.1 Instalar Stripe CLI

**Windows (PowerShell):**
```powershell
winget install stripe.stripe-cli
```

**macOS/Linux:**
```bash
brew install stripe/stripe-cli/stripe
```

### 2.2 Autenticar Stripe CLI

```bash
stripe login
```

Esto abrirá el navegador para autorizar la CLI.

### 2.3 Forward Webhooks a Localhost

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Esto mostrará un webhook secret temporal. Copiarlo y agregarlo a `.env`:

```bash
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## Paso 3: Probar el Webhook

### 3.1 Crear Pago de Prueba con Stripe CLI

```bash
# Simular checkout.session.completed
stripe trigger checkout.session.completed
```

### 3.2 Verificar en Logs del Backend

Deberías ver en los logs:

```
✅ Webhook received: checkout.session.completed
✅ Processing token purchase for wallet: 0x1234...
✅ BEZ-Coins assigned successfully
✅ Discord notification sent
```

### 3.3 Verificar en Base de Datos

Conectar a MongoDB y verificar que se creó el registro de pago:

```javascript
// En MongoDB Compass o CLI
db.payments.find({ status: 'completed' }).sort({ createdAt: -1 }).limit(1)
```

Deberías ver:

```json
{
  "_id": "...",
  "userId": "user123",
  "walletAddress": "0x1234...",
  "amount": 10.00,
  "currency": "USD",
  "tokenAmount": 100,
  "status": "completed",
  "paymentMethod": "stripe",
  "paymentIntentId": "pi_...",
  "transactionHash": "0xabcdef...",
  "createdAt": "2026-02-09T..."
}
```

---

## Paso 4: Flujo Completo de Pago

### 4.1 Usuario Inicia Compra

1. Usuario hace click en "Comprar BEZ-Coins"
2. Frontend llama a: `POST /api/stripe/create-token-purchase-session`
3. Backend crea Checkout Session de Stripe
4. Usuario es redirigido a Stripe Checkout

### 4.2 Usuario Completa Pago

1. Usuario ingresa datos de tarjeta
2. Stripe procesa el pago
3. Stripe envía webhook `checkout.session.completed` al backend

### 4.3 Backend Procesa Webhook

```javascript
// backend/routes/stripe.routes.js
router.post('/webhook', async (req, res) => {
  const event = req.body;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { walletAddress, tokenAmount } = session.metadata;

    // 1. Transferir BEZ-Coins a la wallet del usuario
    const result = await fiatGatewayService.processFiatPayment(
      walletAddress,
      parseFloat(tokenAmount)
    );

    // 2. Guardar registro en MongoDB
    await Payment.create({
      userId: session.metadata.userId,
      walletAddress,
      amount: session.amount_total / 100,
      currency: session.currency,
      tokenAmount: parseFloat(tokenAmount),
      status: 'completed',
      paymentMethod: 'stripe',
      paymentIntentId: session.payment_intent,
      transactionHash: result.transactionHash
    });

    // 3. Enviar notificaciones
    await notifyDiscord(`💰 Payment completed: ${tokenAmount} BEZ`);
  }

  res.json({ received: true });
});
```

### 4.4 Usuario Recibe BEZ-Coins

1. BEZ-Coins aparecen en la wallet del usuario
2. Usuario recibe notificación (Discord/Telegram)
3. Frontend actualiza balance

---

## Paso 5: Seguridad y Validación

### 5.1 Verificar Firma del Webhook

El backend **DEBE** verificar la firma de Stripe:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Procesar evento...
});
```

### 5.2 Validar Metadata

Siempre validar que el webhook contiene los datos necesarios:

```javascript
if (!session.metadata.walletAddress || !session.metadata.tokenAmount) {
  console.error('⚠️ Missing metadata in webhook');
  return res.status(400).json({ error: 'Invalid metadata' });
}
```

### 5.3 Idempotencia

Evitar procesar el mismo pago dos veces:

```javascript
// Verificar si ya existe el pago
const existingPayment = await Payment.findOne({
  paymentIntentId: session.payment_intent
});

if (existingPayment) {
  console.log('⚠️ Payment already processed');
  return res.json({ received: true });
}
```

---

## Paso 6: Monitoreo y Debugging

### 6.1 Ver Logs de Webhooks en Stripe

1. Ir a **Developers** → **Webhooks**
2. Click en el endpoint
3. Ver **Recent deliveries**
4. Revisar requests y responses

### 6.2 Logs del Backend

```bash
# Ver logs en tiempo real
cd backend
npm run dev

# O con PM2
pm2 logs bezhas-backend
```

### 6.3 Logs en GCP

```bash
# Ver logs de Cloud Run
gcloud run services logs read bezhas-backend --region us-central1 --limit 50
```

---

## Paso 7: Troubleshooting

### Error: "Webhook signature verification failed"

**Causa:** `STRIPE_WEBHOOK_SECRET` incorrecto

**Solución:**
1. Verificar que el secret en `.env` coincide con el de Stripe Dashboard
2. Si usas Stripe CLI, usar el secret que muestra `stripe listen`

### Error: "Missing metadata in webhook"

**Causa:** No se pasó `walletAddress` o `tokenAmount` al crear la sesión

**Solución:**
```javascript
const session = await stripe.checkout.sessions.create({
  // ...
  metadata: {
    type: 'token_purchase',
    userId: req.user.id,
    walletAddress: req.user.walletAddress,
    tokenAmount: tokenAmount.toString()
  }
});
```

### Error: "Insufficient BEZ in treasury"

**Causa:** El hot wallet no tiene suficiente BEZ para transferir

**Solución:**
1. Verificar balance del hot wallet
2. Transferir más BEZ al hot wallet desde el treasury

### Webhook no se recibe

**Causa:** Firewall o URL incorrecta

**Solución:**
1. Verificar que el backend está corriendo
2. Verificar que la URL es accesible públicamente
3. En desarrollo, usar Stripe CLI: `stripe listen --forward-to localhost:3001/api/stripe/webhook`

---

## Checklist de Configuración

- [ ] Webhook endpoint creado en Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` agregado a `.env`
- [ ] Eventos seleccionados: `checkout.session.completed`, `payment_intent.succeeded`, etc.
- [ ] Stripe CLI instalado (para testing local)
- [ ] Webhook signature verification implementada
- [ ] Metadata validation implementada
- [ ] Idempotencia implementada
- [ ] Logs de debugging configurados
- [ ] Notificaciones (Discord/Telegram) configuradas
- [ ] Base de datos MongoDB conectada
- [ ] Hot wallet configurado con fondos

---

## Recursos Adicionales

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks Locally](https://stripe.com/docs/webhooks/test)

---

**Última actualización:** 9 de Febrero, 2026
