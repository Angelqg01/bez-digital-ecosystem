// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ProcurementNFT — Tokenized purchase orders with multi-approval and auto-settlement
contract ProcurementNFT is AccessControl {

    bytes32 public constant PROCUREMENT_ROLE = keccak256("PROCUREMENT_ROLE");

    enum POStatus { DRAFT, PENDING_APPROVAL, APPROVED, SHIPPED, RECEIVED, SETTLED, CANCELLED }

    struct PurchaseOrder {
        uint256 id;
        address buyer;
        address supplier;
        bytes32 itemsHash;
        uint256 totalAmount;
        uint256 createdAt;
        uint256 settledAt;
        POStatus status;
        uint256 approvalCount;
        uint256 requiredApprovals;
    }

    uint256 public nextPOId;
    mapping(uint256 => PurchaseOrder) public purchaseOrders;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(address => uint256[]) public buyerOrders;
    mapping(address => uint256[]) public supplierOrders;
    mapping(uint256 => uint256) public escrow;

    event POCreated(uint256 indexed poId, address indexed buyer, address indexed supplier);
    event POApproved(uint256 indexed poId, address indexed approver, uint256 approvalCount);
    event POShipped(uint256 indexed poId);
    event POReceived(uint256 indexed poId);
    event POSettled(uint256 indexed poId, uint256 amount);
    event POCancelled(uint256 indexed poId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROCUREMENT_ROLE, msg.sender);
    }

    // ── Create a purchase order (with escrow) ──────────────────
    function createPO(
        address _supplier,
        bytes32 _itemsHash,
        uint256 _totalAmount,
        uint256 _requiredApprovals
    ) external payable returns (uint256) {
        require(_supplier != address(0), "Invalid supplier");
        require(_totalAmount > 0, "Amount must be > 0");
        require(msg.value >= _totalAmount, "Insufficient escrow");
        require(_requiredApprovals > 0, "Need at least 1 approval");

        uint256 poId = nextPOId++;
        purchaseOrders[poId] = PurchaseOrder({
            id: poId,
            buyer: msg.sender,
            supplier: _supplier,
            itemsHash: _itemsHash,
            totalAmount: _totalAmount,
            createdAt: block.timestamp,
            settledAt: 0,
            status: POStatus.DRAFT,
            approvalCount: 0,
            requiredApprovals: _requiredApprovals
        });
        escrow[poId] = msg.value;
        buyerOrders[msg.sender].push(poId);
        supplierOrders[_supplier].push(poId);

        emit POCreated(poId, msg.sender, _supplier);
        return poId;
    }

    // ── Submit PO for approval ──────────────────
    function submitForApproval(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(msg.sender == po.buyer, "Not buyer");
        require(po.status == POStatus.DRAFT, "Not draft");
        po.status = POStatus.PENDING_APPROVAL;
    }

    // ── Approve a PO ──────────────────
    function approvePO(uint256 _poId) external onlyRole(PROCUREMENT_ROLE) {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.status == POStatus.PENDING_APPROVAL, "Not pending approval");
        require(!hasApproved[_poId][msg.sender], "Already approved");

        hasApproved[_poId][msg.sender] = true;
        po.approvalCount++;

        emit POApproved(_poId, msg.sender, po.approvalCount);

        if (po.approvalCount >= po.requiredApprovals) {
            po.status = POStatus.APPROVED;
        }
    }

    // ── Mark as shipped ──────────────────
    function markShipped(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(msg.sender == po.supplier, "Not supplier");
        require(po.status == POStatus.APPROVED, "Not approved");
        po.status = POStatus.SHIPPED;
        emit POShipped(_poId);
    }

    // ── Confirm receipt ──────────────────
    function confirmReceipt(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(msg.sender == po.buyer, "Not buyer");
        require(po.status == POStatus.SHIPPED, "Not shipped");
        po.status = POStatus.RECEIVED;
        emit POReceived(_poId);
    }

    // ── Settle (release escrow to supplier) ──────────────────
    function settle(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(msg.sender == po.buyer, "Not buyer");
        require(po.status == POStatus.RECEIVED, "Not received");

        uint256 amount = escrow[_poId];
        require(amount > 0, "Nothing to settle");

        escrow[_poId] = 0;
        po.status = POStatus.SETTLED;
        po.settledAt = block.timestamp;

        (bool ok, ) = po.supplier.call{value: amount}("");
        require(ok, "Transfer failed");

        emit POSettled(_poId, amount);
    }

    // ── Cancel PO (refund buyer) ──────────────────
    function cancelPO(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(msg.sender == po.buyer, "Not buyer");
        require(
            po.status == POStatus.DRAFT || po.status == POStatus.PENDING_APPROVAL,
            "Cannot cancel"
        );

        uint256 amount = escrow[_poId];
        escrow[_poId] = 0;
        po.status = POStatus.CANCELLED;

        if (amount > 0) {
            (bool ok, ) = po.buyer.call{value: amount}("");
            require(ok, "Refund failed");
        }

        emit POCancelled(_poId);
    }

    // ── View helpers ──────────────────
    function getBuyerOrders(address _buyer) external view returns (uint256[] memory) {
        return buyerOrders[_buyer];
    }

    function getSupplierOrders(address _supplier) external view returns (uint256[] memory) {
        return supplierOrders[_supplier];
    }
}
