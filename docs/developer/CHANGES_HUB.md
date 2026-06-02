# Cambios de Conexión: BeZhas-Web3 → BeZhas-Hub

Este documento resume los cambios realizados en la infraestructura de **BeZhas-Blockchain** para reflejar el cambio de nombre y ubicación de la plataforma social, ahora denominada **BeZhas-Hub**.

## 1. Cambio de Nombre y Ubicación
- **Nombre anterior:** `BeZhas-Web3` / `beZhas-web3`
- **Nuevo nombre:** `BeZhas-Hub` / `beZhas-hub`
- **Nueva ubicación física:** `D:\Bezhas-Hub`
- **Ubicación anterior:** `D:\...\BeZhas Web\bezhas-web3\`

## 2. Archivos Actualizados

### 📄 COMANDOS_PLATAFORMA_BEZHAS.txt
- Se actualizó la sección de arquitectura para reflejar el nuevo nombre y la ruta absoluta `D:\Bezhas-Hub\`.
- Se actualizó el comando SQL de registro de aplicaciones (`app_registry`) para usar `bezhas-hub` como identificador de aplicación.

### 📄 aegis/websocket.js
- Se actualizó el encabezado de documentación para referenciar la conexión con `BeZhas-Hub`.

### 📄 plans/PLAN_UNIFICACION_BLOCKCHAIN_WEB3.md
- Se renombró internamente todas las referencias de `BeZhas-Web3` a `BeZhas-Hub`.

### 📄 plans/PLAN_MIGRACION_BEZHAS_WEB3.md
- Se renombró internamente todas las referencias de `BeZhas Web3` y `BeZhas-Web3` a `BeZhas-Hub`.

### 📄 agent-runtime/SPRINT3_COMPLETED.md & SPRINT4_COMPLETED.md
- Se actualizaron las referencias de frontend a `bezhas-hub`.
- En el reporte del Sprint 4, se corrigió el comando de navegación a la nueva ruta `cd D:\Bezhas-Hub`.

## 3. Reconexión de API/ABI/Hooks
- Las conexiones de red (RPC), endpoints de API (`:3001`, `:8001`, `:3002`) y direcciones de contratos en Polygon (`137`) permanecen sin cambios técnicos, ya que el cambio es puramente de nombre y ruta de sistema de archivos.
- El identificador en el `app_registry` de la base de datos para el SSO ahora es `bezhas-hub`.

---
*Fecha del cambio: 2026-04-26*
*Responsable: Antigravity AI Agent*
