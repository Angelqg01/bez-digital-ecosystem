// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title PharmaTracker
 * @dev Pharmaceutical supply chain tracking with cold-chain IoT sensor logging,
 * custody transfers, and anti-counterfeit certificate verification.
 */
contract PharmaTracker is AccessControl {
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant LOGISTICS_ROLE = keccak256("LOGISTICS_ROLE");

    enum BatchStatus { IN_TRANSIT, COLD_CHAIN, QC_CHECK, DELIVERED, ALERT, RECALLED }

    struct PharmaBatch {
        string lotId;
        string ndc;
        bytes32 certHash;
        address manufacturer;
        address currentCustodian;
        uint256 quantity;
        int16 minTemp;
        int16 maxTemp;
        uint256 expiryDate;
        uint256 createdAt;
        BatchStatus status;
    }

    struct TemperatureLog {
        uint256 timestamp;
        int16 tempCelsius;
        uint8 humidity;
        bytes32 rfidSignature;
        address reporter;
    }

    uint256 private _nextBatchId;
    mapping(uint256 => PharmaBatch) private _batches;
    mapping(uint256 => TemperatureLog[]) private _tempLogs;
    mapping(uint256 => address[]) private _custodyChain;

    event BatchRegistered(uint256 indexed batchId, string lotId, address indexed manufacturer);
    event TemperatureLogged(uint256 indexed batchId, int16 tempCelsius, uint8 humidity);
    event CustodyTransferred(uint256 indexed batchId, address indexed from, address indexed to);
    event AlertTriggered(uint256 indexed batchId, string reason);
    event BatchDelivered(uint256 indexed batchId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Register a new pharmaceutical batch.
     */
    function registerBatch(
        string calldata lotId,
        string calldata ndc,
        bytes32 certHash,
        uint256 quantity,
        int16 minTemp,
        int16 maxTemp,
        uint256 expiryDate
    ) external onlyRole(MANUFACTURER_ROLE) returns (uint256 batchId) {
        require(bytes(lotId).length > 0, "PharmaTracker: empty lotId");
        require(quantity > 0, "PharmaTracker: zero quantity");
        require(maxTemp > minTemp, "PharmaTracker: invalid temp range");

        batchId = _nextBatchId++;
        _batches[batchId] = PharmaBatch({
            lotId: lotId,
            ndc: ndc,
            certHash: certHash,
            manufacturer: msg.sender,
            currentCustodian: msg.sender,
            quantity: quantity,
            minTemp: minTemp,
            maxTemp: maxTemp,
            expiryDate: expiryDate,
            createdAt: block.timestamp,
            status: BatchStatus.IN_TRANSIT
        });
        _custodyChain[batchId].push(msg.sender);

        emit BatchRegistered(batchId, lotId, msg.sender);
    }

    /**
     * @dev Log temperature reading from IoT sensor.
     */
    function logTemperature(
        uint256 batchId,
        int16 tempCelsius,
        uint8 humidity,
        bytes32 rfidSignature
    ) external onlyRole(LOGISTICS_ROLE) {
        PharmaBatch storage batch = _batches[batchId];
        require(batch.manufacturer != address(0), "PharmaTracker: batch not found");

        _tempLogs[batchId].push(TemperatureLog({
            timestamp: block.timestamp,
            tempCelsius: tempCelsius,
            humidity: humidity,
            rfidSignature: rfidSignature,
            reporter: msg.sender
        }));

        // Auto-alert if temperature out of range
        if (tempCelsius < batch.minTemp || tempCelsius > batch.maxTemp) {
            batch.status = BatchStatus.ALERT;
            emit AlertTriggered(batchId, "Temperature out of range");
        }

        emit TemperatureLogged(batchId, tempCelsius, humidity);
    }

    /**
     * @dev Transfer custody of a batch to a new party.
     */
    function transferCustody(uint256 batchId, address newCustodian) external {
        PharmaBatch storage batch = _batches[batchId];
        require(batch.currentCustodian == msg.sender, "PharmaTracker: not custodian");
        require(newCustodian != address(0), "PharmaTracker: zero address");

        address prev = batch.currentCustodian;
        batch.currentCustodian = newCustodian;
        _custodyChain[batchId].push(newCustodian);

        emit CustodyTransferred(batchId, prev, newCustodian);
    }

    /**
     * @dev Mark batch as delivered.
     */
    function markDelivered(uint256 batchId) external {
        PharmaBatch storage batch = _batches[batchId];
        require(batch.currentCustodian == msg.sender, "PharmaTracker: not custodian");
        batch.status = BatchStatus.DELIVERED;
        emit BatchDelivered(batchId);
    }

    /**
     * @dev Verify certificate hash matches the stored cert.
     */
    function verifyCertificate(uint256 batchId, bytes32 certHash) external view returns (bool) {
        return _batches[batchId].certHash == certHash;
    }

    function getBatch(uint256 batchId) external view returns (PharmaBatch memory) {
        return _batches[batchId];
    }

    function getTempLogCount(uint256 batchId) external view returns (uint256) {
        return _tempLogs[batchId].length;
    }

    function getCustodyChain(uint256 batchId) external view returns (address[] memory) {
        return _custodyChain[batchId];
    }
}
