// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title SupplyTracker — End-to-end shipment tracking with milestones and IoT checkpoints
contract SupplyTracker is AccessControl {

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum ShipmentStatus { CREATED, IN_TRANSIT, AT_CHECKPOINT, DELIVERED, CANCELLED }
    enum CheckpointType { ORIGIN, WAREHOUSE, CUSTOMS, PORT, DISTRIBUTION, DESTINATION }

    struct Shipment {
        uint256 id;
        address sender;
        address receiver;
        bytes32 contentsHash;
        uint256 createdAt;
        uint256 deliveredAt;
        ShipmentStatus status;
        uint256 checkpointCount;
        uint256 weight;
    }

    struct Checkpoint {
        uint256 shipmentId;
        CheckpointType cpType;
        bytes32 locationHash;
        uint256 timestamp;
        int256 temperature;
        address verifier;
    }

    uint256 public nextShipmentId;
    uint256 public nextCheckpointId;

    mapping(uint256 => Shipment) public shipments;
    mapping(uint256 => Checkpoint) public checkpoints;
    mapping(uint256 => uint256[]) public shipmentCheckpoints;
    mapping(address => uint256[]) public senderShipments;

    event ShipmentCreated(uint256 indexed shipmentId, address indexed sender, address indexed receiver);
    event CheckpointRecorded(uint256 indexed shipmentId, uint256 indexed checkpointId, CheckpointType cpType);
    event ShipmentDelivered(uint256 indexed shipmentId, uint256 deliveredAt);
    event ShipmentCancelled(uint256 indexed shipmentId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ── Create a new shipment ──────────────────
    function createShipment(
        address _receiver,
        bytes32 _contentsHash,
        uint256 _weight
    ) external returns (uint256) {
        require(_receiver != address(0), "Invalid receiver");
        require(_weight > 0, "Weight must be > 0");

        uint256 sid = nextShipmentId++;
        shipments[sid] = Shipment({
            id: sid,
            sender: msg.sender,
            receiver: _receiver,
            contentsHash: _contentsHash,
            createdAt: block.timestamp,
            deliveredAt: 0,
            status: ShipmentStatus.CREATED,
            checkpointCount: 0,
            weight: _weight
        });
        senderShipments[msg.sender].push(sid);

        emit ShipmentCreated(sid, msg.sender, _receiver);
        return sid;
    }

    // ── Record a checkpoint ──────────────────
    function recordCheckpoint(
        uint256 _shipmentId,
        CheckpointType _cpType,
        bytes32 _locationHash,
        int256 _temperature
    ) external onlyRole(OPERATOR_ROLE) returns (uint256) {
        Shipment storage s = shipments[_shipmentId];
        require(
            s.status == ShipmentStatus.CREATED ||
            s.status == ShipmentStatus.IN_TRANSIT ||
            s.status == ShipmentStatus.AT_CHECKPOINT,
            "Not trackable"
        );

        uint256 cpId = nextCheckpointId++;
        checkpoints[cpId] = Checkpoint({
            shipmentId: _shipmentId,
            cpType: _cpType,
            locationHash: _locationHash,
            timestamp: block.timestamp,
            temperature: _temperature,
            verifier: msg.sender
        });
        shipmentCheckpoints[_shipmentId].push(cpId);
        s.checkpointCount++;
        s.status = ShipmentStatus.AT_CHECKPOINT;

        emit CheckpointRecorded(_shipmentId, cpId, _cpType);
        return cpId;
    }

    // ── Mark shipment in-transit ──────────────────
    function markInTransit(uint256 _shipmentId) external onlyRole(OPERATOR_ROLE) {
        Shipment storage s = shipments[_shipmentId];
        require(
            s.status == ShipmentStatus.CREATED || s.status == ShipmentStatus.AT_CHECKPOINT,
            "Cannot transition"
        );
        s.status = ShipmentStatus.IN_TRANSIT;
    }

    // ── Confirm delivery ──────────────────
    function confirmDelivery(uint256 _shipmentId) external {
        Shipment storage s = shipments[_shipmentId];
        require(msg.sender == s.receiver, "Not receiver");
        require(s.status != ShipmentStatus.DELIVERED && s.status != ShipmentStatus.CANCELLED, "Already closed");

        s.status = ShipmentStatus.DELIVERED;
        s.deliveredAt = block.timestamp;

        emit ShipmentDelivered(_shipmentId, block.timestamp);
    }

    // ── Cancel a shipment ──────────────────
    function cancelShipment(uint256 _shipmentId) external {
        Shipment storage s = shipments[_shipmentId];
        require(msg.sender == s.sender, "Not sender");
        require(s.status != ShipmentStatus.DELIVERED && s.status != ShipmentStatus.CANCELLED, "Already closed");

        s.status = ShipmentStatus.CANCELLED;
        emit ShipmentCancelled(_shipmentId);
    }

    // ── View helpers ──────────────────
    function getShipmentCheckpoints(uint256 _shipmentId) external view returns (uint256[] memory) {
        return shipmentCheckpoints[_shipmentId];
    }

    function getSenderShipments(address _sender) external view returns (uint256[] memory) {
        return senderShipments[_sender];
    }
}
