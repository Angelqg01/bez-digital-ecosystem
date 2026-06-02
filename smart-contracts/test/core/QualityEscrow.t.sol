// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {QualityEscrow} from "../../src/core/QualityEscrow.sol";

contract QualityEscrowTest is Test {
    QualityEscrow public escrow;
    address public admin = address(1);
    address public edgeNode = address(2);
    address public unauthorizedUser = address(3);

    function setUp() public {
        vm.startPrank(admin);
        escrow = new QualityEscrow();
        escrow.grantRole(escrow.EDGE_NODE_ROLE(), edgeNode);
        vm.stopPrank();
    }

    function test_RegisterSensorDataSuccess() public {
        vm.prank(edgeNode);
        bool success = escrow.registerSensorData("MSKU1811882", -18, "VERIFIED");
        
        assertTrue(success);

        QualityEscrow.SensorData memory data = escrow.getLatestData("MSKU1811882");
        assertEq(data.containerId, "MSKU1811882");
        assertEq(data.temperature, -18);
        assertEq(data.status, "VERIFIED");
    }

    function test_RegisterSensorDataRevertsUnauthorized() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert due to AccessControl
        escrow.registerSensorData("MSKU1811882", -18, "VERIFIED");
    }
}
