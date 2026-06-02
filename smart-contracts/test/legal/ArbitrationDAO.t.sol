// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/legal/ArbitrationDAO.sol";

contract ArbitrationDAOTest is Test {
    ArbitrationDAO public dao;
    address public admin    = address(this);
    address public arbiter1 = address(0xA1);
    address public arbiter2 = address(0xA2);
    address public arbiter3 = address(0xA3);
    address public claimant = address(0xB1);
    address public respondent = address(0xB2);
    address public anyone   = address(0xC1);

    function setUp() public {
        dao = new ArbitrationDAO();
        dao.grantRole(dao.ARBITER_ROLE(), arbiter1);
        dao.grantRole(dao.ARBITER_ROLE(), arbiter2);
        dao.grantRole(dao.ARBITER_ROLE(), arbiter3);
        vm.deal(claimant, 50 ether);
        vm.deal(respondent, 50 ether);
        vm.deal(anyone, 50 ether);
    }

    // ── helpers ──────────────────
    function _fileDispute() internal returns (uint256) {
        vm.prank(claimant);
        return dao.fileDispute{value: 0.01 ether}(respondent, ArbitrationDAO.CaseCategory.CONTRACT, keccak256("dispute1"));
    }

    function _fileAndAssignPanel() internal returns (uint256) {
        uint256 did = _fileDispute();
        address[] memory panel = new address[](3);
        panel[0] = arbiter1;
        panel[1] = arbiter2;
        panel[2] = arbiter3;
        dao.assignPanel(did, panel);
        return did;
    }

    function _fileAssignAndDeliberate() internal returns (uint256) {
        uint256 did = _fileAndAssignPanel();
        dao.startDeliberation(did);
        return did;
    }

    // ── fileDispute ──────────────────
    function testFileDispute() public {
        uint256 did = _fileDispute();
        (address c, address r, ArbitrationDAO.CaseCategory cat, uint256 stake, ArbitrationDAO.DisputeStatus status) = dao.getDisputeCore(did);
        assertEq(c, claimant);
        assertEq(r, respondent);
        assertEq(uint8(cat), uint8(ArbitrationDAO.CaseCategory.CONTRACT));
        assertEq(stake, 0.01 ether);
        assertEq(uint8(status), uint8(ArbitrationDAO.DisputeStatus.FILED));
    }

    function testFileDisputeRevertLowStake() public {
        vm.prank(claimant);
        vm.expectRevert("Insufficient stake");
        dao.fileDispute{value: 0.001 ether}(respondent, ArbitrationDAO.CaseCategory.TORT, keccak256("x"));
    }

    function testFileDisputeRevertSelf() public {
        vm.prank(claimant);
        vm.expectRevert("Cannot dispute self");
        dao.fileDispute{value: 0.01 ether}(claimant, ArbitrationDAO.CaseCategory.OTHER, keccak256("x"));
    }

    // ── assignPanel ──────────────────
    function testAssignPanel() public {
        uint256 did = _fileAndAssignPanel();
        assertEq(uint8(dao.getDisputeStatus(did)), uint8(ArbitrationDAO.DisputeStatus.PANEL_ASSIGNED));
        (uint256 ps,,) = dao.getDisputeVotes(did);
        assertEq(ps, 3);
        address[] memory members = dao.getPanelMembers(did);
        assertEq(members.length, 3);
    }

    function testAssignPanelRevertEvenSize() public {
        uint256 did = _fileDispute();
        address[] memory panel = new address[](4);
        panel[0] = arbiter1;
        panel[1] = arbiter2;
        panel[2] = arbiter3;
        dao.grantRole(dao.ARBITER_ROLE(), anyone);
        panel[3] = anyone;
        vm.expectRevert("Panel must be odd");
        dao.assignPanel(did, panel);
    }

    // ── castVote ──────────────────
    function testCastVote() public {
        uint256 did = _fileAssignAndDeliberate();
        vm.prank(arbiter1);
        dao.castVote(did, true);
        (,uint256 vc,) = dao.getDisputeVotes(did);
        assertEq(vc, 1);
    }

    function testCastVoteRevertAlreadyVoted() public {
        uint256 did = _fileAssignAndDeliberate();
        vm.startPrank(arbiter1);
        dao.castVote(did, true);
        vm.expectRevert("Already voted");
        dao.castVote(did, false);
        vm.stopPrank();
    }

    function testCastVoteRevertNotOnPanel() public {
        uint256 did = _fileAssignAndDeliberate();
        // Grant ARBITER_ROLE to `anyone` but they're not on panel
        dao.grantRole(dao.ARBITER_ROLE(), anyone);
        vm.prank(anyone);
        vm.expectRevert("Not on panel");
        dao.castVote(did, true);
    }

    // ── resolveDispute ──────────────────
    function testResolveDisputeFavorClaimant() public {
        uint256 did = _fileAssignAndDeliberate();
        vm.prank(arbiter1);
        dao.castVote(did, true);
        vm.prank(arbiter2);
        dao.castVote(did, true);
        dao.resolveDispute(did);
        assertEq(uint8(dao.getDisputeStatus(did)), uint8(ArbitrationDAO.DisputeStatus.RESOLVED));
        assertEq(uint8(dao.getDisputeRuling(did)), uint8(ArbitrationDAO.Ruling.FAVOR_CLAIMANT));
    }

    function testResolveDisputeFavorRespondent() public {
        uint256 did = _fileAssignAndDeliberate();
        vm.prank(arbiter1);
        dao.castVote(did, false);
        vm.prank(arbiter2);
        dao.castVote(did, false);
        dao.resolveDispute(did);
        assertEq(uint8(dao.getDisputeRuling(did)), uint8(ArbitrationDAO.Ruling.FAVOR_RESPONDENT));
    }

    function testResolveRevertNotEnoughVotes() public {
        uint256 did = _fileAssignAndDeliberate();
        vm.prank(arbiter1);
        dao.castVote(did, true);
        vm.expectRevert("Not enough votes");
        dao.resolveDispute(did);
    }

    // ── fileAppeal ──────────────────
    function testFileAppeal() public {
        uint256 did = _fileAssignAndDeliberate();
        vm.prank(arbiter1);
        dao.castVote(did, true);
        vm.prank(arbiter2);
        dao.castVote(did, true);
        dao.resolveDispute(did);

        vm.prank(respondent);
        uint256 aid = dao.fileAppeal{value: 0.01 ether}(did, keccak256("unfair"));
        (uint256 dispId, address appellant,, , bool processed) = dao.appeals(aid);
        assertEq(dispId, did);
        assertEq(appellant, respondent);
        assertFalse(processed);
    }

    // ── withdrawStake ──────────────────
    function testWithdrawStake() public {
        uint256 did = _fileAssignAndDeliberate();
        vm.prank(arbiter1);
        dao.castVote(did, true);
        vm.prank(arbiter2);
        dao.castVote(did, true);
        dao.resolveDispute(did);

        uint256 balBefore = claimant.balance;
        vm.prank(claimant);
        dao.withdrawStake(did);
        assertEq(claimant.balance, balBefore + 0.01 ether);
    }

    function testWithdrawStakeRevertNotWinner() public {
        uint256 did = _fileAssignAndDeliberate();
        vm.prank(arbiter1);
        dao.castVote(did, true);
        vm.prank(arbiter2);
        dao.castVote(did, true);
        dao.resolveDispute(did);

        vm.prank(respondent);
        vm.expectRevert("Not the winner");
        dao.withdrawStake(did);
    }
}
