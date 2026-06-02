// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BEZCoinV2} from "../src/tokens/BEZCoinV2.sol";

contract BEZCoinV2AccessTest is Test {
    address multisig = address(0xA11CE);
    address user = address(0xBEEF);
    address bridge = address(0xCAFE);
    BEZCoinV2 bez;

    function setUp() public {
        bez = new BEZCoinV2(multisig);
        vm.startPrank(multisig);
        bez.grantRole(bez.BRIDGE_ROLE(), bridge);
        bez.grantRole(bez.MINTER_ROLE(), bridge);
        vm.stopPrank();
    }

    function testOnlyMinterCanMint() public {
        vm.expectRevert();
        bez.mint(user, 100 ether);
        vm.prank(bridge);
        bez.mint(user, 100 ether);
        assertEq(bez.balanceOf(user), 100 ether);
    }

    function testOnlyBridgeCanBurn() public {
        vm.prank(bridge);
        bez.mint(user, 50 ether);
        vm.expectRevert();
        bez.bridgeBurn(user, 50 ether);
        vm.prank(bridge);
        bez.bridgeBurn(user, 50 ether);
        assertEq(bez.balanceOf(user), 0);
    }

    function testOnlyMultisigCanGrantRoles() public {
        bytes32 bridgeRole = bez.BRIDGE_ROLE();
        vm.expectRevert();
        bez.grantRole(bridgeRole, user);
        vm.prank(multisig);
        bez.grantRole(bridgeRole, user);
    }
}
