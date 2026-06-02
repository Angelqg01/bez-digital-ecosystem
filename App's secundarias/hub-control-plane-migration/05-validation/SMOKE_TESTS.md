# Smoke tests de conexiones optimas

## A. Gateway
- [ ] `GET /api/health`
- [ ] `GET /api/auth/nonce` (o equivalente)
- [ ] `GET /api/wallet/balance/:address`
- [ ] `GET /api/gas/balance`
- [ ] `GET /api/nodes/network`
- [ ] `POST /api/vision/analyze` (si aplica en local)

## B. Hub Control Plane
- [ ] Login SIWE/JWT operativo.
- [ ] App switcher redirige a cada subapp correcta.
- [ ] Dashboard de estado global muestra salud de subapps.
- [ ] Billing y suscripciones resolviendo entitlement.
- [ ] Developer Console carga API keys/webhooks.

## C. Subapps
- [ ] `bez-wallet` operativa de wallet/bridge/governance.
- [ ] `gas-tank-manager` operativa de gas.
- [ ] `edge-node-manager` operativa de nodos.
- [ ] `bez-vision-scan` operativa de escaneo.
- [ ] `BZ Capital` operativa DeFi.

## D. Criterios de salida
- [ ] Ninguna funcionalidad vertical critica sigue duplicada en Hub.
- [ ] Sin errores de conexion por URL base, chainId o RPC inconsistentes.
- [ ] Sin dependencia critica de mocks/fallbacks.

