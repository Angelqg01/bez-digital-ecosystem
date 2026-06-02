# BeZhas Enterprise Node

Paquete distribuible para que cualquier empresa despliegue un nodo conectado a la red BeZhas L2 (Chain ID 2708).

## Despliegue rápido

```bash
cp .env.example .env   # Editar credenciales
docker compose up -d   # Levantar los 3 contenedores
curl http://localhost:4100/health
```

## Instalacion Windows guiada

```powershell
.\scripts\install-windows.ps1 -ApiKey "CAMBIA_ESTA_CLAVE_SEGURA"
.\scripts\validate-node.ps1
docker compose up -d
```

## Arquitectura: 3 contenedores

```
┌──────────────────────────────────────────────────────────────┐
│                 Red BeZhas L2 (Chain ID 2708)                │
└────────────────────────────┬─────────────────────────────────┘
                             │ P2P sync
                             ▼
┌────────────────────────────────────────────┐
│         bezhas-geth  (op-geth)             │
│         Puerto: 8545 (HTTP) / 8546 (WS)   │
│         Rol: Cliente L2, sincroniza bloques│
└──────────────┬─────────────────────────────┘
               │ JSON-RPC (interno)
               ▼
┌────────────────────────────────────────────┐
│       enterprise-api  (Express.js)         │
│       Puerto: 4100                         │
│       Rol:                                 │
│        • API REST (/events, /contracts)    │
│        • Sincroniza ABIs de la plataforma  │
│        • Indexa eventos on-chain           │
│        • Webhooks para ERP (/webhook)      │
└──────────────┬─────────────────────────────┘
               │ SQL (interno)
               ▼
┌────────────────────────────────────────────┐
│         postgres  (PostgreSQL 15)          │
│         Puerto: 5432                       │
│         Rol: Almacena eventos indexados,   │
│             ABIs, estado de sincronización │
└────────────────────────────────────────────┘
```

## Cómo interactúan los contenedores

1. **bezhas-geth** sincroniza bloques de la red BeZhas L2 vía P2P. Expone un endpoint JSON-RPC en `:8545` que cualquier aplicación (MetaMask, SDK, scripts) puede usar directamente.

2. **enterprise-api** se conecta a `bezhas-geth` por JSON-RPC interno (`http://bezhas-geth:8545`). Al arrancar:
   - Crea las tablas en PostgreSQL (`blockchain_events`, `abi_registry`, `sync_state`)
   - Sincroniza los ABIs de los contratos BeZhas (desde la plataforma central o ABIs empaquetados)
   - Suscribe listeners a los eventos de cada contrato registrado
   - Cada evento on-chain se parsea y almacena en PostgreSQL para consulta SQL

3. **postgres** almacena todo localmente. La empresa puede consultar eventos indexados con SQL estándar o a través de la API REST.

## Endpoints API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/health` | No | Estado del nodo |
| GET | `/network/stats` | No | Bloque actual, gas price, chain ID |
| GET | `/events` | API Key | Eventos indexados (filtro: contract, event, from_block) |
| GET | `/contracts` | API Key | ABIs registrados |
| POST | `/contracts/sync` | API Key | Forzar re-sincronización de ABIs |
| GET | `/indexer/stats` | API Key | Estadísticas del indexador |
| POST | `/webhook` | API Key | Recibir datos de ERPs (sector, entity_id, data) |
| GET | `/sdk/frontend-config` | No | Configuracion para frontends y wallets |
| GET | `/sdk/status` | API Key | Estado del SDK BeZhas conectado |
| GET | `/sdk/contracts` | API Key | Direcciones y ABIs para backends |
| GET | `/tokenomics/snapshot` | API Key | Snapshot tokenomico y operativo |
| GET | `/profitability/report` | API Key | Rentabilidad estimada del nodo |
| GET/POST/DELETE | `/hooks` | API Key | Hooks salientes ERP/CRM/backend |
| GET/POST | `/validator/*` | API Key | Estado y operaciones de validador |
| GET | `/operations/checklist` | API Key | Checklist operativo y de seguridad |

### Autenticación

Todos los endpoints marcados con "API Key" requieren el header:
```
Authorization: <API_KEY>
```

## Adaptación al stack de tu proyecto

Este paquete sigue el **estándar técnico BeZhas**:
- **Express.js** (no NestJS) — consistente con `api/`, `bezhas-edge-node/`
- **PostgreSQL** con `pg` (no MongoDB ni ORMs) — queries directas
- **ethers.js v6** — misma versión que el SDK y toda la plataforma
- **Dockerfile multi-stage** con usuario no-root `bezhas`
- **Healthchecks** usando `127.0.0.1` (no `localhost`) para compatibilidad Alpine

## Documentacion para clientes

La carpeta `Doc/` contiene guias por componente:

- `01-nodo-empresarial-bezhas.md`
- `02-api-endpoints.md`
- `03-sdk-y-frontend.md`
- `04-hooks-e-integraciones.md`
- `05-tokenomics-y-rentabilidad.md`
- `06-validador-y-edge-node.md`
- `07-operacion-y-seguridad.md`
