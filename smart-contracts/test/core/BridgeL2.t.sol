// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {BeZhasBridgeL2} from "../../src/core/BeZhasBridgeL2.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";

contract BeZhasBridgeL2Test is Test {
    BeZhasBridgeL2 public bridge;
    BEZCoinV2 public nativeToken;

    address public admin = address(this);
    address public relayer = address(1);
    address public user = address(2);

    function setUp() public {
        // Desplegar el token con admin como administrador inicial
        nativeToken = new BEZCoinV2(admin);

        // Desplegar el puente pasando la dirección del token
        bridge = new BeZhasBridgeL2(address(nativeToken), admin);

        // Dar permisos al puente para Acuñar y Quemar en nombre del token principal
        nativeToken.grantRole(nativeToken.MINTER_ROLE(), address(bridge));
        nativeToken.grantRole(nativeToken.BRIDGE_ROLE(), address(bridge));

        // Dar permisos al "relayer" (Por ej. un nodo LayerZero o el propio Sequencer)
        bridge.grantRole(bridge.BRIDGE_RELAYER_ROLE(), relayer);
    }

    function test_FinalizeDeposit() public {
        bytes32 mockTxHash = keccak256("MockTxHashFromL1");
        uint256 amountToBridge = 1000 * 10 ** 18;

        // Simulamos que el relayer recibe la orden de L1 y acuña en L2
        vm.prank(relayer);
        bridge.finalizeDeposit(user, amountToBridge, mockTxHash);

        // Verificar el balance del usuario en la L2
        assertEq(nativeToken.balanceOf(user), amountToBridge);
    }

    function test_InitiateWithdrawal() public {
        uint256 amountToBridge = 500 * 10 ** 18;

        // Setup: Damos balance inicial al usuario simulando un deposito previo
        vm.prank(relayer);
        bridge.finalizeDeposit(user, amountToBridge, keccak256("InitialDep"));

        // El usuario debe aprobar al puente para quemar sus tokens
        vm.prank(user);
        nativeToken.approve(address(bridge), amountToBridge);

        // El usuario inicia el retiro hacia Ethereum L1
        address l1Destination = address(3);
        vm.prank(user);
        bridge.initiateWithdrawal(l1Destination, amountToBridge);

        // Verificar que los tokens fueron destruidos en la L2
        assertEq(nativeToken.balanceOf(user), 0);
    }

    function test_SecurityRevertIfUnauthorizedRelayer() public {
        address hacker = address(4);

        vm.prank(hacker);
        vm.expectRevert(); // Debe revertir por falta de rol BRIDGE_RELAYER_ROLE
        bridge.finalizeDeposit(user, 1000 * 10 ** 18, keccak256("Hack"));
    }
}
