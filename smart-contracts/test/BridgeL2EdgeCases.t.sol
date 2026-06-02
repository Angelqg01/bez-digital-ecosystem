// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BeZhasBridgeL2} from "../src/core/BeZhasBridgeL2.sol";
import {BEZCoinV2} from "../src/tokens/BEZCoinV2.sol";

contract BridgeL2EdgeCasesTest is Test {
    address multisig = address(0xA11CE);
    address user = address(0xBEEF);
    address relayer = address(0xCAFE);
    BeZhasBridgeL2 bridge;
    BEZCoinV2 bez;

    function setUp() public {
        bez = new BEZCoinV2(multisig);
        bridge = new BeZhasBridgeL2(address(bez), multisig);
        vm.startPrank(multisig);
        bridge.grantRole(bridge.BRIDGE_RELAYER_ROLE(), relayer);
        bez.grantRole(bez.BRIDGE_ROLE(), address(bridge));
        bez.grantRole(bez.MINTER_ROLE(), address(bridge));
        vm.stopPrank();
    }

    function testFinalizeDepositZeroAmountReverts() public {
        vm.prank(relayer);
        vm.expectRevert();
        bridge.finalizeDeposit(user, 0, bytes32("tx"));
    }

    function testInitiateWithdrawalZeroAmountReverts() public {
        vm.prank(relayer);
        bridge.finalizeDeposit(user, 1 ether, bytes32("tx"));
        vm.prank(user);
        bez.approve(address(bridge), 1 ether);
        vm.prank(user);
        vm.expectRevert();
        bridge.initiateWithdrawal(multisig, 0);
    }

    function testOnlyRelayerCanFinalizeDeposit() public {
        vm.expectRevert();
        bridge.finalizeDeposit(user, 1 ether, bytes32("tx"));
    }
}
