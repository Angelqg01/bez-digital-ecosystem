// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/manufacturing/PredictiveMaintenanceLog.sol";

contract PredictiveMaintenanceLogTest is Test {
    PredictiveMaintenanceLog pml;
    address technician = address(0xA1);
    address oracle     = address(0xA2);
    address other      = address(0xB3);

    function setUp() public {
        pml = new PredictiveMaintenanceLog();
        pml.grantRole(pml.TECHNICIAN_ROLE(), technician);
        pml.grantRole(pml.ORACLE_ROLE(), oracle);
    }

    function testRegisterEquipment() public {
        vm.startPrank(technician);
        uint256 id = pml.registerEquipment("HAAS-500-A1", "CNC Lathe HL-500");
        vm.stopPrank();

        (string memory serial, string memory name,, uint256 regAt, bool active,) = pml.equipment(id);
        assertEq(serial, "HAAS-500-A1");
        assertEq(name, "CNC Lathe HL-500");
        assertTrue(active);
        assertGt(regAt, 0);
    }

    function testRegisterEmptySerialReverts() public {
        vm.startPrank(technician);
        vm.expectRevert("Empty serial");
        pml.registerEquipment("", "Name");
        vm.stopPrank();
    }

    function testLogSensorReadingNoAlert() public {
        vm.startPrank(technician);
        uint256 eqId = pml.registerEquipment("SER-001", "Machine A");
        vm.stopPrank();

        vm.startPrank(oracle);
        bool alert = pml.logSensorReading(eqId, 5000, 8000, 30000, keccak256("sensor"));
        vm.stopPrank();

        assertFalse(alert);
        assertEq(pml.totalReadings(), 1);
        assertEq(pml.totalAlerts(), 0);
    }

    function testLogSensorReadingWithAlert() public {
        vm.startPrank(technician);
        uint256 eqId = pml.registerEquipment("SER-002", "Machine B");
        vm.stopPrank();

        // Exceed temperature threshold (default 10000 = 100°C)
        vm.startPrank(oracle);
        bool alert = pml.logSensorReading(eqId, 12000, 8000, 30000, keccak256("hot"));
        vm.stopPrank();

        assertTrue(alert);
        assertEq(pml.totalAlerts(), 1);
    }

    function testLogOnDeactivatedReverts() public {
        vm.startPrank(technician);
        uint256 eqId = pml.registerEquipment("SER-003", "Machine C");
        pml.deactivateEquipment(eqId);
        vm.stopPrank();

        vm.startPrank(oracle);
        vm.expectRevert("Equipment deactivated");
        pml.logSensorReading(eqId, 5000, 5000, 5000, keccak256("data"));
        vm.stopPrank();
    }

    function testSetThresholds() public {
        vm.startPrank(technician);
        uint256 eqId = pml.registerEquipment("SER-004", "Machine D");
        pml.setThresholds(eqId, 8000, 10000, 40000);
        vm.stopPrank();

        (uint256 maxT, uint256 maxV, uint256 maxP) = pml.thresholds(eqId);
        assertEq(maxT, 8000);
        assertEq(maxV, 10000);
        assertEq(maxP, 40000);
    }

    function testRecordMaintenance() public {
        vm.startPrank(technician);
        uint256 eqId = pml.registerEquipment("SER-005", "Machine E");
        pml.recordMaintenance(eqId, "Oil change", 500, keccak256("photo-proof"));
        vm.stopPrank();

        assertEq(pml.totalMaintenanceRecords(), 1);
        (uint256 equipId, string memory desc, uint256 cost,, address tech,) = pml.maintenanceRecords(0);
        assertEq(equipId, eqId);
        assertEq(desc, "Oil change");
        assertEq(cost, 500);
        assertEq(tech, technician);
    }

    function testRecordMaintenanceEmptyDescReverts() public {
        vm.startPrank(technician);
        uint256 eqId = pml.registerEquipment("SER-006", "Machine F");
        vm.expectRevert("Empty description");
        pml.recordMaintenance(eqId, "", 100, keccak256("x"));
        vm.stopPrank();
    }

    function testDeactivateEquipment() public {
        vm.startPrank(technician);
        uint256 eqId = pml.registerEquipment("SER-007", "Machine G");
        pml.deactivateEquipment(eqId);
        vm.stopPrank();

        (,,,, bool active,) = pml.equipment(eqId);
        assertFalse(active);
    }

    function testDeactivateAlreadyDeactivatedReverts() public {
        vm.startPrank(technician);
        uint256 eqId = pml.registerEquipment("SER-008", "Machine H");
        pml.deactivateEquipment(eqId);
        vm.expectRevert("Already deactivated");
        pml.deactivateEquipment(eqId);
        vm.stopPrank();
    }
}
