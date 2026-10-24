// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {PaymasterEntryPointTest} from "./PaymasterEntryPoint.t.sol";
import {GasTankVault} from "../src/gas/GasTankVault.sol";

/// Las mismas pruebas de PaymasterEntryPointTest, pero contra el EntryPoint v0.8 REAL de Polygon y su estado en un fork
/// (solo lecturas: no se envía nada a la red). Se saltan si no hay RPC:
///   POLYGON_FORK_RPC=https://polygon-bor-rpc.publicnode.com FOUNDRY_PROFILE=aa forge test --match-contract PaymasterPolygonFork
contract PaymasterPolygonForkTest is PaymasterEntryPointTest {
    address constant ENTRYPOINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;
    address constant BEZ_POLYGON = 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8;

    function _deployEntryPoint() internal override returns (EntryPoint) {
        string memory rpc = vm.envOr("POLYGON_FORK_RPC", string(""));
        if (bytes(rpc).length == 0) vm.skip(true);
        vm.createSelectFork(rpc);
        require(ENTRYPOINT_V08.code.length > 0, "el EntryPoint v0.8 no existe en este fork");
        return EntryPoint(payable(ENTRYPOINT_V08));
    }

    /// La bóveda con el token BEZ REAL de Polygon: transfer, saldo y comportamiento de un ERC-20 de verdad.
    function test_vaultWithRealBezOnPolygon() public {
        IERC20 bez = IERC20(BEZ_POLYGON);
        GasTankVault vault = new GasTankVault(bez, admin, vm.addr(signerPk), 1000 ether);
        deal(BEZ_POLYGON, address(vault), 1000 ether);
        address factory = makeAddr("rwaFactory");
        bytes4 sel = bytes4(keccak256("tokenizeAsset(string,uint8,string,string,uint256,uint256,uint256,uint256,string)"));
        vm.prank(admin);
        vault.setFeeRule(factory, sel, 100 ether);

        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes32 h = vault.getHash(ORG, address(account), factory, sel, 100 ether, until, bytes32("fork-1"));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h)));
        uint256 before = bez.balanceOf(address(account));
        vm.prank(address(account));
        vault.pullProtocolFee(ORG, factory, sel, 100 ether, until, bytes32("fork-1"), abi.encodePacked(r, s, v));
        assertEq(bez.balanceOf(address(account)) - before, 100 ether, "el BEZ real llega exactamente");
        assertEq(bez.balanceOf(address(vault)), 900 ether);
    }
}
