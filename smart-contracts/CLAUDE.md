# smart-contracts/ — Contratos (Foundry)

Fuente de verdad on-chain. Contexto general: [`../CLAUDE.md`](../CLAUDE.md). No hay Hardhat.

## Comandos

```bash
forge build --sizes
forge test                       # ~110 suites, ~1.400 tests
FOUNDRY_PROFILE=aa forge test    # pruebas de Account Abstraction (antes: script/setup-aa-lib.sh)
cd .. && pnpm sync:abi           # propaga ABIs y direcciones a api, sdk y control-center
```

## Dónde está cada cosa

`src/` contratos · `test/` pruebas · `script/` despliegues (`Deploy*.s.sol`) ·
`deployments/<chainId>.json` direcciones · `abi/` ABIs generados.

## Qué está desplegado (no confundir código con producción)

| Red | Estado |
|---|---|
| Polygon (137) | `BEZCoin`/`BezhasToken`, `QualityEscrow`, `RWAFactory`, `GovernanceSystem`, `LiquidityFarming` (versión **anterior** al código actual, sin pools), `NFTOffers`, `Marketplace`, `AdminRegistry` |
| BNB Chain | **Nada.** No hay contrato BEZ |
| L2 propia (2708) | Sin uso en producción: `BEZCoinV2` es el token de esa red, no el de BeZhas |

`StakingPool`, `SmartWallet`, `MultiSigWallet`, `Paymaster` y `BeZhasDEX` están **corregidos en el
código y sin desplegar** (ver `../docs/audit/PLAN_REMEDIACION_SEGURIDAD_2026-11-12.md`). Al desplegarlos:
`pnpm sync:abi` y fijar `BEZHAS_DEX_ADDRESS` en la API y en el keeper (`../docs/runbooks/DEX-KEEPER.md`).

## Reglas

- **Nunca cambiar una dirección de `deployments/` sin confirmación explícita.**
- Un arreglo de seguridad se escribe con su test primero: tiene que fallar antes y pasar después.
- Un test que avance el tiempo usa `vm.getBlockNumber()` / `vm.warp`, no `block.number + n`
  repetido: con `via_ir` el optimizador reutiliza la primera lectura y el segundo avance no ocurre.
- Los precios del DEX para dinero real salen de `consultTwap`, nunca de `getSpotPrice` (manipulable).
