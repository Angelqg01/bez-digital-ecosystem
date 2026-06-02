// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title FreelanceMarketplace — On-chain gig economy with escrow, milestones and dispute resolution
contract FreelanceMarketplace is AccessControl {

    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    enum GigStatus { OPEN, ASSIGNED, IN_PROGRESS, DELIVERED, COMPLETED, DISPUTED, CANCELLED }

    struct Gig {
        uint256 id;
        address client;
        address freelancer;
        uint256 budget;
        bytes32 descHash;
        uint256 milestoneCount;
        uint256 milestonesApproved;
        GigStatus status;
        uint256 createdAt;
    }

    struct Milestone {
        uint256 id;
        uint256 gigId;
        uint256 amount;
        bytes32 deliverableHash;
        bool delivered;
        bool approved;
    }

    uint256 public nextGigId;
    uint256 public nextMilestoneId;
    mapping(uint256 => Gig) public gigs;
    mapping(uint256 => Milestone) public milestones;
    mapping(uint256 => uint256[]) public gigMilestones;
    mapping(address => uint256[]) public clientGigs;
    mapping(address => uint256[]) public freelancerGigs;

    // ─── Platform Fee ───
    uint256 public platformFeeBps = 750; // 7.5%
    address public treasury;
    uint256 public accruedFees;

    event GigCreated(uint256 indexed gigId, address indexed client, uint256 budget);
    event GigAssigned(uint256 indexed gigId, address indexed freelancer);
    event MilestoneAdded(uint256 indexed milestoneId, uint256 indexed gigId, uint256 amount);
    event MilestoneDelivered(uint256 indexed milestoneId);
    event MilestoneApproved(uint256 indexed milestoneId, uint256 amount);
    event GigCompleted(uint256 indexed gigId);
    event GigDisputed(uint256 indexed gigId);
    event DisputeResolved(uint256 indexed gigId, address winner);
    event GigCancelled(uint256 indexed gigId);
    event FeeCollected(uint256 indexed gigId, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, msg.sender);
        treasury = _treasury;
    }

    // ── Create a gig (client deposits budget) ──────────────────
    function createGig(bytes32 _descHash, uint256 _milestoneCount) external payable returns (uint256) {
        require(msg.value > 0, "Budget required");
        require(_milestoneCount > 0, "Need milestones");

        uint256 gid = nextGigId++;
        gigs[gid] = Gig({
            id: gid,
            client: msg.sender,
            freelancer: address(0),
            budget: msg.value,
            descHash: _descHash,
            milestoneCount: _milestoneCount,
            milestonesApproved: 0,
            status: GigStatus.OPEN,
            createdAt: block.timestamp
        });
        clientGigs[msg.sender].push(gid);

        emit GigCreated(gid, msg.sender, msg.value);
        return gid;
    }

    // ── Assign a freelancer ──────────────────
    function assignFreelancer(uint256 _gigId, address _freelancer) external {
        Gig storage g = gigs[_gigId];
        require(msg.sender == g.client, "Not client");
        require(g.status == GigStatus.OPEN, "Not open");
        require(_freelancer != address(0), "Invalid freelancer");

        g.freelancer = _freelancer;
        g.status = GigStatus.ASSIGNED;
        freelancerGigs[_freelancer].push(_gigId);

        emit GigAssigned(_gigId, _freelancer);
    }

    // ── Add a milestone (client defines payment tranches) ──────────────────
    function addMilestone(uint256 _gigId, uint256 _amount, bytes32 _deliverableHash) external returns (uint256) {
        Gig storage g = gigs[_gigId];
        require(msg.sender == g.client, "Not client");
        require(g.status == GigStatus.ASSIGNED || g.status == GigStatus.IN_PROGRESS, "Not active");
        require(_amount > 0, "Amount required");

        uint256 mid = nextMilestoneId++;
        milestones[mid] = Milestone({
            id: mid,
            gigId: _gigId,
            amount: _amount,
            deliverableHash: _deliverableHash,
            delivered: false,
            approved: false
        });
        gigMilestones[_gigId].push(mid);

        if (g.status == GigStatus.ASSIGNED) {
            g.status = GigStatus.IN_PROGRESS;
        }

        emit MilestoneAdded(mid, _gigId, _amount);
        return mid;
    }

    // ── Freelancer marks milestone as delivered ──────────────────
    function deliverMilestone(uint256 _milestoneId) external {
        Milestone storage m = milestones[_milestoneId];
        Gig storage g = gigs[m.gigId];
        require(msg.sender == g.freelancer, "Not freelancer");
        require(!m.delivered, "Already delivered");
        require(g.status == GigStatus.IN_PROGRESS, "Not in progress");

        m.delivered = true;
        g.status = GigStatus.DELIVERED;

        emit MilestoneDelivered(_milestoneId);
    }

    // ── Client approves milestone (releases payment) ──────────────────
    function approveMilestone(uint256 _milestoneId) external {
        Milestone storage m = milestones[_milestoneId];
        Gig storage g = gigs[m.gigId];
        require(msg.sender == g.client, "Not client");
        require(m.delivered, "Not delivered");
        require(!m.approved, "Already approved");

        m.approved = true;
        g.milestonesApproved++;
        g.status = GigStatus.IN_PROGRESS;

        // Calculate platform fee
        uint256 fee = (m.amount * platformFeeBps) / 10_000;
        uint256 netAmount = m.amount - fee;
        accruedFees += fee;

        // Pay freelancer (net of fee)
        (bool ok, ) = g.freelancer.call{value: netAmount}("");
        require(ok, "Payment failed");

        emit MilestoneApproved(_milestoneId, netAmount);
        if (fee > 0) emit FeeCollected(m.gigId, fee);

        // Auto-complete if all milestones approved
        if (g.milestonesApproved >= g.milestoneCount) {
            g.status = GigStatus.COMPLETED;
            emit GigCompleted(m.gigId);
        }
    }

    // ── Raise a dispute ──────────────────
    function raiseDispute(uint256 _gigId) external {
        Gig storage g = gigs[_gigId];
        require(msg.sender == g.client || msg.sender == g.freelancer, "Not party");
        require(g.status == GigStatus.IN_PROGRESS || g.status == GigStatus.DELIVERED, "Cannot dispute");

        g.status = GigStatus.DISPUTED;
        emit GigDisputed(_gigId);
    }

    // ── Arbiter resolves dispute ──────────────────
    function resolveDispute(uint256 _gigId, address _winner) external onlyRole(ARBITER_ROLE) {
        Gig storage g = gigs[_gigId];
        require(g.status == GigStatus.DISPUTED, "Not disputed");
        require(_winner == g.client || _winner == g.freelancer, "Invalid winner");

        g.status = GigStatus.COMPLETED;

        // Transfer remaining budget to winner
        uint256 remaining = address(this).balance;
        if (remaining > 0) {
            (bool ok, ) = _winner.call{value: remaining}("");
            require(ok, "Transfer failed");
        }

        emit DisputeResolved(_gigId, _winner);
    }

    // ── Cancel a gig ──────────────────
    function cancelGig(uint256 _gigId) external {
        Gig storage g = gigs[_gigId];
        require(msg.sender == g.client, "Not client");
        require(g.status == GigStatus.OPEN, "Cannot cancel");

        g.status = GigStatus.CANCELLED;

        (bool ok, ) = g.client.call{value: g.budget}("");
        require(ok, "Refund failed");

        emit GigCancelled(_gigId);
    }

    // ── View helpers ──────────────────
    function getGigMilestones(uint256 _gigId) external view returns (uint256[] memory) {
        return gigMilestones[_gigId];
    }

    function getClientGigs(address _client) external view returns (uint256[] memory) {
        return clientGigs[_client];
    }

    function getFreelancerGigs(address _freelancer) external view returns (uint256[] memory) {
        return freelancerGigs[_freelancer];
    }

    // ── Admin ──────────────────
    function withdrawFees(address _to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_to != address(0), "Invalid address");
        uint256 amount = accruedFees;
        require(amount > 0, "No fees");
        accruedFees = 0;
        (bool ok, ) = _to.call{value: amount}("");
        require(ok, "Transfer failed");
        emit FeesWithdrawn(_to, amount);
    }

    function setPlatformFee(uint256 _newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newFeeBps <= 1500, "Fee too high"); // max 15%
        platformFeeBps = _newFeeBps;
    }

    function setTreasury(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newTreasury != address(0), "Invalid address");
        treasury = _newTreasury;
    }
}
