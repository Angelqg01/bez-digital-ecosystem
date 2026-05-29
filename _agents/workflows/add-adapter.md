---
description: How to add a new third-party platform adapter to the Universal Bridge
---

# Add New Bridge Adapter

## Pre-requisitos
- Conocer la API de la plataforma tercera
- Tener credenciales de desarrollador de la plataforma

## Pasos

1. Copiar el template del adapter existente:
```bash
cp "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend\bridge\adapters\VintedAdapter.js" "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend\bridge\adapters\NewPlatformAdapter.js"
```

2. Editar el nuevo adapter:
- Renombrar la clase a `NewPlatformAdapter`
- Implementar `connect()` con la auth de la plataforma (OAuth, API Key, etc.)
- Implementar `syncInventory()` para pull de datos
- Implementar `pushInventory()` para push de datos
- Implementar `handleWebhook()` para procesar webhooks entrantes

3. Registrar el adapter en `backend/bridge/index.js`:
```javascript
const NewPlatformAdapter = require('./adapters/NewPlatformAdapter');
bridge.registerAdapter('newplatform', new NewPlatformAdapter(config));
```

4. Añadir rutas de webhook en `backend/bridge/webhooks/webhooks.routes.js`:
```javascript
router.post('/newplatform', async (req, res) => {
  // Verificar firma del webhook
  // Procesar evento
});
```

5. Crear tests:
```bash
# Añadir tests al archivo existente o crear uno nuevo
# backend/tests/bridge.adapters.test.js
```

6. Correr tests:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
npx jest tests/bridge.adapters.test.js --verbose --no-cache
```

7. Añadir credenciales en `BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt`

8. Actualizar SKILL: `_agents/skills/bridge-adapters/SKILL.md`
