# Gobernanza DAO

`GovernanceSystem` implementa la DAO sobre el stack de OpenZeppelin Governor, con el token BEZ como peso de voto y un timelock que separa la aprobación de la ejecución.

## Composición

```solidity
contract GovernanceSystem is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
```

## Parámetros

| Parámetro | Valor |
| --- | --- |
| Nombre | `BeZhas Governance System` |
| Retardo de voto (`votingDelay`) | **1 día** |
| Periodo de voto (`votingPeriod`) | **1 semana** |
| Umbral de propuesta | **10.000 BEZ** |
| Quórum | **4%** del supply con voto |
| Reloj | Modo **timestamp** (no número de bloque) |
| Ejecución | A través de `TimelockController` |

El retardo de un día existe para que nadie pueda comprar poder de voto y votar en la misma operación. La semana de votación da margen a que los operadores corporativos deliberen.

## Requisito previo: delegar

Tener BEZ **no** te da voto. `ERC20Votes` exige delegación explícita:

```js
// Sin esto, tu saldo no cuenta
await bez.delegate(await signer.getAddress());

// O delega en un tercero de confianza
await bez.delegate('0xDelegado');
```

Solo cuenta el poder de voto que tuvieras **en el instante en que arrancó la votación**. Delegar después de que empiece no sirve para esa propuesta.

```js
const poder = await bez.getVotes(direccion);
const historico = await bez.getPastVotes(direccion, timestamp);
```

## Crear una propuesta

Necesitas al menos 10.000 BEZ de poder de voto.

```js
const targets  = [contratoObjetivo.target];
const values   = [0];
const calldatas = [
  contratoObjetivo.interface.encodeFunctionData('setFeeBps', [150]),
];
const descripcion = 'BEZ-014: reducir la comisión sectorial al 1,5%';

const tx = await governance.propose(targets, values, calldatas, descripcion);
```

Guarda el `proposalId` del evento `ProposalCreated`: lo necesitas para todo lo demás.

## Votar

```js
// 0 = Contra, 1 = A favor, 2 = Abstención
await governance.castVote(proposalId, 1);

// Con justificación pública
await governance.castVoteWithReason(proposalId, 1, 'Mejora la competitividad B2B');
```

`GovernorCountingSimple` cuenta abstenciones para el quórum, pero no para el resultado.

## Ciclo de vida

```
Pending → Active → Succeeded → Queued → Executed
                 ↘ Defeated
                 ↘ Canceled / Expired
```

```js
const estado = await governance.state(proposalId);
```

Tras aprobarse, la propuesta se encola en el timelock (`queue`) y solo se ejecuta (`execute`) cuando vence el plazo. Esa ventana es deliberada: da tiempo a reaccionar si una propuesta aprobada resulta ser dañina.

## Papel de los validadores

`GovernanceSystem` conoce el `ValidatorRegistry` y puede consultar `isActiveValidator` y `getValidatorTier`. Los validadores activos tienen responsabilidad reforzada sobre las decisiones técnicas: son quienes ejecutan la red y quienes soportan el coste de un cambio mal calibrado.

`setValidatorRegistry` solo puede invocarse **desde la propia gobernanza** (`onlyGovernance`): ni el equipo ni un administrador pueden reapuntarlo por su cuenta.

## Qué se decide en la DAO

- Parámetros económicos: comisiones, tasas de recompensa, caps de emisión
- Actualizaciones de contratos del núcleo
- Uso de la tesorería
- Incorporación de nuevos módulos sectoriales
- Criterios de validación y de slashing

## Buenas prácticas

1. **Delega antes de que abra la votación**, no durante.
2. **Publica el razonamiento** antes de proponer: una propuesta que llega sin contexto se rechaza por desconocimiento, no por desacuerdo.
3. **Simula la propuesta** en un fork o en local antes de someterla a voto. Un calldata mal codificado se ejecuta igual de bien que uno correcto.
4. **Vigila la cola del timelock.** El periodo entre aprobación y ejecución es tu última oportunidad de detectar un error.

## Ver también

- [BEZ-Coin](/docs/bez-coin)
- [Validadores y staking](/docs/validadores-staking)
