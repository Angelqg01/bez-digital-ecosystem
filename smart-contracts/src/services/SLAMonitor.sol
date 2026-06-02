// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title SLAMonitor — Service Level Agreement tracking with penalties, uptime proofs and incident logging
contract SLAMonitor is AccessControl {

    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");

    enum AgreementStatus { ACTIVE, BREACHED, TERMINATED, EXPIRED }
    enum IncidentSeverity { LOW, MEDIUM, HIGH, CRITICAL }

    struct Agreement {
        uint256 id;
        address provider;
        address consumer;
        uint256 uptimeTargetBps;
        uint256 penaltyPerBreach;
        uint256 deposit;
        uint256 breachCount;
        AgreementStatus status;
        uint256 expiresAt;
    }

    struct Incident {
        uint256 id;
        uint256 agreementId;
        IncidentSeverity severity;
        bytes32 descHash;
        uint256 downtimeSeconds;
        uint256 reportedAt;
        bool resolved;
    }

    uint256 public nextAgreementId;
    uint256 public nextIncidentId;
    mapping(uint256 => Agreement) public agreements;
    mapping(uint256 => Incident) public incidents;
    mapping(uint256 => uint256[]) public agreementIncidents;
    mapping(address => uint256[]) public providerAgreements;

    event AgreementCreated(uint256 indexed agreementId, address indexed provider, address indexed consumer);
    event IncidentReported(uint256 indexed incidentId, uint256 indexed agreementId, IncidentSeverity severity);
    event IncidentResolved(uint256 indexed incidentId);
    event BreachRecorded(uint256 indexed agreementId, uint256 breachCount);
    event PenaltyPaid(uint256 indexed agreementId, address indexed consumer, uint256 amount);
    event AgreementTerminated(uint256 indexed agreementId);
    event AgreementExpired(uint256 indexed agreementId);
    event DepositRefunded(uint256 indexed agreementId, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MONITOR_ROLE, msg.sender);
    }

    // ── Create an SLA agreement (provider deposits penalty escrow) ──────────────────
    function createAgreement(
        address _consumer,
        uint256 _uptimeTargetBps,
        uint256 _penaltyPerBreach,
        uint256 _duration
    ) external payable returns (uint256) {
        require(_consumer != address(0), "Invalid consumer");
        require(_uptimeTargetBps <= 10000, "Invalid uptime target");
        require(_duration > 0, "Duration required");
        require(msg.value > 0, "Deposit required");

        uint256 aid = nextAgreementId++;
        agreements[aid] = Agreement({
            id: aid,
            provider: msg.sender,
            consumer: _consumer,
            uptimeTargetBps: _uptimeTargetBps,
            penaltyPerBreach: _penaltyPerBreach,
            deposit: msg.value,
            breachCount: 0,
            status: AgreementStatus.ACTIVE,
            expiresAt: block.timestamp + _duration
        });
        providerAgreements[msg.sender].push(aid);

        emit AgreementCreated(aid, msg.sender, _consumer);
        return aid;
    }

    // ── Report an incident ──────────────────
    function reportIncident(
        uint256 _agreementId,
        IncidentSeverity _severity,
        bytes32 _descHash,
        uint256 _downtimeSeconds
    ) external onlyRole(MONITOR_ROLE) returns (uint256) {
        Agreement storage a = agreements[_agreementId];
        require(a.status == AgreementStatus.ACTIVE, "Not active");

        uint256 iid = nextIncidentId++;
        incidents[iid] = Incident({
            id: iid,
            agreementId: _agreementId,
            severity: _severity,
            descHash: _descHash,
            downtimeSeconds: _downtimeSeconds,
            reportedAt: block.timestamp,
            resolved: false
        });
        agreementIncidents[_agreementId].push(iid);

        emit IncidentReported(iid, _agreementId, _severity);
        return iid;
    }

    // ── Resolve an incident ──────────────────
    function resolveIncident(uint256 _incidentId) external onlyRole(MONITOR_ROLE) {
        Incident storage i = incidents[_incidentId];
        require(!i.resolved, "Already resolved");
        i.resolved = true;
        emit IncidentResolved(_incidentId);
    }

    // ── Record a breach (triggers penalty) ──────────────────
    function recordBreach(uint256 _agreementId) external onlyRole(MONITOR_ROLE) {
        Agreement storage a = agreements[_agreementId];
        require(a.status == AgreementStatus.ACTIVE, "Not active");

        a.breachCount++;
        emit BreachRecorded(_agreementId, a.breachCount);

        // Pay penalty from deposit to consumer
        if (a.deposit >= a.penaltyPerBreach) {
            a.deposit -= a.penaltyPerBreach;
            (bool ok, ) = a.consumer.call{value: a.penaltyPerBreach}("");
            require(ok, "Penalty transfer failed");
            emit PenaltyPaid(_agreementId, a.consumer, a.penaltyPerBreach);
        }

        // Auto-breach status if deposit depleted
        if (a.deposit == 0) {
            a.status = AgreementStatus.BREACHED;
        }
    }

    // ── Terminate an agreement ──────────────────
    function terminateAgreement(uint256 _agreementId) external {
        Agreement storage a = agreements[_agreementId];
        require(msg.sender == a.provider || msg.sender == a.consumer, "Not party");
        require(a.status == AgreementStatus.ACTIVE || a.status == AgreementStatus.BREACHED, "Cannot terminate");

        a.status = AgreementStatus.TERMINATED;

        // Return remaining deposit to provider
        if (a.deposit > 0) {
            uint256 refund = a.deposit;
            a.deposit = 0;
            (bool ok, ) = a.provider.call{value: refund}("");
            require(ok, "Refund failed");
            emit DepositRefunded(_agreementId, refund);
        }

        emit AgreementTerminated(_agreementId);
    }

    // ── Mark expired ──────────────────
    function markExpired(uint256 _agreementId) external onlyRole(MONITOR_ROLE) {
        Agreement storage a = agreements[_agreementId];
        require(a.status == AgreementStatus.ACTIVE, "Not active");
        require(block.timestamp > a.expiresAt, "Not expired");

        a.status = AgreementStatus.EXPIRED;

        // Return deposit to provider
        if (a.deposit > 0) {
            uint256 refund = a.deposit;
            a.deposit = 0;
            (bool ok, ) = a.provider.call{value: refund}("");
            require(ok, "Refund failed");
            emit DepositRefunded(_agreementId, refund);
        }

        emit AgreementExpired(_agreementId);
    }

    // ── View helpers ──────────────────
    function getAgreementIncidents(uint256 _agreementId) external view returns (uint256[] memory) {
        return agreementIncidents[_agreementId];
    }

    function getProviderAgreements(address _provider) external view returns (uint256[] memory) {
        return providerAgreements[_provider];
    }

    function isAgreementActive(uint256 _agreementId) external view returns (bool) {
        Agreement storage a = agreements[_agreementId];
        return a.status == AgreementStatus.ACTIVE && block.timestamp <= a.expiresAt;
    }
}
