# Checklist de Migracion - BeZhas-Hub (Control Plane)

## Objetivo
Convertir `Bezhas-Hub` en el panel central del ecosistema (Control Plane), eliminando duplicidades con subapps especializadas y unificando integraciones blockchain/API.

## Fase 0 - Baseline y alcance
- [ ] Confirmar entorno objetivo por fase: `dev`, `staging`, `prod`.
- [ ] Congelar nuevas features en `Bezhas-Hub` durante la migracion.
- [ ] Definir rama de trabajo y ventana de despliegue.
- [ ] Establecer criterio de exito: sin regresiones en auth, billing, developer console y estado global.

## Fase 1 - Inventario y clasificacion
- [ ] Inventariar rutas backend en `Bezhas-Hub/backend/routes`.
- [ ] Clasificar cada ruta: `core-hub`, `duplicada`, `legacy`, `mock/fallback`.
- [ ] Inventariar pantallas en `Bezhas-Hub/frontend/src/pages` y `Bezhas-Hub/frontend-next/src/app`.
- [ ] Identificar toda dependencia blockchain directa (`ethers`, ABIs, direcciones hardcoded).
- [ ] Confirmar rutas y componentes que ya existen en apps dedicadas:
  - `bez-wallet`
  - `gas-tank-manager`
  - `edge-node-manager`
  - `bez-vision-scan`
  - `BZ Capital`

## Fase 2 - Conexiones blockchain sanas
- [ ] Unificar source of truth de contratos (sin mezcla de hardcoded + env + defaults no controlados).
- [ ] Corregir incompatibilidades `ethers v6` (eliminar patrones `ethers.utils.*`).
- [ ] Alinear `chainId`, RPC y direcciones con configuracion oficial del proyecto.
- [ ] Eliminar endpoints criticos con respuesta mock en rutas de produccion.
- [ ] Verificar que pagos, staking, governance y bridge usen la misma capa de acceso (SDK/Gateway).

## Fase 3 - Eliminar redundancia funcional
- [ ] Quitar de Hub la operativa wallet/bridge/validators/governance que duplica `bez-wallet`.
- [ ] Quitar de Hub la operativa de gas que duplica `gas-tank-manager`.
- [ ] Quitar de Hub la operativa edge nodes que duplica `edge-node-manager`.
- [ ] Quitar de Hub la operativa vision/scan que duplica `bez-vision-scan`.
- [ ] Quitar de Hub la operativa DeFi vertical que duplica `BZ Capital`.
- [ ] Mantener en Hub solo enlaces, estado agregado y contexto cross-app.

## Fase 4 - Rol objetivo de BeZhas-Hub (Control Plane)
- [ ] Auth/SSO central (SIWE/JWT/roles) para todo el ecosistema.
- [ ] App Switcher global con navegacion y contexto compartido.
- [ ] Billing/suscripcion/permisos centralizados.
- [ ] Developer Console (API keys, SDK onboarding, webhooks, usage).
- [ ] Observabilidad ecosistema (health, logs, alertas, metricas).
- [ ] Notificaciones unificadas cross-app.

## Fase 5 - Alineacion monorepo y contratos de integracion
- [ ] Priorizar `@bezhas/api-gateway` para acceso backend transversal.
- [ ] Priorizar `@bezhas/platform-sdk` en frontends de subapps.
- [ ] Reducir logica blockchain directa en Hub donde ya exista modulo compartido.
- [ ] Definir contrato de integracion entre Hub y subapps:
  - eventos
  - permisos
  - estado de salud
  - deep links

## Fase 6 - Seguridad y hardening
- [ ] Revisar rutas admin y proteger todas las sensibles.
- [ ] Eliminar bypass temporales de auth/rate-limit.
- [ ] Verificar que no existan secretos hardcodeados.
- [ ] Validar CORS por entorno.
- [ ] Asegurar trazabilidad de acciones sensibles (audit log).

## Fase 7 - QA y despliegue
- [ ] Smoke tests de flujos core:
  - login SIWE/JWT
  - developer console
  - billing/suscripcion
  - health global de apps
- [ ] Pruebas de no regresion en subapps enlazadas desde Hub.
- [ ] Release por fases con rollback definido.
- [ ] Monitoreo post-release 24/48h.

## Definicion operativa Keep / Migrate / Delete

### Keep en Hub
- Auth global
- Developer Console
- Billing/Suscripcion
- Configuracion global
- Observabilidad + notificaciones
- App switcher + estado agregado

### Migrate fuera de Hub
- Wallet/Bridge/Validators/Governance operativa -> `bez-wallet`
- Gas operativo -> `gas-tank-manager`
- Edge Nodes operativo -> `edge-node-manager`
- Vision/scan operativo -> `bez-vision-scan`
- DeFi vertical -> `BZ Capital`

### Delete/Deprecate
- Endpoints legacy duplicados
- Endpoints mock/fallback no requeridos
- Conexiones blockchain paralelas fuera de SDK/Gateway

