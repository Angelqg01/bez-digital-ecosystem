// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {WrappedBEZ} from "../src/core/WrappedBEZ.sol";

contract WrappedBEZTest is Test {
    address admin = address(0xA11CE);
    address bridge = address(0xB01D);
    address user = address(0xBEEF);
    WrappedBEZ wbez;

    function setUp() public {
        vm.startPrank(admin);
        wbez = new WrappedBEZ(admin);
        wbez.grantRole(wbez.BRIDGE_ROLE(), bridge);
        vm.stopPrank();
    }

    function testInitialState() public view {
        assertEq(wbez.name(), "Wrapped BeZhas Coin");
        assertEq(wbez.symbol(), "wBEZ");
        assertEq(wbez.totalSupply(), 0);
    }

    function testBridgeMint() public {
        vm.prank(bridge);
        wbez.bridgeMint(user, 1000 ether, bytes32("srcTx1"));
        assertEq(wbez.balanceOf(user), 1000 ether);
        assertEq(wbez.totalSupply(), 1000 ether);
    }

    function testBridgeMintOnlyBridgeRole() public {
        vm.expectRevert();
        vm.prank(user);
        wbez.bridgeMint(user, 100 ether, bytes32("bad"));
    }

    function testBridgeBurn() public {
        vm.prank(bridge);
        wbez.bridgeMint(user, 500 ether, bytes32("srcTx2"));
        vm.prank(bridge);
        wbez.bridgeBurn(user, 200 ether, 1); // targetChainId = 1
        assertEq(wbez.balanceOf(user), 300 ether);
    }

    function testBridgeBurnOnlyBridgeRole() public {
        vm.prank(bridge);
        wbez.bridgeMint(user, 100 ether, bytes32("srcTx3"));
        vm.expectRevert();
        vm.prank(user);
        wbez.bridgeBurn(user, 50 ether, 1);
    }

    function testBurnForBridge() public {
        vm.prank(bridge);
        wbez.bridgeMint(user, 1000 ether, bytes32("srcTx4"));
        vm.prank(user);
        wbez.burnForBridge(400 ether, 42161); // Bezhas L2 chain id
        assertEq(wbez.balanceOf(user), 600 ether);
    }

    function testCannotMintToZeroAddress() public {
        vm.expectRevert("Invalid recipient");
        vm.prank(bridge);
        wbez.bridgeMint(address(0), 100 ether, bytes32("bad"));
    }

    function testCannotMintZeroAmount() public {
        vm.expectRevert("Amount must be > 0");
        vm.prank(bridge);
        wbez.bridgeMint(user, 0, bytes32("bad"));
    }

    function testCannotBurnZeroAmount() public {
        vm.expectRevert("Amount must be > 0");
        vm.prank(user);
        wbez.burnForBridge(0, 1);
    }
}
