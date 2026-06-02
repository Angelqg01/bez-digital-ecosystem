// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title EVChargeToken — EV charging station registry & session settlement on BeZhas Chain
/// @notice Registers charging stations and settles pay-per-use sessions in BEZ
contract EVChargeToken is AccessControl {

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct ChargingStation {
        address operator;
        string  stationId;
        string  name;
        uint256 powerKW;
        uint256 pricePerKWh;     // in wei per kWh
        bool    active;
    }

    enum SessionStatus { ACTIVE, SETTLED, CANCELLED }

    struct ChargingSession {
        uint256 stationIdx;
        address driver;
        uint256 kwhDelivered;    // scaled by 1e3 (millikWh)
        uint256 totalCost;
        uint256 startTime;
        uint256 endTime;
        bytes32 meterProof;
        SessionStatus status;
    }

    uint256 public nextStationId;
    uint256 public nextSessionId;
    mapping(uint256 => ChargingStation) public stations;
    mapping(uint256 => ChargingSession) public sessions;
    mapping(address => uint256) public operatorRevenue;
    uint256 public totalStations;
    uint256 public totalSessions;
    uint256 public totalKwhDelivered;

    event StationRegistered(uint256 indexed stationId, string externalId, address operator);
    event SessionStarted(uint256 indexed sessionId, uint256 stationId, address driver);
    event SessionEnded(uint256 indexed sessionId, uint256 kwhDelivered);
    event SessionSettled(uint256 indexed sessionId, uint256 cost);
    event StationStatusChanged(uint256 indexed stationId, bool active);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function registerStation(
        string calldata stationId,
        string calldata name,
        uint256 powerKW,
        uint256 pricePerKWh
    ) external onlyRole(OPERATOR_ROLE) returns (uint256) {
        require(bytes(stationId).length > 0, "Station ID required");
        require(powerKW > 0, "Power must be > 0");
        require(pricePerKWh > 0, "Price must be > 0");

        uint256 id = nextStationId++;
        stations[id] = ChargingStation({
            operator: msg.sender,
            stationId: stationId,
            name: name,
            powerKW: powerKW,
            pricePerKWh: pricePerKWh,
            active: true
        });

        totalStations++;
        emit StationRegistered(id, stationId, msg.sender);
        return id;
    }

    function startSession(uint256 stationId, address driver) external onlyRole(OPERATOR_ROLE) returns (uint256) {
        require(stationId < nextStationId, "Station does not exist");
        require(stations[stationId].active, "Station not active");
        require(driver != address(0), "Invalid driver");

        uint256 sessionId = nextSessionId++;
        sessions[sessionId] = ChargingSession({
            stationIdx: stationId,
            driver: driver,
            kwhDelivered: 0,
            totalCost: 0,
            startTime: block.timestamp,
            endTime: 0,
            meterProof: bytes32(0),
            status: SessionStatus.ACTIVE
        });

        totalSessions++;
        emit SessionStarted(sessionId, stationId, driver);
        return sessionId;
    }

    function endSession(
        uint256 sessionId,
        uint256 kwhDelivered,
        bytes32 meterProof
    ) external onlyRole(OPERATOR_ROLE) {
        ChargingSession storage session = sessions[sessionId];
        require(session.status == SessionStatus.ACTIVE, "Session not active");
        require(kwhDelivered > 0, "Must deliver energy");

        ChargingStation storage station = stations[session.stationIdx];
        uint256 cost = (kwhDelivered * station.pricePerKWh) / 1e3; // kwhDelivered in millikWh

        session.kwhDelivered = kwhDelivered;
        session.totalCost = cost;
        session.endTime = block.timestamp;
        session.meterProof = meterProof;
        totalKwhDelivered += kwhDelivered;

        emit SessionEnded(sessionId, kwhDelivered);
    }

    function settleSession(uint256 sessionId) external payable {
        ChargingSession storage session = sessions[sessionId];
        require(session.status == SessionStatus.ACTIVE, "Not settleable");
        require(session.endTime > 0, "Session not ended");
        require(msg.value >= session.totalCost, "Insufficient payment");
        require(msg.sender == session.driver, "Not driver");

        session.status = SessionStatus.SETTLED;
        ChargingStation storage station = stations[session.stationIdx];
        operatorRevenue[station.operator] += session.totalCost;

        // Refund excess
        if (msg.value > session.totalCost) {
            (bool ok,) = msg.sender.call{value: msg.value - session.totalCost}("");
            require(ok, "Refund failed");
        }

        emit SessionSettled(sessionId, session.totalCost);
    }

    function withdrawRevenue() external {
        uint256 amount = operatorRevenue[msg.sender];
        require(amount > 0, "No revenue");
        operatorRevenue[msg.sender] = 0;

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    function setStationStatus(uint256 stationId, bool active) external onlyRole(OPERATOR_ROLE) {
        require(stationId < nextStationId, "Station does not exist");
        stations[stationId].active = active;

        emit StationStatusChanged(stationId, active);
    }

    receive() external payable {}
}
