// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title PredictiveMaintenanceLog — IoT sensor logging with threshold alerts on BeZhas Chain
/// @notice Register equipment, log readings, trigger alerts, record maintenance actions
contract PredictiveMaintenanceLog is AccessControl {

    bytes32 public constant TECHNICIAN_ROLE = keccak256("TECHNICIAN_ROLE");
    bytes32 public constant ORACLE_ROLE     = keccak256("ORACLE_ROLE");

    struct Equipment {
        string  serialNumber;
        string  name;
        address owner;
        uint256 registeredAt;
        bool    active;
        uint256 totalOperatingHours;
    }

    struct Thresholds {
        uint256 maxTemperature;   // scaled 1e2
        uint256 maxVibration;     // scaled 1e4
        uint256 maxPressure;      // scaled 1e2
    }

    struct SensorReading {
        uint256 equipmentId;
        uint256 temperature;
        uint256 vibration;
        uint256 pressure;
        uint256 timestamp;
        bytes32 sensorProof;
        bool    alertTriggered;
    }

    struct MaintenanceRecord {
        uint256 equipmentId;
        string  description;
        uint256 cost;
        uint256 performedAt;
        address technician;
        bytes32 evidenceHash;
    }

    uint256 public nextEquipmentId;
    mapping(uint256 => Equipment) public equipment;
    mapping(uint256 => Thresholds) public thresholds;

    uint256 public totalReadings;
    mapping(uint256 => SensorReading) public readings;

    uint256 public totalMaintenanceRecords;
    mapping(uint256 => MaintenanceRecord) public maintenanceRecords;

    uint256 public totalAlerts;

    event EquipmentRegistered(uint256 indexed equipmentId, string serialNumber, string name);
    event ReadingLogged(uint256 indexed equipmentId, uint256 readingId, bool alertTriggered);
    event ThresholdsSet(uint256 indexed equipmentId, uint256 maxTemp, uint256 maxVib, uint256 maxPressure);
    event MaintenanceRecorded(uint256 indexed equipmentId, uint256 recordId, uint256 cost);
    event AlertTriggered(uint256 indexed equipmentId, uint256 readingId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TECHNICIAN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function registerEquipment(
        string calldata serialNumber,
        string calldata name
    ) external onlyRole(TECHNICIAN_ROLE) returns (uint256) {
        require(bytes(serialNumber).length > 0, "Empty serial");

        uint256 eqId = nextEquipmentId++;
        equipment[eqId] = Equipment({
            serialNumber: serialNumber,
            name: name,
            owner: msg.sender,
            registeredAt: block.timestamp,
            active: true,
            totalOperatingHours: 0
        });

        // Default thresholds
        thresholds[eqId] = Thresholds({
            maxTemperature: 10000,   // 100.00°C
            maxVibration: 15000,     // 1.50 mm/s
            maxPressure: 50000       // 500.00 PSI
        });

        emit EquipmentRegistered(eqId, serialNumber, name);
        return eqId;
    }

    function setThresholds(
        uint256 equipmentId,
        uint256 maxTemp,
        uint256 maxVibration,
        uint256 maxPressure
    ) external onlyRole(TECHNICIAN_ROLE) {
        require(equipmentId < nextEquipmentId, "Equipment does not exist");

        thresholds[equipmentId] = Thresholds({
            maxTemperature: maxTemp,
            maxVibration: maxVibration,
            maxPressure: maxPressure
        });

        emit ThresholdsSet(equipmentId, maxTemp, maxVibration, maxPressure);
    }

    function logSensorReading(
        uint256 equipmentId,
        uint256 temp,
        uint256 vibration,
        uint256 pressure,
        bytes32 proof
    ) external onlyRole(ORACLE_ROLE) returns (bool alertTriggered) {
        require(equipmentId < nextEquipmentId, "Equipment does not exist");
        require(equipment[equipmentId].active, "Equipment deactivated");

        Thresholds storage t = thresholds[equipmentId];
        alertTriggered = (temp > t.maxTemperature || vibration > t.maxVibration || pressure > t.maxPressure);

        uint256 readingId = totalReadings++;
        readings[readingId] = SensorReading({
            equipmentId: equipmentId,
            temperature: temp,
            vibration: vibration,
            pressure: pressure,
            timestamp: block.timestamp,
            sensorProof: proof,
            alertTriggered: alertTriggered
        });

        if (alertTriggered) {
            totalAlerts++;
            emit AlertTriggered(equipmentId, readingId);
        }

        emit ReadingLogged(equipmentId, readingId, alertTriggered);
        return alertTriggered;
    }

    function recordMaintenance(
        uint256 equipmentId,
        string calldata description,
        uint256 cost,
        bytes32 evidence
    ) external onlyRole(TECHNICIAN_ROLE) {
        require(equipmentId < nextEquipmentId, "Equipment does not exist");
        require(bytes(description).length > 0, "Empty description");

        uint256 recordId = totalMaintenanceRecords++;
        maintenanceRecords[recordId] = MaintenanceRecord({
            equipmentId: equipmentId,
            description: description,
            cost: cost,
            performedAt: block.timestamp,
            technician: msg.sender,
            evidenceHash: evidence
        });

        emit MaintenanceRecorded(equipmentId, recordId, cost);
    }

    function deactivateEquipment(uint256 equipmentId) external onlyRole(TECHNICIAN_ROLE) {
        require(equipmentId < nextEquipmentId, "Equipment does not exist");
        require(equipment[equipmentId].active, "Already deactivated");

        equipment[equipmentId].active = false;
    }
}
