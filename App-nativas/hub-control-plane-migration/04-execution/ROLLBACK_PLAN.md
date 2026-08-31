# Hub Control Plane Migration - Plan de Rollback

Este documento describe los procedimientos de emergencia en caso de que la migración a la arquitectura de Control Plane (desacoplando el Hub de las Subapps) genere fallos críticos en producción.

## Condiciones para activar el Rollback
1. **Fallo de Identidad**: El sistema de SSO falla, impidiendo el login en las subapps.
2. **Indisponibilidad del App Switcher**: El selector de aplicaciones no redirige correctamente o genera ciclos de redirección.
3. **Caída del API Gateway Proxy**: Los servicios consolidados de `billing`, `developer console` o `auth` en el Hub devuelven errores 5xx recurrentes.
4. **Desconexión Cross-App**: El estado de sesión o wallet no se transfiere correctamente a las subapps.

## Procedimiento de Rollback Inmediato (Sprint 1 y 2)

### 1. Restaurar Frontend de Hub (Revertir App.jsx y Sidebar)
Para revertir el enrutamiento que delegaba las vistas operativas (Wallet, Gas, DeFi, Governance) a subapps, debes restaurar el commit previo al inicio del Sprint 1:

```bash
cd "D:\BeZhas-Blockchain\App-nativas\Bezhas-Hub\frontend"
# Revertir los cambios en App.jsx, sidebarConfig.jsx y Header.jsx
git checkout HEAD -- src/App.jsx src/config/sidebarConfig.jsx src/components/layout/Header.jsx src/components/SidebarDrawer.jsx
```

### 2. Restaurar Backend de Hub (Reactivar Endpoints)
Para remover el middleware de deprecación (410 Gone) y reactivar el enrutamiento en el backend principal:

```bash
cd "D:\BeZhas-Blockchain\App-nativas\Bezhas-Hub\backend"
# Revertir los cambios en server.js
git checkout HEAD -- server.js
```

### 3. Re-Desplegar Monolito (Hard Restart)
Una vez que el código haya sido revertido a su estado monolítico:
```bash
# Frontend
cd "D:\BeZhas-Blockchain\App-nativas\Bezhas-Hub\frontend"
pnpm run build
pm2 restart bezhas-hub-frontend

# Backend
cd "D:\BeZhas-Blockchain\App-nativas\Bezhas-Hub\backend"
pm2 restart bezhas-hub-backend
```

## Validación Post-Rollback
Una vez completado el rollback, ejecutar el script de smoke test apuntando al monolito para asegurar que los endpoints operativos devuelven 200 OK y no 410 Gone:

```bash
node "D:\BeZhas-Blockchain\App-nativas\hub-control-plane-migration\04-execution\smoke-test.mjs"
# Los endpoints como /api/wallet y /api/staking deben fallar el test actual (que espera 410) indicando que han vuelto a su estado original (200 o similar).
```

## Contactos de Emergencia
- DevSecOps Lead: [Pendiente]
- Arquitecto Jefe: Yoel (vía alerta prioritaria).
