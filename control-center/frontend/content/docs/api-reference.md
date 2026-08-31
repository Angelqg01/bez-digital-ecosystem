# Referencia de API

La API Core es la puerta de entrada para integrar BeZhas sin escribir Solidity. Unifica wallet, staking, gobernanza, contratos, billing y las integraciones sectoriales.

> Esta referencia cubre **solo endpoints públicos de integración**. Los endpoints de administración, despliegue y operación interna no se documentan aquí y no son accesibles con credenciales de integrador.

## Base y autenticación

```text
Producción : https://api.bez.digital/api
Local      : http://localhost:3001/api
```

Todas las llamadas (salvo `/sso/login` y las marcadas `public`) requieren API key y JWT:

```http
Authorization: Bearer <JWT>
X-API-Key: <API_KEY>
```

El JWT se obtiene mediante login con wallet y es válido entre Apps Nativas del ecosistema. **Se mantiene en memoria, nunca en disco ni en `localStorage`.**

## Gateway unificado

Todos los endpoints cuelgan de `/gateway/v1/`.

### Sesión

| Método | Ruta | Descripción | Scope |
| --- | --- | --- | --- |
| `POST` | `/sso/login` | Login con wallet, devuelve JWT cross-app | `public` |

### Wallet

| Método | Ruta | Descripción | Scope |
| --- | --- | --- | --- |
| `GET` | `/wallet/balances` | Balances de todos los tokens | `wallet:read` |
| `POST` | `/wallet/transfer` | Transferir tokens | `wallet:write` |

### Staking y farming

| Método | Ruta | Descripción | Scope |
| --- | --- | --- | --- |
| `GET` | `/staking/positions` | Posiciones activas | `staking:read` |
| `POST` | `/staking/stake` | Iniciar staking de BEZ | `staking:write` |
| `GET` | `/farming/pools` | Pools de farming disponibles | `farming:read` |

### Gobernanza

| Método | Ruta | Descripción | Scope |
| --- | --- | --- | --- |
| `GET` | `/governance/proposals` | Propuestas activas | `governance:read` |
| `POST` | `/governance/vote` | Votar una propuesta | `governance:write` |

### Token, contratos y tesorería

| Método | Ruta | Descripción | Scope |
| --- | --- | --- | --- |
| `GET` | `/token/info` | Datos del token BEZ | `public` |
| `GET` | `/contracts/addresses` | Direcciones de contratos por red | `public` |
| `GET` | `/treasury/overview` | Estado de la tesorería DAO | `treasury:read` |

### Bridge

| Método | Ruta | Descripción | Scope |
| --- | --- | --- | --- |
| `POST` | `/bridge/initiate` | Iniciar transferencia cross-chain | `bridge:write` |

## Otros namespaces

| Ruta | Para qué |
| --- | --- |
| `GET /health` | Salud del Core |
| `GET /contracts-abi/*` | Descarga de ABIs |
| `POST /cargolink/v1/*` | Integración logística CargoLink |
| `POST /ai-billing/*` | Billing, créditos y consumo |

## Endpoints sectoriales

| Sector | Endpoint | Descripción |
| --- | --- | --- |
| Logística | `GET /v1/supply/shipments` | Listar envíos |
| Logística | `GET /v1/supply/checkpoints` | Checkpoints de rastreo |
| Logística | `GET /v1/supply/certificates` | Certificados de calidad |
| Logística | `GET /v1/supply/tariffs` | Tarifas y aranceles |
| Aduanas | `POST /v1/supply/customs/clear` | Solicitar despacho |
| Salud | `GET /v1/health/records` | Registros clínicos (permisos explícitos) |
| Energía | `GET /v1/energy/credits` | Créditos de carbono |

Los endpoints de datos personales o clínicos exigen permisos específicos y consentimiento registrado; no basta con un token válido.

## Roles

| Rol | Alcance |
| --- | --- |
| `user` | Consulta básica |
| `agent` | Operaciones de agentes sectoriales |
| `admin` | Operaciones internas — no documentadas ni disponibles públicamente |

## Ejemplo

```bash
curl -H "Authorization: Bearer $JWT" \
     -H "X-API-Key: $BEZHAS_API_KEY" \
     https://api.bez.digital/api/gateway/v1/wallet/balances
```

```js
const res = await fetch(`${BASE}/gateway/v1/staking/positions`, {
  headers: {
    Authorization: `Bearer ${jwt}`,
    'X-API-Key': apiKey,
  },
});
if (!res.ok) throw new Error(`API ${res.status}`);
const posiciones = await res.json();
```

## Errores

| Código | Significado | Qué hacer |
| --- | --- | --- |
| `400` | Petición inválida | Revisa el cuerpo y los tipos |
| `401` | Sin autenticar | API key o JWT ausente, caducado o mal formado |
| `403` | Sin permiso | Tu scope no cubre esa operación |
| `404` | No existe | Revisa la ruta y los identificadores |
| `429` | Rate limit | Backoff exponencial y reintento |
| `5xx` | Error del servidor | Reintenta; si persiste, abre incidencia |

Ante un `401`, comprueba primero si el JWT ha caducado: se renueva automáticamente en el SDK, pero no si lo gestionas a mano.

## Reglas de integración

- Nunca expongas la API key en el frontend. Las llamadas autenticadas salen de tu backend.
- No registres JWT ni API keys en logs, trazas ni sistemas de errores.
- Usa siempre HTTPS.
- Todas las Apps Nativas deben consumir el mismo Core, el mismo sistema de billing y el mismo BEZ-Coin: no dupliques la lógica de créditos por tu cuenta.

## Ver también

- [SDK e integraciones](/docs/sdk-integraciones)
- [Seguridad y buenas prácticas](/docs/seguridad)
