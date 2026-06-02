// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/automotive/AutoPartsRegistry.sol";

contract AutoPartsRegistryTest is Test {
    AutoPartsRegistry registry;
    address admin = address(1);
    address inspector = address(2);
    address entity1 = address(3);
    address entity2 = address(4);

    function setUp() public {
        vm.startPrank(admin);
        registry = new AutoPartsRegistry(admin);
        registry.grantRole(registry.INSPECTOR_ROLE(), inspector);
        vm.stopPrank();
    }

    function testRegisterPart() public {
        vm.startPrank(admin);
        uint256 id = registry.registerPart("BRK-001", "Brake Pad", "BATCH-01");
        vm.stopPrank();

        assertEq(registry.totalParts(), 1);
        (string memory serial,,,,,,, ) = registry.parts(id);
        assertEq(keccak256(bytes(serial)), keccak256("BRK-001"));
    }

    function testRegisterEmptySerialReverts() public {
        vm.startPrank(admin);
        vm.expectRevert("Serial required");
        registry.registerPart("", "Brake Pad", "BATCH-01");
        vm.stopPrank();
    }

    function testVerifyAuthenticity() public {
        vm.startPrank(admin);
        uint256 id = registry.registerPart("ECU-001", "ECU Module", "BATCH-02");
        vm.stopPrank();

        vm.startPrank(inspector);
        registry.verifyAuthenticity(id);
        vm.stopPrank();

        (,,,,, bool verified,,) = registry.parts(id);
        assertTrue(verified);
    }

    function testTransferCustody() public {
        vm.startPrank(admin);
        uint256 id = registry.registerPart("BAT-001", "Battery Pack", "BATCH-03");
        vm.stopPrank();

        bytes32 proof = keccak256(abi.encodePacked("temp:22C,humidity:45%"));

        vm.startPrank(entity1);
        registry.transferCustody(id, entity2, proof);
        vm.stopPrank();

        assertEq(registry.getCustodyLength(id), 1);
    }

    function testIssueRecall() public {
        vm.startPrank(admin);
        registry.issueRecall("BATCH-DEFECT-01", "Torque converter defect");
        vm.stopPrank();

        assertTrue(registry.recalledBatches("BATCH-DEFECT-01"));
        assertEq(registry.totalRecalls(), 1);
    }

    function testDuplicateRecallReverts() public {
        vm.startPrank(admin);
        registry.issueRecall("BATCH-DUP", "Defect A");
        vm.expectRevert("Already recalled");
        registry.issueRecall("BATCH-DUP", "Defect B");
        vm.stopPrank();
    }

    function testMarkPartRecalled() public {
        vm.startPrank(admin);
        uint256 id = registry.registerPart("TRN-001", "Transmission", "BATCH-04");
        registry.markPartRecalled(id, "Gear slip");
        vm.stopPrank();

        assertTrue(registry.isPartRecalled(id));
        (,,,,, bool verified, bool recalled,) = registry.parts(id);
        assertTrue(recalled);
        assertFalse(verified); // verification cleared on recall
    }

    function testVerifyRecalledPartReverts() public {
        vm.startPrank(admin);
        uint256 id = registry.registerPart("SEN-001", "Sensor Array", "BATCH-05");
        registry.markPartRecalled(id, "Calibration fault");
        vm.stopPrank();

        vm.startPrank(inspector);
        vm.expectRevert("Part is recalled");
        registry.verifyAuthenticity(id);
        vm.stopPrank();
    }

    function testCustodyOnRecalledPartReverts() public {
        vm.startPrank(admin);
        uint256 id = registry.registerPart("AIR-001", "Air Filter", "BATCH-06");
        registry.markPartRecalled(id, "Contamination");
        vm.stopPrank();

        vm.startPrank(entity1);
        vm.expectRevert("Part is recalled");
        registry.transferCustody(id, entity2, bytes32(0));
        vm.stopPrank();
    }
}
