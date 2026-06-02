# Nodo Empresarial BeZhas

El Nodo Empresarial BeZhas permite a una empresa conectarse a BeZhas L2 con infraestructura propia, consultar la red por RPC, indexar eventos de contratos, conectar ERPs mediante hooks y explotar datos tokenomicos para tomar decisiones de rentabilidad.

## Para que sirve

- Conectar aplicaciones empresariales a BeZhas L2.
- Exponer un RPC local seguro para frontend, backend, SDK y scripts internos.
- Guardar eventos on-chain en PostgreSQL para auditoria y analitica.
- Publicar eventos hacia ERPs, CRMs, backends o data warehouses mediante hooks.
- Consultar contratos y ABIs desde el SDK BeZhas.
- Medir tokenomics, staking, farming, validadores, edge rewards y escrow.
- Calcular rentabilidad estimada del nodo por cliente, volumen y recompensas.

## Servicios incluidos

- `bezhas-geth`: cliente OP Stack con RPC HTTP y WebSocket.
- `enterprise-api`: API REST, indexador, hooks, SDK bridge y tokenomics.
- `postgres`: base local para eventos, ABIs, snapshots y reportes.

## Instalacion rapida

```bash
cd D:\BeZhas-Blockchain\enterprise-node
copy .env.example .env
docker compose up -d
curl http://localhost:4100/health
```

Antes de usarlo con clientes, cambia `API_KEY`, credenciales de PostgreSQL y revisa que `RPC_HTTP_BIND` siga en `127.0.0.1` salvo que uses VPN, firewall o proxy seguro.

## Uso recomendado por clientes

1. Instalar Docker.
2. Copiar `.env.example` a `.env`.
3. Configurar `API_KEY` y URLs publicas.
4. Levantar con `docker compose up -d`.
5. Conectar frontend/backend a `/sdk/frontend-config`.
6. Crear hooks para los sistemas empresariales que deban recibir eventos.
7. Revisar `/tokenomics/snapshot` y `/profitability/report` para estimar retorno.

## Superficies de rentabilidad

- Cuota mensual por nodo gestionado.
- Cuota de setup inicial.
- Precio por evento indexado.
- Precio por webhook entregado.
- Planes premium con SLA, analitica y soporte.
- Recompensas de validador o edge node si se configuran claves, stake y uptime.

