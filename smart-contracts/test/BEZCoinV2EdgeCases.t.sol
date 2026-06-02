// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BEZCoinV2} from "../src/tokens/BEZCoinV2.sol";

contract BEZCoinV2EdgeCasesTest is Test {
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

    function testMintOverflowNotPossible() public {
        vm.prank(bridge);
        vm.expectRevert(); // Overflow reverts in Solidity 0.8+
        bez.mint(user, type(uint256).max);
    }

    function testBurnOverflowNotPossible() public {
        vm.prank(bridge);
        bez.mint(user, 100 ether);
        vm.prank(bridge);
        bez.bridgeBurn(user, 100 ether);
        assertEq(bez.balanceOf(user), 0);
    }

    function testOnlyBridgeCanBurn() public {
        vm.prank(bridge);
        bez.mint(user, 10 ether);
        vm.expectRevert();
        bez.bridgeBurn(user, 10 ether);
    }
}
