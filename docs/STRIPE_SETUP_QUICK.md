# ⚡ CONFIGURACIÓN RÁPIDA DE STRIPE

## 🎯 Pasos para Activar Stripe en 5 Minutos

### 1️⃣ Actualizar Variables de Entorno

Edita `backend/.env` y agrega/actualiza:

```bash
# Claves de Stripe (obtener de dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE

STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY_HERE

# Obtener este de Stripe Dashboard (paso 2)
STRIPE_WEBHOOK_SECRET=whsec_PENDIENTE_CONFIGURAR

# URL del frontend
FRONTEND_URL=https://bezhas.com
```

### 2️⃣ Configurar Webhook en Stripe

1. **Ir a Stripe Dashboard:**
   https://dashboard.stripe.com/webhooks

2. **Crear Endpoint:**
   - Click "Add endpoint"
   - URL: `https://bezhas.com/api/stripe/webhook`
   - (Para testing local: `https://your-ngrok-url/api/stripe/webhook`)

3. **Seleccionar Eventos:**
   Marcar estos 6 eventos:
   ```
   ✓ checkout.session.completed
   ✓ payment_intent.succeeded
   ✓ payment_intent.payment_failed
   ✓ customer.subscription.created
   ✓ customer.subscription.deleted
   ✓ customer.subscription.updated
   ```

4. **Copiar Signing Secret:**
   - Después de crear el endpoint, verás "Signing secret"
   - Click "Reveal" y copia el valor
   - Comienza con `whsec_...`
   - Pega en `.env` como `STRIPE_WEBHOOK_SECRET`

### 3️⃣ Reiniciar Servidor

```bash
cd backend

# Detener servidor actual (Ctrl+C)

# Reiniciar
npm start

# O en modo desarrollo
npm run dev
```

### 4️⃣ Verificar Configuración

```bash
# Test rápido
node test-day4-auth-stripe.js

# Debe mostrar:
# ✅ Publishable Key: pk_live_YOUR...
# ✅ Currency: USD
# ✅ Configuration loaded
```

---

## 🧪 Testing Rápido

### A) Desde el Frontend

```javascript
// 1. Obtener configuración
fetch('https://bezhas.com/api/stripe/config')
  .then(res => res.json())
  .then(data => {
    console.log('Stripe Config:', data);
    // Debe mostrar publishableKey
  });

// 2. Crear sesión de pago NFT
fetch('https://bezhas.com/api/stripe/create-nft-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
  },
  body: JSON.stringify({
    nftId: 'test-nft-1',
    name: 'Test NFT',
    price: 9.99,
    email: 'test@example.com'
  })
})
.then(res => res.json())
.then(data => {
  console.log('Checkout URL:', data.url);
  // Redirigir: window.location.href = data.url;
});
```

### B) Con cURL (Terminal)

```bash
# 1. Obtener config
curl https://bezhas.com/api/stripe/config

# 2. Crear sesión NFT
curl -X POST https://bezhas.com/api/stripe/create-nft-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nftId": "test-1",
    "name": "Test NFT",
    "price": 9.99,
    "email": "test@example.com"
  }'

# 3. Crear suscripción
curl -X POST https://bezhas.com/api/stripe/create-subscription-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plan": "monthly",
    "email": "test@example.com"
  }'
```

### C) Verificar Webhook (Stripe CLI)

```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Escuchar webhooks localmente
stripe listen --forward-to localhost:5000/api/stripe/webhook

# En otra terminal, enviar evento de prueba
stripe trigger payment_intent.succeeded
```

---

## 🔍 Verificación de Endpoints

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/stripe/config` | GET | ❌ | Config pública |
| `/api/stripe/create-nft-session` | POST | ✅ | Comprar NFT |
| `/api/stripe/create-subscription-session` | POST | ✅ | Suscripción |
| `/api/stripe/create-token-purchase` | POST | ✅ | Comprar tokens |
| `/api/stripe/session/:id` | GET | ✅ | Ver sesión |
| `/api/stripe/subscriptions` | GET | ✅ | Ver suscripciones |
| `/api/stripe/cancel-subscription` | POST | ✅ | Cancelar |
| `/api/stripe/webhook` | POST | ❌* | Webhook handler |

*El webhook usa Stripe signature, no token JWT

---

## 💳 Tarjetas de Prueba (Modo Test)

### Para Testing, Cambiar a Claves Test:

```bash
# .env - Modo Test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Tarjetas Disponibles:

| Número | Resultado | CVC | Fecha |
|--------|-----------|-----|-------|
| `4242 4242 4242 4242` | ✅ Success | Any | Future |
| `4000 0000 0000 0002` | ❌ Decline | Any | Future |
| `4000 0025 0000 3155` | 🔐 3D Secure | Any | Future |
| `4000 0000 0000 0069` | ⏰ Expired | Any | Past |

---

## 🎯 Precios Configurados

### NFTs
- Precio variable según NFT
- Ejemplo: $49.99

### Suscripciones Premium
```javascript
Monthly:  $9.99/mes
Yearly:   $99.99/año  (2 meses gratis)
Lifetime: $299.99     (pago único)
```

### Tokens BZS
```javascript
Precio: $0.10 por token
Mínimo: 1 token
Ejemplo:
  - 100 tokens  = $10.00
  - 1,000 tokens = $100.00
  - 10,000 tokens = $1,000.00
```

---

## ⚙️ Personalizar Precios

Edita `backend/services/stripe.service.js`:

```javascript
// Línea ~90
const SUBSCRIPTION_PRICES = {
    'monthly': 999,    // $9.99 → Cambiar aquí
    'yearly': 9999,    // $99.99 → Cambiar aquí
    'lifetime': 29999  // $299.99 → Cambiar aquí
};

// Línea ~140
const pricePerToken = 10; // 10 centavos → Cambiar aquí
```

---

## 🐛 Troubleshooting

### Error: "Invalid API Key provided"

**Problema:** Las claves en `.env` son inválidas

**Solución:**
1. Verifica que las claves estén correctas
2. No debe haber espacios al inicio/fin
3. Verificar en: https://dashboard.stripe.com/apikeys
4. Regenerar si es necesario

### Error: "No such checkout session"

**Problema:** Session ID incorrecto

**Solución:**
1. Verificar que el sessionId sea correcto
2. Las sesiones expiran después de 24 horas
3. Crear nueva sesión para testing

### Error: "Webhook signature verification failed"

**Problema:** STRIPE_WEBHOOK_SECRET incorrecto

**Solución:**
1. Ir a: https://dashboard.stripe.com/webhooks
2. Click en tu endpoint
3. Click "Signing secret" → "Reveal"
4. Copiar y pegar en `.env`
5. Reiniciar servidor

### Error: "Authentication required"

**Problema:** Falta token JWT en headers

**Solución:**
```javascript
headers: {
  'Authorization': 'Bearer ' + accessToken
}
```

### Webhook no funciona en localhost

**Problema:** Stripe no puede acceder a localhost

**Solución:**
1. Usar ngrok: `ngrok http 5000`
2. Actualizar webhook URL en Stripe Dashboard
3. O usar Stripe CLI: `stripe listen --forward-to localhost:5000/api/stripe/webhook`

---

## 📊 Monitoreo

### Dashboard de Stripe
https://dashboard.stripe.com

**Ver:**
- Pagos recientes
- Webhooks enviados
- Logs de eventos
- Reembolsos
- Suscripciones activas

### Logs del Backend

```bash
# Ver logs en tiempo real
tail -f logs/app.log | grep STRIPE

# Ver solo errores
tail -f logs/app.log | grep "STRIPE.*ERROR"

# Ver webhooks recibidos
tail -f logs/app.log | grep "WEBHOOK_RECEIVED"
```

---

## 🚀 Listo para Producción

### Checklist:

- [ ] ✅ Claves LIVE configuradas en `.env`
- [ ] ✅ Webhook configurado en Stripe Dashboard
- [ ] ✅ `STRIPE_WEBHOOK_SECRET` agregado
- [ ] ✅ `FRONTEND_URL` correcto
- [ ] ✅ HTTPS habilitado (Día 2)
- [ ] ✅ Tests pasando: `node test-day4-auth-stripe.js`
- [ ] ✅ Servidor reiniciado
- [ ] ✅ Compra de prueba exitosa
- [ ] ✅ Webhook funcionando (verificar Dashboard)

### Activar Modo Live en Stripe:

1. Ir a: https://dashboard.stripe.com/settings
2. Click "Activate your account"
3. Completar información del negocio
4. Agregar cuenta bancaria
5. Verificar identidad
6. Cambiar toggle de "Test mode" a "Live mode"

---

## 📞 Soporte

### Documentación Completa:
- `SECURITY_DAY4_COMPLETE.md` - Documentación detallada
- `SECURITY_DAY4_SUMMARY.md` - Resumen ejecutivo
- `.env.stripe.example` - Ejemplo de configuración

### Recursos:
- Stripe Docs: https://stripe.com/docs
- Stripe API: https://stripe.com/docs/api
- Dashboard: https://dashboard.stripe.com
- Status: https://status.stripe.com

---

## ✅ Verificación Final

Ejecuta estos comandos para verificar que todo funciona:

```bash
cd backend

# 1. Verificar instalación
npm list stripe speakeasy qrcode

# 2. Ejecutar tests
node test-day4-auth-stripe.js

# 3. Verificar config
curl http://localhost:5000/api/stripe/config

# 4. Ver logs
tail -f logs/app.log
```

**Resultado Esperado:**
```
✅ Stripe configured
✅ Publishable Key: pk_live_...
✅ Currency: USD
✅ Endpoints responding
```

---

🎉 **¡Stripe configurado y listo para usar!**

Para crear tu primera transacción, ve al frontend y:
1. Selecciona un NFT o plan Premium
2. Click "Buy Now"
3. Completa el checkout de Stripe
4. Verifica en Dashboard: https://dashboard.stripe.com/payments
