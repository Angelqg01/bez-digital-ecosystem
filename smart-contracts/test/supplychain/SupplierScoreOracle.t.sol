// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/SupplierScoreOracle.sol";

contract SupplierScoreOracleTest is Test {
    SupplierScoreOracle oracle;
    address admin = address(this);
    address auditor1 = address(0xA1);
    address supplier1 = address(0xB1);
    address supplier2 = address(0xB2);

    function setUp() public {
        oracle = new SupplierScoreOracle();
        oracle.grantRole(oracle.AUDITOR_ROLE(), auditor1);
    }

    // ── registerSupplier ──────────────────
    function testRegisterSupplier() public {
        vm.prank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("Acme"));
        (address addr, bytes32 nh, uint256 to, uint256 otd, uint256 qs, uint256 rat, bool act) = oracle.suppliers(supplier1);
        assertEq(addr, supplier1);
        assertEq(nh, keccak256("Acme"));
        assertEq(qs, 100);
        assertTrue(act);
        assertGt(rat, 0);
    }

    function testRegisterSupplierRevertDuplicate() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        vm.expectRevert("Already registered");
        oracle.registerSupplier(supplier1, keccak256("b"));
        vm.stopPrank();
    }

    function testRegisterSupplierRevertZeroAddress() public {
        vm.prank(auditor1);
        vm.expectRevert("Invalid address");
        oracle.registerSupplier(address(0), keccak256("x"));
    }

    // ── recordOrder ──────────────────
    function testRecordOrderOnTime() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        oracle.recordOrder(supplier1, true);
        oracle.recordOrder(supplier1, true);
        oracle.recordOrder(supplier1, false);
        vm.stopPrank();
        (, , uint256 to, uint256 otd, , ,) = oracle.suppliers(supplier1);
        assertEq(to, 3);
        assertEq(otd, 2);
    }

    function testRecordOrderRevertInactive() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        oracle.deactivateSupplier(supplier1);
        vm.expectRevert("Supplier not active");
        oracle.recordOrder(supplier1, true);
        vm.stopPrank();
    }

    // ── performAudit ──────────────────
    function testPerformAudit() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        uint256 aid = oracle.performAudit(supplier1, 80, keccak256("report1"));
        vm.stopPrank();
        (uint256 id, address sup, address aud, uint256 sc, bytes32 rh, uint256 ts) = oracle.audits(aid);
        assertEq(sup, supplier1);
        assertEq(aud, auditor1);
        assertEq(sc, 80);
        assertGt(ts, 0);
    }

    function testPerformAuditUpdatesQualityScore() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        oracle.performAudit(supplier1, 80, keccak256("r1"));
        oracle.performAudit(supplier1, 60, keccak256("r2"));
        vm.stopPrank();
        (, , , , uint256 qs, ,) = oracle.suppliers(supplier1);
        // Rolling avg: (80*1 + 60)/2 = 70
        assertEq(qs, 70);
    }

    function testPerformAuditRevertScoreOver100() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        vm.expectRevert("Score max 100");
        oracle.performAudit(supplier1, 101, keccak256("r"));
        vm.stopPrank();
    }

    // ── issueCertification ──────────────────
    function testIssueCertification() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        uint256 cid = oracle.issueCertification(supplier1, keccak256("ISO9001"), block.timestamp + 365 days);
        vm.stopPrank();
        (uint256 id, address sup, bytes32 ch, SupplierScoreOracle.CertStatus st, uint256 iat, uint256 exp, address iss) = oracle.certifications(cid);
        assertEq(sup, supplier1);
        assertEq(uint8(st), uint8(SupplierScoreOracle.CertStatus.APPROVED));
        assertEq(iss, auditor1);
    }

    function testIssueCertRevertAlreadyExpired() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        vm.expectRevert("Already expired");
        oracle.issueCertification(supplier1, keccak256("x"), block.timestamp - 1);
        vm.stopPrank();
    }

    // ── revokeCertification ──────────────────
    function testRevokeCertification() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        uint256 cid = oracle.issueCertification(supplier1, keccak256("x"), block.timestamp + 100 days);
        oracle.revokeCertification(cid);
        vm.stopPrank();
        (, , , SupplierScoreOracle.CertStatus st, , ,) = oracle.certifications(cid);
        assertEq(uint8(st), uint8(SupplierScoreOracle.CertStatus.REVOKED));
    }

    function testRevokeCertRevertNotApproved() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        uint256 cid = oracle.issueCertification(supplier1, keccak256("x"), block.timestamp + 100 days);
        oracle.revokeCertification(cid);
        vm.expectRevert("Not approved");
        oracle.revokeCertification(cid);
        vm.stopPrank();
    }

    // ── markCertExpired ──────────────────
    function testMarkCertExpired() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        uint256 cid = oracle.issueCertification(supplier1, keccak256("x"), block.timestamp + 10 days);
        vm.stopPrank();
        vm.warp(block.timestamp + 11 days);
        vm.prank(auditor1);
        oracle.markCertExpired(cid);
        (, , , SupplierScoreOracle.CertStatus st, , ,) = oracle.certifications(cid);
        assertEq(uint8(st), uint8(SupplierScoreOracle.CertStatus.EXPIRED));
    }

    function testMarkCertExpiredRevertNotYet() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        uint256 cid = oracle.issueCertification(supplier1, keccak256("x"), block.timestamp + 100 days);
        vm.expectRevert("Not yet expired");
        oracle.markCertExpired(cid);
        vm.stopPrank();
    }

    // ── deactivateSupplier ──────────────────
    function testDeactivateSupplier() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        oracle.deactivateSupplier(supplier1);
        vm.stopPrank();
        (, , , , , , bool act) = oracle.suppliers(supplier1);
        assertFalse(act);
    }

    function testDeactivateSupplierRevertAlreadyInactive() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        oracle.deactivateSupplier(supplier1);
        vm.expectRevert("Already inactive");
        oracle.deactivateSupplier(supplier1);
        vm.stopPrank();
    }

    // ── View helpers ──────────────────
    function testGetDeliveryRate() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        oracle.recordOrder(supplier1, true);
        oracle.recordOrder(supplier1, true);
        oracle.recordOrder(supplier1, false);
        oracle.recordOrder(supplier1, true);
        vm.stopPrank();
        assertEq(oracle.getDeliveryRate(supplier1), 75);
    }

    function testGetDeliveryRateZeroOrders() public {
        vm.prank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        assertEq(oracle.getDeliveryRate(supplier1), 0);
    }

    function testIsCertValid() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        uint256 cid = oracle.issueCertification(supplier1, keccak256("x"), block.timestamp + 100 days);
        vm.stopPrank();
        assertTrue(oracle.isCertValid(cid));
        vm.warp(block.timestamp + 101 days);
        assertFalse(oracle.isCertValid(cid));
    }

    function testGetSupplierAudits() public {
        vm.startPrank(auditor1);
        oracle.registerSupplier(supplier1, keccak256("a"));
        oracle.performAudit(supplier1, 90, keccak256("r1"));
        oracle.performAudit(supplier1, 85, keccak256("r2"));
        vm.stopPrank();
        uint256[] memory aids = oracle.getSupplierAudits(supplier1);
        assertEq(aids.length, 2);
    }
}
