// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {BeZhasVerifyingPaymaster} from "../src/gas/BeZhasVerifyingPaymaster.sol";
import {GasTankVault} from "../src/gas/GasTankVault.sol";

/**
 * @title ConfigureGasTank
 * @notice Pasos del admin tras DeployGasTank cuando el admin es una EOA (SOLO Amoy / pruebas): stake y depósito del
 *         paymaster, regla de comisión y fondos de la bóveda. En Polygon el admin es un multisig: allí estas mismas
 *         llamadas se envían como una transacción de Safe, no con este script (se niega a correr en 137).
 *
 * Variables: GAS_TANK_PAYMASTER, GAS_TANK_VAULT (obligatorias).
 *   GAS_TANK_STAKE_WEI / GAS_TANK_UNSTAKE_DELAY_SEC   stake del paymaster (por defecto 0 = no se hace; delay 86400)
 *   GAS_TANK_DEPOSIT_WEI                              depósito para patrocinar gas (por defecto 0)
 *   GAS_TANK_FEE_TARGET / GAS_TANK_FEE_SELECTOR / GAS_TANK_FEE_CAP   regla de comisión (si falta el destino, no se crea)
 *   GAS_TANK_VAULT_BEZ                                BEZ que se transfiere de la cuenta que firma a la bóveda (0 = no)
 *
 *   forge script script/ConfigureGasTank.s.sol --tc ConfigureGasTank --rpc-url $AMOY_RPC --sender <admin> -vv        (simula)
 *   forge script script/ConfigureGasTank.s.sol --tc ConfigureGasTank --rpc-url $AMOY_RPC --account <keystore> --broadcast
 */
contract ConfigureGasTank is Script {
    function run() external {
        require(block.chainid != 137, "En Polygon el admin es un multisig: envia estas llamadas como transaccion de Safe");
        BeZhasVerifyingPaymaster pm = BeZhasVerifyingPaymaster(vm.envAddress("GAS_TANK_PAYMASTER"));
        GasTankVault vault = GasTankVault(vm.envAddress("GAS_TANK_VAULT"));

        uint256 stake = vm.envOr("GAS_TANK_STAKE_WEI", uint256(0));
        uint32 delay = uint32(vm.envOr("GAS_TANK_UNSTAKE_DELAY_SEC", uint256(86400)));
        uint256 deposit = vm.envOr("GAS_TANK_DEPOSIT_WEI", uint256(0));
        address feeTarget = vm.envOr("GAS_TANK_FEE_TARGET", address(0));
        bytes4 feeSelector = bytes4(vm.envOr("GAS_TANK_FEE_SELECTOR", bytes32(0)));
        uint256 feeCap = vm.envOr("GAS_TANK_FEE_CAP", uint256(0));
        uint256 vaultBez = vm.envOr("GAS_TANK_VAULT_BEZ", uint256(0));

        require(pm.owner() == vault.owner(), "paymaster y boveda con distinto owner");
        console.log("owner (debe firmar):", pm.owner());

        vm.startBroadcast();
        require(msg.sender == pm.owner(), "la cuenta que firma no es el owner");
        if (stake > 0) pm.addStake{value: stake}(delay);
        if (deposit > 0) pm.deposit{value: deposit}();
        if (feeTarget != address(0)) {
            require(feeSelector != bytes4(0) && feeCap > 0, "regla de comision incompleta");
            vault.setFeeRule(feeTarget, feeSelector, feeCap);
        }
        if (vaultBez > 0) IERC20(address(vault.bez())).transfer(address(vault), vaultBez);
        vm.stopBroadcast();

        console.log("deposito del paymaster en el EntryPoint:", pm.getDeposit());
        console.log("BEZ en la boveda:", IERC20(address(vault.bez())).balanceOf(address(vault)));
        if (feeTarget != address(0)) console.log("regla de comision (tope):", vault.feeCap(feeTarget, feeSelector));
    }
}
