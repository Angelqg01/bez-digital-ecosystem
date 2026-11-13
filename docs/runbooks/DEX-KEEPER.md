# Keeper del TWAP de BeZhasDEX

**Estado (2026-11-13):** código listo y probado contra una cadena local; **sin desplegar** (BeZhasDEX
tampoco lo está). Este documento es lo que hay que hacer el día del despliegue.

## Para qué sirve

El oráculo de precios del Hub (`price-oracle.service.js`) lee `BeZhasDEX.consultTwap`, el precio
medio desde la última **observación**. Alguien tiene que registrarla llamando a
`updateObservation(BEZ, USDC)`: la puede llamar cualquiera, **como mucho una vez cada 30 minutos**.

Si nadie lo hace, en 24 h el oráculo descarta la pool interna y cae a QuickSwap y, si también falla,
al precio de reserva (`BEZ_PRICE_USD`). No se rompe nada, pero se pierde la fuente propia.

## Qué hace el keeper (`api/scripts/dex-keeper.js`)

Una pasada y sale. Sólo envía la transacción **cuando toca** (observación de 30 min o más, medida con
el reloj de la cadena). No mueve fondos ni exige permisos: su único coste es el gas (unos céntimos).

Se niega a enviar, y sale con código 1 para que salte la alerta, si:

| Caso | Código |
|---|---|
| Falta `DEX_KEEPER_KEY` o `BEZHAS_DEX_ADDRESS` | `CONFIG` |
| El RPC responde otra cadena distinta de la esperada | `CHAIN_MISMATCH` |
| La clave controla la Treasury DAO o la Hot Wallet | `PROTECTED_KEY` |
| La wallet tiene menos de 0,02 de moneda nativa | `BALANCE_LOW` |
| La transacción se envió pero no se confirmó a tiempo (120 s) | `WAIT_TIMEOUT` |

Se salta la pasada **sin error** si el gas supera `DEX_KEEPER_MAX_GWEI` (300) o si la pool no tiene
liquidez. Si otro keeper llega antes, el contrato revierte `ObservationTooRecent` y cuenta como «no toca».

## Cómo ponerlo en marcha

1. **Crear una wallet NUEVA y dedicada.** Nunca la Hot Wallet, la Treasury DAO, la del deployer ni la
   de la multisig. Sin roles en ningún contrato y sin BEZ ni USDC: sólo POL para gas.
   ```bash
   cast wallet new          # guarda la clave en el gestor de secretos, no en el repositorio
   ```
2. **Fondearla con ~1 POL.** A unos 0,01 POL por pasada y 48 pasadas al día, dura semanas. La alerta
   `BALANCE_LOW` salta mucho antes de quedarse sin gas.
3. **Guardar la clave** como secreto `DEX_KEEPER_KEY` (Secret Manager). El resto son variables normales:

   | Variable | Valor |
   |---|---|
   | `BEZHAS_DEX_ADDRESS` | la dirección de BeZhasDEX desplegado en Polygon |
   | `DEX_KEEPER_RPC_URL` | RPC de Polygon (por defecto `POLYGON_RPC_URL`) |
   | `DEX_KEEPER_CHAIN_ID` | 137 (por defecto el de la API) |

4. **Probarlo sin gastar gas:** `cd api && node scripts/dex-keeper.js --dry-run`
5. **Programarlo cada 30 minutos.** Igual que el anclaje del marketplace: un Cloud Run Job con la imagen
   de la API y Cloud Scheduler. Sin ejecutar todavía; esto es lo que habrá que lanzar:
   ```bash
   gcloud run jobs create bezhas-dex-keeper --image <imagen-api> --region <región> \
     --command node --args scripts/dex-keeper.js \
     --set-secrets DEX_KEEPER_KEY=DEX_KEEPER_KEY:latest \
     --set-env-vars BEZHAS_DEX_ADDRESS=<dirección>,DEX_KEEPER_CHAIN_ID=137
   gcloud scheduler jobs create http bezhas-dex-keeper-30m --schedule "*/30 * * * *" ...
   ```
   Sin Google Cloud vale cron o un temporizador de systemd con `node scripts/dex-keeper.js`, o
   `--loop` (cada `DEX_KEEPER_INTERVAL_SECONDS`, 300 por defecto).
6. **Alerta:** que una ejecución fallida del job avise. Un keeper parado deja al oráculo sin la pool
   interna a las 24 h.

## Después de desplegar BeZhasDEX

1. Fijar `BEZHAS_DEX_ADDRESS` en la API y en el keeper.
2. `pnpm sync:abi` para regenerar los ABIs.
3. Lanzar el keeper una vez a mano y **esperar 10 minutos**: antes, `consultTwap` revierte
   (`TwapWindowTooShort`) y el oráculo usa la fuente siguiente.

## Qué se probó

Tests unitarios (`api/__tests__/services/dexKeeper.test.js`, 16) y una prueba real contra `anvil` con
el contrato desplegado: dry-run, envío, «no toca», TWAP válido tras la ventana (50000 = 0,05 USD/BEZ),
cadena equivocada, sin clave y wallet sin fondos. **No se probó en Polygon.**

La prueba real destapó dos fallos que los tests con mocks no veían, ya corregidos: la espera de
confirmaciones podía colgarse sin límite, y medir la edad con el reloj de la máquina en lugar del de la
cadena hacía que el keeper no enviara cuando tocaba.
