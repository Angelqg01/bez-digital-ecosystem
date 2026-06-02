// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BEZCoinV2} from "../src/tokens/BEZCoinV2.sol";
import {BeZhasBridgeL2} from "../src/core/BeZhasBridgeL2.sol";

contract BridgeAccessControlTest is Test {
    address multisig = address(0xA11CE);
    address user = address(0xBEEF);
    address relayer = address(0xCAFE);
    BEZCoinV2 bez;
    BeZhasBridgeL2 bridge;

    function setUp() public {
        bez = new BEZCoinV2(multisig);
        bridge = new BeZhasBridgeL2(address(bez), multisig);
        vm.startPrank(multisig);
        bridge.grantRole(bridge.BRIDGE_RELAYER_ROLE(), relayer);
        bez.grantRole(bez.BRIDGE_ROLE(), address(bridge));
        bez.grantRole(bez.MINTER_ROLE(), address(bridge));
        vm.stopPrank();
        vm.deal(user, 100 ether);
    }

    function testOnlyRelayerCanFinalizeDeposit() public {
        vm.expectRevert();
        bridge.finalizeDeposit(user, 100 ether, bytes32("tx"));
        vm.prank(relayer);
        bridge.finalizeDeposit(user, 100 ether, bytes32("tx"));
        // Check balance
        assertEq(bez.balanceOf(user), 100 ether);
    }

    function testOnlyMultisigCanGrantRoles() public {
        bytes32 relayerRole = bridge.BRIDGE_RELAYER_ROLE();
        vm.expectRevert();
        bridge.grantRole(relayerRole, user);
        vm.prank(multisig);
        bridge.grantRole(relayerRole, user);
    }

    function testInitiateWithdrawalBurnsTokens() public {
        vm.prank(relayer);
        bridge.finalizeDeposit(user, 50 ether, bytes32("tx2"));
        vm.prank(user);
        bez.approve(address(bridge), 50 ether);
        vm.prank(user);
        bridge.initiateWithdrawal(multisig, 50 ether);
        assertEq(bez.balanceOf(user), 0);
    }
}
