# ❓ FAQ & Troubleshooting

**Preguntas frecuentes y soluciones rápidas**

---

## 🚀 Inicio Rápido

### P: ¿Por dónde empiezo?
**R:** 
1. **Opción A (sin código):** Plugin WordPress → 5 minutos
2. **Opción B (rápido):** SDK JavaScript → 30 minutos
3. **Opción C (control total):** API REST → 2-4 horas

Elige según tu stack técnico.

### P: ¿Necesito cuenta de blockchain?
**R:** No es obligatorio. BeZhas maneja todo. Solo si quieres staking/trading en Capital.

### P: ¿Cuál SubApp necesito?
**R:** Depende de tu negocio:
- **Ecommerce** → BeZhas Pay + CargoLink
- **ERP** → API REST + Capital (opcional)
- **Marketplace** → Pay + SDK
- **Tienda online WP** → Plugin WordPress

---

## 🔐 Autenticación & Credenciales

### P: ¿Perdí mi API Key, qué hago?
**R:**
1. Ir a `hub.bez.digital/developers`
2. Sección "API Keys"
3. Click en "Revoke" junto a la vieja
4. Click "Generate New Key"
5. La vieja será rechazada inmediatamente

⚠️ **Importante:** No hay forma de recuperarla, siempre genera una nueva.

### P: ¿Puedo compartir mi API Key?
**R:** **NO. Nunca.** Es como tu contraseña bancaria. Si alguien la tiene, puede:
- Hacer pagos (tus fondos)
- Acceder tus datos
- Crear ordenes falsas

Siempre:
- Guarda en `.env` (nunca en código)
- Usa diferentes keys para dev/prod
- Rota cada 90 días

### P: Mi webhook no funciona, ¿por qué?
**R:** Checklist:

```javascript
// 1. ¿Tu servidor es accesible desde internet?
// Test: curl -X POST https://tuserver.com/webhooks/bezhas
// Debe responder 200

// 2. ¿Verificas la firma?
const crypto = require('crypto');
const sig = req.headers['x-bezhas-signature'];
const hash = crypto.createHmac('sha256', SECRET)
  .update(req.body).digest('hex');
if (hash !== sig) return 401; // ❌ FALLO: firma inválida

// 3. ¿Es HTTPS?
// HTTP no funciona. Debe ser HTTPS.

// 4. ¿Respondés 200 rápido?
// BeZhas espera respuesta en <5s.
// No hagas DB queries lentas dentro del webhook.
res.json({ ack: true }); // ✅ Responde ya
// ... procesa en background job
```

### P: ¿Cuál es la diferencia entre JWT y API Key?
**R:** 

| JWT | API Key |
|-----|---------|
| Usuario (email/SIWE) | Servidor/App |
| Expira (24h) | Infinito |
| Contiene claims (userId, org) | Identificador simple |
| Frontend + Backend | Backend solo |
| Refresh token | Rotación manual |

**Cuándo usar cada una:**
- **Frontend (React/Vue):** JWT (del login)
- **Backend (Node/Python):** API Key
- **Serverless (Lambda):** API Key

### P: Mi JWT expiró, ¿qué hago?
**R:** 
```javascript
// Si tienes refresh token guardado
const newJWT = await fetch(
  'https://api.bez.digital:3001/auth/refresh',
  {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${refreshToken}`
    }
  }
);

// Si no tienes: login nuevamente
// Ir a: hub.bez.digital
// Sign In → nuevo JWT
```

---

## 💳 Pagos

### P: ¿Qué métodos de pago soportan?
**R:** 
- ✅ **Tarjeta:** Visa, Mastercard, American Express (Stripe)
- ✅ **Banco:** SEPA (ES, DE, FR...), SWIFT (global)
- ✅ **Crypto:** BEZ token, USDC, USDT
- ✅ **On-ramps:** MoonPay, Transak, Ramp

### P: ¿Cuál es la comisión?
**R:** Depende del método:
- Tarjeta: 2.9% + €0.30
- Banco: €1.50 (SEPA) o 0.5% (SWIFT)
- Crypto: 0.3% (network fees)

Véase en panel: `hub.bez.digital/pricing`

### P: ¿Cuánto tiempo tarda en llegar el dinero?
**R:**
- Tarjeta: 2-3 días hábiles (en tu cuenta bancaria)
- SEPA: 1-2 días hábiles
- SWIFT: 3-5 días hábiles
- Crypto: 10-30 minutos (según red)

### P: Pago fue rechazado, ¿por qué?
**R:** Causas comunes:
1. **Fondos insuficientes** → Verificar saldo
2. **Tarjeta expirada** → Usar tarjeta válida
3. **3D Secure** → Confirmar en app del banco
4. **Límite diario** → Contactar banco
5. **Fraude flagged** → Llamar al banco

Reintenta en <5 min. Si persiste: `support@bez.digital`

### P: ¿Puedo reembolsar un pago?
**R:** Sí, pero depende del método:
- **Tarjeta:** Hasta 90 días ✅
- **Banco:** Hasta 8 semanas ✅
- **Crypto:** No es reversible ❌

Vía API:
```bash
POST /api/gateway/v1/refund
{
  "paymentId": "pay_abc123",
  "reason": "customer_request"
}
```

---

## 📦 Logística (CargoLink)

### P: ¿Cómo vinculo mi POS con BeZhas?
**R:** Si usas WooCommerce/Shopify:
```javascript
const cargolink = bezhas.cargolink.withRoleKey(roleKey);

await cargolink.linkPos({
  baseUrl: 'https://tutienda.com/api',
  provider: 'woocommerce', // o 'shopify'
  apiKey: 'woo_...' // credenciales POS
});

// Sync órdenes
const { created, updated } = await cargolink.syncOrders();
console.log(`${created} nuevas, ${updated} actualizadas`);
```

### P: ¿Qué es el status "cleared_customs"?
**R:** Es cuando la aduana aprueba el envío. Datos requeridos:
- Descripción de contenido
- Valor total
- Peso
- Clasificación arancelaria (HS code)

Luego: "in_transit" → "delivered"

### P: ¿Puedo rastrear por teléfono?
**R:** Sí, con enlace público:
```
https://track.bez.digital/B-abc123
```

Compartible con cliente. Muestra:
- Ubicación actual (GPS)
- Eventos (aduanas, entrega)
- Temperatura (si sensor IoT)
- ETA

### P: ¿Qué pasa si se pierde el envío?
**R:** 
1. Report en panel (status "lost")
2. BeZhas abre reclamación
3. Puede asegurar: `insurance: true` en creación
4. Cobertura: hasta el 100% del valor

---

## 💰 Capital (DeFi)

### P: ¿Cuánto rédito genera staking?
**R:** Variable, actualmente:
- **BEZ staking:** 25% APY (anual)
- **LP farming:** 45% APY
- **Treasury:** 15% APY

Véase en vivo: `capital.bez.digital/defi`

⚠️ **Riesgo:** APY no garantizado. Puede cambiar.

### P: ¿Puedo perder mi dinero?
**R:** Risks:
- **Smart contract exploit:** Auditado (SOC 2), riesgo muy bajo
- **Liquidation:** Si precio cae 50%, podrías perder (depende ratio)
- **Impermanent loss:** Si LP, spread de tokens
- **Rug pull:** BeZhas es DAO, no control centralizado

**Mitigación:**
- Auditoría profesional (CertiK)
- Seguro opcional (+2% fee)
- DAO governance (votación antes de cambios)

### P: ¿Cómo retiro mis fondos?
**R:**
1. `capital.bez.digital/defi`
2. Click en "Unstake"
3. Confirmar en wallet (firma)
4. 7 días de espera (security lock)
5. Dinero en wallet

Alternativa rápida (fee 5%):
```
Click "Unstake Urgently"
→ Inmediato
```

---

## 🔧 Problemas Técnicos

### P: "API Key invalid"
**R:** Verifica:
1. ¿Copiaste bien la key? (sin espacios)
2. ¿Key no fue revocada? (check en `/developers`)
3. ¿Incluiste en header correcto?
   ```bash
   ✅ curl -H "x-api-key: bez_key_xxx"
   ❌ curl -H "Authorization: Bearer bez_key_xxx"
   ```

### P: "Rate limit exceeded"
**R:**
- Límite: 1000 req/min
- Si excedes: espera 1 minuto
- Header devuelto: `x-ratelimit-reset` (timestamp)

**Mitigación:**
```javascript
// Batch requests
await Promise.all(orders.map(o => createTx(o))); 
// 100 órdenes en 1 request, no 100 requests

// Queue con backoff
async function retryWithBackoff(fn, maxRetries=3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000); // exponential
        continue;
      }
      throw err;
    }
  }
}
```

### P: "Webhook timeout"
**R:** BeZhas espera respuesta en <5s. Si tarda más:

```javascript
// ❌ MAL: procesas en el webhook
app.post('/webhooks/bezhas', async (req, res) => {
  const data = parseWebhook(req);
  await saveToDatabase(data); // Puede tardar >5s
  await sendEmail(data.email); // Timeout!
  res.json({ ack: true }); // Nunca se ejecuta
});

// ✅ BIEN: responde ya, procesa en background
app.post('/webhooks/bezhas', async (req, res) => {
  const data = parseWebhook(req);
  
  // Responder inmediato
  res.json({ ack: true }); // <100ms
  
  // Procesar en background
  processWebhookAsync(data); // Sin esperar
});

async function processWebhookAsync(data) {
  await saveToDatabase(data);
  await sendEmail(data.email);
}
```

### P: CORS error en navegador
**R:** El servidor BeZhas permite CORS. Si ves error:

```javascript
// Problema: no incluiste credenciales
const response = await fetch(
  'https://api.bez.digital:3001/api/users/me',
  {
    headers: { 'x-api-key': key }
    // ❌ Falta: credentials: 'include'
  }
);

// Solución: usar backend proxy
// Frontend → Tu servidor → BeZhas
app.get('/api/users/me', async (req, res) => {
  const response = await fetch(
    'https://api.bez.digital:3001/api/users/me',
    {
      headers: { 'x-api-key': process.env.BEZHAS_API_KEY }
    }
  );
  res.json(await response.json());
});
```

---

## 📊 Datos & Reporting

### P: ¿Cómo exporto facturas?
**R:**
```bash
GET /api/billing/invoices?month=2026-06&format=pdf
# Devuelve PDF descargable
```

O en panel: `hub.bez.digital/billing` → "Download Invoice"

### P: ¿Puedo ver todos mis pagos?
**R:**
```bash
GET /api/gateway/v1/history?limit=100&offset=0

# Response:
[
  {
    "paymentId": "pay_abc",
    "amount": 100.00,
    "currency": "USD",
    "method": "card",
    "status": "completed",
    "createdAt": "2026-06-15T10:30:00Z"
  },
  ...
]
```

### P: ¿Cómo veo mis costos?
**R:**
1. `hub.bez.digital/admin/billing`
2. "Usage" → API calls, storage, transactions
3. "Invoices" → Resumen mensual
4. "Pricing" → Tarifas actuales

---

## 📞 Cuando Contactar Soporte

**Email: `support@bez.digital`**

**Respuesta esperada:**
- Nivel Starter: <4 horas
- Nivel Business: <1 hora
- Nivel Enterprise: <30 minutos

**Qué incluir al reportar:**
```
Asunto: [Error/Pregunta] Descripción breve

Cuerpo:
1. Qué intentas hacer
2. Qué error ves (con código/screenshot)
3. Cuándo pasó
4. ID relevante (paymentId, txId, API call)
5. Stack técnico (API, SDK, WP plugin)

Ejemplo:
---
Asunto: [Error 500] Pago falla en webhook

Descripción:
- Webhook en: https://mysite.com/webhooks/bezhas
- Error: {"status": 500, "error": "ECONNREFUSED"}
- Cuando: 2026-06-15 14:30 UTC
- Payment: pay_abc123
- Stack: Node.js + Express
---
```

**Links útiles:**
- Docs: `hub.bez.digital/docs`
- Status: `status.bez.digital`
- Logs: `hub.bez.digital/admin/logs`
- API Playground: `hub.bez.digital/api-playground`

---

## 🎓 Recursos de Aprendizaje

**Oficial:**
- API Docs: `hub.bez.digital/api-docs`
- SDK GitHub: `github.com/bezhas/connect`
- Blog: `blog.bez.digital`

**Comunidad:**
- Discord: `discord.gg/bezhas`
- Telegram: `t.me/bezhas_ecosystem`
- Twitter: `@BeZhas_io`

**Cursos:**
- "API Basics" (30 min) → `hub.bez.digital/learn/api`
- "SDK Deep Dive" (1h) → `hub.bez.digital/learn/sdk`
- "WordPress Setup" (15 min) → `hub.bez.digital/learn/wp`

---

## ✅ Checklist: Antes de Producción

- [ ] API Key guardada en `.env`
- [ ] Webhook signature verificada en TODOS los eventos
- [ ] Webhook URL es HTTPS
- [ ] Webhook responde <5s
- [ ] Rate limiting implementado
- [ ] Error handling sin exponer secrets
- [ ] Logs de transacciones críticas
- [ ] Testing en sandbox completado
- [ ] Rollback plan si falla
- [ ] Monitoring activo (Datadog, New Relic, etc.)
- [ ] Team entrenado en procedimientos
- [ ] SLA de soporte contratado

---

**¿Algo no funciona? Contacta a support@bez.digital**

**Última actualización: Junio 2026**
