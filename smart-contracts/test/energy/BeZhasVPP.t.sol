// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/energy/BeZhasVPP.sol";

contract BeZhasVPPTest is Test {
    BeZhasVPP vpp;
    address admin    = address(1);
    address operator = address(2);
    address owner    = address(3);
    address stranger = address(4);

    bytes32 constant NODE = keccak256("n4");
    bytes32 constant JOB  = keccak256("scada_job_1");

    function setUp() public {
        vm.startPrank(admin);
        vpp = new BeZhasVPP(admin);
        vpp.grantRole(vpp.OPERATOR_ROLE(), operator);
        vm.stopPrank();
    }

    function testEnrollAsset() public {
        vm.prank(operator);
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.BATTERY, 100);

        (address o,, uint256 cap, bool enrolled,, bool exists) = vpp.assets(NODE);
        assertEq(o, owner);
        assertEq(cap, 100);
        assertTrue(enrolled);
        assertTrue(exists);
        assertEq(vpp.totalEnrolledCapacityKw(), 100);
    }

    function testEnrollDuplicateReverts() public {
        vm.startPrank(operator);
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.BATTERY, 100);
        vm.expectRevert("Asset exists");
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.BATTERY, 50);
        vm.stopPrank();
    }

    function testEnrollUnauthorizedReverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.BATTERY, 100);
    }

    function testSetEnrollmentAdjustsCapacity() public {
        vm.startPrank(operator);
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.LOAD, 80);
        assertEq(vpp.totalEnrolledCapacityKw(), 80);

        vpp.setEnrollment(NODE, false);
        assertEq(vpp.totalEnrolledCapacityKw(), 0);

        vpp.setEnrollment(NODE, true);
        assertEq(vpp.totalEnrolledCapacityKw(), 80);
        vm.stopPrank();
    }

    function testLogCommandAccruesFlexibility() public {
        vm.startPrank(operator);
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.BATTERY, 100);
        vpp.logCommand(JOB, NODE, "CHARGE_BATTERY", keccak256("params"), 25);
        vm.stopPrank();

        assertEq(vpp.flexibilityOf(NODE), 25);
        assertEq(vpp.totalDispatchedKwh(), 25);

        (,,,, uint256 dispatched,) = vpp.assets(NODE);
        assertEq(dispatched, 25);

        (bytes32 nodeId, string memory command,, uint256 energyKwh, address op,, bool exists) = vpp.commands(JOB);
        assertEq(nodeId, NODE);
        assertEq(command, "CHARGE_BATTERY");
        assertEq(energyKwh, 25);
        assertEq(op, operator);
        assertTrue(exists);
    }

    function testLogDuplicateJobReverts() public {
        vm.startPrank(operator);
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.BATTERY, 100);
        vpp.logCommand(JOB, NODE, "CHARGE_BATTERY", bytes32(0), 10);
        vm.expectRevert("Job logged");
        vpp.logCommand(JOB, NODE, "DISCHARGE_BATTERY", bytes32(0), 5);
        vm.stopPrank();
    }

    function testLogCommandRevertsIfNotEnrolled() public {
        vm.prank(operator);
        vm.expectRevert("Asset not enrolled");
        vpp.logCommand(JOB, NODE, "CHARGE_BATTERY", bytes32(0), 10);
    }

    function testLogCommandRevertsIfUnenrolled() public {
        vm.startPrank(operator);
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.BATTERY, 100);
        vpp.setEnrollment(NODE, false);
        vm.expectRevert("Asset not enrolled");
        vpp.logCommand(JOB, NODE, "CHARGE_BATTERY", bytes32(0), 10);
        vm.stopPrank();
    }

    function testLogCommandUnauthorizedReverts() public {
        vm.prank(operator);
        vpp.enrollAsset(NODE, owner, BeZhasVPP.AssetKind.BATTERY, 100);
        vm.prank(stranger);
        vm.expectRevert();
        vpp.logCommand(JOB, NODE, "CHARGE_BATTERY", bytes32(0), 10);
    }
}
