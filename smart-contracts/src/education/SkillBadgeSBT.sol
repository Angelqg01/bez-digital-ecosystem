// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title SkillBadgeSBT — Soulbound skill badges / micro-credentials on BeZhas Chain
/// @notice Mint non-transferable skill badges, verify, revoke
contract SkillBadgeSBT is AccessControl {

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Badge {
        string  title;
        string  skill;
        uint256 level;          // 1-3
        uint256 score;          // 0-100
        address holder;
        address issuer;
        uint256 issuedAt;
        bool    verified;
        bool    revoked;
    }

    struct Issuer {
        string  name;
        address addr;
        uint256 badgesIssued;
        bool    accredited;
    }

    uint256 public nextBadgeId;
    mapping(uint256 => Badge) public badges;

    uint256 public nextIssuerId;
    mapping(uint256 => Issuer) public issuers;
    mapping(address => uint256[]) public holderBadges;

    event IssuerRegistered(uint256 indexed issuerId, string name, address indexed addr);
    event BadgeMinted(uint256 indexed badgeId, address indexed holder, string title, uint256 level, uint256 score);
    event BadgeVerified(uint256 indexed badgeId);
    event BadgeRevoked(uint256 indexed badgeId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    function registerIssuer(string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        uint256 id = nextIssuerId++;
        issuers[id] = Issuer({
            name: name,
            addr: msg.sender,
            badgesIssued: 0,
            accredited: true
        });

        emit IssuerRegistered(id, name, msg.sender);
        return id;
    }

    function mintBadge(
        address holder,
        string calldata title,
        string calldata skill,
        uint256 level,
        uint256 score
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        require(holder != address(0), "Invalid holder");
        require(level >= 1 && level <= 3, "Level 1-3");
        require(score <= 100, "Score 0-100");

        uint256 id = nextBadgeId++;
        badges[id] = Badge({
            title: title,
            skill: skill,
            level: level,
            score: score,
            holder: holder,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            verified: false,
            revoked: false
        });
        holderBadges[holder].push(id);

        emit BadgeMinted(id, holder, title, level, score);
        return id;
    }

    function verifyBadge(uint256 badgeId) external onlyRole(ISSUER_ROLE) {
        require(badges[badgeId].issuedAt > 0, "Badge not found");
        require(!badges[badgeId].revoked, "Badge revoked");
        require(!badges[badgeId].verified, "Already verified");

        badges[badgeId].verified = true;
        emit BadgeVerified(badgeId);
    }

    function revokeBadge(uint256 badgeId) external onlyRole(ISSUER_ROLE) {
        require(badges[badgeId].issuedAt > 0, "Badge not found");
        require(!badges[badgeId].revoked, "Already revoked");

        badges[badgeId].revoked = true;
        badges[badgeId].verified = false;
        emit BadgeRevoked(badgeId);
    }

    function getBadge(uint256 badgeId) external view returns (Badge memory) {
        return badges[badgeId];
    }

    function getHolderBadgeCount(address holder) external view returns (uint256) {
        return holderBadges[holder].length;
    }
}
