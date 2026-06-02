// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title DigitalTwinRegistry — NFT-linked digital twins for manufacturing equipment on BeZhas Chain
/// @notice Register equipment twins, log IoT telemetry, update health scores
contract DigitalTwinRegistry is AccessControl {

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");

    struct DigitalTwin {
        string  serialNumber;
        string  name;
        string  twinType;
        address owner;
        uint256 createdAt;
        bool    active;
        uint256 healthScore;   // 0-100
    }

    struct TelemetryLog {
        uint256 twinId;
        uint256 temperature;   // scaled 1e2 (e.g. 4200 = 42.00°C)
        uint256 vibration;     // scaled 1e4 (e.g. 1200 = 0.12 mm/s)
        uint256 rpm;
        uint256 timestamp;
        bytes32 sensorProof;
    }

    uint256 public nextTwinId;
    mapping(uint256 => DigitalTwin) public twins;

    uint256 public totalTelemetryLogs;
    mapping(uint256 => TelemetryLog) public telemetryLogs;

    event TwinMinted(uint256 indexed twinId, string serialNumber, string name);
    event TelemetryLogged(uint256 indexed twinId, uint256 logId, uint256 temperature, uint256 vibration);
    event HealthUpdated(uint256 indexed twinId, uint256 newScore);
    event TwinDecommissioned(uint256 indexed twinId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function mintTwin(
        string calldata serialNumber,
        string calldata name,
        string calldata twinType
    ) external onlyRole(OPERATOR_ROLE) returns (uint256) {
        require(bytes(serialNumber).length > 0, "Empty serial");

        uint256 twinId = nextTwinId++;
        twins[twinId] = DigitalTwin({
            serialNumber: serialNumber,
            name: name,
            twinType: twinType,
            owner: msg.sender,
            createdAt: block.timestamp,
            active: true,
            healthScore: 100
        });

        emit TwinMinted(twinId, serialNumber, name);
        return twinId;
    }

    function logTelemetry(
        uint256 twinId,
        uint256 temperature,
        uint256 vibration,
        uint256 rpm,
        bytes32 sensorProof
    ) external onlyRole(ORACLE_ROLE) {
        require(twinId < nextTwinId, "Twin does not exist");
        require(twins[twinId].active, "Twin decommissioned");

        uint256 logId = totalTelemetryLogs++;
        telemetryLogs[logId] = TelemetryLog({
            twinId: twinId,
            temperature: temperature,
            vibration: vibration,
            rpm: rpm,
            timestamp: block.timestamp,
            sensorProof: sensorProof
        });

        emit TelemetryLogged(twinId, logId, temperature, vibration);
    }

    function updateHealth(
        uint256 twinId,
        uint256 score
    ) external onlyRole(ORACLE_ROLE) {
        require(twinId < nextTwinId, "Twin does not exist");
        require(score <= 100, "Score must be 0-100");

        twins[twinId].healthScore = score;
        emit HealthUpdated(twinId, score);
    }

    function decommission(uint256 twinId) external onlyRole(OPERATOR_ROLE) {
        require(twinId < nextTwinId, "Twin does not exist");
        require(twins[twinId].active, "Already decommissioned");

        twins[twinId].active = false;
        emit TwinDecommissioned(twinId);
    }
}
