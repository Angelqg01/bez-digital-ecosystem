// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title PolicyNFT — Tokenized insurance policies on BeZhas Chain
/// @notice Mint, manage, and settle insurance policies as on-chain assets
contract PolicyNFT is AccessControl {

    bytes32 public constant UNDERWRITER_ROLE = keccak256("UNDERWRITER_ROLE");

    enum RiskTier { LOW, MEDIUM, HIGH, CRITICAL }

    struct Policy {
        string  policyType;
        address holder;
        uint256 premiumBez;
        uint256 coverageAmount;
        uint256 startDate;
        uint256 endDate;
        RiskTier riskTier;
        bool    active;
        bool    cancelled;
        uint256 totalClaims;
    }

    struct PremiumPayment {
        uint256 policyId;
        address payer;
        uint256 amount;
        uint256 paidAt;
    }

    uint256 public nextPolicyId;
    mapping(uint256 => Policy) public policies;

    uint256 public nextPaymentId;
    mapping(uint256 => PremiumPayment) public payments;
    mapping(uint256 => uint256[]) public policyPayments;

    event PolicyMinted(uint256 indexed policyId, string policyType, address indexed holder, uint256 coverageAmount);
    event PremiumPaid(uint256 indexed policyId, uint256 paymentId, address indexed payer, uint256 amount);
    event PolicyCancelled(uint256 indexed policyId);
    event PolicyRenewed(uint256 indexed policyId, uint256 newEndDate);
    event ClaimFiled(uint256 indexed policyId, uint256 totalClaims);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UNDERWRITER_ROLE, msg.sender);
    }

    function mintPolicy(
        string calldata policyType,
        address holder,
        uint256 premiumBez,
        uint256 coverageAmount,
        uint256 startDate,
        uint256 endDate,
        RiskTier riskTier
    ) external onlyRole(UNDERWRITER_ROLE) returns (uint256) {
        require(holder != address(0), "Invalid holder");
        require(coverageAmount > 0, "Coverage must be > 0");
        require(endDate > startDate, "End must be after start");

        uint256 id = nextPolicyId++;
        policies[id] = Policy({
            policyType: policyType,
            holder: holder,
            premiumBez: premiumBez,
            coverageAmount: coverageAmount,
            startDate: startDate,
            endDate: endDate,
            riskTier: riskTier,
            active: true,
            cancelled: false,
            totalClaims: 0
        });

        emit PolicyMinted(id, policyType, holder, coverageAmount);
        return id;
    }

    function payPremium(uint256 policyId) external payable {
        Policy storage p = policies[policyId];
        require(p.active, "Policy not active");
        require(!p.cancelled, "Policy cancelled");
        require(msg.value >= p.premiumBez, "Insufficient premium");

        uint256 pid = nextPaymentId++;
        payments[pid] = PremiumPayment({
            policyId: policyId,
            payer: msg.sender,
            amount: msg.value,
            paidAt: block.timestamp
        });
        policyPayments[policyId].push(pid);

        emit PremiumPaid(policyId, pid, msg.sender, msg.value);
    }

    function cancelPolicy(uint256 policyId) external onlyRole(UNDERWRITER_ROLE) {
        Policy storage p = policies[policyId];
        require(p.active, "Already inactive");
        p.active = false;
        p.cancelled = true;
        emit PolicyCancelled(policyId);
    }

    function renewPolicy(uint256 policyId, uint256 newEndDate) external onlyRole(UNDERWRITER_ROLE) {
        Policy storage p = policies[policyId];
        require(p.active, "Not active");
        require(!p.cancelled, "Cancelled");
        require(newEndDate > p.endDate, "Must extend end date");
        p.endDate = newEndDate;
        emit PolicyRenewed(policyId, newEndDate);
    }

    function fileClaim(uint256 policyId) external {
        Policy storage p = policies[policyId];
        require(p.active, "Not active");
        require(msg.sender == p.holder, "Not holder");
        p.totalClaims++;
        emit ClaimFiled(policyId, p.totalClaims);
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getPolicyPaymentCount(uint256 policyId) external view returns (uint256) {
        return policyPayments[policyId].length;
    }
}
