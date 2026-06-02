// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title QualityEscrow
 * @dev Contrato central para almacenar la telemetría de IoT previamente validada por la 
 * IA (AI Gateway) de BeZhas. Sólo los "Edge Nodes" corporativos tienen permiso de escritura.
 */
contract QualityEscrow is AccessControl {
    bytes32 public constant EDGE_NODE_ROLE = keccak256("EDGE_NODE_ROLE");

    struct SensorData {
        uint256 timestamp;
        string containerId;
        int256 temperature;
        string status;
    }

    // Mapping from Container ID to its latest sensor data
    mapping(string => SensorData) private _latestData;

    // Mapping to store history of sensor data per container
    mapping(string => SensorData[]) private _historicalData;

    event SensorDataRegistered(
        string indexed containerId,
        int256 temperature,
        string status,
        address indexed node
    );

    /**
     * @dev Configura el rol por defecto del admin
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Registra telemetría validada para un contenedor logístico.
     * Restringido a callers con el rol EDGE_NODE_ROLE.
     */
    function registerSensorData(
        string calldata containerId,
        int256 temperature,
        string calldata status
    ) external onlyRole(EDGE_NODE_ROLE) returns (bool) {
        require(bytes(containerId).length > 0, "QualityEscrow: containerId empty");

        SensorData memory newData = SensorData({
            timestamp: block.timestamp,
            containerId: containerId,
            temperature: temperature,
            status: status
        });

        _latestData[containerId] = newData;
        _historicalData[containerId].push(newData);

        emit SensorDataRegistered(containerId, temperature, status, msg.sender);

        return true;
    }

    /**
     * @dev Obtiene el último registro de un contenedor
     */
    function getLatestData(string calldata containerId) external view returns (SensorData memory) {
        require(_latestData[containerId].timestamp != 0, "QualityEscrow: no data found");
        return _latestData[containerId];
    }

    /**
     * @dev Obtiene el historial completo de un contenedor
     */
    function getHistoricalData(string calldata containerId) external view returns (SensorData[] memory) {
        return _historicalData[containerId];
    }
}
