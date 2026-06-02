# Tokenomics y Rentabilidad

El componente tokenomico calcula snapshots de la plataforma y reportes de rentabilidad del nodo.

## Snapshot tokenomico

```bash
curl -H "Authorization: TU_API_KEY" http://localhost:4100/tokenomics/snapshot
```

Incluye, cuando los contratos estan configurados:

- Supply de BEZ.
- Staking total, APY y minimo de stake.
- Farming pools, allocation points y BEZ por bloque.
- Governance quorum.
- Escrow total y escrows activos.
- Total de validadores.
- Edge nodes y recompensa por nodo.

## Direcciones de contratos

El nodo resuelve direcciones desde:

1. SDK montado.
2. Variables `.env`.
3. ABIs empaquetados para eventos basicos.

Variables importantes:

- `BEZCOINV2_ADDRESS`
- `STAKING_POOL_ADDRESS`
- `LIQUIDITY_FARMING_ADDRESS`
- `GOVERNANCE_SYSTEM_ADDRESS`
- `QUALITY_ESCROW_ADDRESS`
- `VALIDATOR_REGISTRY_ADDRESS`
- `EDGE_NODE_REWARDS_ADDRESS`

## Reporte de rentabilidad

```bash
curl -H "Authorization: TU_API_KEY" http://localhost:4100/profitability/report
```

Modelo base:

- `REVENUE_MONTHLY_NODE_FEE_EUR`
- `REVENUE_SETUP_FEE_EUR`
- `REVENUE_WEBHOOK_FEE_EUR`
- `REVENUE_INDEXED_EVENT_FEE_EUR`
- `REVENUE_VALIDATOR_REWARD_BEZ_MONTHLY`
- `BEZ_PRICE_EUR`
- `INFRA_COST_EUR_MONTHLY`

## Recomendacion comercial

Para maximizar rentabilidad de BeZhas:

- Vender el nodo como suscripcion mensual B2B.
- Cobrar setup inicial por instalacion y soporte.
- Cobrar por volumen de eventos indexados y hooks.
- Reservar funciones de validador para planes de mayor precio.
- Mantener RPC privado para evitar abuso de infraestructura.
- Usar analitica tokenomica como argumento de valor para clientes.

