// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title MaterialTokenMRP — Tokenized raw-material inventory with BOM tracking on BeZhas Chain
/// @notice Register materials, create purchase orders, define Bills of Materials, consume inventory
contract MaterialTokenMRP is AccessControl {

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Material {
        string  sku;
        string  name;
        address supplier;
        uint256 pricePerUnit;   // in wei
        uint256 totalSupply;
        uint256 reorderPoint;
        bool    active;
    }

    enum OrderStatus { PENDING, CONFIRMED, SHIPPED, RECEIVED, CANCELLED }

    struct PurchaseOrder {
        uint256     materialId;
        address     buyer;
        uint256     quantity;
        uint256     totalCost;
        uint256     createdAt;
        OrderStatus status;
    }

    struct BOMEntry {
        uint256 productId;
        uint256 materialId;
        uint256 quantityNeeded;  // per unit of product
    }

    uint256 public nextMaterialId;
    mapping(uint256 => Material) public materials;

    uint256 public nextOrderId;
    mapping(uint256 => PurchaseOrder) public orders;

    uint256 public totalBOMEntries;
    mapping(uint256 => BOMEntry) public bomEntries;

    uint256 public totalConsumed;

    event MaterialRegistered(uint256 indexed materialId, string sku, string name);
    event OrderCreated(uint256 indexed orderId, uint256 materialId, uint256 quantity);
    event OrderConfirmed(uint256 indexed orderId);
    event OrderReceived(uint256 indexed orderId, uint256 actualQty);
    event BOMEntryAdded(uint256 indexed productId, uint256 materialId, uint256 qty);
    event MaterialConsumed(uint256 indexed materialId, uint256 qty);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    function registerMaterial(
        string calldata sku,
        string calldata name,
        uint256 pricePerUnit,
        uint256 reorderPoint
    ) external onlyRole(MANAGER_ROLE) returns (uint256) {
        require(bytes(sku).length > 0, "Empty SKU");

        uint256 matId = nextMaterialId++;
        materials[matId] = Material({
            sku: sku,
            name: name,
            supplier: msg.sender,
            pricePerUnit: pricePerUnit,
            totalSupply: 0,
            reorderPoint: reorderPoint,
            active: true
        });

        emit MaterialRegistered(matId, sku, name);
        return matId;
    }

    function createPurchaseOrder(
        uint256 materialId,
        uint256 qty
    ) external payable onlyRole(MANAGER_ROLE) returns (uint256) {
        require(materialId < nextMaterialId, "Material does not exist");
        require(qty > 0, "Zero quantity");

        uint256 cost = qty * materials[materialId].pricePerUnit;
        require(msg.value >= cost, "Insufficient payment");

        uint256 orderId = nextOrderId++;
        orders[orderId] = PurchaseOrder({
            materialId: materialId,
            buyer: msg.sender,
            quantity: qty,
            totalCost: cost,
            createdAt: block.timestamp,
            status: OrderStatus.PENDING
        });

        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        emit OrderCreated(orderId, materialId, qty);
        return orderId;
    }

    function confirmOrder(uint256 orderId) external onlyRole(MANAGER_ROLE) {
        require(orderId < nextOrderId, "Order does not exist");
        require(orders[orderId].status == OrderStatus.PENDING, "Not pending");

        orders[orderId].status = OrderStatus.CONFIRMED;
        emit OrderConfirmed(orderId);
    }

    function receiveOrder(
        uint256 orderId,
        uint256 actualQty,
        bytes32 qualityProof
    ) external onlyRole(MANAGER_ROLE) {
        require(orderId < nextOrderId, "Order does not exist");
        PurchaseOrder storage po = orders[orderId];
        require(po.status == OrderStatus.CONFIRMED, "Not confirmed");
        require(actualQty > 0, "Zero quantity");
        require(qualityProof != bytes32(0), "Missing quality proof");

        po.status = OrderStatus.RECEIVED;
        materials[po.materialId].totalSupply += actualQty;
        emit OrderReceived(orderId, actualQty);
    }

    function addBOMEntry(
        uint256 productId,
        uint256 materialId,
        uint256 qtyNeeded
    ) external onlyRole(MANAGER_ROLE) {
        require(materialId < nextMaterialId, "Material does not exist");
        require(qtyNeeded > 0, "Zero quantity");

        uint256 entryId = totalBOMEntries++;
        bomEntries[entryId] = BOMEntry({
            productId: productId,
            materialId: materialId,
            quantityNeeded: qtyNeeded
        });

        emit BOMEntryAdded(productId, materialId, qtyNeeded);
    }

    function consumeMaterial(uint256 materialId, uint256 qty) external onlyRole(MANAGER_ROLE) {
        require(materialId < nextMaterialId, "Material does not exist");
        require(materials[materialId].totalSupply >= qty, "Insufficient supply");

        materials[materialId].totalSupply -= qty;
        totalConsumed += qty;
        emit MaterialConsumed(materialId, qty);
    }
}
