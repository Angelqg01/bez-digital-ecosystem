# BeZhas Testnet Readiness

## Estado actual

El workspace ya contiene contratos Foundry, API Gateway Web2.5, SDK npm, Edge Node,
Enterprise Node, MCP/AI Engine, Messaging MCP e infraestructura de monitorizacion.

Los bloqueadores principales antes de una testnet compartida son:

1. Toolchain no reproducible en la maquina actual.
   - `forge` no esta instalado en PATH.
   - `npm` global falla cargando `lru-cache` desde `C:\Program Files\nodejs\node_modules\npm`.
   - `pnpm install` no completo dentro del timeout actual y no dejo `jest` instalado localmente.
2. RPC enterprise endurecido, pero debe desplegarse detras de proxy/firewall si se expone fuera de localhost.
3. El escrow logistico actual registra telemetria, pero no retiene/libera fondos.
4. Fiat-to-BEZ registra ordenes pendientes, pero falta webhook Stripe verificado y liquidacion on-chain.
5. ERC-3643/RWA y DID/SSI estan representados parcialmente, no listos para compliance real.

## Cambios aplicados en este sprint

1. El indexador de la API ahora escucha `QualityEscrow.SensorDataRegistered`, que es el evento real emitido por `smart-contracts/src/core/QualityEscrow.sol`.
2. El canal Redis/SSE de escrow se normalizo a `event:escrow:sensor_data`.
3. El Enterprise Node ya no expone RPC HTTP/WS en todas las interfaces por defecto:
   - `RPC_HTTP_BIND=127.0.0.1`
   - `RPC_WS_BIND=127.0.0.1`
   - CORS/WS origins parametrizados.
4. `op-geth` enterprise expone metricas internas Prometheus en `6060`.
5. Prometheus corrige el scrape del Edge Node de `4200` a `4000`.
6. Tests MCP de `ai-engine` actualizados para enviar `x-internal-key`, alineados con la auth interna del servidor.
7. Se agrego `smart-contracts/src/core/DeliveryEscrow.sol` como escrow economico real para pagos de entrega en `$BEZ`.
8. Se agregaron tests Foundry para `DeliveryEscrow` y se conecto a `DeployPayment.s.sol` y `DeployAll.s.sol`.
9. Se agrego `POST /api/gateway/v1/payments/settle` como hook interno de liquidacion para ordenes fiat/banco/crypto.

## Ruta recomendada para testnet local

1. Reparar toolchain:
   - Reinstalar Node.js/npm o usar una instalacion gestionada por `fnm`, `nvm-windows` o Volta.
   - Instalar Foundry y confirmar `forge --version`.
   - Ejecutar `pnpm install --frozen-lockfile` en `api`, `ai-engine`, `sdk`, `agent-runtime` y frontends principales.
2. Contratos:
   - `cd smart-contracts`
   - `forge build`
   - `forge test`
   - Desplegar a Anvil o BeZhas testnet y ejecutar `script/parse-deployment.js`.
3. Base de datos/API:
   - `cd api`
   - `pnpm run db:migrate`
   - `pnpm test`
4. Nodo enterprise:
   - Copiar `enterprise-node/.env.example` a `.env`.
   - Mantener `RPC_HTTP_BIND=127.0.0.1` salvo que haya proxy seguro.
   - `docker compose -f enterprise-node/docker-compose.yml config`
   - `docker compose -f enterprise-node/docker-compose.yml up -d`
5. Validacion funcional:
   - Registrar un sensor via Edge Node.
   - Verificar evento `SensorDataRegistered` en `blockchain_events`.
   - Verificar publicacion Redis/SSE `event:escrow:sensor_data`.
   - Verificar metricas `/api/metrics` desde red interna.
   - Crear una orden con `/api/gateway/v1/payments/buy`.
   - Confirmarla desde un worker interno con `/api/gateway/v1/payments/settle`.
   - Adjuntar `txHash` cuando el mint/transfer de `$BEZ` este enviado.

## Contrato economico de escrow agregado

`DeliveryEscrow.sol` cubre:

- deposito de comprador en `$BEZ`;
- fee configurable inicial 250 bps;
- validacion por rol `ORACLE_ROLE` o `EDGE_NODE_ROLE`;
- estados `FUNDED`, `DISPUTED`, `RELEASED`, `REFUNDED`;
- `validateAndRelease`, `refund`, `openDispute`, `resolveDispute`;
- `ReentrancyGuard`, `AccessControl`, `Pausable`;
- tests Foundry para release, refund, disputa, fee y reentrancy.

Nota: el contrato implementa `validateAndRelease` en lugar de `release` directo para dejar claro que la salida de fondos depende de evidencia/oraculo.
