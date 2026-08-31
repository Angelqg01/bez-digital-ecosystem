# BZ CargoLink

**Validator Terminal** para la gestión de operaciones portuarias, aduaneras y de transporte de última milla sobre la red BeZhas.

## Funcionalidades
- **Active Route**: Navegación en tiempo real para transporte (Última Milla).
- **Cargo Fingerprint**: Registro hash fotogramétrico de la carga en BeZhas L2.
- **Smart Stowage**: Cálculo de Centro de Gravedad (COG) para optimización de contenedores.
- **Customs Sync**: Despacho aduanal mediante estándar UBL 2.1 (ASYCUDA/WCO-SIMPLE).
- **Wallet**: Gestión de fondos para operaciones.
- **Developer Integration (API Hub)**: SDK, API Keys y Webhooks para integración empresarial.

## Puerto
`http://localhost:3016`

## Ejecución Local
```bash
pnpm install
pnpm dev
```

## Módulos de API (sector: `cargo`)
- `POST /v1/customs/dispatch` — Despacho aduanal
- `POST /v1/shipping/stowage` — Validación de COG en buque
- `GET  /v1/logistics/route`  — Tracking de última milla
- `POST /v1/audit/fingerprint` — Hash de carga en L2

## Integración activada
- `src/services/bezhasPlatform.js` actúa como gateway API/SDK/blockchain/billing local.
- Las llamadas API consumen primero la cuota Freemium diaria y después crédito BEZ-Coin.
- Cada operación genera un bloque simulado de BeZhas L2 con `txHash`, `payloadHash`, evento y número de bloque.
- El SDK local está en `src/sdk/cargolink-sdk.js` y expone `auditFingerprint`, `validateStowage`, `dispatchCustoms` y `getActiveRoute`.
- El Developer Hub permite rotar API key, registrar webhook, probar SDK y ver plan, cuota y saldo.
- La barra de ecosistema activa compra BEZ-Coin, planes Starter/Business, recarga de Gas Tank, staking y validación de contratos.

---
*Este módulo es parte de la suite "App's secundarias" de BeZhas.*
