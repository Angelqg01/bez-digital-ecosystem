// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {HealthRecordSBT} from "../../src/health/HealthRecordSBT.sol";

contract HealthRecordSBTTest is Test {
    HealthRecordSBT public sbt;
    address public admin = address(1);
    address public hospital = address(2);
    address public patient = address(3);
    address public doctor = address(4);
    address public erSystem = address(5);
    address public unauthorized = address(6);

    function setUp() public {
        vm.startPrank(admin);
        sbt = new HealthRecordSBT();
        sbt.grantRole(sbt.HOSPITAL_ROLE(), hospital);
        sbt.grantRole(sbt.EMERGENCY_ROLE(), erSystem);
        vm.stopPrank();
    }

    function test_MintMedRecord() public {
        vm.prank(hospital);
        uint256 tokenId = sbt.mintMedRecord("PAT-001", keccak256("data"), keccak256("consent"), patient);

        assertEq(sbt.ownerOf(tokenId), patient);
        HealthRecordSBT.PatientRecord memory rec = sbt.getRecord(tokenId);
        assertEq(rec.guardian, patient);
        assertEq(keccak256(bytes(rec.patientId)), keccak256(bytes("PAT-001")));
    }

    function test_MintRevertsUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        sbt.mintMedRecord("PAT-002", keccak256("data"), keccak256("consent"), patient);
    }

    function test_GrantAccess() public {
        vm.prank(hospital);
        uint256 tokenId = sbt.mintMedRecord("PAT-001", keccak256("data"), keccak256("consent"), patient);

        string[] memory scopes = new string[](2);
        scopes[0] = "ECG";
        scopes[1] = "Lab";

        vm.prank(patient);
        sbt.grantAccess(tokenId, doctor, scopes, block.timestamp + 30 days);

        assertEq(sbt.getAccessLogCount(tokenId), 1);
    }

    function test_GrantAccessRevertsNotPatient() public {
        vm.prank(hospital);
        uint256 tokenId = sbt.mintMedRecord("PAT-001", keccak256("data"), keccak256("consent"), patient);

        string[] memory scopes = new string[](1);
        scopes[0] = "ECG";

        vm.prank(unauthorized);
        vm.expectRevert("HealthRecordSBT: not patient");
        sbt.grantAccess(tokenId, doctor, scopes, block.timestamp + 30 days);
    }

    function test_RevokeAllAccess() public {
        vm.prank(hospital);
        uint256 tokenId = sbt.mintMedRecord("PAT-001", keccak256("data"), keccak256("consent"), patient);

        vm.prank(patient);
        sbt.revokeAllAccess(tokenId);

        HealthRecordSBT.PatientRecord memory rec = sbt.getRecord(tokenId);
        assertEq(uint(rec.status), uint(HealthRecordSBT.RecordStatus.REVOKED));
    }

    function test_EmergencyAccess() public {
        vm.prank(hospital);
        uint256 tokenId = sbt.mintMedRecord("PAT-001", keccak256("data"), keccak256("consent"), patient);

        vm.prank(erSystem);
        sbt.emergencyAccess(tokenId, doctor);

        HealthRecordSBT.PatientRecord memory rec = sbt.getRecord(tokenId);
        assertEq(uint(rec.status), uint(HealthRecordSBT.RecordStatus.EMERGENCY_OVERRIDE));
    }

    function test_SoulboundBlocksTransfer() public {
        vm.prank(hospital);
        uint256 tokenId = sbt.mintMedRecord("PAT-001", keccak256("data"), keccak256("consent"), patient);

        vm.prank(patient);
        vm.expectRevert("HealthRecordSBT: soulbound");
        sbt.transferFrom(patient, unauthorized, tokenId);
    }

    function test_UpdateDataHash() public {
        vm.prank(hospital);
        uint256 tokenId = sbt.mintMedRecord("PAT-001", keccak256("data"), keccak256("consent"), patient);

        bytes32 newHash = keccak256("updated data");
        vm.prank(hospital);
        sbt.updateDataHash(tokenId, newHash);

        HealthRecordSBT.PatientRecord memory rec = sbt.getRecord(tokenId);
        assertEq(rec.dataHash, newHash);
    }
}
