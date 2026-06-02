# Documentación de Endpoints y Funciones - BEZ_Scaner

## Endpoints REST

### POST /api/mint
- Descripción: Realiza el mint de un NFT logístico.
- Headers: `x-api-key`
- Body: `{ to, uri, containerId }`
- Respuesta: `{ status, txHash }`

### POST /api/transfer
- Descripción: Transfiere un NFT logístico a otra cuenta.
- Headers: `x-api-key`
- Body: `{ tokenId, to }`
- Respuesta: `{ status, txHash }`

### GET /api/sensor/:containerId
- Descripción: Consulta el último dato de sensor para un contenedor.
- Headers: `x-api-key`
- Respuesta: `{ data }`

### POST /api/sensor
- Descripción: Registra un nuevo dato de sensor para un contenedor.
- Headers: `x-api-key`
- Body: `{ containerId, temperature, status }`
- Respuesta: `{ status, txHash }`

## CLI
- Permite interactuar con la API desde consola para mint, transferencias y gestión de sensores.

## Seguridad
- Todos los endpoints requieren autenticación por API KEY.
- Mint requiere que el signer tenga el rol MINTER_ROLE.
- Transferencia requiere que el signer sea owner o aprobado.

---

**Última actualización:** 2026-03-30
