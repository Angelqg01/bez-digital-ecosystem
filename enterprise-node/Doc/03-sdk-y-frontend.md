# SDK, Frontend y Backend

El nodo ofrece un puente entre la infraestructura empresarial y `@bezhas/sdk`.

## Conexion principal

El frontend debe consultar:

```http
GET /sdk/frontend-config
```

Devuelve:

- Chain ID de BeZhas L2.
- RPC publico/local recomendado.
- Explorer.
- Moneda nativa `BEZ`.
- URLs principales de la API.
- Estado del SDK.

## Uso con MetaMask o wallets

El frontend puede usar la respuesta de `/sdk/frontend-config` para solicitar a la wallet una red con:

- `chainId`: `2708`
- `rpcUrls`: valor de `chain.rpc_url`
- `chainName`: `BeZhas L2`
- `nativeCurrency.symbol`: `BEZ`

## Uso desde backend

Los backends autorizados pueden usar:

```http
GET /sdk/contracts
Authorization: TU_API_KEY
```

Este endpoint devuelve direcciones y ABIs disponibles para construir instancias con `ethers`.

## Montaje del SDK en Docker

`docker-compose.yml` monta:

```yaml
../sdk:/bezhas-sdk:ro
../smart-contracts:/smart-contracts:ro
```

Por eso en Docker `BEZHAS_SDK_PATH` debe ser `/bezhas-sdk`. Si ejecutas `node server.js` fuera de Docker, puedes usar `../sdk`.

## Beneficio comercial

Este puente reduce friccion para clientes porque una app no necesita conocer toda la estructura interna del monorepo. El nodo entrega una configuracion consumible para frontend, backend y scripts.

