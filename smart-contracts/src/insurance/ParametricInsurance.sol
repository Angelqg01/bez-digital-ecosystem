// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ParametricInsurance — Oracle-triggered index-based insurance on BeZhas Chain
/// @notice Create parametric policies, receive oracle readings, trigger auto-payouts
contract ParametricInsurance is AccessControl {

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    struct ParametricPolicy {
        string  name;
        string  region;
        uint256 triggerValue;      // scaled 1e2
        uint256 premiumBez;
        uint256 payoutAmount;
        address holder;
        uint256 startDate;
        uint256 endDate;
        bool    active;
        bool    triggered;
        bool    paid;
    }

    struct OracleReading {
        uint256 policyId;
        uint256 value;             // scaled 1e2
        uint256 timestamp;
        bool    triggerMet;
        address reporter;
    }

    uint256 public nextPolicyId;
    mapping(uint256 => ParametricPolicy) public parametricPolicies;

    uint256 public nextReadingId;
    mapping(uint256 => OracleReading) public readings;
    mapping(uint256 => uint256[]) public policyReadings;

    event ParametricCreated(uint256 indexed policyId, string name, string region, address indexed holder);
    event ReadingSubmitted(uint256 indexed policyId, uint256 readingId, uint256 value, bool triggerMet);
    event PolicyTriggered(uint256 indexed policyId, uint256 readingValue);
    event PayoutSent(uint256 indexed policyId, address indexed holder, uint256 amount);
    event PolicyExpired(uint256 indexed policyId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function createParametric(
        string calldata name,
        string calldata region,
        uint256 triggerValue,
        uint256 payoutAmount,
        uint256 startDate,
        uint256 endDate
    ) external payable returns (uint256) {
        require(msg.value > 0, "Premium required");
        require(payoutAmount > 0, "Payout must be > 0");
        require(endDate > startDate, "End > start");

        uint256 id = nextPolicyId++;
        parametricPolicies[id] = ParametricPolicy({
            name: name,
            region: region,
            triggerValue: triggerValue,
            premiumBez: msg.value,
            payoutAmount: payoutAmount,
            holder: msg.sender,
            startDate: startDate,
            endDate: endDate,
            active: true,
            triggered: false,
            paid: false
        });

        emit ParametricCreated(id, name, region, msg.sender);
        return id;
    }

    function submitReading(uint256 policyId, uint256 value) external onlyRole(ORACLE_ROLE) {
        ParametricPolicy storage p = parametricPolicies[policyId];
        require(p.active, "Policy not active");
        require(!p.triggered, "Already triggered");

        bool met = value >= p.triggerValue;

        uint256 rid = nextReadingId++;
        readings[rid] = OracleReading({
            policyId: policyId,
            value: value,
            timestamp: block.timestamp,
            triggerMet: met,
            reporter: msg.sender
        });
        policyReadings[policyId].push(rid);

        emit ReadingSubmitted(policyId, rid, value, met);

        if (met) {
            p.triggered = true;
            emit PolicyTriggered(policyId, value);
        }
    }

    function claimPayout(uint256 policyId) external {
        ParametricPolicy storage p = parametricPolicies[policyId];
        require(p.holder == msg.sender, "Not holder");
        require(p.triggered, "Not triggered");
        require(!p.paid, "Already paid");
        require(address(this).balance >= p.payoutAmount, "Insufficient balance");

        p.paid = true;
        p.active = false;

        (bool ok, ) = payable(msg.sender).call{value: p.payoutAmount}("");
        require(ok, "Transfer failed");

        emit PayoutSent(policyId, msg.sender, p.payoutAmount);
    }

    function expirePolicy(uint256 policyId) external onlyRole(ORACLE_ROLE) {
        ParametricPolicy storage p = parametricPolicies[policyId];
        require(p.active, "Not active");
        require(block.timestamp > p.endDate, "Not expired");
        p.active = false;
        emit PolicyExpired(policyId);
    }

    function getParametricPolicy(uint256 policyId) external view returns (ParametricPolicy memory) {
        return parametricPolicies[policyId];
    }

    function getPolicyReadingCount(uint256 policyId) external view returns (uint256) {
        return policyReadings[policyId].length;
    }

    receive() external payable {}
}
