// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BeZhasL1Bridge} from "../src/bridges/BeZhasL1Bridge.sol";

contract L1BridgeAccessTest is Test {
    address multisig = address(0xA11CE);
    address user = address(0xBEEF);
    address tokenManager = address(0xCAFE);
    BeZhasL1Bridge bridge;

    function setUp() public {
        bridge = new BeZhasL1Bridge(multisig);
        vm.startPrank(multisig);
        bridge.grantRole(bridge.TOKEN_MANAGER_ROLE(), tokenManager);
        vm.stopPrank();
    }

    function testOnlyTokenManagerCanSetTokenSupport() public {
        address token = address(0xDEAD);
        vm.expectRevert();
        bridge.setTokenSupport(token, true);
        vm.prank(tokenManager);
        bridge.setTokenSupport(token, true);
        assertTrue(bridge.supportedTokens(token));
    }

    function testOnlyPauserCanPause() public {
        vm.expectRevert();
        bridge.setPause(true);
        bytes32 pauserRole = bridge.PAUSER_ROLE();
        vm.prank(multisig);
        bridge.grantRole(pauserRole, user);
        vm.prank(user);
        bridge.setPause(true);
        assertTrue(bridge.isPaused());
    }

    function testOnlyMultisigCanGrantRoles() public {
        bytes32 pauserRole = bridge.PAUSER_ROLE();
        vm.expectRevert();
        bridge.grantRole(pauserRole, user);
        vm.prank(multisig);
        bridge.grantRole(pauserRole, user);
    }

    function testOnlyMultisigCanUnlockTokens() public {
        vm.expectRevert();
        bridge.unlockTokens(
            user,
            address(0),
            1,
            keccak256("wid"),
            keccak256("proof")
        );
    }
}
