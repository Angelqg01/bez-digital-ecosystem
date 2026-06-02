# API y Endpoints

La API REST vive en `enterprise-api` y por defecto escucha en `http://localhost:4100`.

## Endpoints publicos

- `GET /health`: estado del servicio, memoria, uptime, chain id e indexador.
- `GET /network/stats`: altura de bloque, gas price y estado RPC.
- `GET /sdk/frontend-config`: configuracion lista para frontends sin exponer claves privadas.

## Endpoints autenticados

Todos requieren:

```http
Authorization: TU_API_KEY
```

Tambien se acepta `?api_key=TU_API_KEY`, aunque para produccion es mejor usar header.

## Eventos y contratos

- `GET /events`: lista eventos indexados.
- `GET /contracts`: ABIs registrados.
- `POST /contracts/sync`: resincroniza ABIs desde plataforma o SDK/bundled ABIs.
- `GET /indexer/stats`: metricas del indexador.

Filtros utiles de `/events`:

- `contract=StakingPool`
- `event=Staked`
- `from_block=100`
- `limit=100`

## SDK y frontend

- `GET /sdk/status`: estado del SDK, contratos conocidos y exports disponibles.
- `GET /sdk/contracts`: direcciones y ABIs por contrato para backends autorizados.
- `GET /sdk/frontend-config`: chain id, RPC, explorer y rutas utiles para apps.

## Tokenomics y rentabilidad

- `GET /tokenomics/snapshot`: captura estado tokenomico y lo guarda.
- `GET /tokenomics/latest`: ultima captura guardada.
- `GET /profitability/report`: calcula reporte con valores del `.env`.
- `POST /profitability/calculate`: calcula rentabilidad con supuestos enviados en JSON.

Ejemplo:

```bash
curl -H "Authorization: TU_API_KEY" http://localhost:4100/profitability/report
```

## Hooks

- `GET /hooks`: lista hooks configurados.
- `POST /hooks`: crea hook saliente.
- `POST /hooks/:id/test`: prueba entrega.
- `DELETE /hooks/:id`: elimina hook.

## Validador

- `GET /validator/status`: muestra configuracion y estado on-chain si existe.
- `POST /validator/approve-stake`: aprueba BEZ para stake.
- `POST /validator/register`: registra validador.
- `POST /validator/heartbeat`: envia heartbeat.

Las rutas write del validador requieren `VALIDATOR_PRIVATE_KEY`. No actives esa clave en servidores sin hardening.

