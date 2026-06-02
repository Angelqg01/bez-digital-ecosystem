// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title TreasuryVault — Multi-sig treasury with deposit tracking, spending limits and withdrawal approval
contract TreasuryVault is AccessControl {

    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    enum WithdrawalStatus { PENDING, APPROVED, EXECUTED, REJECTED }

    struct Withdrawal {
        uint256 id;
        address requester;
        address recipient;
        uint256 amount;
        bytes32 reasonHash;
        uint256 approvals;
        uint256 rejections;
        WithdrawalStatus status;
        uint256 createdAt;
    }

    uint256 public nextWithdrawalId;
    uint256 public requiredApprovals;
    uint256 public dailyLimit;
    uint256 public spentToday;
    uint256 public lastResetDay;

    mapping(uint256 => Withdrawal) public withdrawals;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(address => uint256) public depositorBalance;

    event Deposited(address indexed depositor, uint256 amount);
    event WithdrawalRequested(uint256 indexed withdrawalId, address indexed requester, uint256 amount);
    event WithdrawalApproved(uint256 indexed withdrawalId, address indexed approver);
    event WithdrawalRejected(uint256 indexed withdrawalId, address indexed approver);
    event WithdrawalExecuted(uint256 indexed withdrawalId, address indexed recipient, uint256 amount);
    event DailyLimitUpdated(uint256 newLimit);
    event RequiredApprovalsUpdated(uint256 newRequired);

    constructor(uint256 _requiredApprovals, uint256 _dailyLimit) {
        require(_requiredApprovals > 0, "Need at least 1 approval");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURER_ROLE, msg.sender);
        _grantRole(APPROVER_ROLE, msg.sender);
        requiredApprovals = _requiredApprovals;
        dailyLimit = _dailyLimit;
        lastResetDay = block.timestamp / 1 days;
    }

    // ── Deposit funds ──────────────────
    function deposit() external payable {
        require(msg.value > 0, "Amount must be > 0");
        depositorBalance[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // ── Request a withdrawal ──────────────────
    function requestWithdrawal(
        address _recipient,
        uint256 _amount,
        bytes32 _reasonHash
    ) external onlyRole(TREASURER_ROLE) returns (uint256) {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be > 0");
        require(_amount <= address(this).balance, "Insufficient balance");

        uint256 wid = nextWithdrawalId++;
        withdrawals[wid] = Withdrawal({
            id: wid,
            requester: msg.sender,
            recipient: _recipient,
            amount: _amount,
            reasonHash: _reasonHash,
            approvals: 0,
            rejections: 0,
            status: WithdrawalStatus.PENDING,
            createdAt: block.timestamp
        });

        emit WithdrawalRequested(wid, msg.sender, _amount);
        return wid;
    }

    // ── Approve a withdrawal ──────────────────
    function approveWithdrawal(uint256 _withdrawalId) external onlyRole(APPROVER_ROLE) {
        Withdrawal storage w = withdrawals[_withdrawalId];
        require(w.status == WithdrawalStatus.PENDING, "Not pending");
        require(!hasApproved[_withdrawalId][msg.sender], "Already voted");

        hasApproved[_withdrawalId][msg.sender] = true;
        w.approvals++;

        emit WithdrawalApproved(_withdrawalId, msg.sender);

        if (w.approvals >= requiredApprovals) {
            w.status = WithdrawalStatus.APPROVED;
        }
    }

    // ── Reject a withdrawal ──────────────────
    function rejectWithdrawal(uint256 _withdrawalId) external onlyRole(APPROVER_ROLE) {
        Withdrawal storage w = withdrawals[_withdrawalId];
        require(w.status == WithdrawalStatus.PENDING, "Not pending");
        require(!hasApproved[_withdrawalId][msg.sender], "Already voted");

        hasApproved[_withdrawalId][msg.sender] = true;
        w.rejections++;
        w.status = WithdrawalStatus.REJECTED;

        emit WithdrawalRejected(_withdrawalId, msg.sender);
    }

    // ── Execute an approved withdrawal ──────────────────
    function executeWithdrawal(uint256 _withdrawalId) external onlyRole(TREASURER_ROLE) {
        Withdrawal storage w = withdrawals[_withdrawalId];
        require(w.status == WithdrawalStatus.APPROVED, "Not approved");
        require(w.amount <= address(this).balance, "Insufficient balance");

        // Daily limit check
        _resetDailySpend();
        require(spentToday + w.amount <= dailyLimit, "Daily limit exceeded");
        spentToday += w.amount;

        w.status = WithdrawalStatus.EXECUTED;

        (bool ok, ) = w.recipient.call{value: w.amount}("");
        require(ok, "Transfer failed");

        emit WithdrawalExecuted(_withdrawalId, w.recipient, w.amount);
    }

    // ── Admin functions ──────────────────
    function setDailyLimit(uint256 _newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyLimit = _newLimit;
        emit DailyLimitUpdated(_newLimit);
    }

    function setRequiredApprovals(uint256 _newRequired) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newRequired > 0, "Need at least 1");
        requiredApprovals = _newRequired;
        emit RequiredApprovalsUpdated(_newRequired);
    }

    // ── View helpers ──────────────────
    function getVaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getDailyRemaining() external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) return dailyLimit;
        if (spentToday >= dailyLimit) return 0;
        return dailyLimit - spentToday;
    }

    // ── Internal ──────────────────
    function _resetDailySpend() internal {
        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) {
            spentToday = 0;
            lastResetDay = today;
        }
    }

    receive() external payable {
        depositorBalance[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
