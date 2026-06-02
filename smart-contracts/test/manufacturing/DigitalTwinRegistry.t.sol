// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/manufacturing/DigitalTwinRegistry.sol";

contract DigitalTwinRegistryTest is Test {
    DigitalTwinRegistry dtr;
    address operator = address(0xA1);
    address oracle   = address(0xA2);
    address other    = address(0xB3);

    function setUp() public {
        dtr = new DigitalTwinRegistry();
        dtr.grantRole(dtr.OPERATOR_ROLE(), operator);
        dtr.grantRole(dtr.ORACLE_ROLE(), oracle);
    }

    function testMintTwin() public {
        vm.startPrank(operator);
        uint256 id = dtr.mintTwin("HAAS-500-A1", "CNC Lathe HL-500", "CNC_MACHINE");
        vm.stopPrank();

        (string memory serial, string memory name, string memory ttype,, uint256 createdAt, bool active, uint256 health) = dtr.twins(id);
        assertEq(serial, "HAAS-500-A1");
        assertEq(name, "CNC Lathe HL-500");
        assertEq(ttype, "CNC_MACHINE");
        assertTrue(active);
        assertEq(health, 100);
        assertGt(createdAt, 0);
    }

    function testMintEmptySerialReverts() public {
        vm.startPrank(operator);
        vm.expectRevert("Empty serial");
        dtr.mintTwin("", "Name", "TYPE");
        vm.stopPrank();
    }

    function testLogTelemetry() public {
        vm.startPrank(operator);
        uint256 twinId = dtr.mintTwin("SER-001", "Machine A", "CNC");
        vm.stopPrank();

        vm.startPrank(oracle);
        dtr.logTelemetry(twinId, 4200, 1200, 3400, keccak256("sensor-data"));
        vm.stopPrank();

        assertEq(dtr.totalTelemetryLogs(), 1);
        (uint256 tid, uint256 temp, uint256 vib, uint256 rpm,,) = dtr.telemetryLogs(0);
        assertEq(tid, twinId);
        assertEq(temp, 4200);
        assertEq(vib, 1200);
        assertEq(rpm, 3400);
    }

    function testLogTelemetryDecommissionedReverts() public {
        vm.startPrank(operator);
        uint256 twinId = dtr.mintTwin("SER-002", "Machine B", "PRESS");
        dtr.decommission(twinId);
        vm.stopPrank();

        vm.startPrank(oracle);
        vm.expectRevert("Twin decommissioned");
        dtr.logTelemetry(twinId, 4200, 1200, 0, keccak256("data"));
        vm.stopPrank();
    }

    function testUpdateHealth() public {
        vm.startPrank(operator);
        uint256 twinId = dtr.mintTwin("SER-003", "Machine C", "ROBOT");
        vm.stopPrank();

        vm.startPrank(oracle);
        dtr.updateHealth(twinId, 72);
        vm.stopPrank();

        (,,,,,, uint256 health) = dtr.twins(twinId);
        assertEq(health, 72);
    }

    function testUpdateHealthOver100Reverts() public {
        vm.startPrank(operator);
        uint256 twinId = dtr.mintTwin("SER-004", "Machine D", "SMT");
        vm.stopPrank();

        vm.startPrank(oracle);
        vm.expectRevert("Score must be 0-100");
        dtr.updateHealth(twinId, 101);
        vm.stopPrank();
    }

    function testDecommission() public {
        vm.startPrank(operator);
        uint256 twinId = dtr.mintTwin("SER-005", "Machine E", "MOLD");
        dtr.decommission(twinId);
        vm.stopPrank();

        (,,,,, bool active,) = dtr.twins(twinId);
        assertFalse(active);
    }

    function testDecommissionAlreadyDecommissionedReverts() public {
        vm.startPrank(operator);
        uint256 twinId = dtr.mintTwin("SER-006", "Machine F", "BELT");
        dtr.decommission(twinId);
        vm.expectRevert("Already decommissioned");
        dtr.decommission(twinId);
        vm.stopPrank();
    }

    function testUnauthorizedMintReverts() public {
        vm.startPrank(other);
        vm.expectRevert();
        dtr.mintTwin("SER-X", "X", "X");
        vm.stopPrank();
    }
}
