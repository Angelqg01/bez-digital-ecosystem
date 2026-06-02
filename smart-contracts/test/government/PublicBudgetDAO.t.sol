// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/government/PublicBudgetDAO.sol";

contract PublicBudgetDAOTest is Test {
    PublicBudgetDAO dao;
    address admin = address(this);
    address council1 = address(0xA1);
    address council2 = address(0xA2);
    address council3 = address(0xA3);
    address beneficiary1 = address(0xC1);

    function setUp() public {
        dao = new PublicBudgetDAO();
        dao.grantRole(dao.COUNCIL_ROLE(), council1);
        dao.grantRole(dao.COUNCIL_ROLE(), council2);
        dao.grantRole(dao.COUNCIL_ROLE(), council3);
        // Fund treasury
        vm.deal(address(this), 100 ether);
        (bool ok, ) = address(dao).call{value: 50 ether}("");
        require(ok);
    }

    // Helper
    function _createProposal() internal returns (uint256) {
        vm.prank(council1);
        return dao.createProposal(
            keccak256("Bridge Repair"),
            keccak256("Fix main bridge"),
            PublicBudgetDAO.BudgetCategory.INFRASTRUCTURE,
            5 ether,
            beneficiary1
        );
    }

    // ── createProposal ──────────────────
    function testCreateProposal() public {
        uint256 pid = _createProposal();
        assertEq(uint8(dao.getProposalStatus(pid)), uint8(PublicBudgetDAO.ProposalStatus.DRAFT));
        (address proposer, PublicBudgetDAO.BudgetCategory cat, uint256 amt, address ben, ) = dao.getProposalCore(pid);
        assertEq(proposer, council1);
        assertEq(uint8(cat), uint8(PublicBudgetDAO.BudgetCategory.INFRASTRUCTURE));
        assertEq(amt, 5 ether);
        assertEq(ben, beneficiary1);
    }

    function testCreateProposalRevertZeroBeneficiary() public {
        vm.prank(council1);
        vm.expectRevert("Invalid beneficiary");
        dao.createProposal(keccak256("x"), keccak256("y"), PublicBudgetDAO.BudgetCategory.HEALTH, 1 ether, address(0));
    }

    function testCreateProposalRevertZeroAmount() public {
        vm.prank(council1);
        vm.expectRevert("Amount must be > 0");
        dao.createProposal(keccak256("x"), keccak256("y"), PublicBudgetDAO.BudgetCategory.HEALTH, 0, beneficiary1);
    }

    // ── openProposal ──────────────────
    function testOpenProposal() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        assertEq(uint8(dao.getProposalStatus(pid)), uint8(PublicBudgetDAO.ProposalStatus.OPEN));
    }

    function testOpenProposalRevertNotDraft() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        vm.prank(council1);
        vm.expectRevert("Not draft");
        dao.openProposal(pid, 7 days);
    }

    // ── castVote ──────────────────
    function testCastVote() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);

        vm.prank(council1);
        dao.castVote(pid, true);
        vm.prank(council2);
        dao.castVote(pid, false);

        (uint256 vFor, uint256 vAgainst) = dao.getProposalVotes(pid);
        assertEq(vFor, 1);
        assertEq(vAgainst, 1);
    }

    function testCastVoteRevertAlreadyVoted() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        vm.prank(council1);
        dao.castVote(pid, true);
        vm.prank(council1);
        vm.expectRevert("Already voted");
        dao.castVote(pid, true);
    }

    function testCastVoteRevertAfterDeadline() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        vm.warp(block.timestamp + 8 days);
        vm.prank(council1);
        vm.expectRevert("Voting ended");
        dao.castVote(pid, true);
    }

    // ── tallyVotes ──────────────────
    function testTallyVotesApproved() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        vm.prank(council1);
        dao.castVote(pid, true);
        vm.prank(council2);
        dao.castVote(pid, true);
        vm.prank(council3);
        dao.castVote(pid, false);

        vm.warp(block.timestamp + 8 days);
        vm.prank(council1);
        dao.tallyVotes(pid);
        assertEq(uint8(dao.getProposalStatus(pid)), uint8(PublicBudgetDAO.ProposalStatus.APPROVED));
    }

    function testTallyVotesRejected() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        vm.prank(council1);
        dao.castVote(pid, false);
        vm.prank(council2);
        dao.castVote(pid, false);

        vm.warp(block.timestamp + 8 days);
        vm.prank(council1);
        dao.tallyVotes(pid);
        assertEq(uint8(dao.getProposalStatus(pid)), uint8(PublicBudgetDAO.ProposalStatus.REJECTED));
    }

    function testTallyRevertVotingNotEnded() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        vm.prank(council1);
        vm.expectRevert("Voting not ended");
        dao.tallyVotes(pid);
    }

    // ── executeProposal ──────────────────
    function testExecuteProposal() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        vm.prank(council1);
        dao.castVote(pid, true);
        vm.warp(block.timestamp + 8 days);
        vm.prank(council1);
        dao.tallyVotes(pid);

        uint256 balBefore = beneficiary1.balance;
        vm.prank(council1);
        dao.executeProposal(pid);
        assertEq(beneficiary1.balance - balBefore, 5 ether);
        assertEq(uint8(dao.getProposalStatus(pid)), uint8(PublicBudgetDAO.ProposalStatus.EXECUTED));
    }

    function testExecuteRevertNotApproved() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        vm.expectRevert("Not approved");
        dao.executeProposal(pid);
    }

    // ── cancelProposal ──────────────────
    function testCancelProposal() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.cancelProposal(pid);
        assertEq(uint8(dao.getProposalStatus(pid)), uint8(PublicBudgetDAO.ProposalStatus.CANCELLED));
    }

    function testCancelRevertAfterApproval() public {
        uint256 pid = _createProposal();
        vm.prank(council1);
        dao.openProposal(pid, 7 days);
        vm.prank(council1);
        dao.castVote(pid, true);
        vm.warp(block.timestamp + 8 days);
        vm.prank(council1);
        dao.tallyVotes(pid);
        vm.prank(council1);
        vm.expectRevert("Cannot cancel");
        dao.cancelProposal(pid);
    }

    // ── Treasury ──────────────────
    function testTreasuryBalance() public view {
        assertEq(dao.treasuryBalance(), 50 ether);
    }
}
