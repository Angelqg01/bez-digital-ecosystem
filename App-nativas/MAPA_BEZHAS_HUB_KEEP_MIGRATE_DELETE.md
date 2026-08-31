# Mapa tecnico - BeZhas-Hub vs subapps (Keep / Migrate / Delete)

## 1) Estado detectado en BeZhas-Hub

`Bezhas-Hub` actualmente combina:
- frontend React/Vite legacy (`frontend`)
- frontend Next (`frontend-next`)
- backend monolitico con muchas rutas (`backend/server.js` + `backend/routes/*`)
- integracion blockchain directa + SDK + capas legacy

Esto lo convierte en una superposicion funcional con varias subapps del ecosistema.

## 2) Solapamientos principales

### Wallet / Bridge / DAO / Validators / Gas
- Evidencia en Hub:
  - paginas como `WalletPage`, `BridgePage`, `DAOPage`, `StakingPage`, `FarmingPage`, `TokenomicsDashboard`
  - rutas backend wallet/governance/staking/blockchain
- App especializada:
  - `bez-wallet` (incluye bridge, governance, validators y gas en su navegacion)
- Decision:
  - `MIGRATE` operativa fuera de Hub
  - `KEEP` en Hub solo resumen + acceso rapido

### Gas Management
- Evidencia en Hub:
  - endpoints y vistas relacionadas a gas y blockchain general
- App especializada:
  - `gas-tank-manager`
- Decision:
  - `MIGRATE` operativa completa a app dedicada
  - `KEEP` en Hub un widget agregado de estado/costo

### Edge Nodes / DePIN
- Evidencia en Hub:
  - dashboard y hooks de edge node en frontend-next + rutas backend asociadas
- App especializada:
  - `edge-node-manager`
- Decision:
  - `MIGRATE` operativa de nodos/recompensas a app dedicada
  - `KEEP` en Hub scorecard y alertas

### Vision / Scanner
- Evidencia en Hub:
  - rutas/logica de AI y componentes varios
- App especializada:
  - `bez-vision-scan`
- Decision:
  - `MIGRATE` operativa scanner a app dedicada
  - `KEEP` en Hub estado global y accesos

### DeFi vertical
- Evidencia en Hub:
  - staking/farming/tokenomics/DAO en dos frontends
- App especializada:
  - `BZ Capital`
- Decision:
  - `MIGRATE` operativa DeFi vertical a `BZ Capital`
  - `KEEP` en Hub panel ejecutivo

## 3) Conectividad con blockchain: gaps criticos

- Mezcla de configuracion de contratos:
  - variables de entorno
  - direcciones hardcodeadas
  - defaults de desarrollo
- Uso mixto de patrones `ethers` con riesgo de incompatibilidad (`v5 style` en partes de backend).
- Presencia de mocks/fallbacks/temporales en rutas sensibles.
- Doble capa de frontend (legacy + next) con posibles fuentes de verdad distintas.

## 4) Target architecture para Hub

Hub debe ser Control Plane, no vertical app:
- identidad y acceso global
- app switcher
- developer console
- billing/suscripcion/permisos
- observabilidad del ecosistema
- notificaciones cross-app

Toda operativa de dominio va en su subapp dedicada.

## 5) Matriz de decision

- `KEEP`:
  - auth central
  - admin global
  - developer console
  - billing y planes
  - health monitor de ecosistema
  - notificaciones globales

- `MIGRATE`:
  - wallet/bridge/governance/validators/gas operativo -> `bez-wallet` / `gas-tank-manager`
  - edge nodes operativo -> `edge-node-manager`
  - vision operativo -> `bez-vision-scan`
  - defi operativo -> `BZ Capital`

- `DELETE/DEPRECATE`:
  - endpoints legacy duplicados
  - paginas duplicadas entre `frontend` y `frontend-next`
  - mocks/fallbacks no autorizados para produccion

## 6) Orden recomendado de ejecucion

1. Etiquetar endpoints/paginas con `KEEP|MIGRATE|DELETE`.
2. Desactivar nuevas features en areas `MIGRATE`.
3. Migrar UI por vertical a subapps y dejar deep links desde Hub.
4. Consolidar backend Hub para solo funciones Control Plane.
5. Eliminar codigo legacy duplicado en rondas pequenas.
6. Cerrar con smoke tests de ecosistema y rollout gradual.

