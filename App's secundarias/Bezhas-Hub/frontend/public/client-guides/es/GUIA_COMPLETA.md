# Guia Completa de Integracion BeZhas
## Para Clientes B2B — 3 Metodos de Acceso

**Version:** 2.0.0 | **Fecha:** Junio 2026 | **Soporte:** support@bez.digital

---

## Indice
1. Vision General
2. Metodos de Integracion
3. SubApps Disponibles
4. Guia API REST
5. Guia SDK JavaScript
6. Guia Plugin WordPress
7. Autenticacion y Seguridad
8. Webhooks
9. Soporte y Recursos

---

## Vision General

BeZhas es un ecosistema blockchain empresarial B2B con 13 SubApps especializadas.
Cada empresa puede integrar las que necesita usando 3 metodos diferentes:

| Metodo | Complejidad | Casos de Uso | Tiempo de Setup |
|--------|------------|--------------|-----------------|
| **API REST** | Media | Backend, automatizacion, procesamiento masivo | 2-4 horas |
| **SDK JavaScript** | Baja | Frontend, Node.js, serverless | 30 minutos |
| **Plugin WordPress** | Muy Baja | WooCommerce, tiendas online | 5 minutos |

Todos los metodos ofrecen acceso a:
- Pagos globales (tarjeta, banco, criptomoneda)
- Logistica y trazabilidad
- DeFi (staking, farming)
- Gestion de activos digitales
- Virtualizacion energetica

---

## Metodo 1: API REST

**Ideal para:** Backends, servidores, automatizaciones
**URL Base:** `https://api.bez.digital:3001`
**Autenticacion:** Header `x-api-key`

### Paso 1 — Obtener API Key

1. Ir a: `hub.bez.digital/developers`
2. Click "Generar API Key"
3. Copiar y guardar en variable de entorno

```bash
# Guardar en archivo .env (nunca en el codigo fuente)
BEZHAS_API_KEY=bez_key_xxxxxxxxxxxxxxxx
BEZHAS_API_URL=https://api.bez.digital:3001
BEZHAS_WEBHOOK_SECRET=wh_secret_yyyyyyyyyyy
```

IMPORTANTE: Nunca incluir la API Key en commits de git ni en logs.

### Paso 2 — Primera Llamada

```bash
# Verificar conexion
curl -H "x-api-key: $BEZHAS_API_KEY" \
  https://api.bez.digital:3001/health

# Respuesta esperada:
# { "status": "ok", "timestamp": "...", "uptime": 12345 }
```

### Paso 3 — Usar Endpoints de SubApps

```bash
# Crear un pago
curl -X POST \
  -H "x-api-key: $BEZHAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amountUSD":100,"paymentMethod":"card","email":"cliente@ejemplo.com"}' \
  https://api.bez.digital:3001/api/gateway/v1/pay

# Crear transaccion logistica
curl -X POST \
  -H "x-api-key: $BEZHAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"posRef":"ORD-1001","origin":"Algeciras","destination":"Tanger"}' \
  https://api.bez.digital:3001/api/cargolink/transactions
```

### Paso 4 — Configurar Webhooks

Recibe eventos de BeZhas (pago completado, cargo entregado, etc.) verificando
siempre la firma HMAC-SHA256:

```javascript
const crypto = require('crypto');

app.post('/webhooks/bezhas', express.raw({type: 'application/json'}), (req, res) => {
  const firma = req.headers['x-bezhas-signature'];
  const hash = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(req.body).digest('hex');

  if (hash !== firma) return res.status(401).json({ error: 'Firma invalida' });

  const datos = JSON.parse(req.body);
  // Procesar evento: datos.event, datos.data
  res.json({ ack: true });
});
```

### Paso 5 — Produccion

- Limite de peticiones: 1000 por minuto
- Monitorizar en: `hub.bez.digital/admin/logs`
- Soporte: support@bez.digital

### Tabla de Endpoints Principales

| SubApp | Metodo | Endpoint | Descripcion |
|--------|--------|----------|-------------|
| Pay | POST | /api/gateway/v1/pay | Crear pago |
| Pay | GET | /api/gateway/v1/price | Precio actual |
| Pay | GET | /api/gateway/v1/history | Historial |
| CargoLink | POST | /api/cargolink/transactions | Crear transaccion |
| CargoLink | PATCH | /api/cargolink/transactions/:id | Actualizar estado |
| Capital | GET | /api/capital/defi/price | Precio token |
| Capital | POST | /api/capital/defi/stake | Hacer staking |
| Energy | POST | /api/energy/trade | Ejecutar trade |
| Identity | GET | /api/identity/profile | Perfil de usuario |

---

## Metodo 2: SDK JavaScript

**Paquete:** `@bezhas/connect`
**Dependencias:** Ninguna (zero-deps)
**Funciona en:** Node.js 18+ y navegadores modernos

### Paso 1 — Instalar

```bash
pnpm add @bezhas/connect
# o: npm install @bezhas/connect
```

### Paso 2 — Inicializar

```javascript
import { BeZhasConnect } from '@bezhas/connect';

const bezhas = new BeZhasConnect({
  apiKey: process.env.BEZHAS_API_KEY
});
```

### Paso 3 — Pagos

```javascript
// Pago con tarjeta
const pedido = await bezhas.pay.buy({
  amountUSD: 100,
  paymentMethod: 'card',
  email: 'cliente@ejemplo.com'
});
// Redirigir al checkout
window.location.href = pedido.checkoutUrl;

// Pago con banco (SEPA)
const banco = await bezhas.pay.buy({
  amountUSD: 5000,
  paymentMethod: 'bank'
});
// Devuelve: { iban, bic, reference, amount }
```

### Paso 4 — Logistica

```javascript
// Crear transaccion con rol POS
const pos = bezhas.cargolink.withRoleKey(process.env.POS_KEY);

await pos.createTx({
  posRef: 'ORD-12345',
  origin: 'Algeciras',
  destination: 'Tanger'
});
// Devuelve: { txId: 'B-abc123', status: 'created' }

// Avanzar estado
await pos.advanceTx('B-abc123', { note: 'Aduanas completado' });
```

### Paso 5 — Verificar Webhooks

```javascript
import { webhooks } from '@bezhas/connect';

app.post('/webhooks/bezhas', express.raw({type: 'application/json'}), (req, res) => {
  const datos = webhooks.verifyAndParse(
    req.body,
    req.headers['x-bezhas-signature'],
    process.env.BEZHAS_WEBHOOK_SECRET
  );
  // datos.event: 'payment.completed', 'cargo.delivered', etc.
  res.json({ received: true });
});
```

---

## Metodo 3: Plugin WordPress

**Requisitos:** WordPress 6.0+ | WooCommerce (opcional) | PHP 7.4+

### Paso 1 — Descargar e Instalar

1. Ir a: `hub.bez.digital/downloads`
2. Descargar `bezhas-hub-v2.0.0.zip`
3. WordPress Admin -> Plugins -> Anadir Nuevo -> Subir Plugin
4. Seleccionar el archivo .zip -> Instalar Ahora
5. Click Activar

### Paso 2 — Configurar API Key

1. WordPress -> Ajustes -> Configuracion BeZhas
2. Pegar la API Key (obtenida en `hub.bez.digital/developers`)
3. Pegar el Webhook Secret (opcional pero recomendado)
4. Click Guardar Cambios

### Paso 3 — Activar Metodos de Pago

1. WooCommerce -> Ajustes -> Pagos
2. Activar "BeZhas Pay" como pasarela
3. Metodos disponibles: Tarjeta, Banco (SEPA), BEZ Token
4. Guardar

### Paso 4 — Probar

1. Crear un pedido de prueba en tu tienda
2. Seleccionar "BeZhas Pay" en el checkout
3. Verificar que aparece en hub.bez.digital
4. El widget del dashboard muestra las estadisticas

---

## SubApps Disponibles

### CargoLink — Trazabilidad Logistica
- Tracking de envios en tiempo real
- Integracion de aduanas (CUSDEC)
- Sensores IoT (temperatura, ubicacion)
- Firma digital de entregas
- Acceso: API /api/cargolink o SDK bezhas.cargolink

### BeZhas Pay — Pagos Globales
- Tarjeta (Visa, Mastercard via Stripe)
- Banco (SEPA europa, SWIFT internacional)
- Criptomoneda (BEZ token nativo)
- On-ramps fiat (MoonPay, Transak)
- Acceso: API /api/gateway/v1 o SDK bezhas.pay

### BZ Capital — DeFi y Staking
- Staking de BEZ con recompensas
- Farming de liquidez
- Gobernanza DAO (votar propuestas)
- Tesoreria
- Acceso: capital.bez.digital/defi

### BEZ Wallet — Gestion de Activos
- Multi-chain (Polygon, BNB Chain)
- Bridge LayerZero
- Validadores
- Acceso: wallet.bez.digital (conectar MetaMask)

### BZ Energy — Virtual Power Plant
- Trading de energia en tiempo real
- Mercado OMIE (iberico)
- Sensores MQTT IoT
- Arbitraje con IA
- Acceso: API /api/energy

### BZ Genesis — Identidad Bio Digital
- BeZhas_ID unico por usuario
- Agentes IA autonomos
- Reputacion on-chain
- SSO integrado
- Acceso: genesis.bez.digital

### Otras SubApps
- BZ Prestige: Club B2B y networking
- BZ Sphere: Red social del ecosistema
- PureScan: Compliance y auditoria
- Vision Scan: IA visual y trazabilidad
- Gas Tank: Gestion de gas fees
- Edge Node: Nodos DePIN
- RWA: Tokenizacion inmobiliaria

---

## Autenticacion y Seguridad

### 3 Formas de Autenticarse

**1. SIWE (Sign In With Ethereum)**
Para usuarios con wallet (MetaMask, WalletConnect).
No requiere contrasena. Firma criptografica.

**2. Email + 2FA**
Login tradicional con doble factor de autenticacion.
Codigo SMS o app de autenticacion.

**3. API Key**
Para integraciones servidor-a-servidor.
Header: x-api-key en cada peticion.

### Tokens JWT

Estructura del token:
```
{
  "userId": "u_abc123",
  "orgId": "org_xyz",
  "role": "admin",
  "scope": ["read", "write"],
  "exp": 1719763200
}
```

- Validez: 24 horas (configurable)
- Renovacion: con refresh token (30 dias)

### Buenas Practicas

Para usuarios:
- Activar 2FA en todas las cuentas
- Guardar recovery codes en gestor de contrasenas
- No compartir API keys
- Cambiar contrasena cada 90 dias

Para desarrolladores:
- Nunca incluir .env o secrets en commits
- API keys siempre en variables de entorno
- Rotar keys cada 90 dias
- Usar keys diferentes para desarrollo y produccion
- Monitorizar acceso en /admin/logs

---

## Webhooks

### Eventos Disponibles

| Evento | Descripcion |
|--------|-------------|
| payment.completed | Pago exitoso |
| payment.failed | Pago rechazado |
| payment.refunded | Pago reembolsado |
| cargo.created | Transaccion logistica creada |
| cargo.updated | Estado de cargo actualizado |
| cargo.customs_cleared | Aduanas completado |
| cargo.delivered | Cargo entregado |
| energy.trade.completed | Trade de energia completado |

### Reintentos Automaticos

BeZhas reintenta automaticamente si tu servidor no responde:
- 1er intento: inmediato
- 2do: +5 minutos
- 3ro: +30 minutos
- 4to: +2 horas
- Maximo: 5 intentos en 24 horas

---

## Preguntas Frecuentes

**P: Puedo usar varios metodos a la vez?**
R: Si. Ejemplo: Plugin WordPress para pagos + API para logistica.

**P: Que pasa si pierdo mi API Key?**
R: Genera una nueva en /developers. La anterior se anula automaticamente.

**P: Cual es el costo?**
R: API: pago por llamada. SDK: incluido. Plugin: gratuito.

**P: Que blockchains soporta?**
R: Polygon, BNB Chain, Amoy (testnet).

**P: Puedo testear antes de produccion?**
R: Si. Usa credenciales de sandbox desde el Developer Console.

**P: Como contacto soporte?**
R: Email: support@bez.digital (respuesta <2 horas).
   Chat en vivo: hub.bez.digital/chat (horario 9-18h CET).

---

## Soporte

| Canal | Contacto | Tiempo de Respuesta |
|-------|----------|---------------------|
| Email | support@bez.digital | < 2 horas |
| Chat | hub.bez.digital/chat | < 30 minutos |
| Documentacion | hub.bez.digital/docs | 24/7 |

---

**Ultima actualizacion: Junio 2026**
**Soporte: support@bez.digital**
