# ABIs heredados — generación de junio de 2026

Rescatados de `BeZhas-Blockchain-jun2026`, un checkout con historia de git sin
relación con este repositorio (raíz `3701578c` frente a `4d5e07c8`) que era en
realidad una copia anterior de Bezhas-Hub, antes de absorberse como SubApp.

Están **aparte a propósito**, fuera de `smart-contracts/abi/`, para que el
`sync-daemon` (`pnpm sync:abi`) no los mezcle con los ABIs de los contratos
vigentes ni los sobrescriba.

## StakingPool.json

No es una versión antigua del `StakingPool` actual: **es otro contrato con el
mismo nombre**.

| | Actual (`smart-contracts/src/core/StakingPool.sol`) | Este (junio 2026) |
|---|---|---|
| Modelo | Estilo Synthetix: `rewardPerToken`, `earned`, `getReward`, `exit`, tiers de validador y *boost* | Staking clásico: `stakes`, `unstake`, `claimReward`, `fund` |
| Pausable | No (`Ownable, ReentrancyGuard`) | Sí — `pause`, `unpause`, `EnforcedPause` |
| Rescate | — | `emergencyWithdraw` |
| Entradas de ABI | 37 | 34 |

Hay 16 entradas que sólo existen aquí: `pause`, `unpause`, `paused`, `Paused`,
`Unpaused`, `EnforcedPause`, `ExpectedPause`, `emergencyWithdraw`, `claimReward`,
`unstake`, `unstakeAndClaim`, `Unstaked`, `stakes`, `stakingToken`, `totalStaked`,
`fund`.

**Para qué sirve:** si queda alguna instancia de aquel `StakingPool` viva en
cadena, este es el único ABI del repositorio con el que se puede hablar con
ella — en particular para `emergencyWithdraw` o para pausarla. El `StakingPool`
desplegado hoy en la L2 (`chainId 2708`, `0x8198f5d8…9fbb7`) corresponde al
contrato **actual**, no a este.

**Antes de borrarlo:** comprobar en el explorador si existe algún despliegue de
la generación anterior con fondos dentro. Si no hay ninguno, esta carpeta se
puede eliminar entera.

## Lo que NO se rescató, y por qué

De las cuatro piezas candidatas, tres resultaron estar ya en el repositorio:

- `cloudbuild.yaml` y `cloudbuild-backend.yaml` → idénticos a los de
  `App-nativas/Bezhas-Hub/` (la única diferencia eran los CRLF).
- `grafana/dashboard-revenue-stream.json` → idéntico al del Hub.
- Los otros 11 ABIs → 10 idénticos a los ya presentes; `TokenSale.json` tiene las
  mismas 18 entradas que `sdk/artifacts/contracts/TokenSale.sol/TokenSale.json`,
  sólo cambia el formato (artefacto de Hardhat frente a array plano).

La cuarta pieza, `backend/services/cache.service.js`, sí faltaba y se restauró en
`App-nativas/Bezhas-Hub/backend/services/` — seis servicios la importaban y
el fichero no existía.
