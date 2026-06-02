// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/government/CitizenIdentityNFT.sol";

contract CitizenIdentityNFTTest is Test {
    CitizenIdentityNFT cid;
    address admin = address(this);
    address registrar = address(0xA1);
    address citizen1 = address(0xB1);
    address citizen2 = address(0xB2);

    function setUp() public {
        cid = new CitizenIdentityNFT();
        cid.grantRole(cid.REGISTRAR_ROLE(), registrar);
    }

    // ── registerCitizen ──────────────────
    function testRegisterCitizen() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("John"), keccak256("bio1"));
        (uint256 rid, address w, bytes32 nh, bytes32 bh, CitizenIdentityNFT.KYCStatus ks, uint256 rat, uint256 kvat, bool act) = cid.citizens(id);
        assertEq(w, citizen1);
        assertEq(nh, keccak256("John"));
        assertEq(uint8(ks), uint8(CitizenIdentityNFT.KYCStatus.NONE));
        assertTrue(act);
    }

    function testRegisterCitizenRevertZeroAddress() public {
        vm.prank(registrar);
        vm.expectRevert("Invalid wallet");
        cid.registerCitizen(address(0), keccak256("x"), keccak256("b"));
    }

    // ── submitKYC ──────────────────
    function testSubmitKYC() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(citizen1);
        cid.submitKYC(id);
        (, , , , CitizenIdentityNFT.KYCStatus ks, , ,) = cid.citizens(id);
        assertEq(uint8(ks), uint8(CitizenIdentityNFT.KYCStatus.PENDING));
    }

    function testSubmitKYCRevertNotCitizen() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(citizen2);
        vm.expectRevert("Not citizen");
        cid.submitKYC(id);
    }

    // ── verifyKYC ──────────────────
    function testVerifyKYC() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(citizen1);
        cid.submitKYC(id);
        vm.prank(registrar);
        cid.verifyKYC(id);
        (, , , , CitizenIdentityNFT.KYCStatus ks, , uint256 kvat,) = cid.citizens(id);
        assertEq(uint8(ks), uint8(CitizenIdentityNFT.KYCStatus.VERIFIED));
        assertGt(kvat, 0);
    }

    function testVerifyKYCRevertNotPending() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(registrar);
        vm.expectRevert("Not pending");
        cid.verifyKYC(id);
    }

    // ── revokeKYC ──────────────────
    function testRevokeKYC() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(citizen1);
        cid.submitKYC(id);
        vm.startPrank(registrar);
        cid.verifyKYC(id);
        cid.revokeKYC(id);
        vm.stopPrank();
        (, , , , CitizenIdentityNFT.KYCStatus ks, , ,) = cid.citizens(id);
        assertEq(uint8(ks), uint8(CitizenIdentityNFT.KYCStatus.REVOKED));
    }

    function testRevokeKYCRevertNotVerified() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(registrar);
        vm.expectRevert("Not verified");
        cid.revokeKYC(id);
    }

    // ── issueDocument ──────────────────
    function testIssueDocument() public {
        vm.prank(registrar);
        uint256 citId = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(registrar);
        uint256 docId = cid.issueDocument(citId, CitizenIdentityNFT.DocType.NATIONAL_ID, keccak256("doc1"), block.timestamp + 365 days);
        (uint256 did, uint256 dcid, CitizenIdentityNFT.DocType dt, bytes32 dh, uint256 iat, uint256 exp, bool rev) = cid.documents(docId);
        assertEq(dcid, citId);
        assertEq(uint8(dt), uint8(CitizenIdentityNFT.DocType.NATIONAL_ID));
        assertFalse(rev);
    }

    function testIssueDocumentRevertExpired() public {
        vm.prank(registrar);
        uint256 citId = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(registrar);
        vm.expectRevert("Already expired");
        cid.issueDocument(citId, CitizenIdentityNFT.DocType.PASSPORT, keccak256("d"), block.timestamp - 1);
    }

    // ── revokeDocument ──────────────────
    function testRevokeDocument() public {
        vm.prank(registrar);
        uint256 citId = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(registrar);
        uint256 docId = cid.issueDocument(citId, CitizenIdentityNFT.DocType.TAX_ID, keccak256("d"), block.timestamp + 100 days);
        vm.prank(registrar);
        cid.revokeDocument(docId);
        (, , , , , , bool rev) = cid.documents(docId);
        assertTrue(rev);
    }

    function testRevokeDocumentRevertAlready() public {
        vm.prank(registrar);
        uint256 citId = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.startPrank(registrar);
        uint256 docId = cid.issueDocument(citId, CitizenIdentityNFT.DocType.TAX_ID, keccak256("d"), block.timestamp + 100 days);
        cid.revokeDocument(docId);
        vm.expectRevert("Already revoked");
        cid.revokeDocument(docId);
        vm.stopPrank();
    }

    // ── deactivateCitizen ──────────────────
    function testDeactivateCitizen() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(registrar);
        cid.deactivateCitizen(id);
        (, , , , , , , bool act) = cid.citizens(id);
        assertFalse(act);
    }

    // ── View helpers ──────────────────
    function testGetCitizenDocs() public {
        vm.prank(registrar);
        uint256 citId = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.startPrank(registrar);
        cid.issueDocument(citId, CitizenIdentityNFT.DocType.NATIONAL_ID, keccak256("d1"), block.timestamp + 365 days);
        cid.issueDocument(citId, CitizenIdentityNFT.DocType.PASSPORT, keccak256("d2"), block.timestamp + 365 days);
        vm.stopPrank();
        uint256[] memory docs = cid.getCitizenDocs(citId);
        assertEq(docs.length, 2);
    }

    function testIsDocValid() public {
        vm.prank(registrar);
        uint256 citId = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        vm.prank(registrar);
        uint256 docId = cid.issueDocument(citId, CitizenIdentityNFT.DocType.DRIVERS_LICENSE, keccak256("d"), block.timestamp + 10 days);
        assertTrue(cid.isDocValid(docId));
        vm.warp(block.timestamp + 11 days);
        assertFalse(cid.isDocValid(docId));
    }

    function testIsKYCVerified() public {
        vm.prank(registrar);
        uint256 id = cid.registerCitizen(citizen1, keccak256("J"), keccak256("b"));
        assertFalse(cid.isKYCVerified(id));
        vm.prank(citizen1);
        cid.submitKYC(id);
        vm.prank(registrar);
        cid.verifyKYC(id);
        assertTrue(cid.isKYCVerified(id));
    }
}
