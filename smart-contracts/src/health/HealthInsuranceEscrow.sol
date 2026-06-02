// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title HealthInsuranceEscrow
 * @dev Escrow contract for healthcare insurance claims. AI engine scores claims,
 * auto-approves high-confidence ones, flags suspicious claims for human review.
 */
contract HealthInsuranceEscrow is AccessControl {
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");
    bytes32 public constant AI_ENGINE_ROLE = keccak256("AI_ENGINE_ROLE");
    bytes32 public constant ADJUSTER_ROLE = keccak256("ADJUSTER_ROLE");

    uint8 public constant AUTO_APPROVE_THRESHOLD = 85;
    uint8 public constant FRAUD_FLAG_THRESHOLD = 50;

    enum ClaimStatus { SUBMITTED, AI_APPROVED, HUMAN_REVIEW, PAID, ESCALATED, FRAUD_FLAG, DENIED }

    struct Claim {
        string claimId;
        address hospital;
        address insurer;
        bytes32 diagnosisProof;
        bytes32 procedureHash;
        uint256 amount;
        uint256 submitDate;
        uint256 processDate;
        uint256 payoutDate;
        uint8 aiConfidence;
        ClaimStatus status;
    }

    uint256 private _nextEscrowId;
    mapping(uint256 => Claim) private _claims;
    uint256 public totalClaimsCount;
    uint256 public totalPaidOut;

    event ClaimSubmitted(uint256 indexed escrowId, string claimId, address indexed hospital, uint256 amount);
    event AIVerified(uint256 indexed escrowId, uint8 confidence);
    event ClaimApproved(uint256 indexed escrowId);
    event ClaimDenied(uint256 indexed escrowId);
    event FraudFlagged(uint256 indexed escrowId, string reason);
    event PayoutReleased(uint256 indexed escrowId, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Hospital submits a new insurance claim.
     */
    function submitClaim(
        string calldata claimId,
        address insurer,
        bytes32 diagnosisProof,
        bytes32 procedureHash,
        uint256 amount
    ) external onlyRole(HOSPITAL_ROLE) returns (uint256 escrowId) {
        require(insurer != address(0), "HealthInsuranceEscrow: zero insurer");
        require(amount > 0, "HealthInsuranceEscrow: zero amount");
        require(bytes(claimId).length > 0, "HealthInsuranceEscrow: empty claimId");

        escrowId = _nextEscrowId++;
        _claims[escrowId] = Claim({
            claimId: claimId,
            hospital: msg.sender,
            insurer: insurer,
            diagnosisProof: diagnosisProof,
            procedureHash: procedureHash,
            amount: amount,
            submitDate: block.timestamp,
            processDate: 0,
            payoutDate: 0,
            aiConfidence: 0,
            status: ClaimStatus.SUBMITTED
        });
        totalClaimsCount++;

        emit ClaimSubmitted(escrowId, claimId, msg.sender, amount);
    }

    /**
     * @dev AI engine sets confidence score. Auto-routes based on threshold.
     */
    function setAIVerification(
        uint256 escrowId,
        uint8 confidenceScore
    ) external onlyRole(AI_ENGINE_ROLE) {
        Claim storage claim = _claims[escrowId];
        require(claim.status == ClaimStatus.SUBMITTED, "HealthInsuranceEscrow: not submitted");

        claim.aiConfidence = confidenceScore;
        claim.processDate = block.timestamp;

        if (confidenceScore >= AUTO_APPROVE_THRESHOLD) {
            claim.status = ClaimStatus.AI_APPROVED;
            emit ClaimApproved(escrowId);
        } else if (confidenceScore < FRAUD_FLAG_THRESHOLD) {
            claim.status = ClaimStatus.FRAUD_FLAG;
            emit FraudFlagged(escrowId, "Low AI confidence");
        } else {
            claim.status = ClaimStatus.HUMAN_REVIEW;
        }

        emit AIVerified(escrowId, confidenceScore);
    }

    /**
     * @dev Human adjuster reviews flagged claim.
     */
    function manualReview(uint256 escrowId, bool approved) external onlyRole(ADJUSTER_ROLE) {
        Claim storage claim = _claims[escrowId];
        require(
            claim.status == ClaimStatus.HUMAN_REVIEW || claim.status == ClaimStatus.FRAUD_FLAG,
            "HealthInsuranceEscrow: wrong status"
        );

        if (approved) {
            claim.status = ClaimStatus.AI_APPROVED;
            emit ClaimApproved(escrowId);
        } else {
            claim.status = ClaimStatus.DENIED;
            emit ClaimDenied(escrowId);
        }
        claim.processDate = block.timestamp;
    }

    /**
     * @dev Release payout for an approved claim.
     */
    function releasePayout(uint256 escrowId) external onlyRole(ADJUSTER_ROLE) {
        Claim storage claim = _claims[escrowId];
        require(claim.status == ClaimStatus.AI_APPROVED, "HealthInsuranceEscrow: not approved");

        claim.status = ClaimStatus.PAID;
        claim.payoutDate = block.timestamp;
        totalPaidOut += claim.amount;

        emit PayoutReleased(escrowId, claim.amount);
    }

    function getClaim(uint256 escrowId) external view returns (Claim memory) {
        return _claims[escrowId];
    }
}
