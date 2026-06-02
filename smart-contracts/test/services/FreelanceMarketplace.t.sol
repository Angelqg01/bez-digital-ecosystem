// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/services/FreelanceMarketplace.sol";

contract FreelanceMarketplaceTest is Test {
    FreelanceMarketplace mkt;
    address admin = address(this);
    address arbiter = address(0xA1);
    address client1 = address(0xB1);
    address freelancer1 = address(0xC1);
    address freelancer2 = address(0xC2);
    address treasury = address(0xD1);

    function setUp() public {
        mkt = new FreelanceMarketplace(treasury);
        mkt.grantRole(mkt.ARBITER_ROLE(), arbiter);
        vm.deal(client1, 100 ether);
        vm.deal(freelancer1, 10 ether);
    }

    // ── createGig ──────────────────
    function testCreateGig() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 3);
        (uint256 rid, address c, address f, uint256 b, bytes32 dh, uint256 mc, uint256 ma, FreelanceMarketplace.GigStatus s, uint256 ca) = mkt.gigs(gid);
        assertEq(c, client1);
        assertEq(b, 10 ether);
        assertEq(mc, 3);
        assertEq(uint8(s), uint8(FreelanceMarketplace.GigStatus.OPEN));
    }

    function testCreateGigRevertNoBudget() public {
        vm.prank(client1);
        vm.expectRevert("Budget required");
        mkt.createGig(keccak256("desc"), 3);
    }

    function testCreateGigRevertNoMilestones() public {
        vm.prank(client1);
        vm.expectRevert("Need milestones");
        mkt.createGig{value: 10 ether}(keccak256("desc"), 0);
    }

    // ── assignFreelancer ──────────────────
    function testAssignFreelancer() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.prank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        (, , address f, , , , , FreelanceMarketplace.GigStatus s,) = mkt.gigs(gid);
        assertEq(f, freelancer1);
        assertEq(uint8(s), uint8(FreelanceMarketplace.GigStatus.ASSIGNED));
    }

    function testAssignFreelancerRevertNotClient() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.prank(freelancer1);
        vm.expectRevert("Not client");
        mkt.assignFreelancer(gid, freelancer1);
    }

    function testAssignFreelancerRevertNotOpen() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        vm.expectRevert("Not open");
        mkt.assignFreelancer(gid, freelancer2);
        vm.stopPrank();
    }

    // ── addMilestone ──────────────────
    function testAddMilestone() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.prank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        vm.prank(client1);
        uint256 mid = mkt.addMilestone(gid, 5 ether, keccak256("deliverable1"));
        (uint256 rid, uint256 mgid, uint256 amt, bytes32 dh, bool del, bool apr) = mkt.milestones(mid);
        assertEq(mgid, gid);
        assertEq(amt, 5 ether);
        assertFalse(del);
        assertFalse(apr);
    }

    function testAddMilestoneRevertNotClient() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.prank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        vm.prank(freelancer1);
        vm.expectRevert("Not client");
        mkt.addMilestone(gid, 5 ether, keccak256("d"));
    }

    // ── deliverMilestone ──────────────────
    function testDeliverMilestone() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        uint256 mid = mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        vm.stopPrank();

        vm.prank(freelancer1);
        mkt.deliverMilestone(mid);
        (, , , , bool del,) = mkt.milestones(mid);
        assertTrue(del);
    }

    function testDeliverMilestoneRevertNotFreelancer() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        uint256 mid = mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        vm.stopPrank();

        vm.prank(client1);
        vm.expectRevert("Not freelancer");
        mkt.deliverMilestone(mid);
    }

    // ── approveMilestone ──────────────────
    function testApproveMilestone() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        uint256 mid = mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        vm.stopPrank();

        vm.prank(freelancer1);
        mkt.deliverMilestone(mid);

        uint256 fBalBefore = freelancer1.balance;
        vm.prank(client1);
        mkt.approveMilestone(mid);

        (, , , , , bool apr) = mkt.milestones(mid);
        assertTrue(apr);
        // Freelancer receives milestone amount minus 7.5% platform fee
        uint256 fee = (5 ether * 750) / 10_000;
        assertEq(freelancer1.balance, fBalBefore + 5 ether - fee);
    }

    function testApproveMilestoneRevertNotDelivered() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        uint256 mid = mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        vm.stopPrank();

        vm.prank(client1);
        vm.expectRevert("Not delivered");
        mkt.approveMilestone(mid);
    }

    function testApproveMilestoneAutoCompletes() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 1);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        uint256 mid = mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        vm.stopPrank();

        vm.prank(freelancer1);
        mkt.deliverMilestone(mid);
        vm.prank(client1);
        mkt.approveMilestone(mid);

        (, , , , , , , FreelanceMarketplace.GigStatus s,) = mkt.gigs(gid);
        assertEq(uint8(s), uint8(FreelanceMarketplace.GigStatus.COMPLETED));
    }

    // ── raiseDispute ──────────────────
    function testRaiseDispute() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        vm.stopPrank();

        vm.prank(client1);
        mkt.raiseDispute(gid);
        (, , , , , , , FreelanceMarketplace.GigStatus s,) = mkt.gigs(gid);
        assertEq(uint8(s), uint8(FreelanceMarketplace.GigStatus.DISPUTED));
    }

    function testRaiseDisputeRevertNotParty() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        vm.stopPrank();

        vm.prank(freelancer2);
        vm.expectRevert("Not party");
        mkt.raiseDispute(gid);
    }

    // ── resolveDispute ──────────────────
    function testResolveDispute() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        mkt.raiseDispute(gid);
        vm.stopPrank();

        uint256 f1Bal = freelancer1.balance;
        vm.prank(arbiter);
        mkt.resolveDispute(gid, freelancer1);

        (, , , , , , , FreelanceMarketplace.GigStatus s,) = mkt.gigs(gid);
        assertEq(uint8(s), uint8(FreelanceMarketplace.GigStatus.COMPLETED));
        assertGt(freelancer1.balance, f1Bal);
    }

    function testResolveDisputeRevertNotDisputed() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.prank(arbiter);
        vm.expectRevert("Not disputed");
        mkt.resolveDispute(gid, client1);
    }

    // ── cancelGig ──────────────────
    function testCancelGig() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);

        uint256 balBefore = client1.balance;
        vm.prank(client1);
        mkt.cancelGig(gid);

        (, , , , , , , FreelanceMarketplace.GigStatus s,) = mkt.gigs(gid);
        assertEq(uint8(s), uint8(FreelanceMarketplace.GigStatus.CANCELLED));
        assertEq(client1.balance, balBefore + 10 ether);
    }

    function testCancelGigRevertNotOpen() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        vm.expectRevert("Cannot cancel");
        mkt.cancelGig(gid);
        vm.stopPrank();
    }

    // ── View helpers ──────────────────
    function testGetGigMilestones() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.startPrank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        mkt.addMilestone(gid, 5 ether, keccak256("d1"));
        mkt.addMilestone(gid, 5 ether, keccak256("d2"));
        vm.stopPrank();

        uint256[] memory mids = mkt.getGigMilestones(gid);
        assertEq(mids.length, 2);
    }

    function testGetClientGigs() public {
        vm.startPrank(client1);
        mkt.createGig{value: 5 ether}(keccak256("d1"), 1);
        mkt.createGig{value: 5 ether}(keccak256("d2"), 2);
        vm.stopPrank();
        uint256[] memory gids = mkt.getClientGigs(client1);
        assertEq(gids.length, 2);
    }

    function testGetFreelancerGigs() public {
        vm.prank(client1);
        uint256 gid = mkt.createGig{value: 10 ether}(keccak256("desc"), 2);
        vm.prank(client1);
        mkt.assignFreelancer(gid, freelancer1);
        uint256[] memory fgids = mkt.getFreelancerGigs(freelancer1);
        assertEq(fgids.length, 1);
    }
}
