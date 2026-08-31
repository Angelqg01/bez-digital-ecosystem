# 🔐 BeZhas API Documentation System

## ✅ Implementación Completada

### Archivos Creados/Modificados:

1. **`backend/swagger.config.js`** - Configuración completa OpenAPI 3.0
2. **`backend/middleware/apiKeyAuth.js`** - Sistema de autenticación con API Keys
3. **`backend/routes/escrow.routes.js`** - Endpoints documentados con Swagger
4. **`backend/routes/developer-portal.routes.js`** - Portal para desarrolladores
5. **`backend/server.js`** - Swagger habilitado con seguridad

---

## 🚀 Cómo Probar

### 1. Acceder a la Documentación
```
http://localhost:3000/api-docs
```

### 2. Obtener API Keys de Demo
```bash
curl http://localhost:3000/developers/register
```

**API Keys disponibles:**
- **Free Tier**: `bzh_dev_1234567890abcdef` (100 req/hora)
- **Pro Tier**: `bzh_pro_abcdef1234567890` (1000 req/hora)

### 3. Probar Endpoints

#### Sin API Key (Error 401):
```bash
curl http://localhost:3000/api/escrow/1
```

#### Con API Key válida:
```bash
curl -H "X-API-Key: bzh_dev_1234567890abcdef" \
     http://localhost:3000/api/escrow/1
```

#### Crear Servicio:
```bash
curl -X POST http://localhost:3000/api/escrow/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: bzh_dev_1234567890abcdef" \
  -d '{
    "clientWallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "amount": "1000000000000000000",
    "initialQuality": 95
  }'
```

---

## 📋 Endpoints Públicos (Documentados)

### Quality Oracle
- `POST /api/escrow/create` - Crear servicio con colateral
- `GET /api/escrow/{id}` - Consultar servicio
- `POST /api/escrow/{id}/finalize` - Finalizar servicio

### BezCoin (Solo Lectura)
- `GET /api/bezcoin/balance/{address}` - Ver balance
- `GET /api/bezcoin/transactions/{address}` - Historial
- `GET /api/bezcoin/price` - Precio actual

### Developer Portal
- `GET /developers/register` - Info de registro
- `GET /developers/keys` - Listar keys demo
- `POST /developers/generate` - Generar nueva key

---

## 🔒 Endpoints SECRETOS (No Documentados)

Los siguientes paths están bloqueados en `/api-docs`:

- `/api/admin/*` - Panel administrativo
- `/api/internal/*` - Servicios internos
- `/api/aegis/*` - Motor IA propietario
- `/api/automation/*` - Automatización interna
- `/api/ai/train/*` - Entrenamiento de modelos
- `/api/ai/model/*` - Gestión de modelos

**Middleware de protección:** `hideInternalRoutes`

---

## 🎯 Características Implementadas

✅ **Autenticación por API Key**
✅ **Rate Limiting por Tier**
✅ **Documentación interactiva Swagger**
✅ **Schemas OpenAPI 3.0 completos**
✅ **Portal de desarrolladores**
✅ **Generación de API Keys (demo)**
✅ **Ocultación de rutas internas**
✅ **Ejemplos de uso en cada endpoint**
✅ **Soporte para autenticación opcional**

---

## 📊 Tiers de API Keys

| Tier | Rate Limit | Precio | Features |
|------|-----------|--------|----------|
| **Free** | 100 req/hora | $0/mes | Endpoints básicos, Docs |
| **Pro** | 1000 req/hora | $49/mes | Todos endpoints, Webhooks |
| **Enterprise** | Sin límite | Custom | SLA 99.9%, Soporte 24/7 |

---

## 🛠️ Developer Tools

- **Swagger UI**: `http://localhost:3000/api-docs`
- **Portal**: `http://localhost:3000/developers/register`
- **Playground**: `http://localhost:3000/developers/playground`
- **Generate Key**: `POST /developers/generate`

---

## 📝 Ejemplo de Integración

```javascript
// JavaScript/Node.js
const axios = require('axios');

const API_KEY = 'bzh_dev_1234567890abcdef';
const BASE_URL = 'http://localhost:3000/api';

async function createService() {
  const response = await axios.post(
    `${BASE_URL}/escrow/create`,
    {
      clientWallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: '1000000000000000000',
      initialQuality: 95
    },
    {
      headers: { 'X-API-Key': API_KEY }
    }
  );
  
  console.log('Service created:', response.data);
}

createService();
```

---

## ⚠️ Notas Importantes

1. Las API Keys actuales son **solo para desarrollo**
2. En producción, implementar:
   - Base de datos para keys
   - OAuth 2.0 / JWT
   - Rate limiting con Redis
   - Logging y monitoreo
3. Los endpoints devuelven datos **mock** por ahora
4. Implementar conexión real a blockchain

---

## 🔗 Links Útiles

- Documentación: http://localhost:3000/api-docs
- Portal Devs: http://localhost:3000/developers/register
- Whitepaper: http://localhost:5173/whitepaper
- Landing: http://localhost:5173

---

Sistema implementado y funcional! 🚀
