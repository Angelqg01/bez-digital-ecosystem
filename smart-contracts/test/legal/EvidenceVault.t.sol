// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/legal/EvidenceVault.sol";

contract EvidenceVaultTest is Test {
    EvidenceVault public vault;
    address public admin     = address(this);
    address public custodian = address(0xA1);
    address public submitter = address(0xB1);
    address public receiver  = address(0xB2);
    address public anyone    = address(0xC1);

    function setUp() public {
        vault = new EvidenceVault();
        vault.grantRole(vault.CUSTODIAN_ROLE(), custodian);
    }

    // ── helpers ──────────────────
    function _submit() internal returns (uint256) {
        vm.prank(submitter);
        return vault.submitEvidence(keccak256("evidence1"), EvidenceVault.EvidenceType.DOCUMENT, 100);
    }

    // ── submitEvidence ──────────────────
    function testSubmitEvidence() public {
        uint256 eid = _submit();
        (,address sub, bytes32 h, EvidenceVault.EvidenceType et, uint256 caseId, uint256 ts, uint256 cc, bool isSealed, bool challenged) = vault.evidences(eid);
        assertEq(sub, submitter);
        assertEq(h, keccak256("evidence1"));
        assertEq(uint8(et), uint8(EvidenceVault.EvidenceType.DOCUMENT));
        assertEq(caseId, 100);
        assertTrue(ts > 0);
        assertEq(cc, 1); // initial custody record
        assertFalse(isSealed);
        assertFalse(challenged);
    }

    function testSubmitRevertEmptyHash() public {
        vm.prank(submitter);
        vm.expectRevert("Empty hash");
        vault.submitEvidence(bytes32(0), EvidenceVault.EvidenceType.PHOTO, 1);
    }

    function testSubmitRevertDuplicateHash() public {
        _submit();
        vm.prank(submitter);
        vm.expectRevert("Hash already registered");
        vault.submitEvidence(keccak256("evidence1"), EvidenceVault.EvidenceType.AUDIO, 2);
    }

    // ── transferCustody ──────────────────
    function testTransferCustody() public {
        uint256 eid = _submit();
        vm.prank(custodian);
        vault.transferCustody(eid, receiver, keccak256("transfer notes"));
        (,,,,,,uint256 cc,,) = vault.evidences(eid);
        assertEq(cc, 2); // submit + transfer
    }

    function testTransferRevertNotCustodian() public {
        uint256 eid = _submit();
        vm.prank(anyone);
        vm.expectRevert();
        vault.transferCustody(eid, receiver, bytes32(0));
    }

    function testTransferRevertSealed() public {
        uint256 eid = _submit();
        vm.prank(custodian);
        vault.sealEvidence(eid);
        vm.prank(custodian);
        vm.expectRevert("Evidence sealed");
        vault.transferCustody(eid, receiver, bytes32(0));
    }

    // ── sealEvidence ──────────────────
    function testSealEvidence() public {
        uint256 eid = _submit();
        vm.prank(custodian);
        vault.sealEvidence(eid);
        (,,,,,,,bool isSealed,) = vault.evidences(eid);
        assertTrue(isSealed);
    }

    function testSealRevertAlreadySealed() public {
        uint256 eid = _submit();
        vm.startPrank(custodian);
        vault.sealEvidence(eid);
        vm.expectRevert("Already sealed");
        vault.sealEvidence(eid);
        vm.stopPrank();
    }

    // ── challengeEvidence ──────────────────
    function testChallengeEvidence() public {
        uint256 eid = _submit();
        vm.prank(anyone);
        vault.challengeEvidence(eid);
        (,,,,,,, , bool challenged) = vault.evidences(eid);
        assertTrue(challenged);
    }

    function testChallengeRevertAlready() public {
        uint256 eid = _submit();
        vm.prank(anyone);
        vault.challengeEvidence(eid);
        vm.prank(anyone);
        vm.expectRevert("Already challenged");
        vault.challengeEvidence(eid);
    }

    // ── releaseEvidence ──────────────────
    function testReleaseEvidence() public {
        uint256 eid = _submit();
        vm.prank(custodian);
        vault.sealEvidence(eid);
        vm.prank(custodian);
        vault.releaseEvidence(eid, receiver);
        uint256[] memory custody = vault.getEvidenceCustody(eid);
        assertEq(custody.length, 3); // submit + seal + release
    }

    function testReleaseRevertNotSealed() public {
        uint256 eid = _submit();
        vm.prank(custodian);
        vm.expectRevert("Must be sealed first");
        vault.releaseEvidence(eid, receiver);
    }

    // ── verifyHash ──────────────────
    function testVerifyHash() public {
        uint256 eid = _submit();
        assertTrue(vault.verifyHash(eid, keccak256("evidence1")));
        assertFalse(vault.verifyHash(eid, keccak256("wrong")));
    }

    // ── getCaseEvidences ──────────────────
    function testGetCaseEvidences() public {
        _submit();
        vm.prank(submitter);
        vault.submitEvidence(keccak256("evidence2"), EvidenceVault.EvidenceType.VIDEO, 100);
        uint256[] memory evs = vault.getCaseEvidences(100);
        assertEq(evs.length, 2);
    }
}
