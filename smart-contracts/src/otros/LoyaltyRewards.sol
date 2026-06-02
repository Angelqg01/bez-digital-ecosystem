// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title LoyaltyRewards — On-chain loyalty points with tiers, redemptions and expiry
contract LoyaltyRewards is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    enum Tier { BRONZE, SILVER, GOLD, PLATINUM, DIAMOND }

    struct Member {
        address wallet;
        bytes32 nameHash;
        uint256 points;
        uint256 lifetimePoints;
        Tier tier;
        bool active;
        uint256 joinedAt;
    }

    struct Redemption {
        uint256 id;
        address member;
        uint256 pointsSpent;
        bytes32 rewardHash;
        uint256 redeemedAt;
    }

    mapping(address => Member) public members;
    mapping(uint256 => Redemption) public redemptions;
    address[] internal _memberList;

    uint256 public nextRedemptionId = 1;

    event MemberRegistered(address indexed wallet);
    event PointsIssued(address indexed wallet, uint256 amount);
    event PointsRedeemed(address indexed wallet, uint256 redemptionId, uint256 points);
    event TierUpdated(address indexed wallet, Tier newTier);
    event MemberDeactivated(address indexed wallet);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    function registerMember(address _wallet, bytes32 _nameHash) external onlyRole(ISSUER_ROLE) returns (uint256) {
        require(!members[_wallet].active, "Already registered");
        members[_wallet] = Member({
            wallet: _wallet,
            nameHash: _nameHash,
            points: 0,
            lifetimePoints: 0,
            tier: Tier.BRONZE,
            active: true,
            joinedAt: block.timestamp
        });
        _memberList.push(_wallet);
        emit MemberRegistered(_wallet);
        return _memberList.length;
    }

    function issuePoints(address _wallet, uint256 _amount) external onlyRole(ISSUER_ROLE) {
        require(members[_wallet].active, "Not active");
        require(_amount > 0, "Amount required");
        members[_wallet].points += _amount;
        members[_wallet].lifetimePoints += _amount;
        _updateTier(_wallet);
        emit PointsIssued(_wallet, _amount);
    }

    function redeemPoints(address _wallet, uint256 _points, bytes32 _rewardHash) external onlyRole(ISSUER_ROLE) returns (uint256) {
        require(members[_wallet].active, "Not active");
        require(_points > 0, "Points required");
        require(members[_wallet].points >= _points, "Insufficient points");

        members[_wallet].points -= _points;
        uint256 rid = nextRedemptionId++;
        redemptions[rid] = Redemption({
            id: rid,
            member: _wallet,
            pointsSpent: _points,
            rewardHash: _rewardHash,
            redeemedAt: block.timestamp
        });
        _updateTier(_wallet);
        emit PointsRedeemed(_wallet, rid, _points);
        return rid;
    }

    function deactivateMember(address _wallet) external onlyRole(ISSUER_ROLE) {
        require(members[_wallet].active, "Not active");
        members[_wallet].active = false;
        emit MemberDeactivated(_wallet);
    }

    // ── View helpers ──
    function getMemberCount() external view returns (uint256) {
        return _memberList.length;
    }

    function getMemberTier(address _wallet) external view returns (Tier) {
        return members[_wallet].tier;
    }

    function getPoints(address _wallet) external view returns (uint256) {
        return members[_wallet].points;
    }

    // ── Internal ──
    function _updateTier(address _wallet) internal {
        uint256 lp = members[_wallet].lifetimePoints;
        Tier newTier;
        if (lp >= 100000) newTier = Tier.DIAMOND;
        else if (lp >= 50000) newTier = Tier.PLATINUM;
        else if (lp >= 20000) newTier = Tier.GOLD;
        else if (lp >= 5000) newTier = Tier.SILVER;
        else newTier = Tier.BRONZE;

        if (newTier != members[_wallet].tier) {
            members[_wallet].tier = newTier;
            emit TierUpdated(_wallet, newTier);
        }
    }
}
