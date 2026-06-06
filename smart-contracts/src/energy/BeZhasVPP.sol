// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title BeZhasVPP — Virtual Power Plant registry, flexibility accounting & SCADA audit
/// @notice Enrolls flexibility assets (batteries, controllable loads, DER) into the
///         VPP and keeps an immutable on-chain audit trail of every SCADA command
///         dispatched to them (referenced by api/routes/energy.js `audit_trail`).
///         Cumulative dispatched energy per asset is the basis for VPP flexibility
///         staking rewards (StakingPoolV2).
contract BeZhasVPP is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum AssetKind { BATTERY, SOLAR, WIND, HYDRO, LOAD }

    struct Asset {
        address   owner;
        AssetKind kind;
        uint256   capacityKw;
        bool      enrolled;
        uint256   dispatchedKwh; // cumulative flexibility contribution
        bool      exists;
    }

    struct CommandLog {
        bytes32 nodeId;
        string  command;       // CHARGE_BATTERY, DISCHARGE_BATTERY, SHED_LOAD, ...
        bytes32 paramsHash;    // keccak256 of the off-chain params JSON
        uint256 energyKwh;     // energy moved / curtailed by this dispatch
        address operator;
        uint64  timestamp;
        bool    exists;
    }

    mapping(bytes32 => Asset) public assets;        // nodeId => Asset
    mapping(bytes32 => CommandLog) public commands; // jobId => audited command
    uint256 public totalEnrolledCapacityKw;
    uint256 public totalDispatchedKwh;

    event AssetEnrolled(bytes32 indexed nodeId, address indexed owner, AssetKind kind, uint256 capacityKw);
    event AssetEnrollmentChanged(bytes32 indexed nodeId, bool enrolled);
    event CommandLogged(bytes32 indexed jobId, bytes32 indexed nodeId, string command, uint256 energyKwh, address operator);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // ─────────────────────────────────────────────────────────────
    // Flexibility asset registry
    // ─────────────────────────────────────────────────────────────

    function enrollAsset(bytes32 nodeId, address owner, AssetKind kind, uint256 capacityKw)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(owner != address(0), "Zero owner");
        require(!assets[nodeId].exists, "Asset exists");
        assets[nodeId] = Asset({
            owner: owner,
            kind: kind,
            capacityKw: capacityKw,
            enrolled: true,
            dispatchedKwh: 0,
            exists: true
        });
        totalEnrolledCapacityKw += capacityKw;
        emit AssetEnrolled(nodeId, owner, kind, capacityKw);
    }

    function setEnrollment(bytes32 nodeId, bool enrolled) external onlyRole(OPERATOR_ROLE) {
        Asset storage a = assets[nodeId];
        require(a.exists, "Unknown asset");
        if (a.enrolled == enrolled) return;
        a.enrolled = enrolled;
        if (enrolled) totalEnrolledCapacityKw += a.capacityKw;
        else totalEnrolledCapacityKw -= a.capacityKw;
        emit AssetEnrollmentChanged(nodeId, enrolled);
    }

    // ─────────────────────────────────────────────────────────────
    // SCADA command audit (immutable) + flexibility accrual
    // ─────────────────────────────────────────────────────────────

    function logCommand(
        bytes32 jobId,
        bytes32 nodeId,
        string calldata command,
        bytes32 paramsHash,
        uint256 energyKwh
    ) external onlyRole(OPERATOR_ROLE) {
        require(!commands[jobId].exists, "Job logged");
        Asset storage a = assets[nodeId];
        require(a.exists && a.enrolled, "Asset not enrolled");

        commands[jobId] = CommandLog({
            nodeId: nodeId,
            command: command,
            paramsHash: paramsHash,
            energyKwh: energyKwh,
            operator: msg.sender,
            timestamp: uint64(block.timestamp),
            exists: true
        });
        a.dispatchedKwh += energyKwh;
        totalDispatchedKwh += energyKwh;
        emit CommandLogged(jobId, nodeId, command, energyKwh, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────

    function flexibilityOf(bytes32 nodeId) external view returns (uint256) {
        return assets[nodeId].dispatchedKwh;
    }
}
