// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/services/SubscriptionManager.sol";

contract SubscriptionManagerTest is Test {
    SubscriptionManager sub;
    address admin = address(this);
    address provider = address(0xA1);
    address subscriber1 = address(0xB1);
    address subscriber2 = address(0xB2);

    function setUp() public {
        sub = new SubscriptionManager();
        sub.grantRole(sub.PROVIDER_ROLE(), provider);
        vm.deal(subscriber1, 100 ether);
        vm.deal(subscriber2, 100 ether);
        vm.deal(provider, 10 ether);
    }

    // ── createPlan ──────────────────
    function testCreatePlan() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        (uint256 rid, address p, uint256 price, uint256 period, bytes32 nh, SubscriptionManager.PlanStatus s, uint256 sc, uint256 ca) = sub.plans(pid);
        assertEq(p, provider);
        assertEq(price, 1 ether);
        assertEq(period, 30 days);
        assertEq(uint8(s), uint8(SubscriptionManager.PlanStatus.ACTIVE));
    }

    function testCreatePlanRevertZeroPrice() public {
        vm.prank(provider);
        vm.expectRevert("Price required");
        sub.createPlan(0, 30 days, keccak256("x"));
    }

    function testCreatePlanRevertZeroPeriod() public {
        vm.prank(provider);
        vm.expectRevert("Period required");
        sub.createPlan(1 ether, 0, keccak256("x"));
    }

    // ── pausePlan / resumePlan / retirePlan ──────────────────
    function testPausePlan() public {
        vm.startPrank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        sub.pausePlan(pid);
        vm.stopPrank();
        (, , , , , SubscriptionManager.PlanStatus s, ,) = sub.plans(pid);
        assertEq(uint8(s), uint8(SubscriptionManager.PlanStatus.PAUSED));
    }

    function testResumePlan() public {
        vm.startPrank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        sub.pausePlan(pid);
        sub.resumePlan(pid);
        vm.stopPrank();
        (, , , , , SubscriptionManager.PlanStatus s, ,) = sub.plans(pid);
        assertEq(uint8(s), uint8(SubscriptionManager.PlanStatus.ACTIVE));
    }

    function testRetirePlan() public {
        vm.startPrank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        sub.retirePlan(pid);
        vm.stopPrank();
        (, , , , , SubscriptionManager.PlanStatus s, ,) = sub.plans(pid);
        assertEq(uint8(s), uint8(SubscriptionManager.PlanStatus.RETIRED));
    }

    function testPausePlanRevertNotActive() public {
        vm.startPrank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        sub.pausePlan(pid);
        vm.expectRevert("Not active");
        sub.pausePlan(pid);
        vm.stopPrank();
    }

    function testResumePlanRevertNotPaused() public {
        vm.startPrank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.expectRevert("Not paused");
        sub.resumePlan(pid);
        vm.stopPrank();
    }

    // ── subscribe ──────────────────
    function testSubscribe() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));

        vm.prank(subscriber1);
        uint256 sid = sub.subscribe{value: 1 ether}(pid);
        (uint256 rid, uint256 spid, address s, uint256 sa, uint256 pu, SubscriptionManager.SubStatus st) = sub.subscriptions(sid);
        assertEq(s, subscriber1);
        assertEq(spid, pid);
        assertEq(uint8(st), uint8(SubscriptionManager.SubStatus.ACTIVE));
        assertEq(pu, block.timestamp + 30 days);
    }

    function testSubscribeRevertWrongPrice() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));

        vm.prank(subscriber1);
        vm.expectRevert("Must pay exact price");
        sub.subscribe{value: 0.5 ether}(pid);
    }

    function testSubscribeRevertPlanNotActive() public {
        vm.startPrank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        sub.pausePlan(pid);
        vm.stopPrank();

        vm.prank(subscriber1);
        vm.expectRevert("Plan not active");
        sub.subscribe{value: 1 ether}(pid);
    }

    // ── renew ──────────────────
    function testRenew() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.prank(subscriber1);
        uint256 sid = sub.subscribe{value: 1 ether}(pid);

        uint256 firstPaidUntil = block.timestamp + 30 days;
        vm.prank(subscriber1);
        sub.renew{value: 1 ether}(sid);

        (, , , , uint256 pu,) = sub.subscriptions(sid);
        assertEq(pu, firstPaidUntil + 30 days);
    }

    function testRenewRevertNotSubscriber() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.prank(subscriber1);
        uint256 sid = sub.subscribe{value: 1 ether}(pid);

        vm.prank(subscriber2);
        vm.expectRevert("Not subscriber");
        sub.renew{value: 1 ether}(sid);
    }

    // ── cancelSubscription ──────────────────
    function testCancelSubscription() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.prank(subscriber1);
        uint256 sid = sub.subscribe{value: 1 ether}(pid);

        vm.prank(subscriber1);
        sub.cancelSubscription(sid);
        (, , , , , SubscriptionManager.SubStatus st) = sub.subscriptions(sid);
        assertEq(uint8(st), uint8(SubscriptionManager.SubStatus.CANCELLED));
    }

    function testCancelSubscriptionRevertNotActive() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.startPrank(subscriber1);
        uint256 sid = sub.subscribe{value: 1 ether}(pid);
        sub.cancelSubscription(sid);
        vm.expectRevert("Not active");
        sub.cancelSubscription(sid);
        vm.stopPrank();
    }

    // ── withdrawRevenue ──────────────────
    function testWithdrawRevenue() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.prank(subscriber1);
        sub.subscribe{value: 1 ether}(pid);

        uint256 provBal = provider.balance;
        vm.prank(provider);
        sub.withdrawRevenue(pid);
        assertEq(provider.balance, provBal + 1 ether);
    }

    function testWithdrawRevenueRevertNoRevenue() public {
        vm.startPrank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.expectRevert("No revenue");
        sub.withdrawRevenue(pid);
        vm.stopPrank();
    }

    // ── View helpers ──────────────────
    function testGetSubscriberSubs() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.startPrank(subscriber1);
        sub.subscribe{value: 1 ether}(pid);
        sub.subscribe{value: 1 ether}(pid);
        vm.stopPrank();
        uint256[] memory sids = sub.getSubscriberSubs(subscriber1);
        assertEq(sids.length, 2);
    }

    function testIsSubActive() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.prank(subscriber1);
        uint256 sid = sub.subscribe{value: 1 ether}(pid);
        assertTrue(sub.isSubActive(sid));

        vm.warp(block.timestamp + 31 days);
        assertFalse(sub.isSubActive(sid));
    }

    function testGetPlanRevenue() public {
        vm.prank(provider);
        uint256 pid = sub.createPlan(1 ether, 30 days, keccak256("Basic"));
        vm.prank(subscriber1);
        sub.subscribe{value: 1 ether}(pid);
        vm.prank(subscriber2);
        sub.subscribe{value: 1 ether}(pid);
        assertEq(sub.getPlanRevenue(pid), 2 ether);
    }
}
