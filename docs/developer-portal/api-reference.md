# API Reference

> Documentación de los endpoints públicos RESTful de BeZhas. No se exponen endpoints internos, de administración ni debugging.

## Autenticación
Todas las llamadas requieren API Key en el header `Authorization: Bearer <API_KEY>`.

Base local del Core:

```text
http://localhost:3001/api
```

Guia de instalacion de API/SDK/nodos/RPC: [API, SDK, Nodos y RPC](api-sdk-nodos-rpc.md).

### Roles soportados
- `user`: Acceso básico de consulta
- `agent`: Acceso a operaciones de agentes sectoriales
- `admin`: Solo para operaciones de despliegue (no documentadas aquí)

### Ejemplo de autenticación
```http
GET /v1/supply/shipments
Authorization: Bearer TU_API_KEY
```

## Endpoints Principales

### Logística
- `GET /v1/supply/shipments` — Listar envíos
- `POST /v1/supply/customs/clear` — Solicitar despacho aduanal
- `GET /v1/supply/checkpoints` — Consultar checkpoints de rastreo
- `GET /v1/supply/certificates` — Certificados de calidad
- `GET /v1/supply/tariffs` — Tarifas y aranceles

### Salud
- `GET /v1/health/records` — Consultar registros médicos (requiere permisos)

### Energía
- `GET /v1/energy/credits` — Listar créditos de carbono

... (ver documentación sectorial para más endpoints)

> Nota: No publiques nunca tus tokens ni claves en ejemplos públicos.

[[generic-webhook]]
[[shopify-webhook]]
[[sap-webhook]]
[[oracle-webhook]]
[[Servidores_MCP_Recomendados]]
