// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title WarehouseManager — Inventory management with lot tracking and expiry monitoring
contract WarehouseManager is AccessControl {

    bytes32 public constant WAREHOUSE_ROLE = keccak256("WAREHOUSE_ROLE");

    enum LotStatus { ACTIVE, RESERVED, EXPIRED, CONSUMED, TRANSFERRED }

    struct Warehouse {
        uint256 id;
        bytes32 nameHash;
        address operator;
        uint256 capacity;
        uint256 usedCapacity;
        bool active;
    }

    struct Lot {
        uint256 id;
        uint256 warehouseId;
        bytes32 productHash;
        uint256 quantity;
        uint256 expiryDate;
        LotStatus status;
        uint256 createdAt;
    }

    struct Transfer {
        uint256 lotId;
        uint256 fromWarehouse;
        uint256 toWarehouse;
        uint256 quantity;
        uint256 timestamp;
        address initiator;
    }

    uint256 public nextWarehouseId;
    uint256 public nextLotId;
    uint256 public nextTransferId;

    mapping(uint256 => Warehouse) public warehouses;
    mapping(uint256 => Lot) public lots;
    mapping(uint256 => Transfer) public transfers;
    mapping(uint256 => uint256[]) public warehouseLots;

    event WarehouseRegistered(uint256 indexed warehouseId, address indexed operator);
    event LotReceived(uint256 indexed warehouseId, uint256 indexed lotId, bytes32 productHash);
    event LotTransferred(uint256 indexed transferId, uint256 fromWarehouse, uint256 toWarehouse);
    event LotExpired(uint256 indexed lotId);
    event LotConsumed(uint256 indexed lotId, uint256 quantity);
    event LotReserved(uint256 indexed lotId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(WAREHOUSE_ROLE, msg.sender);
    }

    // ── Register a warehouse ──────────────────
    function registerWarehouse(
        bytes32 _nameHash,
        uint256 _capacity
    ) external onlyRole(WAREHOUSE_ROLE) returns (uint256) {
        require(_capacity > 0, "Capacity must be > 0");

        uint256 wid = nextWarehouseId++;
        warehouses[wid] = Warehouse({
            id: wid,
            nameHash: _nameHash,
            operator: msg.sender,
            capacity: _capacity,
            usedCapacity: 0,
            active: true
        });

        emit WarehouseRegistered(wid, msg.sender);
        return wid;
    }

    // ── Receive a lot into a warehouse ──────────────────
    function receiveLot(
        uint256 _warehouseId,
        bytes32 _productHash,
        uint256 _quantity,
        uint256 _expiryDate
    ) external onlyRole(WAREHOUSE_ROLE) returns (uint256) {
        Warehouse storage w = warehouses[_warehouseId];
        require(w.active, "Warehouse not active");
        require(w.usedCapacity + _quantity <= w.capacity, "Exceeds capacity");
        require(_quantity > 0, "Quantity must be > 0");
        require(_expiryDate > block.timestamp, "Already expired");

        uint256 lid = nextLotId++;
        lots[lid] = Lot({
            id: lid,
            warehouseId: _warehouseId,
            productHash: _productHash,
            quantity: _quantity,
            expiryDate: _expiryDate,
            status: LotStatus.ACTIVE,
            createdAt: block.timestamp
        });
        w.usedCapacity += _quantity;
        warehouseLots[_warehouseId].push(lid);

        emit LotReceived(_warehouseId, lid, _productHash);
        return lid;
    }

    // ── Reserve a lot ──────────────────
    function reserveLot(uint256 _lotId) external onlyRole(WAREHOUSE_ROLE) {
        Lot storage lot = lots[_lotId];
        require(lot.status == LotStatus.ACTIVE, "Not active");
        lot.status = LotStatus.RESERVED;
        emit LotReserved(_lotId);
    }

    // ── Consume (partially or fully) ──────────────────
    function consumeLot(uint256 _lotId, uint256 _quantity) external onlyRole(WAREHOUSE_ROLE) {
        Lot storage lot = lots[_lotId];
        require(lot.status == LotStatus.ACTIVE || lot.status == LotStatus.RESERVED, "Not consumable");
        require(_quantity > 0 && _quantity <= lot.quantity, "Invalid quantity");

        Warehouse storage w = warehouses[lot.warehouseId];
        lot.quantity -= _quantity;
        w.usedCapacity -= _quantity;

        if (lot.quantity == 0) {
            lot.status = LotStatus.CONSUMED;
        }

        emit LotConsumed(_lotId, _quantity);
    }

    // ── Mark lot expired ──────────────────
    function markExpired(uint256 _lotId) external onlyRole(WAREHOUSE_ROLE) {
        Lot storage lot = lots[_lotId];
        require(lot.status == LotStatus.ACTIVE || lot.status == LotStatus.RESERVED, "Not expirable");
        require(block.timestamp >= lot.expiryDate, "Not yet expired");

        Warehouse storage w = warehouses[lot.warehouseId];
        w.usedCapacity -= lot.quantity;
        lot.status = LotStatus.EXPIRED;

        emit LotExpired(_lotId);
    }

    // ── Transfer lot between warehouses ──────────────────
    function transferLot(
        uint256 _lotId,
        uint256 _toWarehouseId
    ) external onlyRole(WAREHOUSE_ROLE) returns (uint256) {
        Lot storage lot = lots[_lotId];
        require(lot.status == LotStatus.ACTIVE, "Not active");

        Warehouse storage from = warehouses[lot.warehouseId];
        Warehouse storage to = warehouses[_toWarehouseId];
        require(to.active, "Destination not active");
        require(to.usedCapacity + lot.quantity <= to.capacity, "Exceeds destination capacity");

        uint256 tid = nextTransferId++;
        transfers[tid] = Transfer({
            lotId: _lotId,
            fromWarehouse: lot.warehouseId,
            toWarehouse: _toWarehouseId,
            quantity: lot.quantity,
            timestamp: block.timestamp,
            initiator: msg.sender
        });

        from.usedCapacity -= lot.quantity;
        to.usedCapacity += lot.quantity;

        lot.warehouseId = _toWarehouseId;
        lot.status = LotStatus.TRANSFERRED;

        // Create new lot in destination
        uint256 newLid = nextLotId++;
        lots[newLid] = Lot({
            id: newLid,
            warehouseId: _toWarehouseId,
            productHash: lot.productHash,
            quantity: lot.quantity,
            expiryDate: lot.expiryDate,
            status: LotStatus.ACTIVE,
            createdAt: block.timestamp
        });
        warehouseLots[_toWarehouseId].push(newLid);

        emit LotTransferred(tid, transfers[tid].fromWarehouse, _toWarehouseId);
        return tid;
    }

    // ── Deactivate warehouse ──────────────────
    function deactivateWarehouse(uint256 _warehouseId) external onlyRole(WAREHOUSE_ROLE) {
        Warehouse storage w = warehouses[_warehouseId];
        require(w.active, "Already inactive");
        require(w.usedCapacity == 0, "Warehouse not empty");
        w.active = false;
    }

    // ── View helpers ──────────────────
    function getWarehouseLots(uint256 _warehouseId) external view returns (uint256[] memory) {
        return warehouseLots[_warehouseId];
    }

    function isLotExpired(uint256 _lotId) external view returns (bool) {
        return block.timestamp >= lots[_lotId].expiryDate;
    }
}
