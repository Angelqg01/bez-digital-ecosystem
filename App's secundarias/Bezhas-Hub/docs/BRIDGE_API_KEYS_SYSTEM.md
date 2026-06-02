# 🌉 Bridge API - Sistema de API Keys

## ✅ Completado

El sistema de gestión de API Keys para el Bridge Universal ha sido implementado completamente.

## 📦 Componentes Creados

### Backend

#### 1. Modelos MongoDB (4 modelos)
- **`BridgeApiKey.model.js`** - Sistema de autenticación de API Keys
- **`BridgeSyncedItem.model.js`** - Inventario sincronizado
- **`BridgeShipment.model.js`** - Tracking de envíos
- **`BridgeOrder.model.js`** - Gestión de órdenes

#### 2. Rutas Admin
- **`bridgeAdmin.routes.js`** - CRUD de API Keys

Endpoints disponibles:
```
GET    /api/v1/bridge/admin/keys              - Listar todas las API keys
POST   /api/v1/bridge/admin/keys              - Crear nueva API key
PATCH  /api/v1/bridge/admin/keys/:id          - Actualizar API key
DELETE /api/v1/bridge/admin/keys/:id          - Eliminar API key
GET    /api/v1/bridge/admin/keys/:id/stats    - Ver estadísticas de una key
POST   /api/v1/bridge/admin/keys/:id/regenerate - Regenerar una API key
```

#### 3. Bridge Routes Actualizadas
- **`bridge.routes.js`** - Endpoints del Bridge con persistencia MongoDB

Endpoints disponibles:
```
POST /api/v1/bridge/inventory/sync     - Sincronizar inventario
POST /api/v1/bridge/logistics/update   - Actualizar tracking de envío
POST /api/v1/bridge/orders/create      - Crear orden desde plataforma externa
```

### Frontend

#### 1. Componente de Gestión
- **`BridgeApiKeysManager.jsx`** - Interfaz completa para gestionar API Keys

Funcionalidades:
- ✅ Crear nuevas API Keys
- ✅ Listar todas las keys
- ✅ Editar permisos y configuración
- ✅ Ver estadísticas de uso
- ✅ Regenerar keys
- ✅ Eliminar keys
- ✅ Copiar keys al portapapeles

#### 2. Integración en Admin Panel
- Nuevo tab "Bridge API" en el Admin Dashboard
- Acceso directo desde la navegación principal

## 🚀 Cómo Usar

### Paso 1: Crear una API Key

#### Opción A: Usando el Admin Panel (Recomendado)

1. Accede al Admin Panel: http://localhost:5173/admin
2. Ve al tab "Bridge API"
3. Click en "Create API Key"
4. Llena el formulario:
   - **User ID**: ID del usuario propietario
   - **Name**: Nombre descriptivo de la key
   - **Platform**: Plataforma (vinted, amazon, ebay, etc.)
   - **Permissions**: Marca los permisos necesarios
   - **Rate Limits**: Configura límites (default: 100/min, 10k/día)
5. Click en "Create"
6. **¡IMPORTANTE!** Copia la API key que se muestra (solo se mostrará una vez)

#### Opción B: Usando cURL

```bash
curl -X POST http://localhost:3001/api/v1/bridge/admin/keys \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_AQUI",
    "name": "My Test API Key",
    "description": "API key de prueba",
    "platform": "other",
    "permissions": {
      "inventory": true,
      "logistics": true,
      "payments": true,
      "orders": true
    },
    "rateLimit": {
      "requestsPerMinute": 100,
      "requestsPerDay": 10000
    }
  }'
```

### Paso 2: Usar la API Key

#### Headers Requeridos

Todos los endpoints del Bridge requieren estos headers:

```
X-Bridge-API-Key: bez_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
X-External-Platform: vinted|amazon|ebay|maersk|fedex|dhl|stripe|paypal|other
Content-Type: application/json
```

#### Ejemplo: Sincronizar Inventario

```bash
curl -X POST http://localhost:3001/api/v1/bridge/inventory/sync \
  -H "X-Bridge-API-Key: bez_YOUR_API_KEY_HERE" \
  -H "X-External-Platform: vinted" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "externalId": "vinted_12345",
        "title": "Camiseta Nike Original",
        "description": "Talla M, color azul",
        "price": 29.99,
        "currency": "EUR",
        "images": ["https://example.com/image.jpg"],
        "category": "clothing",
        "condition": "new",
        "stock": 5,
        "available": true,
        "metadata": {
          "brand": "Nike",
          "size": "M"
        }
      }
    ]
  }'
```

#### Ejemplo: Actualizar Tracking

```bash
curl -X POST http://localhost:3001/api/v1/bridge/logistics/update \
  -H "X-Bridge-API-Key: bez_YOUR_API_KEY_HERE" \
  -H "X-External-Platform: dhl" \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumber": "DHL123456789",
    "status": "in_transit",
    "provider": "dhl",
    "location": {
      "city": "Madrid",
      "country": "España",
      "coordinates": {
        "lat": 40.4168,
        "long": -3.7038
      }
    },
    "description": "En tránsito hacia centro de distribución",
    "estimatedDelivery": "2024-01-20T18:00:00Z"
  }'
```

#### Ejemplo: Crear Orden

```bash
curl -X POST http://localhost:3001/api/v1/bridge/orders/create \
  -H "X-Bridge-API-Key: bez_YOUR_API_KEY_HERE" \
  -H "X-External-Platform: vinted" \
  -H "Content-Type: application/json" \
  -d '{
    "externalOrderId": "VINTED_ORD_12345",
    "buyer": {
      "externalId": "buyer_123",
      "email": "buyer@example.com",
      "username": "compradortest"
    },
    "seller": {
      "externalId": "seller_456",
      "email": "seller@example.com",
      "username": "vendedortest"
    },
    "items": [
      {
        "externalId": "vinted_12345",
        "title": "Camiseta Nike Original",
        "quantity": 1,
        "price": 29.99,
        "currency": "EUR"
      }
    ],
    "shippingAddress": {
      "street": "Calle Mayor 123",
      "city": "Madrid",
      "state": "Madrid",
      "postalCode": "28001",
      "country": "España"
    },
    "shippingCost": 5.99
  }'
```

### Paso 3: Testing Automático

Ejecuta el script de prueba con una API key válida:

```bash
cd backend
node scripts/test-bridge-endpoints.js bez_YOUR_API_KEY_HERE
```

Esto probará:
✅ Sincronización de inventario (2 items)
✅ Actualización de tracking
✅ Creación de orden completa

## 📊 Monitoreo

### Ver Estadísticas en el Admin Panel

1. Ve al tab "Bridge API"
2. Encuentra la API key en la tabla
3. Click en el icono de estadísticas (📊)
4. Verás:
   - Total de requests
   - Requests exitosos/fallidos
   - Success rate
   - Última vez usada
   - Estado de expiración

### Estadísticas por API Key

Cada API key rastrea automáticamente:
- **totalRequests**: Total de peticiones realizadas
- **successfulRequests**: Peticiones exitosas
- **failedRequests**: Peticiones fallidas
- **lastError**: Último error registrado
- **lastUsedAt**: Última vez que se usó

## 🔐 Seguridad

### Formato de API Key

Todas las API keys tienen el formato:
```
bez_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

- Prefijo obligatorio: `bez_`
- 64 caracteres hexadecimales (256 bits)
- Generadas con crypto.randomBytes()

### Validaciones

El middleware valida:
1. ✅ Presencia del header `X-Bridge-API-Key`
2. ✅ Formato correcto (prefijo + longitud)
3. ✅ Existencia en base de datos
4. ✅ Estado activo
5. ✅ No expirada

### Permisos

Cada API key puede tener permisos granulares:
- **inventory**: Sincronizar inventario
- **logistics**: Actualizar tracking
- **payments**: Procesar pagos (futuro)
- **orders**: Crear y gestionar órdenes

### Rate Limiting

Límites configurables por API key:
- **requestsPerMinute**: Default 100 req/min
- **requestsPerDay**: Default 10,000 req/día

### IP Whitelist (Opcional)

Puedes restringir una API key a IPs específicas:
```javascript
{
  "ipWhitelist": ["192.168.1.100", "10.0.0.50"]
}
```

## 📁 Estructura de Datos

### BridgeSyncedItem (Inventario)

```javascript
{
  beZhasId: "BEZ_vinted_item123",      // ID único en BeZhas
  externalId: "item123",                // ID en plataforma externa
  platform: "vinted",
  title: "Camiseta Nike",
  price: 29.99,
  currency: "EUR",
  syncStatus: "synced",                 // pending | synced | error | out_of_sync
  lastSyncAt: Date,
  apiKey: ObjectId,                     // Referencia a la API key usada
  available: true,
  stock: 10
}
```

### BridgeShipment (Tracking)

```javascript
{
  trackingNumber: "DHL123456789",
  provider: "dhl",
  status: "in_transit",                 // pending | picked_up | in_transit | delivered | etc.
  currentLocation: {
    city: "Madrid",
    country: "España",
    coordinates: { lat, long }
  },
  events: [                              // Historia completa
    {
      timestamp: Date,
      status: "picked_up",
      location: {...},
      description: "Paquete recogido"
    }
  ],
  estimatedDelivery: Date,
  apiKey: ObjectId
}
```

### BridgeOrder (Órdenes)

```javascript
{
  beZhasOrderId: "BEZ_ORD_vinted_1234567890",
  externalOrderId: "VINTED_ORD_12345",
  platform: "vinted",
  buyer: {
    externalId: "buyer_123",
    beZhasId: ObjectId,                 // Se mapea si existe en BeZhas
    email: "buyer@example.com"
  },
  seller: {
    externalId: "seller_456",
    beZhasId: ObjectId,
    email: "seller@example.com"
  },
  items: [
    {
      externalId: "item123",
      beZhasId: "BEZ_vinted_item123",
      quantity: 1,
      price: 29.99
    }
  ],
  status: "pending",                    // pending | confirmed | shipped | delivered | etc.
  paymentStatus: "pending",             // pending | paid | failed | refunded
  escrowStatus: "pending",              // pending | locked | released | refunded
  totalAmount: 29.99,
  shippingCost: 5.99,
  apiKey: ObjectId
}
```

## 🔄 Flujo de Integración

### 1. Plataforma Externa → BeZhas (Sincronización)

```
Plataforma Externa (Vinted)
         ↓
   Webhook/API Call
         ↓
Bridge API (inventory/sync)
         ↓
Validación + Auth
         ↓
MongoDB (BridgeSyncedItem)
         ↓
BeZhas ID generado
         ↓
Response con IDs
```

### 2. BeZhas → Plataforma Externa (Propagación)

```
BeZhas (cambio de precio)
         ↓
Bridge API detecta cambio
         ↓
Webhook a plataforma externa
         ↓
Actualización confirmada
         ↓
syncStatus: "synced"
```

## 🐛 Troubleshooting

### Error: "API key is required"
- Verifica que estás enviando el header `X-Bridge-API-Key`
- Formato correcto: `X-Bridge-API-Key: bez_XXXX...`

### Error: "Invalid API key format"
- La key debe empezar con `bez_`
- Debe tener 64 caracteres hexadecimales después del prefijo

### Error: "API key not found or invalid"
- La key no existe en la base de datos
- Crea una nueva key desde el Admin Panel

### Error: "API key is disabled or expired"
- La key está marcada como `active: false`
- La key tiene una fecha de expiración pasada
- Reactiva o regenera la key desde el Admin Panel

### Error 429: "Rate limit exceeded"
- Has superado el límite de requests por minuto/día
- Espera o solicita un aumento de límite

## 📝 Notas Importantes

1. **API Keys son sensibles**: Solo se muestran completas al crearlas. Guárdalas en un lugar seguro.

2. **Regeneración**: Regenerar una key invalida la anterior inmediatamente.

3. **Estadísticas**: Se actualizan en tiempo real con cada request.

4. **MongoDB Atlas**: Todas las colecciones están indexadas para máximo rendimiento.

5. **Upsert Pattern**: El inventario usa upsert para evitar duplicados.

6. **Tracking History**: Los envíos mantienen historia completa de eventos.

7. **Escrow Integration**: Las órdenes tienen campos para integración con Quality Oracle (pendiente).

## 🎯 Próximos Pasos

1. ✅ Sistema de API Keys - COMPLETADO
2. ⏳ Testing automático de endpoints
3. ⏳ Integración con Quality Oracle para escrow
4. ⏳ WebSocket notifications para shipment updates
5. ⏳ Rate limiting real-time con Redis
6. ⏳ Webhooks para sincronización bidireccional

## 🔗 Enlaces Útiles

- Admin Panel: http://localhost:5173/admin
- API Bridge: http://localhost:3001/api/v1/bridge
- Swagger Docs (futuro): http://localhost:3001/api-docs

## 📞 Soporte

Para más información consulta:
- `BRIDGE_API_IMPLEMENTATION.md`
- `AD_CENTER_UNIFICATION.md`
- Código fuente en `/backend/routes/bridge.routes.js`
