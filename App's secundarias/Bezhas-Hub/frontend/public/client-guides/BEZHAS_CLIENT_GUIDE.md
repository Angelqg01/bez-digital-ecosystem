# 📘 Guía Completa de Integración BeZhas
## Para Clientes B2B — 3 Métodos de Acceso

**Versión:** 2.0.0 | **Fecha:** Junio 2026 | **Soporte:** support@bez.digital

---

## 📋 Índice
1. [Visión General](#visión-general)
2. [Métodos de Integración](#métodos-de-integración)
3. [SubApps Disponibles](#subapps-disponibles)
4. [Guía API REST](#guía-api-rest)
5. [Guía SDK JavaScript](#guía-sdk-javascript)
6. [Guía Plugin WordPress](#guía-plugin-wordpress)
7. [Autenticación y Seguridad](#autenticación-y-seguridad)
8. [Webhooks](#webhooks)
9. [Soporte y Recursos](#soporte-y-recursos)

---

## 🎯 Visión General

BeZhas es un ecosistema blockchain empresarial B2B con 13 SubApps especializadas. Cada empresa puede integrar las que necesita usando **3 métodos diferentes**:

| Método | Complejidad | Casos de Uso | Tiempo Setup |
|--------|------------|--------------|--------------|
| **API REST** | Media | Backend integration, automatización, batch | 2-4 horas |
| **SDK JavaScript** | Baja | Frontend, Node.js, serverless | 30 minutos |
| **Plugin WordPress** | Muy Baja | WooCommerce, tiendas online | 5 minutos |

**Todos los métodos ofrecen acceso a:**
- ✅ Pagos globales (tarjeta, banco, cripto)
- ✅ Logística y trazabilidad
- ✅ DeFi (staking, farming)
- ✅ Gestión de activos
- ✅ Virtualización energética

---

## 🔧 Métodos de Integración

### 1️⃣ API REST
**Para:** Backends, servidores, automatizaciones  
**Stack:** HTTP, JSON, cualquier lenguaje  
**URL Base:** `https://api.bez.digital:3001`

#### Ventajas
- ✅ Control total
- ✅ Multi-lenguaje (Python, Java, Go, C#, PHP)
- ✅ Webhooks bidireccionales
- ✅ Rate limiting controlado
- ✅ Documentación interactiva en `/api-docs`

#### Desventajas
- ❌ Requiere validar manualmente
- ❌ Setup más complejo
- ❌ Responsabilidad de retry logic

---

### 2️⃣ SDK JavaScript (@bezhas/connect)
**Para:** Frontend React, Node.js, serverless  
**Dependencias:** Zero (sin librerías externas)  
**Lenguaje:** JavaScript/TypeScript, zero-deps

#### Ventajas
- ✅ Type-safe (TypeScript)
- ✅ Async/await nativo
- ✅ Método `webhooks.verifyAndParse()` incluido
- ✅ 30+ métodos automáticos
- ✅ Instalación npm pública

#### Desventajas
- ❌ JavaScript/TypeScript only
- ❌ Browser-safe pero cuidado con secrets

#### Instalación
```bash
pnpm add @bezhas/connect
# o
npm install @bezhas/connect
```

---

### 3️⃣ Plugin WordPress
**Para:** WooCommerce, tiendas online  
**Lenguaje:** PHP  
**Versión WP mínima:** 6.0

#### Ventajas
- ✅ **Sin código**
- ✅ Setup en 3 pasos
- ✅ Dashboard widget incluido
- ✅ Ordenes auto-sincronizadas
- ✅ Soporte técnico prioritario

#### Desventajas
- ❌ WordPress-specific
- ❌ Funcionalidad limitada a pagos

---

## 🎯 SubApps Disponibles

### 📦 CargoLink — Trazabilidad Logística
**Casos de Uso:** Envíos, aduanas, tracking  
**URL:** `cargolink.bez.digital`  
**Rol:** Shipper, customs broker, carrier

**Características:**
- Integración POS (Shopify, WooCommerce)
- Ciclo de vida de cargo completo
- Datos de aduanas (CUSDEC)
- IoT + sensores (temperatura, ubicación)
- Firma digital de entregas

**Acceso:**
```bash
# API
POST /api/cargolink/transactions
GET  /api/cargolink/transactions/{id}

# SDK
const cargolink = bezhas.cargolink.withRoleKey(roleKey);
await cargolink.createTx({
  posRef: 'ORD-1001',
  origin: 'Algeciras',
  destination: 'Tánger'
});
```

---

### 💳 BeZhas Pay — Pagos Globales
**Casos de Uso:** Checkout, pagos B2B, cobros  
**URL:** `pay.bez.digital`  
**Métodos:** Card, Bank, Crypto, Fiat on-ramp

**Características:**
- Stripe integration (tarjeta)
- SEPA/SWIFT (banco europeo)
- BEZ Token (nativo blockchain)
- MoonPay/Transak (fiat on-ramp)
- Historial de transacciones

**Acceso:**
```bash
# API
POST /api/gateway/v1/pay
GET  /api/gateway/v1/price

# SDK
const order = await bezhas.pay.buy({
  amountUSD: 100,
  paymentMethod: 'card',
  email: 'customer@example.com'
});
// → { paymentId, checkoutUrl, ... }
```

---

### 💎 BZ Capital — DeFi & Staking
**Casos de Uso:** Inversión, staking, gobernanza  
**URL:** `capital.bez.digital/defi`  
**Redes:** Polygon, BNB Chain

**Características:**
- Staking BEZ con rewards
- Farming LP (Uniswap/QuickSwap)
- Gobernanza DAO
- Tesorería y treasuries
- Precio en tiempo real

**Acceso:**
```bash
# URL con wallet conectada (MetaMask)
https://capital.bez.digital/defi/staking

# API
GET /api/capital/defi/price
POST /api/capital/defi/stake
```

---

### 🔐 BEZ Wallet — Gestión de Activos
**Casos de Uso:** Gestión de fondos, bridge, validadores  
**URL:** `wallet.bez.digital`  
**Blockchains:** Polygon, BNB, Amoy (testnet)

**Características:**
- Multi-chain compatible
- Bridge LayerZero
- Validadores
- Gas patrocinio
- SIWE login

**Acceso:**
```bash
# Solo URL (wallet-based)
https://wallet.bez.digital
# Conectar MetaMask → auto-login SIWE
```

---

### ⚡ BZ Energy — Virtual Power Plant
**Casos de Uso:** Trading energía, OMIE, arbitrage  
**URL:** `energy.bez.digital`  
**Datos:** OMIE (mercado ibérico)

**Características:**
- Trading de energía en tiempo real
- MQTT IoT sensors
- Arbitrage con IA
- On-chain settlement
- Mercado OMIE integrado

**Acceso:**
```bash
# API
POST /api/energy/trade
GET  /api/energy/price

# SDK (en desarrollo)
await bezhas.energy.trade({ amount, price });
```

---

### 🧬 BZ Genesis — Identidad Bio Digital
**Casos de Uso:** SSO, agentes IA, reputación  
**URL:** `genesis.bez.digital`  
**Auth:** SIWE + Email

**Características:**
- BeZhas_ID único por usuario
- Agentes IA bio-autónomos
- Score de reputación onchain
- SSO integrado
- Verificación de identidad

**Acceso:**
```bash
# Login
https://genesis.bez.digital
# Auto-SIWE o Email + 2FA

# API
GET /api/identity/profile
GET /api/identity/reputation-score
```

---

### 📱 Otros (BZ Prestige, Sphere, PureScan, Vision, Gas Tank, Edge Node)
Cada una con funcionalidades especializadas.

**Acceso universal:**
```
URL: {subapp}.bez.digital
```

---

## 📡 Guía API REST

### Obtener API Key

1. **Ir a:** `hub.bez.digital/developers`
2. **Click:** "Generate API Key"
3. **Copiar** y guardar en `.env`:
```bash
BEZHAS_API_KEY=bez_key_xxxxxxxxxxxxxxxx
BEZHAS_API_URL=https://api.bez.digital:3001
BEZHAS_WEBHOOK_SECRET=wh_secret_yyyyyyyyyyy
```

⚠️ **Seguridad:** Nunca commits API keys. Nunca en logs.

### Primera Llamada

```bash
# Test conexión
curl -H "x-api-key: $BEZHAS_API_KEY" \
  https://api.bez.digital:3001/health

# Response:
# { "status": "ok", "timestamp": "...", ... }
```

### Llamadas Autenticadas

```bash
# Obtener perfil
curl -H "x-api-key: $BEZHAS_API_KEY" \
  https://api.bez.digital:3001/api/users/me

# Response:
# { "id": "u_abc123", "org": "org_xyz", "email": "..." }
```

### Endpoints por SubApp

#### Pay (Pagos)
```bash
# Crear pago
POST /api/gateway/v1/pay
{
  "amountUSD": 100,
  "paymentMethod": "card",
  "email": "customer@example.com"
}

# Historial
GET /api/gateway/v1/history?limit=20

# Precio actual
GET /api/gateway/v1/price?from=BEZ&to=USD
```

#### CargoLink (Logística)
```bash
# Crear transacción
POST /api/cargolink/transactions
{
  "posRef": "ORD-1001",
  "origin": "Algeciras",
  "destination": "Tánger",
  "items": [...]
}

# Avanzar estado
PATCH /api/cargolink/transactions/{id}
{
  "status": "cleared_customs",
  "note": "Aduanas completado"
}
```

#### Capital (DeFi)
```bash
# Precio token
GET /api/capital/defi/price

# APY actual
GET /api/capital/defi/apy

# Mi balance
GET /api/capital/defi/balance
```

### Rate Limiting

- **Límite:** 1000 requests/minuto
- **Cabecera:** `x-ratelimit-remaining`
- **Si excedes:** HTTP 429 Too Many Requests
- **Backoff:** Espera exponencial (1s, 2s, 4s...)

```bash
# Verificar límite
curl -i -H "x-api-key: $KEY" https://api.bez.digital/health
# x-ratelimit-remaining: 987
# x-ratelimit-reset: 1719763200
```

### Manejo de Errores

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API key not found or invalid",
    "details": { ... }
  }
}
```

**Códigos comunes:**
- `401 Unauthorized` → API key inválida/expirada
- `403 Forbidden` → Permiso insuficiente
- `404 Not Found` → Recurso no existe
- `429 Too Many Requests` → Rate limit excedido
- `500 Internal Server Error` → Contactar soporte

---

## 🚀 Guía SDK JavaScript

### Instalación

```bash
pnpm add @bezhas/connect
```

### Inicializar

```javascript
import { BeZhasConnect } from '@bezhas/connect';

const bezhas = new BeZhasConnect({
  apiKey: process.env.BEZHAS_API_KEY,
  apiUrl: 'https://api.bez.digital:3001' // opcional
});
```

### Interface: Pay

```javascript
// Pago con tarjeta
const order = await bezhas.pay.buy({
  amountUSD: 100,
  paymentMethod: 'card',
  email: 'customer@example.com'
});

console.log(order);
// {
//   paymentId: 'pay_abc123',
//   checkoutUrl: 'https://checkout.bez.digital/pay_abc123',
//   nextAction: 'redirect_to_checkout',
//   currency: 'USD',
//   amount: 100
// }

// Redirigir a checkout
window.location.href = order.checkoutUrl;
```

```javascript
// Pago con banco (SEPA)
const bank = await bezhas.pay.buy({
  amountUSD: 5000,
  paymentMethod: 'bank',
  email: 'empresa@example.com'
});

console.log(bank);
// {
//   iban: 'ES77 1465 0100 91 1766376210',
//   bic: 'IBEXESBBXXX',
//   reference: 'REF-abc123',
//   amount: 5000,
//   currency: 'EUR'
// }
```

### Interface: CargoLink

```javascript
// Con rol específico
const pos = bezhas.cargolink.withRoleKey(
  process.env.BEZHAS_POS_ROLE_KEY
);

// Crear transacción
const tx = await pos.createTx({
  posRef: 'ORD-12345',
  origin: 'Algeciras',
  destination: 'Tánger',
  items: [
    { sku: 'SKU-001', quantity: 10, weight: 50 }
  ]
});

console.log(tx);
// { txId: 'B-xyz789', status: 'created', ... }

// Avanzar estado
await pos.advanceTx('B-xyz789', {
  status: 'cleared_customs',
  note: 'Aduanas OK'
});
```

### Verificar Webhooks

```javascript
import express from 'express';
import { webhooks } from '@bezhas/connect';

const app = express();
app.use(express.raw({ type: 'application/json' }));

app.post('/webhooks/bezhas', (req, res) => {
  try {
    // Verificar firma y parsear
    const payload = webhooks.verifyAndParse(
      req.body,                                // Buffer crudo
      req.headers['x-bezhas-signature'],
      process.env.BEZHAS_WEBHOOK_SECRET
    );

    console.log('Evento:', payload);
    // { event: 'payment.completed', data: { ... } }

    // Procesar según evento
    switch (payload.event) {
      case 'payment.completed':
        // Activar orden
        await updateOrder(payload.data.paymentId, 'paid');
        break;

      case 'cargo.delivered':
        // Notificar cliente
        await sendDeliveryEmail(payload.data.txId);
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook invalid:', err.message);
    res.status(401).json({ error: 'Invalid signature' });
  }
});

app.listen(3000);
```

### Eventos Webhook

| Evento | Descripción | Data |
|--------|-------------|------|
| `payment.completed` | Pago exitoso | `{paymentId, amount, method}` |
| `payment.failed` | Pago rechazado | `{paymentId, reason}` |
| `cargo.created` | Transacción logística | `{txId, origin, destination}` |
| `cargo.updated` | Estado cambió | `{txId, newStatus, note}` |
| `cargo.delivered` | Entregado | `{txId, deliveredAt}` |

---

## 🔌 Guía Plugin WordPress

### Paso 1: Descargar e Instalar

1. Ir a: `hub.bez.digital/downloads`
2. Descargar: `bezhas-hub-v2.0.0.zip`
3. WordPress Admin → **Plugins** → **Add New**
4. **Upload Plugin** → seleccionar `.zip`
5. **Install Now** → **Activate**

### Paso 2: Obtener Credenciales

1. Ir a: `hub.bez.digital/developers`
2. **Generate API Key**
3. Copiar `API Key` (única oportunidad)
4. Copiar `Webhook Secret` (opcional pero recomendado)

### Paso 3: Configurar

1. WordPress → **Settings** → **BeZhas Configuration**
2. Pegar **API Key**
3. Pegar **Webhook Secret** (si tienes)
4. **Save Changes**

### Paso 4: Habilitar Payment Gateway

1. WordPress → **Settings** → **Payments**
2. Marcar **BeZhas** como gateway activo
3. Opcionalmente, desactivar otros gateways
4. **Save**

### Paso 5: Probar

1. Ir a una **Producto**
2. Agregar al carrito
3. **Checkout**
4. Seleccionar "BeZhas Pay"
5. Completar pago de prueba

### Métodos de Pago Disponibles

El plugin auto-detecta:
- ✅ **Tarjeta** (Stripe)
- ✅ **Banco** (SEPA)
- ✅ **Crypto** (BEZ token)

El cliente elige en checkout.

### Dashboard Widget

Después de instalar, verás en WordPress Admin:
- **BeZhas Stats:** Pagos hoy, semana, mes
- **Últimas transacciones**
- **Rate de aprobación**
- **Links a hub.bez.digital**

### Soporte

Si no aparece el widget o hay error:
1. Verificar que API Key es válida
2. Ir a **Plugins** → **Deactivate** → **Activate**
3. Limpiar caché (WP Super Cache, etc.)
4. Contactar: `support@bez.digital`

---

## 🔐 Autenticación y Seguridad

### Métodos de Login

#### 1. SIWE (Sign In With Ethereum)
**Para:** Usuarios con wallet (MetaMask)

```javascript
// Auto en todas las SubApps
// Usuario hace click en "Sign In with Wallet"
// Wallet firma → Backend verifica → JWT issued
```

**Flujo:**
1. Click "Connect Wallet"
2. MetaMask abre
3. Firma mensaje (sin gas cost)
4. Backend valida firma
5. JWT + Refresh token → localStorage

**Seguridad:** Firma criptográfica, no contraseña.

---

#### 2. Email + 2FA
**Para:** Usuarios sin wallet

```javascript
// Hub proporciona formulario
// 1. Email + contraseña
// 2. Código SMS o app 2FA
// 3. JWT issued
```

**Flujo:**
1. Ingresa email
2. Ingresa contraseña
3. Backend envía código SMS
4. Usuario confirma
5. JWT + Refresh token

**Seguridad:** PBKDF2 hashing, 2FA obligatorio.

---

#### 3. API Key
**Para:** Backend server-to-server

```bash
# Header en cada request
x-api-key: bez_key_xxxxxxxx
```

**Flujo:**
1. Generar key en `/developers`
2. Incluir en cabecera
3. Backend valida scopes
4. Procesa request

**Seguridad:** Scopes limitados, rotación anual.

---

### Tokens JWT

**Estructura:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.eyJ1c2VySWQiOiJ1X2FiYzEyMyIsIm9yZ0lkIjoib3JnX3h5eiIsImV4cCI6MTcxOTc2MzIwMH0
.signature_hmac_sha256
```

**Payload típico:**
```json
{
  "userId": "u_abc123",
  "orgId": "org_xyz",
  "role": "admin",
  "scope": ["read", "write"],
  "exp": 1719763200,
  "iat": 1719676800
}
```

**Válido por:** 24 horas (configurable)  
**Refresh:** Con refresh token (válido 30 días)

---

### Mejores Prácticas

**Usuarios:**
- ✅ Usa 2FA en 100% de cuentas
- ✅ Guarda recovery codes en gestor de contraseñas
- ✅ No compartas API keys
- ✅ Cambia contraseña cada 90 días
- ✅ Usa password manager (Bitwarden, 1Password)

**Desarrolladores:**
- ✅ Nunca commits `.env` o secrets
- ✅ API keys en variables de entorno
- ✅ Rota keys cada 90 días
- ✅ Usa diferentes keys para dev/prod
- ✅ Monitorea acceso en `/admin/logs`

---

## 🔔 Webhooks

### Registrar Webhook

```bash
POST /api/webhooks/register
{
  "url": "https://tudominio.com/webhooks/bezhas",
  "events": ["payment.completed", "cargo.delivered"],
  "secret": "wh_secret_xxxxx"
}
```

### Recibir Webhook

```javascript
app.post('/webhooks/bezhas', express.raw({type: 'application/json'}),
  (req, res) => {
    const payload = webhooks.verifyAndParse(
      req.body,
      req.headers['x-bezhas-signature'],
      process.env.WEBHOOK_SECRET
    );
    
    // Procesar...
    res.json({ ack: true });
  }
);
```

### Eventos Disponibles

**Payment Events:**
- `payment.completed`
- `payment.failed`
- `payment.refunded`
- `payment.disputed`

**Cargo Events:**
- `cargo.created`
- `cargo.updated`
- `cargo.customs_cleared`
- `cargo.delivered`
- `cargo.returned`

**Energy Events:**
- `energy.trade.completed`
- `energy.settlement`

### Reintentos

BeZhas reininta automáticamente:
- 1er intento: inmediato
- 2do: +5 minutos
- 3ro: +30 minutos
- 4to: +2 horas
- Máximo: 5 intentos en 24h

**Para custom retry logic:**
```javascript
// Guardar payload en DB
// Procesar en background job
// Confirmar solo si éxito
```

---

## 📞 Soporte y Recursos

### Documentación

| Recurso | URL |
|---------|-----|
| **API Docs** | `hub.bez.digital/api-docs` |
| **SDK Docs** | `www.npmjs.com/@bezhas/connect` |
| **Guides** | `hub.bez.digital/docs` |
| **Status** | `status.bez.digital` |

### Contacto

| Canal | Contacto | Respuesta |
|-------|----------|-----------|
| **Email Support** | `support@bez.digital` | <2h |
| **Slack Channel** | `#bezhas-support` | <30 min |
| **Phone (ES)** | `+34 956 XX XXXX` | Oficina 9-18h CET |
| **Chat (live)** | `hub.bez.digital/chat` | 9-18h CET |

### Comunidad

- **Discord:** `discord.gg/bezhas`
- **Twitter:** `@BeZhas_io`
- **Telegram:** `t.me/bezhas_ecosystem`

### SLA (Service Level Agreement)

| Nivel | Uptime | Respuesta | Cobertura |
|-------|--------|-----------|-----------|
| **Starter** | 99.5% | 4h | Email |
| **Business** | 99.9% | 1h | Email + Slack |
| **Enterprise** | 99.99% | 30min | 24/7 + Dedicated |

---

## 🚀 Checklist: Tu Primera Integración

### Opción A: API REST
- [ ] Obtener API Key en `/developers`
- [ ] Guardar en `.env`
- [ ] Test con `curl /health`
- [ ] Implementar función de pago
- [ ] Registrar webhook
- [ ] Procesar evento en backend
- [ ] Testing en sandbox
- [ ] Deploy a producción

### Opción B: SDK JavaScript
- [ ] `pnpm add @bezhas/connect`
- [ ] Importar `BeZhasConnect`
- [ ] Inicializar con apiKey
- [ ] Usar `bezhas.pay.buy()`
- [ ] Manejar webhook con `webhooks.verifyAndParse()`
- [ ] Procesar evento
- [ ] Build y deploy
- [ ] Testing E2E

### Opción C: Plugin WordPress
- [ ] Descargar `.zip` de `/downloads`
- [ ] **Plugins** → **Upload** → **Activate**
- [ ] Obtener API Key
- [ ] **Settings** → **BeZhas** → pegar key
- [ ] Habilitar como payment gateway
- [ ] Hacer compra de prueba
- [ ] Verificar orden en BeZhas Hub
- [ ] ¡Listo para producción!

---

## ❓ FAQ

**P: ¿Puedo usar varios métodos simultáneamente?**  
R: Sí. Ej: WordPress para pagos + API para datos.

**P: ¿Qué pasa si pierdo mi API Key?**  
R: Genera una nueva en `/developers`. La vieja se anula.

**P: ¿Cuál es el costo?**  
R: Pay-per-call (precio en portal). WP plugin es gratuito.

**P: ¿Qué blockchains soporta?**  
R: Polygon, BNB Chain, Amoy testnet.

**P: ¿Puedo testear antes de producción?**  
R: Sí. Usa credenciales de sandbox (URLs con `-sandbox`).

**P: ¿Cuándo se resetea el rate limit?**  
R: Cada minuto. Ver header `x-ratelimit-reset`.

**P: ¿Cómo verificar que el webhook es legítimo?**  
R: Siempre usa `webhooks.verifyAndParse()` (API) o validar firma.

**P: ¿Puedo cambiar de método más tarde?**  
R: Sí. Todos son independientes.

---

## 📝 Notas Legales

**Términos:**
- Cumples con MiCA (UE) y AEAT (España)
- Datos encriptados en tránsito (TLS 1.3)
- Compliant con SEPA, SWIFT, DAC8
- SOC 2 Type II auditado

**Privacidad:**
- GDPR compliant
- No vendemos datos
- Política: `bez.digital/privacy`

---

**¿Preguntas? Contacta a `support@bez.digital`**  
**Última actualización: Junio 2026**
