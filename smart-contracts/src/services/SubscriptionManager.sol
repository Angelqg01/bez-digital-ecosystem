// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title SubscriptionManager — Recurring on-chain subscriptions with auto-renewal, tiers and cancellation
contract SubscriptionManager is AccessControl {

    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");

    enum PlanStatus { ACTIVE, PAUSED, RETIRED }
    enum SubStatus { ACTIVE, EXPIRED, CANCELLED }

    struct Plan {
        uint256 id;
        address provider;
        uint256 price;
        uint256 period;
        bytes32 nameHash;
        PlanStatus status;
        uint256 subscriberCount;
        uint256 createdAt;
    }

    struct Subscription {
        uint256 id;
        uint256 planId;
        address subscriber;
        uint256 startedAt;
        uint256 paidUntil;
        SubStatus status;
    }

    uint256 public nextPlanId;
    uint256 public nextSubId;
    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Subscription) public subscriptions;
    mapping(address => uint256[]) public subscriberSubs;
    mapping(uint256 => uint256) public planRevenue;

    event PlanCreated(uint256 indexed planId, address indexed provider, uint256 price);
    event PlanPaused(uint256 indexed planId);
    event PlanResumed(uint256 indexed planId);
    event PlanRetired(uint256 indexed planId);
    event Subscribed(uint256 indexed subId, uint256 indexed planId, address indexed subscriber);
    event Renewed(uint256 indexed subId, uint256 newPaidUntil);
    event SubCancelled(uint256 indexed subId);
    event RevenueWithdrawn(uint256 indexed planId, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROVIDER_ROLE, msg.sender);
    }

    // ── Create a subscription plan ──────────────────
    function createPlan(uint256 _price, uint256 _period, bytes32 _nameHash) external onlyRole(PROVIDER_ROLE) returns (uint256) {
        require(_price > 0, "Price required");
        require(_period > 0, "Period required");

        uint256 pid = nextPlanId++;
        plans[pid] = Plan({
            id: pid,
            provider: msg.sender,
            price: _price,
            period: _period,
            nameHash: _nameHash,
            status: PlanStatus.ACTIVE,
            subscriberCount: 0,
            createdAt: block.timestamp
        });

        emit PlanCreated(pid, msg.sender, _price);
        return pid;
    }

    // ── Pause / Resume / Retire a plan ──────────────────
    function pausePlan(uint256 _planId) external onlyRole(PROVIDER_ROLE) {
        Plan storage p = plans[_planId];
        require(p.provider == msg.sender, "Not provider");
        require(p.status == PlanStatus.ACTIVE, "Not active");
        p.status = PlanStatus.PAUSED;
        emit PlanPaused(_planId);
    }

    function resumePlan(uint256 _planId) external onlyRole(PROVIDER_ROLE) {
        Plan storage p = plans[_planId];
        require(p.provider == msg.sender, "Not provider");
        require(p.status == PlanStatus.PAUSED, "Not paused");
        p.status = PlanStatus.ACTIVE;
        emit PlanResumed(_planId);
    }

    function retirePlan(uint256 _planId) external onlyRole(PROVIDER_ROLE) {
        Plan storage p = plans[_planId];
        require(p.provider == msg.sender, "Not provider");
        require(p.status != PlanStatus.RETIRED, "Already retired");
        p.status = PlanStatus.RETIRED;
        emit PlanRetired(_planId);
    }

    // ── Subscribe to a plan ──────────────────
    function subscribe(uint256 _planId) external payable returns (uint256) {
        Plan storage p = plans[_planId];
        require(p.status == PlanStatus.ACTIVE, "Plan not active");
        require(msg.value == p.price, "Must pay exact price");

        uint256 sid = nextSubId++;
        subscriptions[sid] = Subscription({
            id: sid,
            planId: _planId,
            subscriber: msg.sender,
            startedAt: block.timestamp,
            paidUntil: block.timestamp + p.period,
            status: SubStatus.ACTIVE
        });
        subscriberSubs[msg.sender].push(sid);
        p.subscriberCount++;
        planRevenue[_planId] += msg.value;

        emit Subscribed(sid, _planId, msg.sender);
        return sid;
    }

    // ── Renew subscription ──────────────────
    function renew(uint256 _subId) external payable {
        Subscription storage s = subscriptions[_subId];
        require(s.subscriber == msg.sender, "Not subscriber");
        require(s.status == SubStatus.ACTIVE, "Not active");

        Plan storage p = plans[s.planId];
        require(msg.value == p.price, "Must pay exact price");

        s.paidUntil += p.period;
        planRevenue[s.planId] += msg.value;

        emit Renewed(_subId, s.paidUntil);
    }

    // ── Cancel subscription ──────────────────
    function cancelSubscription(uint256 _subId) external {
        Subscription storage s = subscriptions[_subId];
        require(s.subscriber == msg.sender, "Not subscriber");
        require(s.status == SubStatus.ACTIVE, "Not active");

        s.status = SubStatus.CANCELLED;
        emit SubCancelled(_subId);
    }

    // ── Provider withdraws revenue ──────────────────
    function withdrawRevenue(uint256 _planId) external onlyRole(PROVIDER_ROLE) {
        Plan storage p = plans[_planId];
        require(p.provider == msg.sender, "Not provider");

        uint256 amount = planRevenue[_planId];
        require(amount > 0, "No revenue");
        planRevenue[_planId] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Withdraw failed");

        emit RevenueWithdrawn(_planId, amount);
    }

    // ── View helpers ──────────────────
    function getSubscriberSubs(address _subscriber) external view returns (uint256[] memory) {
        return subscriberSubs[_subscriber];
    }

    function isSubActive(uint256 _subId) external view returns (bool) {
        Subscription storage s = subscriptions[_subId];
        return s.status == SubStatus.ACTIVE && block.timestamp <= s.paidUntil;
    }

    function getPlanRevenue(uint256 _planId) external view returns (uint256) {
        return planRevenue[_planId];
    }
}
