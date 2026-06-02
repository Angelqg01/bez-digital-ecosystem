// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ClaimAdjuster — AI-powered claim processing with fraud detection on BeZhas Chain
/// @notice File claims, submit evidence, AI scoring, fraud flagging, payout
contract ClaimAdjuster is AccessControl {

    bytes32 public constant ADJUSTER_ROLE = keccak256("ADJUSTER_ROLE");
    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");

    enum ClaimStatus { FILED, UNDER_REVIEW, APPROVED, DENIED, FLAGGED, PAID }

    struct Claim {
        uint256 policyId;
        address claimant;
        string  claimType;
        uint256 amount;
        uint256 filedAt;
        uint256 aiScore;     // 0-100
        uint256 fraudRisk;   // 0-100
        ClaimStatus status;
        bool    paid;
    }

    struct EvidenceLog {
        uint256 claimId;
        string  evidenceHash;
        string  evidenceType;
        address submitter;
        uint256 submittedAt;
    }

    uint256 public nextClaimId;
    mapping(uint256 => Claim) public claims;

    uint256 public nextEvidenceId;
    mapping(uint256 => EvidenceLog) public evidenceLogs;
    mapping(uint256 => uint256[]) public claimEvidence;

    event ClaimFiled(uint256 indexed claimId, uint256 indexed policyId, address indexed claimant, uint256 amount);
    event EvidenceSubmitted(uint256 indexed claimId, uint256 evidenceId, string evidenceType);
    event ClaimScored(uint256 indexed claimId, uint256 aiScore, uint256 fraudRisk);
    event ClaimApproved(uint256 indexed claimId);
    event ClaimDenied(uint256 indexed claimId);
    event ClaimFlagged(uint256 indexed claimId, uint256 fraudRisk);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADJUSTER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function fileClaim(
        uint256 policyId,
        string calldata claimType,
        uint256 amount
    ) external returns (uint256) {
        require(amount > 0, "Amount must be > 0");

        uint256 id = nextClaimId++;
        claims[id] = Claim({
            policyId: policyId,
            claimant: msg.sender,
            claimType: claimType,
            amount: amount,
            filedAt: block.timestamp,
            aiScore: 0,
            fraudRisk: 0,
            status: ClaimStatus.FILED,
            paid: false
        });

        emit ClaimFiled(id, policyId, msg.sender, amount);
        return id;
    }

    function submitEvidence(
        uint256 claimId,
        string calldata evidenceHash,
        string calldata evidenceType
    ) external {
        require(claims[claimId].filedAt > 0, "Claim does not exist");

        uint256 eid = nextEvidenceId++;
        evidenceLogs[eid] = EvidenceLog({
            claimId: claimId,
            evidenceHash: evidenceHash,
            evidenceType: evidenceType,
            submitter: msg.sender,
            submittedAt: block.timestamp
        });
        claimEvidence[claimId].push(eid);

        emit EvidenceSubmitted(claimId, eid, evidenceType);
    }

    function aiScoreClaim(uint256 claimId, uint256 aiScore, uint256 fraudRisk) external onlyRole(ORACLE_ROLE) {
        require(claims[claimId].filedAt > 0, "Claim does not exist");
        require(aiScore <= 100, "Score 0-100");
        require(fraudRisk <= 100, "Risk 0-100");

        claims[claimId].aiScore = aiScore;
        claims[claimId].fraudRisk = fraudRisk;
        claims[claimId].status = ClaimStatus.UNDER_REVIEW;

        emit ClaimScored(claimId, aiScore, fraudRisk);
    }

    function approveClaim(uint256 claimId) external onlyRole(ADJUSTER_ROLE) {
        Claim storage c = claims[claimId];
        require(c.status == ClaimStatus.UNDER_REVIEW || c.status == ClaimStatus.FILED, "Invalid status");
        c.status = ClaimStatus.APPROVED;
        emit ClaimApproved(claimId);
    }

    function denyClaim(uint256 claimId) external onlyRole(ADJUSTER_ROLE) {
        Claim storage c = claims[claimId];
        require(c.status != ClaimStatus.PAID, "Already paid");
        c.status = ClaimStatus.DENIED;
        emit ClaimDenied(claimId);
    }

    function flagClaim(uint256 claimId) external onlyRole(ADJUSTER_ROLE) {
        Claim storage c = claims[claimId];
        require(c.status != ClaimStatus.PAID, "Already paid");
        c.status = ClaimStatus.FLAGGED;
        emit ClaimFlagged(claimId, c.fraudRisk);
    }

    function payoutClaim(uint256 claimId) external onlyRole(ADJUSTER_ROLE) {
        Claim storage c = claims[claimId];
        require(c.status == ClaimStatus.APPROVED, "Not approved");
        require(!c.paid, "Already paid");
        require(address(this).balance >= c.amount, "Insufficient balance");

        c.paid = true;
        c.status = ClaimStatus.PAID;

        (bool ok, ) = payable(c.claimant).call{value: c.amount}("");
        require(ok, "Transfer failed");

        emit ClaimPaid(claimId, c.claimant, c.amount);
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }

    function getClaimEvidenceCount(uint256 claimId) external view returns (uint256) {
        return claimEvidence[claimId].length;
    }

    receive() external payable {}
}
