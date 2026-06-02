// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title RoyaltyDistributor — Automated royalty splits for content creators on BeZhas Chain
/// @notice Register content, define revenue splits, distribute royalties transparently
contract RoyaltyDistributor is AccessControl {

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    enum ContentType { MUSIC, VIDEO, ART, PODCAST, GAME }

    struct Content {
        string      title;
        ContentType contentType;
        address     creator;
        uint256     registeredAt;
        uint256     totalRevenue;
        uint256     totalDistributed;
        bool        active;
    }

    struct Split {
        address beneficiary;
        uint256 shareBps; // basis points (total splits for a content must = 10000)
    }

    struct Distribution {
        uint256 contentId;
        uint256 amount;
        uint256 distributedAt;
    }

    uint256 public nextContentId;
    mapping(uint256 => Content) public contents;
    mapping(uint256 => Split[]) public contentSplits;

    uint256 public nextDistId;
    mapping(uint256 => Distribution) public distributions;
    mapping(uint256 => uint256[]) public contentDistributions;
    mapping(address => uint256) public pendingWithdrawals;

    event ContentRegistered(uint256 indexed contentId, string title, ContentType contentType, address indexed creator);
    event SplitsConfigured(uint256 indexed contentId, uint256 splitCount);
    event RevenueDeposited(uint256 indexed contentId, uint256 amount);
    event RoyaltiesDistributed(uint256 indexed contentId, uint256 distId, uint256 amount);
    event Withdrawn(address indexed beneficiary, uint256 amount);
    event ContentDeactivated(uint256 indexed contentId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }

    function registerContent(
        string calldata title,
        ContentType contentType
    ) external returns (uint256) {
        uint256 id = nextContentId++;
        contents[id] = Content({
            title: title,
            contentType: contentType,
            creator: msg.sender,
            registeredAt: block.timestamp,
            totalRevenue: 0,
            totalDistributed: 0,
            active: true
        });

        emit ContentRegistered(id, title, contentType, msg.sender);
        return id;
    }

    function configureSplits(
        uint256 contentId,
        address[] calldata beneficiaries,
        uint256[] calldata sharesBps
    ) external {
        Content storage c = contents[contentId];
        require(c.creator == msg.sender, "Not creator");
        require(beneficiaries.length == sharesBps.length, "Length mismatch");
        require(beneficiaries.length > 0, "No splits");

        // Clear existing splits
        delete contentSplits[contentId];

        uint256 total;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            require(beneficiaries[i] != address(0), "Invalid beneficiary");
            require(sharesBps[i] > 0, "Share must be > 0");
            total += sharesBps[i];
            contentSplits[contentId].push(Split({
                beneficiary: beneficiaries[i],
                shareBps: sharesBps[i]
            }));
        }
        require(total == 10000, "Splits must total 100%");

        emit SplitsConfigured(contentId, beneficiaries.length);
    }

    function depositRevenue(uint256 contentId) external payable {
        Content storage c = contents[contentId];
        require(c.active, "Content not active");
        require(msg.value > 0, "No value sent");

        c.totalRevenue += msg.value;
        emit RevenueDeposited(contentId, msg.value);
    }

    function distributeRoyalties(uint256 contentId, uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) {
        Content storage c = contents[contentId];
        require(c.active, "Content not active");
        uint256 available = c.totalRevenue - c.totalDistributed;
        require(amount <= available, "Insufficient revenue");

        Split[] storage splits = contentSplits[contentId];
        require(splits.length > 0, "No splits configured");

        c.totalDistributed += amount;

        uint256 distId = nextDistId++;
        distributions[distId] = Distribution({
            contentId: contentId,
            amount: amount,
            distributedAt: block.timestamp
        });
        contentDistributions[contentId].push(distId);

        for (uint256 i = 0; i < splits.length; i++) {
            uint256 share = (amount * splits[i].shareBps) / 10000;
            pendingWithdrawals[splits[i].beneficiary] += share;
        }

        emit RoyaltiesDistributed(contentId, distId, amount);
    }

    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Withdraw failed");

        emit Withdrawn(msg.sender, amount);
    }

    function deactivateContent(uint256 contentId) external {
        Content storage c = contents[contentId];
        require(c.creator == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        require(c.active, "Already inactive");
        c.active = false;

        emit ContentDeactivated(contentId);
    }

    function getContent(uint256 contentId) external view returns (Content memory) {
        return contents[contentId];
    }

    function getSplitCount(uint256 contentId) external view returns (uint256) {
        return contentSplits[contentId].length;
    }

    function getSplit(uint256 contentId, uint256 index) external view returns (Split memory) {
        return contentSplits[contentId][index];
    }

    function getDistributionCount(uint256 contentId) external view returns (uint256) {
        return contentDistributions[contentId].length;
    }

    receive() external payable {}
}
