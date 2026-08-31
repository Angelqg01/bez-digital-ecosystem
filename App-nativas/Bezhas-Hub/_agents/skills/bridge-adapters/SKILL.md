---
name: Bridge Adapters
description: How to create and manage Universal Bridge adapters for third-party platform connections
---

# Bridge Adapters SKILL

## Arquitectura del Universal Bridge
```
backend/bridge/
├── index.js                    ← Core: UniversalBridge class (event-driven)
├── routes/
│   └── bridge.api.routes.js    ← API endpoints para bridge operations
├── webhooks/
│   └── webhooks.routes.js      ← Recibir webhooks de plataformas terceras
└── adapters/
    ├── VintedAdapter.js         ← Marketplace moda (funcional)
    ├── AirbnbAdapter.js         ← Alquileres (funcional)
    └── MaerskAdapter.js         ← Logística shipping (funcional)
```

## Patrón de un Adapter
Cada adapter debe implementar estas funciones:
```javascript
class PlatformAdapter {
  async connect()                        // OAuth connect
  async syncInventory(options)           // Pull data from platform
  async pushInventory(items)             // Push data to platform
  async handleWebhook(eventType, payload) // Process incoming webhooks
}
```

## Adapters Existentes (3 funcionales)
1. **VintedAdapter** — `backend/bridge/adapters/VintedAdapter.js`
2. **AirbnbAdapter** — `backend/bridge/adapters/AirbnbAdapter.js`
3. **MaerskAdapter** — `backend/bridge/adapters/MaerskAdapter.js`

## Adapters Pendientes de Crear (9)
- Amazon, eBay, Wallapop, Shopify, WooCommerce
- Stripe Connect, MercadoLibre, AliExpress, Etsy

## Cómo Crear un Nuevo Adapter
1. Copiar plantilla de `VintedAdapter.js`
2. Cambiar nombre y lógica de API de la plataforma
3. Registrar en `index.js` → `registerAdapter()`
4. Añadir rutas de webhook en `webhooks.routes.js`
5. Añadir test en `tests/bridge.adapters.test.js`

## Tests
```bash
npx jest tests/bridge.core.test.js --verbose
npx jest tests/bridge.adapters.test.js --verbose
```

## Credenciales
Ver archivo: `BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt` (raíz del proyecto)
