# Gas Tank Manager

Gas Tank Manager (Paymaster) es el módulo encargado de abstraer los costos de gas (BEZ-Coin) en transacciones corporativas.

## Características
- **Recargas Empresariales**: Permite realizar depósitos fiat/Stripe que se convierten automáticamente en gas.
- **Autenticación SSO**: Integrado transparentemente mediante `@bezhas/platform-sdk` y tokens delegados del Hub.
- **Monitoreo**: Historial de consumo y estadísticas para entidades y corporaciones.

## Ejecución Local
```bash
cd gas-tank-manager
pnpm install
pnpm dev
```
Puerto de desarrollo: **3011**
URL Local: `http://localhost:3011`

---
*Este módulo es parte de la suite "App's secundarias" de BeZhas.*
