# Validadores y staking

La red BeZhas se asegura mediante un registro de validadores corporativos: empresas que stakean BEZ, operan infraestructura y responden con su colateral si fallan. Todo el sistema vive en `ValidatorRegistry`, `StakingPool`, `EdgeNodeRewards` y `SlashingManager`.

## Tiers de validador

El importe stakeado determina el tier y el multiplicador de recompensa:

| Tier | Stake mínimo | Boost |
| --- | --- | --- |
| **Bronze** | 10.000 BEZ | 1,00× (10000 bps) |
| **Silver** | 50.000 BEZ | 1,25× (12500 bps) |
| **Gold** | 250.000 BEZ | 1,50× (15000 bps) |
| **Platinum** | 1.000.000 BEZ | 2,00× (20000 bps) |

El tier se recalcula automáticamente al añadir stake (`TierUpdated`). El boost se aplica tanto a las recompensas de staking como a las de validación DePIN.

## Parámetros de red

| Parámetro | Valor |
| --- | --- |
| Periodo de unbonding | **7 días** |
| Uptime mínimo | **90%** (9000 bps) — por debajo, desactivación |
| Cap diario de emisión — staking | 50.000 BEZ |
| Cap diario de emisión — DePIN | 100.000 BEZ |

## Ciclo de vida de un validador

```
registerValidator → heartbeat periódico → recordContribution → claim
                                        ↘ incumplimiento → slash → deactivate
initiateUnbonding → (7 días) → completeWithdraw
```

### 1. Registro

```js
// 1) Autorizar al registro a mover tu stake
await bez.approve(validatorRegistry.target, stake);

// 2) Registrarte
await validatorRegistry.registerValidator('Mi Empresa S.L.', stake);
```

Emite `ValidatorRegistered(operator, companyName, initialStake)`. El stake debe alcanzar al menos el tier Bronze.

### 2. Añadir stake y subir de tier

```js
await bez.approve(validatorRegistry.target, extra);
await validatorRegistry.addStake(extra);   // → StakeAdded + TierUpdated
```

### 3. Mantener el nodo vivo

```js
await validatorRegistry.heartbeat();       // → HeartbeatRecorded
```

El heartbeat es la prueba de disponibilidad. El nodo lo emite automáticamente; si tu uptime cae por debajo del 90%, el validador pasa a inactivo (`ValidatorDeactivated`) y deja de acumular recompensas.

### 4. Registrar trabajo útil

Las contribuciones (validaciones, verificaciones, procesado de datos) las registra un oráculo autorizado:

```solidity
function recordContribution(address operator, uint256 points, string calldata taskType)
```

Emite `ContributionRecorded`. Los puntos se traducen en BEZ según el sistema DePIN descrito abajo.

### 5. Retirar

```js
await validatorRegistry.initiateUnbonding(cantidad);  // arranca los 7 días
// … 7 días después …
await validatorRegistry.completeWithdraw();
```

`initiateUnbonding` emite `UnbondingInitiated(operator, amount, availableAt)`. No hay atajo: el periodo existe para que la red pueda penalizar comportamientos detectados después del hecho.

## Consultar el estado

```js
const info    = await validatorRegistry.getValidatorInfo(operador);
const tier    = await validatorRegistry.getValidatorTier(operador);
const boost   = await validatorRegistry.getRewardBoost(operador);   // en bps
const activo  = await validatorRegistry.isActiveValidator(operador);
const total   = await validatorRegistry.totalStaked();
const activos = await validatorRegistry.getValidatorCount();
```

## Staking pool

`StakingPool` implementa el modelo clásico de recompensa por token acumulada, con una diferencia: **el boost de tu tier de validador se aplica al reclamar**.

```js
await bez.approve(stakingPool.target, cantidad);
await stakingPool.stake(cantidad);            // → Staked

await stakingPool.earned(cuenta);             // recompensa base
await stakingPool.earnedBoosted(cuenta);      // recompensa con boost aplicado

await stakingPool.getReward();                // → RewardPaid(user, reward, boostBps)
await stakingPool.withdraw(cantidad);         // → Withdrawn
await stakingPool.exit();                     // retirar todo + reclamar
```

La emisión está limitada a **50.000 BEZ/día** (`DAILY_EMISSION_CAP`) y la tasa a `MAX_REWARD_RATE`. Si el cap diario se agota, las recompensas se acumulan pero el pago se contiene: es un freno de emisión, no una pérdida.

## Recompensas DePIN (`EdgeNodeRewards`)

Los Edge Nodes ganan por trabajo verificable, no por presencia:

| Parámetro | Valor |
| --- | --- |
| Recompensa base | 0,0075 BEZ por punto (antes del boost) |
| Máx. puntos por registro | 500 |
| Máx. puntos por nodo y día | 10.000 |
| Cap de emisión diaria | 100.000 BEZ |

```js
await edgeNodeRewards.registerNode();          // → NodeRegistered
// el oráculo registra el trabajo:
//   recordValidation(node, points, taskType)   → ValidationRecorded
await edgeNodeRewards.claimRewards();          // → RewardsClaimed(node, bez, boostBps)

const info = await edgeNodeRewards.getNodeInfo(nodo);
```

El cálculo efectivo es: `puntos × rewardPerPoint × boost del tier`, sujeto a los tres límites anteriores. Un nodo de tier Platinum cobra el doble por el mismo trabajo que uno Bronze — el stake compra capacidad de ingreso, no votos extra sobre la validez.

## Slashing

Un validador puede ser penalizado por el rol autorizado ante fallos graves: firmas incorrectas, indisponibilidad sostenida o comportamiento malicioso.

```solidity
function slash(address operator, uint256 amount, string calldata reason)
```

Emite `ValidatorSlashed(operator, amount, reason)`. El importe sale del stake; si cae por debajo del mínimo del tier, el validador se desactiva. Puede volver con `reactivateValidator(stakeAmount)` reponiendo colateral.

## Elegibilidad como secuenciador

Los validadores con tier y uptime suficientes entran en la rotación de secuenciador:

```js
const candidatos = await validatorRegistry.getActiveSequencerCandidates();
```

La rotación la gestionan `SequencerRotation` y `L2Sequencer`. El evento `SequencerEligibilityUpdated` te avisa de cambios en tu elegibilidad.

## Antes de stakear: comprueba

- [ ] Tu nodo está operativo y emite heartbeat de forma fiable (ver [Nodos](/docs/nodos-enterprise-edge)).
- [ ] Tienes monitorización y alertas de caída — el 90% de uptime no es un objetivo, es un umbral.
- [ ] La clave del operador está en un gestor de secretos o HSM, nunca en el repositorio ni en el `.env` de un servidor compartido.
- [ ] Entiendes que el unbonding son 7 días y planificas tu liquidez en consecuencia.
- [ ] Has probado el ciclo completo en local (`31337`) antes de comprometer stake real.

## Ver también

- [Nodos Enterprise y Edge](/docs/nodos-enterprise-edge)
- [Gobernanza DAO](/docs/gobernanza-dao)
- [BEZ-Coin](/docs/bez-coin)
