// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/entertainment/FanTokenDAO.sol";

contract FanTokenDAOTest is Test {
    FanTokenDAO public dao;
    address public admin   = address(this);
    address public manager = address(0xA1);
    address public fan1    = address(0xB1);
    address public fan2    = address(0xB2);
    address public fan3    = address(0xB3);
    address public anyone  = address(0xC1);

    function setUp() public {
        dao = new FanTokenDAO();
        dao.grantRole(dao.MANAGER_ROLE(), manager);
        vm.deal(manager, 50 ether);
        vm.deal(fan1, 10 ether);
        vm.deal(fan2, 10 ether);
        vm.deal(fan3, 10 ether);
    }

    // ── createClub ───────────────────────────────────────────────────

    function testCreateClub() public {
        vm.prank(manager);
        uint256 id = dao.createClub("Club America FC", "Sports");

        FanTokenDAO.FanClub memory c = dao.getClub(id);
        assertEq(c.name, "Club America FC");
        assertEq(c.category, "Sports");
        assertEq(c.manager, manager);
        assertEq(c.totalMembers, 0);
        assertTrue(c.active);
    }

    function testCreateClubRevertNotManager() public {
        vm.prank(anyone);
        vm.expectRevert();
        dao.createClub("Bad Club", "Sports");
    }

    // ── joinClub ─────────────────────────────────────────────────────

    function testJoinClub() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Chivas FC", "Sports");

        vm.prank(fan1);
        dao.joinClub(cid);

        assertTrue(dao.isMember(cid, fan1));
        FanTokenDAO.FanClub memory c = dao.getClub(cid);
        assertEq(c.totalMembers, 1);
    }

    function testJoinClubRevertAlreadyMember() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Sports");

        vm.startPrank(fan1);
        dao.joinClub(cid);
        vm.expectRevert("Already member");
        dao.joinClub(cid);
        vm.stopPrank();
    }

    // ── createPoll & vote ────────────────────────────────────────────

    function testCreatePollAndVote() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Monterrey FC", "Sports");

        vm.prank(fan1);
        dao.joinClub(cid);
        vm.prank(fan2);
        dao.joinClub(cid);

        string[] memory opts = new string[](3);
        opts[0] = "Home Jersey Blue";
        opts[1] = "Home Jersey White";
        opts[2] = "Home Jersey Black";

        vm.prank(manager);
        uint256 pid = dao.createPoll(cid, "Next season jersey color?", opts, 7 days);

        assertEq(dao.getPollOptionCount(pid), 3);

        vm.prank(fan1);
        dao.vote(pid, 0);

        vm.prank(fan2);
        dao.vote(pid, 2);

        assertEq(dao.getPollVotes(pid, 0), 1);
        assertEq(dao.getPollVotes(pid, 2), 1);
    }

    function testVoteRevertNotMember() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Sports");

        string[] memory opts = new string[](2);
        opts[0] = "A";
        opts[1] = "B";

        vm.prank(manager);
        uint256 pid = dao.createPoll(cid, "Question?", opts, 7 days);

        vm.prank(anyone);
        vm.expectRevert("Not a member");
        dao.vote(pid, 0);
    }

    function testVoteRevertAlreadyVoted() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Sports");

        vm.prank(fan1);
        dao.joinClub(cid);

        string[] memory opts = new string[](2);
        opts[0] = "A";
        opts[1] = "B";

        vm.prank(manager);
        uint256 pid = dao.createPoll(cid, "Question?", opts, 7 days);

        vm.startPrank(fan1);
        dao.vote(pid, 0);
        vm.expectRevert("Already voted");
        dao.vote(pid, 1);
        vm.stopPrank();
    }

    function testVoteRevertInvalidOption() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Sports");

        vm.prank(fan1);
        dao.joinClub(cid);

        string[] memory opts = new string[](2);
        opts[0] = "A";
        opts[1] = "B";

        vm.prank(manager);
        uint256 pid = dao.createPoll(cid, "Question?", opts, 7 days);

        vm.prank(fan1);
        vm.expectRevert("Invalid option");
        dao.vote(pid, 5);
    }

    // ── finalizePoll ─────────────────────────────────────────────────

    function testFinalizePoll() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Pumas FC", "Sports");

        vm.prank(fan1);
        dao.joinClub(cid);
        vm.prank(fan2);
        dao.joinClub(cid);
        vm.prank(fan3);
        dao.joinClub(cid);

        string[] memory opts = new string[](2);
        opts[0] = "Option A";
        opts[1] = "Option B";

        vm.prank(manager);
        uint256 pid = dao.createPoll(cid, "Best option?", opts, 1 days);

        vm.prank(fan1);
        dao.vote(pid, 1);
        vm.prank(fan2);
        dao.vote(pid, 1);
        vm.prank(fan3);
        dao.vote(pid, 0);

        // Warp past end time
        vm.warp(block.timestamp + 2 days);

        vm.prank(manager);
        dao.finalizePoll(pid);

        (,,,, bool finalized, uint256 winner) = dao.polls(pid);
        assertTrue(finalized);
        assertEq(winner, 1); // Option B wins 2-1
    }

    function testFinalizeRevertNotEnded() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Sports");

        string[] memory opts = new string[](2);
        opts[0] = "A";
        opts[1] = "B";

        vm.prank(manager);
        uint256 pid = dao.createPoll(cid, "Q?", opts, 7 days);

        vm.prank(manager);
        vm.expectRevert("Poll not ended");
        dao.finalizePoll(pid);
    }

    // ── rewards ──────────────────────────────────────────────────────

    function testDepositAndClaimReward() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Tigres FC", "Sports");

        vm.prank(fan1);
        dao.joinClub(cid);

        // Fan needs engagement score >= 10, so create a poll and vote
        string[] memory opts = new string[](2);
        opts[0] = "A";
        opts[1] = "B";

        vm.prank(manager);
        uint256 pid = dao.createPoll(cid, "Q?", opts, 1 days);

        vm.prank(fan1);
        dao.vote(pid, 0);

        // Deposit rewards
        vm.prank(manager);
        dao.depositRewards{value: 5 ether}(cid);

        FanTokenDAO.FanClub memory club = dao.getClub(cid);
        assertEq(club.rewardPool, 5 ether);

        // Claim
        uint256 balBefore = fan1.balance;
        vm.prank(fan1);
        dao.claimReward(cid, 1 ether);

        assertEq(fan1.balance, balBefore + 1 ether);
    }

    function testClaimRewardRevertNotMember() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Sports");

        vm.prank(manager);
        dao.depositRewards{value: 5 ether}(cid);

        vm.prank(anyone);
        vm.expectRevert("Not a member");
        dao.claimReward(cid, 1 ether);
    }

    function testClaimRewardRevertLowEngagement() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Sports");

        vm.prank(fan1);
        dao.joinClub(cid);

        vm.prank(manager);
        dao.depositRewards{value: 5 ether}(cid);

        vm.prank(fan1);
        vm.expectRevert("Low engagement");
        dao.claimReward(cid, 1 ether);
    }

    // ── createPoll edge cases ────────────────────────────────────────

    function testCreatePollRevertTooFewOptions() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Sports");

        string[] memory opts = new string[](1);
        opts[0] = "Only one";

        vm.prank(manager);
        vm.expectRevert("Min 2 options");
        dao.createPoll(cid, "Q?", opts, 7 days);
    }

    function testVoteUpdatesEngagement() public {
        vm.prank(manager);
        uint256 cid = dao.createClub("Team", "Music");

        vm.prank(fan1);
        dao.joinClub(cid);

        string[] memory opts = new string[](2);
        opts[0] = "A";
        opts[1] = "B";

        vm.prank(manager);
        uint256 pid = dao.createPoll(cid, "Q?", opts, 7 days);

        vm.prank(fan1);
        dao.vote(pid, 0);

        uint256 mid = dao.clubMemberId(cid, fan1);
        FanTokenDAO.Member memory m = dao.getMember(mid);
        assertEq(m.engagementScore, 10);
        assertEq(m.votesCount, 1);
    }
}
