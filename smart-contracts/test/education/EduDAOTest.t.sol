// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/education/EduDAO.sol";

contract EduDAOTest is Test {
    EduDAO dao;
    address admin  = address(this);
    address instAdmin = address(0xE1);
    address voter1 = address(0xF1);
    address voter2 = address(0xF2);
    address voter3 = address(0xF3);

    function setUp() public {
        dao = new EduDAO();
        dao.grantRole(dao.INSTITUTION_ADMIN_ROLE(), instAdmin);
        vm.deal(voter1, 5 ether);
        vm.deal(voter2, 5 ether);
    }

    function testRegisterInstitution() public {
        vm.startPrank(instAdmin);
        uint256 id = dao.registerInstitution("UNAM");
        vm.stopPrank();

        EduDAO.Institution memory inst = dao.getInstitution(id);
        assertEq(inst.name, "UNAM");
        assertEq(inst.admin, instAdmin);
        assertTrue(inst.active);
    }

    function testRegisterRevertNotAdmin() public {
        vm.startPrank(voter1);
        vm.expectRevert();
        dao.registerInstitution("Fake");
        vm.stopPrank();
    }

    function testCreateProposal() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("TecMilenio");
        vm.stopPrank();

        vm.startPrank(voter1);
        uint256 pid = dao.createProposal(instId, "Add Solidity Track", "Curriculum", 3, block.timestamp + 7 days);
        vm.stopPrank();

        EduDAO.Proposal memory p = dao.getProposal(pid);
        assertEq(p.title, "Add Solidity Track");
        assertEq(p.category, "Curriculum");
        assertEq(p.proposer, voter1);
        assertEq(p.quorum, 3);
        assertFalse(p.executed);
    }

    function testCreateProposalRevertPastDeadline() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("IPN");
        vm.stopPrank();

        vm.startPrank(voter1);
        vm.expectRevert("Deadline must be future");
        dao.createProposal(instId, "Old", "Budget", 1, block.timestamp - 1);
        vm.stopPrank();
    }

    function testCastVote() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("BeZhas Academy");
        vm.stopPrank();

        vm.startPrank(voter1);
        uint256 pid = dao.createProposal(instId, "Lab Equipment", "Budget", 2, block.timestamp + 7 days);
        dao.castVote(pid, true);
        vm.stopPrank();

        vm.startPrank(voter2);
        dao.castVote(pid, false);
        vm.stopPrank();

        EduDAO.Proposal memory p = dao.getProposal(pid);
        assertEq(p.forVotes, 1);
        assertEq(p.againstVotes, 1);
    }

    function testCastVoteRevertDoubleVote() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("Platzi");
        vm.stopPrank();

        vm.startPrank(voter1);
        uint256 pid = dao.createProposal(instId, "Ethics Course", "Curriculum", 1, block.timestamp + 7 days);
        dao.castVote(pid, true);
        vm.expectRevert("Already voted");
        dao.castVote(pid, true);
        vm.stopPrank();
    }

    function testExecuteProposal() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("UNAM");
        vm.stopPrank();

        vm.startPrank(voter1);
        uint256 pid = dao.createProposal(instId, "Open Source Repo", "Infrastructure", 2, block.timestamp + 7 days);
        dao.castVote(pid, true);
        vm.stopPrank();

        vm.startPrank(voter2);
        dao.castVote(pid, true);
        vm.stopPrank();

        vm.startPrank(instAdmin);
        dao.executeProposal(pid);
        vm.stopPrank();

        assertTrue(dao.getProposal(pid).executed);
    }

    function testExecuteRevertQuorumNotMet() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("IPN");
        vm.stopPrank();

        vm.startPrank(voter1);
        uint256 pid = dao.createProposal(instId, "Big Change", "Budget", 5, block.timestamp + 7 days);
        dao.castVote(pid, true);
        vm.stopPrank();

        vm.startPrank(instAdmin);
        vm.expectRevert("Quorum not met");
        dao.executeProposal(pid);
        vm.stopPrank();
    }

    function testExecuteRevertNotPassed() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("Domestika");
        vm.stopPrank();

        vm.startPrank(voter1);
        uint256 pid = dao.createProposal(instId, "Rejected", "Budget", 2, block.timestamp + 7 days);
        dao.castVote(pid, false);
        vm.stopPrank();

        vm.startPrank(voter2);
        dao.castVote(pid, false);
        vm.stopPrank();

        vm.startPrank(instAdmin);
        vm.expectRevert("Not passed");
        dao.executeProposal(pid);
        vm.stopPrank();
    }

    function testFundTreasury() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("TecMilenio");
        vm.stopPrank();

        vm.startPrank(voter1);
        dao.fundTreasury{value: 3 ether}(instId);
        vm.stopPrank();

        assertEq(dao.getInstitution(instId).treasuryBez, 3 ether);
    }

    function testGetInstitutionProposalCount() public {
        vm.startPrank(instAdmin);
        uint256 instId = dao.registerInstitution("UNAM");
        vm.stopPrank();

        vm.startPrank(voter1);
        dao.createProposal(instId, "P1", "Curriculum", 1, block.timestamp + 1 days);
        dao.createProposal(instId, "P2", "Budget", 1, block.timestamp + 1 days);
        vm.stopPrank();

        assertEq(dao.getInstitutionProposalCount(instId), 2);
    }
}
