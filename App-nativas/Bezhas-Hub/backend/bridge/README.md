# BeZhas Universal Bridge

Sistema de integración universal para conectar BeZhas con plataformas externas mediante un patrón de adaptadores (Adapters).

## Estructura de Carpetas

```
backend/bridge/
├── index.js                    # Entry point - Exporta todo el sistema
├── README.md                   # Esta documentación
│
├── core/
│   └── bridgeCore.js           # Controlador central del bridge
│
├── adapters/
│   ├── index.js                # Registro y factory de adaptadores
│   ├── BaseAdapter.js          # Clase abstracta base
│   ├── VintedAdapter.js        # Adaptador para Vinted (marketplace)
│   ├── MaerskAdapter.js        # Adaptador para Maersk (logística)
│   └── AirbnbAdapter.js        # Adaptador para Airbnb (RWA rentals)
│
├── webhooks/
│   └── webhooks.routes.js      # Receptor centralizado de webhooks
│
├── routes/
│   └── bridge.api.routes.js    # API REST para gestionar el bridge
│
└── jobs/
    └── syncJobs.js             # Trabajos de sincronización programados
```

## Uso Básico

```javascript
const bridge = require('./bridge');

// Inicializar el bridge
await bridge.initialize();

// Registrar un adaptador manualmente (opcional, ya se auto-registran)
await bridge.registerAdapter('vinted', {
    accessToken: 'tu_token',
    webhookSecret: 'tu_secret'
});

// Sincronizar inventario de una plataforma
const result = await bridge.syncInventory('vinted');

// Sincronizar todas las plataformas
const results = await bridge.syncAll();

// Obtener estadísticas
const stats = bridge.getStats();

// Health check
const health = await bridge.healthCheck();
```

## Endpoints API

### Bridge Management (Admin)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v2/bridge/status` | Estado del bridge |
| GET | `/api/v2/bridge/adapters` | Lista de adaptadores |
| GET | `/api/v2/bridge/adapters/:id` | Detalle de un adaptador |
| POST | `/api/v2/bridge/adapters/:id/register` | Registrar adaptador |
| DELETE | `/api/v2/bridge/adapters/:id` | Desregistrar adaptador |
| POST | `/api/v2/bridge/sync/:id` | Sincronizar plataforma |
| POST | `/api/v2/bridge/sync-all` | Sincronizar todas |
| POST | `/api/v2/bridge/track/:trackingNumber` | Rastrear envío |
| GET | `/api/v2/bridge/health` | Health check |

### Webhooks (Externos)

| Endpoint | Origen |
|----------|--------|
| `POST /api/webhooks/vinted` | Vinted |
| `POST /api/webhooks/maersk` | Maersk |
| `POST /api/webhooks/airbnb` | Airbnb |
| `POST /api/webhooks/:platform` | Genérico |

## Adaptadores Disponibles

### VintedAdapter
- **Funcionalidad**: Sincronización de inventario, órdenes, webhooks
- **Mock Mode**: Activo si no hay credenciales

### MaerskAdapter
- **Funcionalidad**: Tracking de envíos, reservas, webhooks
- **Mock Mode**: Activo si no hay credenciales

### AirbnbAdapter
- **Funcionalidad**: Sincronización de propiedades, reservas, dividendos RWA
- **Mock Mode**: Activo si no hay credenciales

## Crear un Nuevo Adaptador

1. Crear archivo `backend/bridge/adapters/NuevoAdapter.js`
2. Extender `BaseAdapter`
3. Implementar métodos requeridos:
   - `connect()`
   - `syncInventory(options)`
   - `handleWebhook(eventType, payload)`
   - `transformToBeZhasFormat(item)`
   - `transformToExternalFormat(item)`

4. Registrar en `adapters/index.js`:
```javascript
const NuevoAdapter = require('./NuevoAdapter');
const ADAPTER_REGISTRY = {
    // ...
    nuevo: NuevoAdapter,
};
```

## Variables de Entorno

```env
# Vinted
VINTED_ACCESS_TOKEN=
VINTED_USER_ID=
VINTED_WEBHOOK_SECRET=

# Maersk
MAERSK_CONSUMER_KEY=
MAERSK_CONSUMER_SECRET=

# Airbnb
AIRBNB_CLIENT_ID=
AIRBNB_CLIENT_SECRET=
```

## Eventos del Bridge

El bridge emite eventos que puedes escuchar:

```javascript
const { bridgeCore, BRIDGE_EVENTS } = require('./bridge');

bridgeCore.on(BRIDGE_EVENTS.INVENTORY_SYNCED, (data) => {
    console.log('Inventario sincronizado:', data);
});

bridgeCore.on(BRIDGE_EVENTS.ORDER_CREATED, (data) => {
    console.log('Orden creada:', data);
});

bridgeCore.on(BRIDGE_EVENTS.SHIPMENT_UPDATED, (data) => {
    console.log('Envío actualizado:', data);
});
```

Eventos disponibles:
- `inventory:synced`
- `inventory:sync_failed`
- `order:created`
- `order:updated`
- `shipment:updated`
- `payment:received`
- `webhook:received`
- `adapter:connected`
- `adapter:disconnected`
- `error`

## Sincronización Programada

Los jobs se ejecutan automáticamente:

| Job | Frecuencia | Descripción |
|-----|------------|-------------|
| `inventory-sync` | Cada 15 minutos | Sincroniza inventario |
| `health-check` | Cada 5 minutos | Verifica salud de adaptadores |
| `daily-stats` | Diario a 00:00 | Agrega estadísticas |
