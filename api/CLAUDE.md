# api/ — Gateway y API principal

Express (CommonJS) sobre Postgres, con Redis opcional. Entrada: `index.js`. Contexto general del
proyecto: [`../CLAUDE.md`](../CLAUDE.md).

## Comandos

```bash
pnpm test                 # toda la batería de Jest
pnpm run test:unit        # lo que ejecuta el CI (~2.400 tests, ~30 s, sin base de datos)
pnpm db:migrate           # aplica db/migrations contra DATABASE_URL
node scripts/dex-keeper.js --dry-run   # ejemplo de CLI de scripts/
```

Los tests de `__tests__/integration/` se **saltan** sin base: `KNOWLEDGE_TEST_PG_URL`,
`OPERANT_TEST_PG_URL`. Necesitan un Postgres con las migraciones; nunca apuntarlos a producción.

## Una sola fuente de verdad (no copiar estos valores)

| Qué | Dónde |
|---|---|
| Cadena por defecto | `config/chain-policy.js` (`cadenaPorDefecto`, `cadenaDeServicio`). No escribir `process.env.BEZHAS_CHAIN_ID \|\| '31337'` |
| Planes y precios | `config/plans.js`, `config/plan-entitlements.js` |
| Precios de Anthropic | `config/usage-pricing.js`: es **el único** sitio a tocar si cambian |
| Economía de OPERANT | `config/operant-services.js` |
| Saldo prepago (Starter) | `config/api-credits.js` y `services/apiCredits/` (migración 080) |
| Herramientas MCP | `config/mcp-tools.js` |

Si cambia un precio, falla `__tests__/config/operant-pricing-docs.test.js` hasta que se actualicen
`../CLAUDE.md`, `../docs/OPERANT_SUBAPP.md` y el espejo del Hub.

## Cobro y cuotas

- El plan Starter es **prepago**: sin saldo, 402. El consumo sale de `services/usageBilling.js`.
- La cuota de tareas de OPERANT se **reserva de forma atómica** antes de ejecutar
  (`operantUsage.reserveTask`) y se devuelve si la tarea falla (`releaseReservation`). Nunca volver a
  `checkQuota` + ejecutar: N peticiones simultáneas se colaban en la misma plaza.
- `routes/ai-billing.js`: las rutas de escritura están retiradas (410); sólo queda
  `GET /subscription`.

## Seguridad

- En producción faltan secretos → la API no arranca (`config/secrets.js`). No añadir valores por defecto.
- `services/hotKeyGuard.js` retira claves de operador que controlen la Treasury DAO o la Hot Wallet.
  Una clave nueva de operador se registra en `CLAVES_OPERADOR`.
- El panel SuperAdmin va por cookie: `middleware/admin-auth.js` rechaza escrituras con `Origin` ajeno.
- Nunca registrar claves ni JWT en logs.

## Trampas

- **Migraciones:** la siguiente es la 081. Hay números repetidos (002, 008, 074): inofensivos y **no se renombran** (el runner
  registra el nombre del fichero: renombrar = volver a ejecutarla en producción). Un test impide añadir más.
  No lanzarlas contra producción fuera del flujo de despliegue.
- **Imagen Docker local** (servicio `bezhas-api`): antes de construirla hay que copiar `agent-lib/` y
  `../smart-contracts/abi/` y `../smart-contracts/deployments/` dentro de `api/`, como hace `../scripts/gcp-deploy.sh`.
  Están en `.gitignore`: borrarlas después.
- Los scripts de `scripts/` que firman (`scripts/dex-keeper.js`, `scripts/marketplace-anchor.js`) usan wallets
  **dedicadas**, nunca la Hot Wallet.
