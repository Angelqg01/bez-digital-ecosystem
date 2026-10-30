# Gas Tank: runbook de despliegue (Amoy y Polygon)

> Estado a 2026-10-24: **preparado y simulado, NO desplegado.** Nada de lo de abajo se ha enviado a ninguna red.
> Contratos: `BeZhasVerifyingPaymaster` y `GasTankVault` (`smart-contracts/src/gas/`). Script: `smart-contracts/script/DeployGasTank.s.sol`.

## Qué se ha verificado sin desplegar

| Comprobación | Resultado |
|---|---|
| 27 tests unitarios de Foundry + 11 contra el EntryPoint v0.8 de la librería | ✅ |
| Los mismos 11 tests **contra el EntryPoint v0.8 real de Polygon** (fork, solo lectura) | ✅ |
| Bóveda con el **token BEZ real** de Polygon (`0xEcBa…11A8`, 18 decimales): `pullProtocolFee` entrega exactamente 100 BEZ | ✅ |
| EntryPoint v0.8 canónico `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` tiene código en Polygon (21.738 bytes) | ✅ |
| Simulación del script en fork de Polygon: despliega, comprueba owner/signer/EntryPoint/BEZ | ✅ (≈ 2,4 M de gas, ≈ 3,3 POL al precio de la simulación) |
| El script **rechaza** un admin EOA en Polygon y el **Safe actual (umbral 1)** | ✅ |

Fork de pruebas: `POLYGON_FORK_RPC=https://polygon-bor-rpc.publicnode.com FOUNDRY_PROFILE=aa forge test`
(la librería de ERC-4337 se baja antes con `smart-contracts/script/setup-aa-lib.sh`).

## ⚠️ Antes de Polygon (mainnet)

1. **Auditoría externa de los dos contratos.** Está en el plan (Fase 2) como requisito de mainnet; no está hecha.
2. **El admin NO puede ser el Safe actual.** `0x3EfC…e8a3` (el «QualityEscrow/Safe» de CLAUDE.md) es un Safe **1 de 3** y uno de sus
   propietarios es la **Hot Wallet** (`0x52Df…044E`, una EOA). Con ese umbral, una sola clave comprometida controlaría el depósito del
   paymaster, las reglas de comisión y el rescate de la bóveda. Hace falta un multisig con umbral ≥ 2 (el script lo exige en 137).
   Además `0x89c2…9b12`, listado como «Treasury DAO», **no tiene código** en Polygon: es una EOA, no un contrato.
3. **Clave de verificación en KMS** (`GAS_PAYMASTER_KMS_KEY`), distinta de cualquier wallet con fondos. Su dirección es `GAS_TANK_SIGNER`.
4. Migraciones **072, 073 y 074** aplicadas y `@google-cloud/kms` añadido al API.
5. Presupuesto: ≈ 3–4 POL de despliegue, más el **stake** (obligatorio, ERC-7562) y el **depósito** del paymaster, y el BEZ de la bóveda.

## Amoy (80002), pruebas

Requisitos que no se cumplían en la máquina donde se preparó esto: una **clave de pruebas con POL de Amoy** (faucet) y un **RPC de Amoy
alcanzable** (`rpc-amoy.polygon.technology` no resolvía desde allí; vale cualquier otro RPC de Amoy).

BEZ solo existe en Polygon mainnet, así que en Amoy se usa un ERC-20 de pruebas cualquiera como `BEZ_TOKEN`.

```bash
cd smart-contracts
export AMOY_RPC_URL=<rpc de Amoy>
export BEZ_TOKEN=<ERC-20 de pruebas en Amoy>
export GAS_TANK_SIGNER=<dirección de la clave de verificación de pruebas>
export GAS_TANK_ADMIN=<tu dirección de pruebas>           # en 80002 se admite una EOA
# 1) simulación
forge script script/DeployGasTank.s.sol --rpc-url $AMOY_RPC_URL --sender <tu dirección>
# 2) despliegue (la clave NO va en el entorno: keystore de Foundry o Ledger)
forge script script/DeployGasTank.s.sol --rpc-url $AMOY_RPC_URL --account <keystore> --broadcast
```

El script comprueba que el EntryPoint tenga código en la cadena; si el canónico no está en Amoy, falla en claro antes de enviar nada.

## Polygon (137), producción

```bash
cd smart-contracts
export POLYGON_RPC_URL=https://polygon-bor-rpc.publicnode.com
export BEZ_TOKEN=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
export GAS_TANK_ADMIN=<multisig con umbral >= 2>
export GAS_TANK_SIGNER=<dirección de la clave KMS>
# 1) simulación (no envía nada)
forge script script/DeployGasTank.s.sol --rpc-url $POLYGON_RPC_URL --sender <deployer>
# 2) despliegue real, firmado por ti con keystore o Ledger
forge script script/DeployGasTank.s.sol --rpc-url $POLYGON_RPC_URL --account <keystore> --broadcast --verify
```

### Después del despliegue (lo firma el admin multisig)

1. `paymaster.addStake(unstakeDelaySec)` con value. Sin stake, los bundlers rechazan las UserOps (el paymaster lee su almacenamiento).
2. `paymaster.deposit()` con value: el gas que se patrocina. Empezar con poco.
3. `vault.setFeeRule(<RWAFactory>, <selector de tokenizeAsset>, 100e18)`. RWAFactory de activos: `0xa7e6656eFA45EB59ca247aa15F883330692C0d9A`.
4. Transferir BEZ a la bóveda (el tope diario del contrato limita lo que puede salir por día).
5. API: `GAS_TANK_CHAIN_ID=137`, `GAS_TANK_ENTRYPOINT`, `GAS_TANK_PAYMASTER`, `GAS_TANK_VAULT`, `GAS_PAYMASTER_KMS_KEY`.
   El conciliador arranca solo con estas variables; `GAS_TANK_START_BLOCK` = bloque del despliegue.
6. Cargar la política de la primera organización en `gas_tank_policies` (con KYB verificado) y probar con **una** UserOp de importe pequeño.
7. Actualizar `deployments/137.json` y la tabla de contratos de CLAUDE.md. CLAUDE.md pide confirmación expresa antes de tocar direcciones.

### Marcha atrás

`paymaster.setPaused(true)` y `vault.setPaused(true)` detienen el patrocinio al instante; `suspendOrg` lo corta por organización;
`setSigner(<clave>, false)` revoca la clave de verificación; `paymaster.withdrawTo` y `vault.rescue` recuperan los fondos (solo el admin).
