// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ServiceReputationNFT — On-chain reputation system for service providers with reviews, badges and scoring
contract ServiceReputationNFT is AccessControl {

    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");

    enum BadgeLevel { NONE, BRONZE, SILVER, GOLD, PLATINUM }

    struct Provider {
        address wallet;
        bytes32 nameHash;
        uint256 totalReviews;
        uint256 totalScore;
        uint256 completedJobs;
        uint256 disputes;
        BadgeLevel badge;
        bool active;
        uint256 registeredAt;
    }

    struct Review {
        uint256 id;
        address provider;
        address reviewer;
        uint256 score;
        bytes32 commentHash;
        uint256 createdAt;
    }

    uint256 public nextReviewId;
    mapping(address => Provider) public providers;
    mapping(uint256 => Review) public reviews;
    mapping(address => uint256[]) public providerReviews;
    address[] public providerList;

    event ProviderRegistered(address indexed provider);
    event ReviewSubmitted(uint256 indexed reviewId, address indexed provider, uint256 score);
    event JobCompleted(address indexed provider, uint256 totalCompleted);
    event DisputeRecorded(address indexed provider, uint256 totalDisputes);
    event BadgeUpdated(address indexed provider, BadgeLevel badge);
    event ProviderDeactivated(address indexed provider);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REVIEWER_ROLE, msg.sender);
    }

    // ── Register a service provider ──────────────────
    function registerProvider(address _wallet, bytes32 _nameHash) external onlyRole(REVIEWER_ROLE) {
        require(_wallet != address(0), "Invalid address");
        require(!providers[_wallet].active, "Already registered");

        providers[_wallet] = Provider({
            wallet: _wallet,
            nameHash: _nameHash,
            totalReviews: 0,
            totalScore: 0,
            completedJobs: 0,
            disputes: 0,
            badge: BadgeLevel.NONE,
            active: true,
            registeredAt: block.timestamp
        });
        providerList.push(_wallet);

        emit ProviderRegistered(_wallet);
    }

    // ── Submit a review (1-5 score) ──────────────────
    function submitReview(address _provider, uint256 _score, bytes32 _commentHash) external onlyRole(REVIEWER_ROLE) {
        require(providers[_provider].active, "Not active provider");
        require(_score >= 1 && _score <= 5, "Score must be 1-5");

        uint256 rid = nextReviewId++;
        reviews[rid] = Review({
            id: rid,
            provider: _provider,
            reviewer: msg.sender,
            score: _score,
            commentHash: _commentHash,
            createdAt: block.timestamp
        });
        providerReviews[_provider].push(rid);

        Provider storage p = providers[_provider];
        p.totalReviews++;
        p.totalScore += _score;

        _updateBadge(_provider);

        emit ReviewSubmitted(rid, _provider, _score);
    }

    // ── Record a completed job ──────────────────
    function recordJobCompleted(address _provider) external onlyRole(REVIEWER_ROLE) {
        require(providers[_provider].active, "Not active provider");
        providers[_provider].completedJobs++;
        _updateBadge(_provider);
        emit JobCompleted(_provider, providers[_provider].completedJobs);
    }

    // ── Record a dispute ──────────────────
    function recordDispute(address _provider) external onlyRole(REVIEWER_ROLE) {
        require(providers[_provider].active, "Not active provider");
        providers[_provider].disputes++;
        _updateBadge(_provider);
        emit DisputeRecorded(_provider, providers[_provider].disputes);
    }

    // ── Deactivate a provider ──────────────────
    function deactivateProvider(address _provider) external onlyRole(REVIEWER_ROLE) {
        require(providers[_provider].active, "Not active");
        providers[_provider].active = false;
        emit ProviderDeactivated(_provider);
    }

    // ── View helpers ──────────────────
    function getProviderReviews(address _provider) external view returns (uint256[] memory) {
        return providerReviews[_provider];
    }

    function getAverageScore(address _provider) external view returns (uint256) {
        Provider storage p = providers[_provider];
        if (p.totalReviews == 0) return 0;
        return (p.totalScore * 100) / p.totalReviews; // Returns score * 100 for precision
    }

    function getProviderCount() external view returns (uint256) {
        return providerList.length;
    }

    function getBadge(address _provider) external view returns (BadgeLevel) {
        return providers[_provider].badge;
    }

    // ── Internal: auto-calculate badge ──────────────────
    function _updateBadge(address _provider) internal {
        Provider storage p = providers[_provider];
        BadgeLevel newBadge = BadgeLevel.NONE;

        uint256 avgScore = p.totalReviews > 0 ? (p.totalScore * 100) / p.totalReviews : 0;

        if (p.completedJobs >= 50 && avgScore >= 450 && p.disputes <= 2) {
            newBadge = BadgeLevel.PLATINUM;
        } else if (p.completedJobs >= 25 && avgScore >= 400 && p.disputes <= 5) {
            newBadge = BadgeLevel.GOLD;
        } else if (p.completedJobs >= 10 && avgScore >= 350) {
            newBadge = BadgeLevel.SILVER;
        } else if (p.completedJobs >= 3 && avgScore >= 300) {
            newBadge = BadgeLevel.BRONZE;
        }

        if (newBadge != p.badge) {
            p.badge = newBadge;
            emit BadgeUpdated(_provider, newBadge);
        }
    }
}
