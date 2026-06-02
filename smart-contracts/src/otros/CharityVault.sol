// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CharityVault — Transparent donation pool with allocation tracking and beneficiary withdrawals
contract CharityVault is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    enum CauseStatus { ACTIVE, PAUSED, COMPLETED, CANCELLED }

    struct Cause {
        uint256 id;
        address beneficiary;
        uint256 goal;
        uint256 raised;
        uint256 withdrawn;
        bytes32 nameHash;
        CauseStatus status;
        uint256 donorCount;
        uint256 createdAt;
    }

    struct Donation {
        uint256 id;
        uint256 causeId;
        address donor;
        uint256 amount;
        bytes32 messageHash;
        uint256 donatedAt;
    }

    mapping(uint256 => Cause) public causes;
    mapping(uint256 => Donation) public donations;
    mapping(uint256 => uint256[]) internal _causeDonations;
    mapping(address => uint256[]) internal _donorHistory;

    uint256 public nextCauseId = 1;
    uint256 public nextDonationId = 1;

    event CauseCreated(uint256 indexed causeId, address indexed beneficiary, uint256 goal);
    event DonationReceived(uint256 indexed causeId, address indexed donor, uint256 amount);
    event FundsWithdrawn(uint256 indexed causeId, uint256 amount);
    event CauseCompleted(uint256 indexed causeId);
    event CausePaused(uint256 indexed causeId);
    event CauseResumed(uint256 indexed causeId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    function createCause(address _beneficiary, uint256 _goal, bytes32 _nameHash) external onlyRole(MANAGER_ROLE) returns (uint256) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_goal > 0, "Goal required");

        uint256 cid = nextCauseId++;
        causes[cid] = Cause({
            id: cid,
            beneficiary: _beneficiary,
            goal: _goal,
            raised: 0,
            withdrawn: 0,
            nameHash: _nameHash,
            status: CauseStatus.ACTIVE,
            donorCount: 0,
            createdAt: block.timestamp
        });

        emit CauseCreated(cid, _beneficiary, _goal);
        return cid;
    }

    function donate(uint256 _causeId, bytes32 _messageHash) external payable returns (uint256) {
        Cause storage c = causes[_causeId];
        require(c.status == CauseStatus.ACTIVE, "Not active");
        require(msg.value > 0, "Amount required");

        uint256 did = nextDonationId++;
        donations[did] = Donation({
            id: did,
            causeId: _causeId,
            donor: msg.sender,
            amount: msg.value,
            messageHash: _messageHash,
            donatedAt: block.timestamp
        });
        _causeDonations[_causeId].push(did);
        _donorHistory[msg.sender].push(did);
        c.raised += msg.value;
        c.donorCount++;

        emit DonationReceived(_causeId, msg.sender, msg.value);

        if (c.raised >= c.goal) {
            c.status = CauseStatus.COMPLETED;
            emit CauseCompleted(_causeId);
        }
        return did;
    }

    function withdrawFunds(uint256 _causeId, uint256 _amount) external {
        Cause storage c = causes[_causeId];
        require(msg.sender == c.beneficiary, "Not beneficiary");
        require(_amount > 0, "Amount required");
        uint256 available = c.raised - c.withdrawn;
        require(_amount <= available, "Insufficient funds");

        c.withdrawn += _amount;
        (bool ok,) = c.beneficiary.call{value: _amount}("");
        require(ok, "Transfer failed");

        emit FundsWithdrawn(_causeId, _amount);
    }

    function pauseCause(uint256 _causeId) external onlyRole(MANAGER_ROLE) {
        Cause storage c = causes[_causeId];
        require(c.status == CauseStatus.ACTIVE, "Not active");
        c.status = CauseStatus.PAUSED;
        emit CausePaused(_causeId);
    }

    function resumeCause(uint256 _causeId) external onlyRole(MANAGER_ROLE) {
        Cause storage c = causes[_causeId];
        require(c.status == CauseStatus.PAUSED, "Not paused");
        c.status = CauseStatus.ACTIVE;
        emit CauseResumed(_causeId);
    }

    // ── View helpers ──
    function getCauseDonations(uint256 _causeId) external view returns (uint256[] memory) {
        return _causeDonations[_causeId];
    }

    function getDonorHistory(address _donor) external view returns (uint256[] memory) {
        return _donorHistory[_donor];
    }

    function getAvailableFunds(uint256 _causeId) external view returns (uint256) {
        Cause storage c = causes[_causeId];
        return c.raised - c.withdrawn;
    }

    function getCauseProgress(uint256 _causeId) external view returns (uint256 raised, uint256 goal, uint256 percentage) {
        Cause storage c = causes[_causeId];
        raised = c.raised;
        goal = c.goal;
        percentage = c.goal > 0 ? (c.raised * 100) / c.goal : 0;
    }
}
