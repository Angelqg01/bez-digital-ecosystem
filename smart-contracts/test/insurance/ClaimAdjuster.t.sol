// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/insurance/ClaimAdjuster.sol";

contract ClaimAdjusterTest is Test {
    ClaimAdjuster public adjuster;
    address public admin    = address(this);
    address public adj      = address(0xB1);
    address public oracle   = address(0xB2);
    address public claimant = address(0xB3);

    function setUp() public {
        adjuster = new ClaimAdjuster();
        adjuster.grantRole(adjuster.ADJUSTER_ROLE(), adj);
        adjuster.grantRole(adjuster.ORACLE_ROLE(), oracle);
    }

    function testFileClaim() public {
        vm.prank(claimant);
        uint256 id = adjuster.fileClaim(1, "Cargo Damage", 5 ether);

        ClaimAdjuster.Claim memory c = adjuster.getClaim(id);
        assertEq(c.policyId, 1);
        assertEq(c.claimant, claimant);
        assertEq(c.amount, 5 ether);
        assertEq(uint(c.status), uint(ClaimAdjuster.ClaimStatus.FILED));
        assertFalse(c.paid);
    }

    function testFileClaimRevertsZeroAmount() public {
        vm.prank(claimant);
        vm.expectRevert("Amount must be > 0");
        adjuster.fileClaim(1, "Cargo Damage", 0);
    }

    function testSubmitEvidence() public {
        vm.prank(claimant);
        uint256 cid = adjuster.fileClaim(1, "Fire Damage", 10 ether);

        vm.prank(claimant);
        adjuster.submitEvidence(cid, "QmHash123", "Photo");

        assertEq(adjuster.getClaimEvidenceCount(cid), 1);
    }

    function testSubmitEvidenceRevertsNonexistent() public {
        vm.prank(claimant);
        vm.expectRevert("Claim does not exist");
        adjuster.submitEvidence(999, "QmHash", "Photo");
    }

    function testAiScoreClaim() public {
        vm.prank(claimant);
        uint256 cid = adjuster.fileClaim(1, "Flood", 8 ether);

        vm.prank(oracle);
        adjuster.aiScoreClaim(cid, 85, 12);

        ClaimAdjuster.Claim memory c = adjuster.getClaim(cid);
        assertEq(c.aiScore, 85);
        assertEq(c.fraudRisk, 12);
        assertEq(uint(c.status), uint(ClaimAdjuster.ClaimStatus.UNDER_REVIEW));
    }

    function testAiScoreClaimRevertsInvalidScore() public {
        vm.prank(claimant);
        uint256 cid = adjuster.fileClaim(1, "Storm", 3 ether);

        vm.prank(oracle);
        vm.expectRevert("Score 0-100");
        adjuster.aiScoreClaim(cid, 150, 10);
    }

    function testApproveClaim() public {
        vm.prank(claimant);
        uint256 cid = adjuster.fileClaim(1, "Theft", 15 ether);

        vm.prank(adj);
        adjuster.approveClaim(cid);

        ClaimAdjuster.Claim memory c = adjuster.getClaim(cid);
        assertEq(uint(c.status), uint(ClaimAdjuster.ClaimStatus.APPROVED));
    }

    function testDenyClaim() public {
        vm.prank(claimant);
        uint256 cid = adjuster.fileClaim(1, "Suspicious", 20 ether);

        vm.prank(adj);
        adjuster.denyClaim(cid);

        ClaimAdjuster.Claim memory c = adjuster.getClaim(cid);
        assertEq(uint(c.status), uint(ClaimAdjuster.ClaimStatus.DENIED));
    }

    function testFlagClaim() public {
        vm.prank(claimant);
        uint256 cid = adjuster.fileClaim(1, "Duplicate", 50 ether);

        vm.prank(adj);
        adjuster.flagClaim(cid);

        ClaimAdjuster.Claim memory c = adjuster.getClaim(cid);
        assertEq(uint(c.status), uint(ClaimAdjuster.ClaimStatus.FLAGGED));
    }

    function testPayoutClaim() public {
        vm.prank(claimant);
        uint256 cid = adjuster.fileClaim(1, "Equipment", 5 ether);

        vm.prank(adj);
        adjuster.approveClaim(cid);

        // Fund the contract
        vm.deal(address(adjuster), 10 ether);

        uint256 balBefore = claimant.balance;
        vm.prank(adj);
        adjuster.payoutClaim(cid);

        ClaimAdjuster.Claim memory c = adjuster.getClaim(cid);
        assertTrue(c.paid);
        assertEq(uint(c.status), uint(ClaimAdjuster.ClaimStatus.PAID));
        assertEq(claimant.balance - balBefore, 5 ether);
    }

    function testPayoutClaimRevertsNotApproved() public {
        vm.prank(claimant);
        uint256 cid = adjuster.fileClaim(1, "Test", 1 ether);

        vm.prank(adj);
        vm.expectRevert("Not approved");
        adjuster.payoutClaim(cid);
    }
}
