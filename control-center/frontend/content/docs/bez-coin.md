# BEZ-Coin: el token nativo

`BEZCoinV2` es el token nativo del ecosistema. No es un token especulativo añadido encima de la plataforma: es **el gas de la L2, el colateral de los validadores y el peso de voto de la DAO**.

## Ficha técnica

| Propiedad | Valor |
| --- | --- |
| Nombre / símbolo | BeZhas Coin · `BEZ` |
| Decimales | 18 |
| Estándar | ERC-20 |
| Extensiones | `ERC20Burnable`, `ERC20Permit`, `ERC20Votes`, `AccessControl` |
| Hard cap (`MAX_SUPPLY`) | 10.000.000.000 BEZ — constante, no modificable |
| Pre-mint en despliegue | 3.000.000.000 BEZ a tesorería/liquidez |
| Contrato | `smart-contracts/src/tokens/BEZCoinV2.sol` |

## Direcciones en producción

| Red | Dirección |
| --- | --- |
| Polygon (ERC-20) | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` |
| BNB Chain (BEP-20) | `0x8a1e3930fde1f151471c368fdbb39f3f63a65b55` |

Las direcciones de la L2 (`chainId 2708`) y del resto de contratos se obtienen siempre en tiempo de ejecución vía SDK o mediante `GET /api/gateway/v1/contracts/addresses`. **No las codifiques a mano**: cambian entre despliegues y entre redes.

## Los cuatro usos del token

### 1. Gas de la L2

La L2 está configurada con **gas token personalizado** (`useCustomGasToken: true`): las transacciones se pagan en BEZ, no en ETH. Para una empresa esto significa que el coste operativo de la red se presupuesta en un único activo.

### 2. Colateral de validación

Registrarse como validador exige stakear BEZ. El importe determina el *tier* y el multiplicador de recompensas. Ver [Validadores y staking](/docs/validadores-staking).

### 3. Peso de gobernanza

`ERC20Votes` permite delegar poder de voto sin transferir tokens:

```js
// Autodelegación: sin esto tu saldo NO cuenta para votar
await bez.delegate(await signer.getAddress());

// Delegar a un tercero
await bez.delegate('0xDelegado');
```

El reloj de voto (`clock()`) opera en **modo timestamp**, no en número de bloque. Ver [Gobernanza DAO](/docs/gobernanza-dao).

### 4. Aprobaciones sin gas (`permit`)

`ERC20Permit` (EIP-2612) permite que un usuario firme una autorización off-chain y que un relayer o el Paymaster pague el gas de la ejecución:

```js
const nonce = await bez.nonces(owner);
const deadline = Math.floor(Date.now() / 1000) + 3600;
// firma EIP-712 → luego bez.permit(owner, spender, value, deadline, v, r, s)
```

Es la base de los pagos *gasless* para empresas que no quieren gestionar saldos de gas en cada wallet.

## Emisión y control de supply

`mint()` está restringido al rol `MINTER_ROLE` y valida el cap en cada llamada:

```solidity
require(totalSupply() + amount <= MAX_SUPPLY, "BEZ: supply cap exceeded");
```

El resto del supply (por encima del pre-mint de 3B) se emite progresivamente contra operaciones reales: recompensas DePIN, staking e incentivos de red, siempre bajo el cap.

## Detalle importante para integradores: la semántica de `burn`

`BEZCoinV2` **sobrescribe deliberadamente** `burn()`, `burnFrom()` y `bridgeBurn()`. Estas funciones **no destruyen tokens ni reducen `totalSupply()`**: transfieren el importe a `treasuryWallet`.

Consecuencias prácticas si integras contabilidad o analítica:

- No asumas que `totalSupply()` decrece tras un "burn". No lo hará.
- Para un puente, el saldo bloqueado en la cadena destino debe cuadrar **con lo recolectado en tesorería**, no con una reducción de supply.
- Si calculas supply circulante, resta explícitamente el saldo de `treasuryWallet()`.

El nombre se conserva por compatibilidad con herramientas ERC-20, pero el comportamiento es de *recolección*, no de quema.

## Roles del contrato

| Rol | Puede |
| --- | --- |
| `DEFAULT_ADMIN_ROLE` | Gestionar roles y cambiar `treasuryWallet` |
| `MINTER_ROLE` | Emitir hasta el cap |
| `BRIDGE_ROLE` | Ejecutar `bridgeBurn` en operaciones cross-chain |

Los roles se custodian mediante multi-firma institucional y, progresivamente, bajo control del timelock de la DAO.

## Ver también

- [Tokenización de activos](/docs/tokenizacion-activos)
- [Pagos y gas](/docs/pagos-y-gas)
- [Puentes cross-chain](/docs/puentes-cross-chain)
