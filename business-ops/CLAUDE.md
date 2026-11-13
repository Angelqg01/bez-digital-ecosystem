# business-ops/ — OPERANT

Plataforma multi-tenant de agentes IA para gestión empresarial; servicio en `:4000`. Contexto general:
[`../CLAUDE.md`](../CLAUDE.md). Detalle comercial y tarifas: [`../docs/OPERANT_SUBAPP.md`](../docs/OPERANT_SUBAPP.md).

## Comandos

```bash
pnpm test               # node --test "test/*.test.js"
pnpm run evals          # evaluaciones del comportamiento de los agentes
pnpm run smoke          # flujo de extremo a extremo sin claves
pnpm db:migrate         # necesita DATABASE_URL del propietario
```

El `README.md` aún dice `npm install`: en este proyecto es **pnpm**.

## Reglas

- **Ningún cambio de prompt entra sin pasar `pnpm run evals`** (el CI lo comprueba).
- El cliente **nunca** llama a OPERANT: usa su api-key del Gateway y la API de BeZhas llama al puente
  interno (`src/bridge/router.js`). La cuota y el cobro viven en `../api` (`../api/services/operantUsage.js`),
  no aquí.
- Mover activos on-chain o tocar un smart contract son **líneas rojas**: ningún agente las cruza sin
  aprobación humana.
- Las pruebas de PostgresStore y de RLS necesitan Postgres real (el CI levanta uno con pgvector).
