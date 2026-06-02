// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title CreditScoreOracle — On-chain credit scoring with payment history, disputes and risk tiers
contract CreditScoreOracle is AccessControl {

    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    enum RiskTier { UNRATED, PRIME, NEAR_PRIME, SUBPRIME, DEEP_SUBPRIME }
    enum DisputeStatus { NONE, OPEN, RESOLVED, REJECTED }

    struct CreditProfile {
        address subject;
        uint256 score;
        uint256 totalLoans;
        uint256 defaultedLoans;
        uint256 onTimePayments;
        uint256 latePayments;
        RiskTier tier;
        bool active;
        uint256 lastUpdated;
    }

    struct PaymentRecord {
        uint256 id;
        address subject;
        uint256 amount;
        bool onTime;
        bytes32 referenceHash;
        uint256 timestamp;
    }

    struct Dispute {
        uint256 id;
        address subject;
        bytes32 reasonHash;
        DisputeStatus status;
        bytes32 resolutionHash;
        uint256 createdAt;
    }

    uint256 public nextRecordId;
    uint256 public nextDisputeId;
    mapping(address => CreditProfile) public profiles;
    mapping(uint256 => PaymentRecord) public records;
    mapping(address => uint256[]) public subjectRecords;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256[]) public subjectDisputes;

    event ProfileCreated(address indexed subject);
    event PaymentRecorded(uint256 indexed recordId, address indexed subject, bool onTime);
    event ScoreUpdated(address indexed subject, uint256 newScore, RiskTier newTier);
    event LoanRecorded(address indexed subject, bool defaulted);
    event DisputeOpened(uint256 indexed disputeId, address indexed subject);
    event DisputeResolved(uint256 indexed disputeId, DisputeStatus status);
    event ProfileDeactivated(address indexed subject);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REPORTER_ROLE, msg.sender);
    }

    // ── Create a credit profile ──────────────────
    function createProfile(address _subject) external onlyRole(REPORTER_ROLE) {
        require(_subject != address(0), "Invalid address");
        require(!profiles[_subject].active, "Profile exists");

        profiles[_subject] = CreditProfile({
            subject: _subject,
            score: 500,
            totalLoans: 0,
            defaultedLoans: 0,
            onTimePayments: 0,
            latePayments: 0,
            tier: RiskTier.UNRATED,
            active: true,
            lastUpdated: block.timestamp
        });

        emit ProfileCreated(_subject);
    }

    // ── Record a payment ──────────────────
    function recordPayment(
        address _subject,
        uint256 _amount,
        bool _onTime,
        bytes32 _referenceHash
    ) external onlyRole(REPORTER_ROLE) {
        require(profiles[_subject].active, "No active profile");

        uint256 rid = nextRecordId++;
        records[rid] = PaymentRecord({
            id: rid,
            subject: _subject,
            amount: _amount,
            onTime: _onTime,
            referenceHash: _referenceHash,
            timestamp: block.timestamp
        });
        subjectRecords[_subject].push(rid);

        CreditProfile storage p = profiles[_subject];
        if (_onTime) {
            p.onTimePayments++;
        } else {
            p.latePayments++;
        }

        _recalculateScore(_subject);
        emit PaymentRecorded(rid, _subject, _onTime);
    }

    // ── Record a loan outcome ──────────────────
    function recordLoan(address _subject, bool _defaulted) external onlyRole(REPORTER_ROLE) {
        require(profiles[_subject].active, "No active profile");

        CreditProfile storage p = profiles[_subject];
        p.totalLoans++;
        if (_defaulted) {
            p.defaultedLoans++;
        }

        _recalculateScore(_subject);
        emit LoanRecorded(_subject, _defaulted);
    }

    // ── Open a dispute ──────────────────
    function openDispute(bytes32 _reasonHash) external {
        require(profiles[msg.sender].active, "No active profile");

        uint256 did = nextDisputeId++;
        disputes[did] = Dispute({
            id: did,
            subject: msg.sender,
            reasonHash: _reasonHash,
            status: DisputeStatus.OPEN,
            resolutionHash: bytes32(0),
            createdAt: block.timestamp
        });
        subjectDisputes[msg.sender].push(did);

        emit DisputeOpened(did, msg.sender);
    }

    // ── Resolve a dispute ──────────────────
    function resolveDispute(
        uint256 _disputeId,
        bool _accepted,
        bytes32 _resolutionHash
    ) external onlyRole(REPORTER_ROLE) {
        Dispute storage d = disputes[_disputeId];
        require(d.status == DisputeStatus.OPEN, "Not open");

        d.resolutionHash = _resolutionHash;
        d.status = _accepted ? DisputeStatus.RESOLVED : DisputeStatus.REJECTED;

        emit DisputeResolved(_disputeId, d.status);
    }

    // ── Manual score override ──────────────────
    function overrideScore(address _subject, uint256 _newScore) external onlyRole(REPORTER_ROLE) {
        require(profiles[_subject].active, "No active profile");
        require(_newScore <= 850, "Score too high");

        profiles[_subject].score = _newScore;
        profiles[_subject].tier = _computeTier(_newScore);
        profiles[_subject].lastUpdated = block.timestamp;

        emit ScoreUpdated(_subject, _newScore, profiles[_subject].tier);
    }

    // ── Deactivate a profile ──────────────────
    function deactivateProfile(address _subject) external onlyRole(REPORTER_ROLE) {
        require(profiles[_subject].active, "Not active");
        profiles[_subject].active = false;
        emit ProfileDeactivated(_subject);
    }

    // ── View helpers ──────────────────
    function getSubjectRecords(address _subject) external view returns (uint256[] memory) {
        return subjectRecords[_subject];
    }

    function getSubjectDisputes(address _subject) external view returns (uint256[] memory) {
        return subjectDisputes[_subject];
    }

    function getScore(address _subject) external view returns (uint256 score, RiskTier tier) {
        CreditProfile storage p = profiles[_subject];
        return (p.score, p.tier);
    }

    // ── Internal ──────────────────
    function _recalculateScore(address _subject) internal {
        CreditProfile storage p = profiles[_subject];
        uint256 totalPayments = p.onTimePayments + p.latePayments;
        uint256 base = 500;

        if (totalPayments > 0) {
            // +200 max for payment history
            base += (p.onTimePayments * 200) / totalPayments;
        }

        if (p.totalLoans > 0) {
            // -150 max for default rate
            uint256 penalty = (p.defaultedLoans * 150) / p.totalLoans;
            if (penalty > base) {
                base = 0;
            } else {
                base -= penalty;
            }
        }

        // Cap at 850
        if (base > 850) base = 850;

        p.score = base;
        p.tier = _computeTier(base);
        p.lastUpdated = block.timestamp;

        emit ScoreUpdated(_subject, base, p.tier);
    }

    function _computeTier(uint256 _score) internal pure returns (RiskTier) {
        if (_score >= 720) return RiskTier.PRIME;
        if (_score >= 620) return RiskTier.NEAR_PRIME;
        if (_score >= 500) return RiskTier.SUBPRIME;
        return RiskTier.DEEP_SUBPRIME;
    }
}
