// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {BeZhasVerifyingPaymaster} from "../src/gas/BeZhasVerifyingPaymaster.sol";
import {GasTankVault} from "../src/gas/GasTankVault.sol";
import {IEntryPointV8} from "../src/gas/IEntryPointV8.sol";

interface ISafeLike {
    function getThreshold() external view returns (uint256);
}

/**
 * @title DeployGasTank
 * @notice Despliega BeZhasVerifyingPaymaster y GasTankVault. NO mueve fondos: ni deposita en el EntryPoint ni
 *         fondea la bóveda ni configura reglas; eso lo hace el `admin` (multisig) después, con el checklist que
 *         imprime este script.
 *
 * La clave de despliegue NO va en el entorno: se pasa a Foundry con `--account <keystore>` o `--ledger`.
 *
 * Variables (todas obligatorias salvo las marcadas):
 *   GAS_TANK_ADMIN                 owner de ambos contratos. Multisig; en Polygon (137) se exige contrato con umbral >= 2
 *   GAS_TANK_SIGNER                dirección de la clave de verificación (KMS), la que firma paymasterAndData y vouchers
 *   BEZ_TOKEN                      token BEZ de la cadena
 *   GAS_TANK_ENTRYPOINT            (opc.) por defecto el EntryPoint v0.8 canónico
 *   GAS_TANK_MAX_COST_PER_OP_WEI   (opc.) tope duro por UserOp del paymaster, por defecto 0,05 POL
 *   GAS_TANK_VAULT_DAILY_CAP       (opc.) tope diario de la bóveda en BEZ (wei), por defecto 1.000 BEZ
 *   GAS_TANK_ALLOW_WEAK_ADMIN      (opc.) "true" para permitir un admin EOA o con umbral 1 (SOLO pruebas)
 *
 * Simulación (sin enviar nada):
 *   forge script script/DeployGasTank.s.sol --rpc-url $POLYGON_RPC_URL --sender <deployer>
 * Despliegue real:
 *   forge script script/DeployGasTank.s.sol --rpc-url $POLYGON_RPC_URL --account <keystore> --broadcast --verify
 */
contract DeployGasTank is Script {
    address constant ENTRYPOINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    function run() external returns (BeZhasVerifyingPaymaster paymaster, GasTankVault vault) {
        address admin = vm.envAddress("GAS_TANK_ADMIN");
        address signer = vm.envAddress("GAS_TANK_SIGNER");
        address bez = vm.envAddress("BEZ_TOKEN");
        address entryPoint = vm.envOr("GAS_TANK_ENTRYPOINT", ENTRYPOINT_V08);
        uint256 maxCostPerOp = vm.envOr("GAS_TANK_MAX_COST_PER_OP_WEI", uint256(0.05 ether));
        uint256 vaultDailyCap = vm.envOr("GAS_TANK_VAULT_DAILY_CAP", uint256(1000 ether));
        bool allowWeak = vm.envOr("GAS_TANK_ALLOW_WEAK_ADMIN", false);

        require(admin != address(0) && signer != address(0), "admin y signer obligatorios");
        require(entryPoint.code.length > 0, "EntryPoint sin codigo en esta cadena");
        require(bez.code.length > 0, "BEZ sin codigo en esta cadena");
        require(maxCostPerOp > 0 && vaultDailyCap > 0, "topes a cero");
        require(admin != signer, "el admin y la clave de verificacion deben ser distintos");

        // En mainnet el owner controla fondos (depositos, reglas de comision, rescate): que sea un multisig de verdad.
        if (block.chainid == 137 && !allowWeak) {
            require(admin.code.length > 0, "en Polygon el admin debe ser un contrato multisig, no una EOA");
            uint256 threshold = ISafeLike(admin).getThreshold();
            require(threshold >= 2, "el multisig admin debe exigir al menos 2 firmas");
        }

        console.log("=== Gas Tank: despliegue ===");
        console.log("chainId:", block.chainid);
        console.log("admin (owner):", admin);
        console.log("signer:", signer);
        console.log("EntryPoint:", entryPoint);
        console.log("BEZ:", bez);

        vm.startBroadcast();
        paymaster = new BeZhasVerifyingPaymaster(IEntryPointV8(entryPoint), admin, signer, maxCostPerOp);
        vault = new GasTankVault(IERC20(bez), admin, signer, vaultDailyCap);
        vm.stopBroadcast();

        // Comprobaciones tras el despliegue (en simulación también se ejecutan).
        require(paymaster.owner() == admin && vault.owner() == admin, "owner distinto del admin");
        require(paymaster.isSigner(signer) && vault.isSigner(signer), "signer no registrado");
        require(address(paymaster.entryPoint()) == entryPoint, "EntryPoint distinto");
        require(address(vault.bez()) == bez, "BEZ distinto");

        console.log("BeZhasVerifyingPaymaster:", address(paymaster));
        console.log("GasTankVault:", address(vault));
        console.log("");
        console.log("Siguientes pasos (los firma el admin multisig):");
        console.log(" 1. paymaster.addStake(unstakeDelaySec) con value  (obligatorio: ERC-7562)");
        console.log(" 2. paymaster.deposit() con value                   (el gas que se patrocina)");
        console.log(" 3. vault.setFeeRule(RWAFactory, tokenizeAsset selector, 100 BEZ)");
        console.log(" 4. transferir BEZ a la boveda (tope diario incluido)");
        console.log(" 5. API: GAS_TANK_PAYMASTER / GAS_TANK_VAULT / GAS_TANK_ENTRYPOINT / GAS_TANK_CHAIN_ID / GAS_PAYMASTER_KMS_KEY");
        console.log(" 6. Actualizar deployments/<chainId>.json y la tabla de contratos de CLAUDE.md (con confirmacion)");
    }
}
