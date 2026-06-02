// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title AquaFarmMonitor — Aquaculture & hydroponics IoT monitoring on BeZhas Chain
/// @notice Register tanks, log sensor readings, set thresholds, harvest
contract AquaFarmMonitor is AccessControl {

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");

    struct FarmTank {
        string  name;
        string  species;
        uint256 capacity;
        uint256 currentStock;
        address operator;
        bool    active;
    }

    struct SensorReading {
        uint256 tankId;
        uint256 ph;              // scaled 1e2 (720 = 7.20)
        uint256 dissolvedO2;     // scaled 1e2 (680 = 6.80 mg/L)
        uint256 temperature;     // scaled 1e2 (2830 = 28.30°C)
        uint256 ammonia;         // scaled 1e4 (200 = 0.0200 mg/L)
        uint256 timestamp;
    }

    struct AlertThreshold {
        uint256 maxTemp;
        uint256 minO2;
        uint256 maxAmmonia;
        uint256 minPh;
        uint256 maxPh;
    }

    uint256 public nextTankId;
    mapping(uint256 => FarmTank) public tanks;

    uint256 public totalReadings;
    mapping(uint256 => SensorReading) public readings;
    mapping(uint256 => uint256) public tankReadingCount;

    mapping(uint256 => AlertThreshold) public thresholds;

    uint256 public totalHarvested;

    event TankRegistered(uint256 indexed tankId, string name, string species, uint256 capacity);
    event ReadingLogged(uint256 indexed tankId, uint256 readingId, uint256 ph, uint256 o2, uint256 temp, uint256 ammonia);
    event AlertTriggered(uint256 indexed tankId, string reason);
    event ThresholdUpdated(uint256 indexed tankId);
    event TankHarvested(uint256 indexed tankId, uint256 quantity);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function registerTank(
        string calldata name,
        string calldata species,
        uint256 capacity
    ) external onlyRole(OPERATOR_ROLE) returns (uint256) {
        require(capacity > 0, "Capacity must be > 0");

        uint256 id = nextTankId++;
        tanks[id] = FarmTank({
            name: name,
            species: species,
            capacity: capacity,
            currentStock: 0,
            operator: msg.sender,
            active: true
        });

        emit TankRegistered(id, name, species, capacity);
        return id;
    }

    function stockTank(uint256 tankId, uint256 quantity) external onlyRole(OPERATOR_ROLE) {
        FarmTank storage t = tanks[tankId];
        require(t.capacity > 0, "Tank does not exist");
        require(t.active, "Tank not active");
        require(t.currentStock + quantity <= t.capacity, "Exceeds capacity");
        t.currentStock += quantity;
    }

    function logReading(
        uint256 tankId,
        uint256 ph,
        uint256 dissolvedO2,
        uint256 temperature,
        uint256 ammonia
    ) external onlyRole(ORACLE_ROLE) {
        require(tanks[tankId].capacity > 0, "Tank does not exist");

        uint256 rId = totalReadings++;
        readings[rId] = SensorReading({
            tankId: tankId,
            ph: ph,
            dissolvedO2: dissolvedO2,
            temperature: temperature,
            ammonia: ammonia,
            timestamp: block.timestamp
        });
        tankReadingCount[tankId]++;

        emit ReadingLogged(tankId, rId, ph, dissolvedO2, temperature, ammonia);

        AlertThreshold storage at_ = thresholds[tankId];
        if (at_.maxTemp > 0) {
            if (temperature > at_.maxTemp) emit AlertTriggered(tankId, "Temperature too high");
            if (dissolvedO2 < at_.minO2)   emit AlertTriggered(tankId, "Dissolved O2 too low");
            if (ammonia > at_.maxAmmonia)   emit AlertTriggered(tankId, "Ammonia too high");
            if (ph < at_.minPh || ph > at_.maxPh) emit AlertTriggered(tankId, "pH out of range");
        }
    }

    function setThresholds(
        uint256 tankId,
        uint256 maxTemp,
        uint256 minO2,
        uint256 maxAmmonia,
        uint256 minPh,
        uint256 maxPh
    ) external onlyRole(OPERATOR_ROLE) {
        require(tanks[tankId].capacity > 0, "Tank does not exist");

        thresholds[tankId] = AlertThreshold({
            maxTemp: maxTemp,
            minO2: minO2,
            maxAmmonia: maxAmmonia,
            minPh: minPh,
            maxPh: maxPh
        });

        emit ThresholdUpdated(tankId);
    }

    function harvestTank(uint256 tankId, uint256 quantity) external onlyRole(OPERATOR_ROLE) {
        FarmTank storage t = tanks[tankId];
        require(t.capacity > 0, "Tank does not exist");
        require(t.active, "Tank not active");
        require(quantity <= t.currentStock, "Not enough stock");

        t.currentStock -= quantity;
        totalHarvested += quantity;

        emit TankHarvested(tankId, quantity);
    }

    function getTank(uint256 id) external view returns (
        string memory name, string memory species, uint256 capacity,
        uint256 currentStock, address operator, bool active
    ) {
        FarmTank storage t = tanks[id];
        return (t.name, t.species, t.capacity, t.currentStock, t.operator, t.active);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
