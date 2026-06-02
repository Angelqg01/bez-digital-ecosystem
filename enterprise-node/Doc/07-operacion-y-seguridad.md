# Operacion y Seguridad

Este documento resume las pautas necesarias para operar el nodo empresarial de forma optima.

## Checklist inicial

Consulta:

```bash
curl -H "Authorization: TU_API_KEY" http://localhost:4100/operations/checklist
```

Debe revisar:

- `API_KEY` fuerte.
- SDK disponible.
- RPC protegido.
- ABIs sincronizados.
- Hooks creados solo para destinos confiables.
- Validador write activado solo cuando exista hardening.

## Seguridad RPC

Por defecto:

```env
RPC_HTTP_BIND=127.0.0.1
RPC_WS_BIND=127.0.0.1
```

Mantenerlo asi evita que terceros usen el nodo sin permiso. Si necesitas exponer RPC, usa proxy con TLS, autenticacion, rate limit y firewall.

## Base de datos

PostgreSQL guarda:

- `blockchain_events`
- `abi_registry`
- `sync_state`
- `integration_hooks`
- `tokenomics_snapshots`
- `profitability_reports`
- `node_operations`

Configura backups periodicos antes de usar clientes reales.

## Monitorizacion

Revisar:

- `/health`
- `/network/stats`
- `/indexer/stats`
- Logs de Docker.
- Altura de bloque frente a la red BeZhas.
- Errores de hooks.

## Instalacion optima

Para clientes finales, se recomienda distribuir:

- ZIP o release versionado.
- `.env.example` claro.
- Imagen Docker publicada.
- Guia de instalacion Windows/Linux.
- Script de validacion post-instalacion.

