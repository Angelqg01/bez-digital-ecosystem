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
Fachadas del ciclo de vida B-UID de la API de BeZhas (`/api/cargolink`, o
`/api/cargolink` del gateway con `x-api-key` de rol). Con api-key de rol y
`bUid` (créalo antes con `POST /v1/tx`) aplican el ciclo de vida real. Sin
alguno de los dos responden 200 en **vista previa** (`mode: 'preview'`,
`persisted: false`): ejecutan el validador en seco, sin leer ni modificar
ningún envío. Una clave inválida o un rol sin permiso siguen dando 401/403.

- `POST /v1/customs/dispatch` — rol `customs`: valida el manifiesto y avanza a `CUSTOMS_CLEARED`. El canal es la preclasificación de riesgo de BeZhas, no el levante oficial (`customsAuthorization: null`).
- `POST /v1/shipping/stowage` — rol `carrier`: centro de gravedad calculado a partir de `items[{x,y,weight}]` y avance a `STOWED`.
- `GET  /v1/logistics/route?bUid=` — estado, ETA comprometida, puerto actual, retrasos y tránsito multipaís.
- `POST /v1/audit/fingerprint` — registra la huella de una evidencia (`payloadHash`); no la verifica.

El uso se mide (`billing.mode: METERED`) pero todavía no se cobra.

## Integración activada
- `src/services/bezhasPlatform.js` actúa como gateway API/SDK/blockchain/billing local.
- Las llamadas API consumen primero la cuota Freemium diaria y después crédito BEZ-Coin.
- Cada operación genera un bloque simulado de BeZhas L2 con `txHash`, `payloadHash`, evento y número de bloque.
- El SDK local está en `src/sdk/cargolink-sdk.js` y expone `auditFingerprint`, `validateStowage`, `dispatchCustoms` y `getActiveRoute`.
- El Developer Hub permite rotar API key, registrar webhook, probar SDK y ver plan, cuota y saldo.
- La barra de ecosistema activa compra BEZ-Coin, planes Starter/Business, recarga de Gas Tank, staking y validación de contratos.

---
*Este módulo es parte de la suite "App-nativas" de BeZhas.*
