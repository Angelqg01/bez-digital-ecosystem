// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/manufacturing/QualityCertificateNFT.sol";

contract QualityCertificateNFTTest is Test {
    QualityCertificateNFT qc;
    address inspector = address(0xA1);
    address other     = address(0xB2);

    function setUp() public {
        qc = new QualityCertificateNFT();
        qc.grantRole(qc.INSPECTOR_ROLE(), inspector);
    }

    function testMintCertificate() public {
        vm.startPrank(inspector);
        uint256 id = qc.mintCertificate("Gear Assembly", "BATCH-001", "ISO 9001", 95);
        vm.stopPrank();

        (string memory product,, string memory std,, uint256 score,, bool valid,) = qc.certificates(id);
        assertEq(product, "Gear Assembly");
        assertEq(std, "ISO 9001");
        assertEq(score, 95);
        assertTrue(valid);
    }

    function testMintEmptyBatchReverts() public {
        vm.startPrank(inspector);
        vm.expectRevert("Empty batchId");
        qc.mintCertificate("Product", "", "ISO 9001", 90);
        vm.stopPrank();
    }

    function testMintScoreOver100Reverts() public {
        vm.startPrank(inspector);
        vm.expectRevert("Score must be 0-100");
        qc.mintCertificate("Product", "BATCH-X", "ISO 9001", 101);
        vm.stopPrank();
    }

    function testLogDefect() public {
        vm.startPrank(inspector);
        uint256 certId = qc.mintCertificate("Panel A3", "BATCH-002", "ISO 14001", 88);
        qc.logDefect(certId, "Micro-crack on edge", 3);
        vm.stopPrank();

        assertEq(qc.totalDefects(), 1);
        assertEq(qc.certDefectCount(certId), 1);
    }

    function testLogDefectBadSeverityReverts() public {
        vm.startPrank(inspector);
        uint256 certId = qc.mintCertificate("X", "BATCH-003", "ASTM", 80);
        vm.expectRevert("Severity must be 1-5");
        qc.logDefect(certId, "test", 0);
        vm.stopPrank();
    }

    function testRevokeCertificate() public {
        vm.startPrank(inspector);
        uint256 certId = qc.mintCertificate("Bracket", "BATCH-004", "ASTM A36", 50);
        qc.revokeCertificate(certId, "Critical fatigue cracks");
        vm.stopPrank();

        (,,,,,,bool valid, string memory reason) = qc.certificates(certId);
        assertFalse(valid);
        assertEq(reason, "Critical fatigue cracks");
    }

    function testRevokeAlreadyRevokedReverts() public {
        vm.startPrank(inspector);
        uint256 certId = qc.mintCertificate("X", "BATCH-005", "ISO", 40);
        qc.revokeCertificate(certId, "reason");
        vm.expectRevert("Already revoked");
        qc.revokeCertificate(certId, "again");
        vm.stopPrank();
    }

    function testRecertify() public {
        vm.startPrank(inspector);
        uint256 certId = qc.mintCertificate("Cell Module", "BATCH-006", "IEC 62133", 72);
        qc.revokeCertificate(certId, "Low score");
        qc.recertify(certId, 91);
        vm.stopPrank();

        (,,,, uint256 score,, bool valid, string memory reason) = qc.certificates(certId);
        assertEq(score, 91);
        assertTrue(valid);
        assertEq(reason, "");
    }

    function testUnauthorizedMintReverts() public {
        vm.startPrank(other);
        vm.expectRevert();
        qc.mintCertificate("X", "BATCH-007", "ISO", 80);
        vm.stopPrank();
    }

    function testMultipleDefects() public {
        vm.startPrank(inspector);
        uint256 certId = qc.mintCertificate("Pump", "BATCH-008", "ISO 9001", 65);
        qc.logDefect(certId, "Seal leak", 2);
        qc.logDefect(certId, "Corrosion", 4);
        qc.logDefect(certId, "Vibration", 3);
        vm.stopPrank();

        assertEq(qc.certDefectCount(certId), 3);
        assertEq(qc.totalDefects(), 3);
    }
}
