# Runtime Errors & Solutions
> Errores en ejecución y sus soluciones

## API: "ABI not found for ContractName"
**Causa**: Contratos no compilados o artifact path incorrecto
**Solución**: Ejecutar `forge build` en smart-contracts/
**Verificar**: `smart-contracts/out/{Name}.sol/{Name}.json` debe existir

## API: "Contract X not deployed on chain"
**Causa**: Address no registrada en DB
**Solución**: Ejecutar deploy script + parse-deployment.js + seed.js

## Redis connection refused
**Causa**: Redis no está corriendo
**Solución**: `docker compose up redis -d`
**Fallback**: API funciona sin Redis (sin cache/rate-limit)

## PostgreSQL connection timeout
**Causa**: DB no inicializada o pool agotado
**Solución**: 
1. `docker compose up postgres -d`
2. `node api/db/migrate.js`
3. Verificar pool size en db/pool.js

## Frontend: SWC parser error
**Causa**: Non-ASCII characters (emojis, accents) in JSX files
**Solución**: Remove non-ASCII chars from JSX source
**Patrón**: Use i18n strings instead of inline unicode

## Wallet: "SW: daily limit exceeded"
**Causa**: User tried to spend more than daily limit
**Solución**: Wait for daily reset (24h) or increase limit via `setDailyLimit()`

## MultiSig: "MS: timelock active"
**Causa**: Large operation requires 48h wait
**Solución**: Wait for timelock to expire, then executeTransaction()

## SecurityModule: "SEC: expired"
**Causa**: Timelock operation not executed within grace period (14 days)
**Solución**: Schedule a new operation — expired ones cannot be executed
