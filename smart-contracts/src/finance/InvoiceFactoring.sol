// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title InvoiceFactoring — Tokenized invoice financing with discount rates and settlement
contract InvoiceFactoring is AccessControl {

    bytes32 public constant FACTOR_ROLE = keccak256("FACTOR_ROLE");

    enum InvoiceStatus { SUBMITTED, APPROVED, FUNDED, REPAID, DEFAULTED, CANCELLED }

    struct Invoice {
        uint256 id;
        address seller;
        address debtor;
        uint256 faceValue;
        uint256 discountBps;
        uint256 fundedAmount;
        uint256 dueDate;
        InvoiceStatus status;
        uint256 createdAt;
    }

    uint256 public nextInvoiceId;
    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) public sellerInvoices;

    // ─── Platform Fee ───
    uint256 public platformFeeBps = 100; // 1% platform fee on funded amount
    address public treasury;
    uint256 public accruedFees;

    event InvoiceSubmitted(uint256 indexed invoiceId, address indexed seller, uint256 faceValue);
    event InvoiceApproved(uint256 indexed invoiceId);
    event InvoiceFunded(uint256 indexed invoiceId, uint256 fundedAmount);
    event InvoiceRepaid(uint256 indexed invoiceId);
    event InvoiceDefaulted(uint256 indexed invoiceId);
    event InvoiceCancelled(uint256 indexed invoiceId);
    event FeeCollected(uint256 indexed invoiceId, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FACTOR_ROLE, msg.sender);
        treasury = _treasury;
    }

    // ── Submit an invoice for factoring ──────────────────
    function submitInvoice(
        address _debtor,
        uint256 _faceValue,
        uint256 _discountBps,
        uint256 _dueDate
    ) external returns (uint256) {
        require(_debtor != address(0), "Invalid debtor");
        require(_faceValue > 0, "Face value must be > 0");
        require(_discountBps <= 3000, "Discount too high");
        require(_dueDate > block.timestamp, "Due date must be future");

        uint256 iid = nextInvoiceId++;
        invoices[iid] = Invoice({
            id: iid,
            seller: msg.sender,
            debtor: _debtor,
            faceValue: _faceValue,
            discountBps: _discountBps,
            fundedAmount: 0,
            dueDate: _dueDate,
            status: InvoiceStatus.SUBMITTED,
            createdAt: block.timestamp
        });
        sellerInvoices[msg.sender].push(iid);

        emit InvoiceSubmitted(iid, msg.sender, _faceValue);
        return iid;
    }

    // ── Approve an invoice for funding ──────────────────
    function approveInvoice(uint256 _invoiceId) external onlyRole(FACTOR_ROLE) {
        Invoice storage inv = invoices[_invoiceId];
        require(inv.status == InvoiceStatus.SUBMITTED, "Not submitted");
        inv.status = InvoiceStatus.APPROVED;
        emit InvoiceApproved(_invoiceId);
    }

    // ── Fund an approved invoice (factor sends discounted amount to seller) ──────────────────
    function fundInvoice(uint256 _invoiceId) external payable onlyRole(FACTOR_ROLE) {
        Invoice storage inv = invoices[_invoiceId];
        require(inv.status == InvoiceStatus.APPROVED, "Not approved");

        uint256 discounted = inv.faceValue - (inv.faceValue * inv.discountBps / 10000);
        require(msg.value == discounted, "Must match discounted amount");

        // Deduct platform fee
        uint256 fee = (msg.value * platformFeeBps) / 10_000;
        uint256 netToSeller = msg.value - fee;
        accruedFees += fee;

        inv.fundedAmount = msg.value;
        inv.status = InvoiceStatus.FUNDED;

        // Pay seller (net of fee)
        (bool ok, ) = inv.seller.call{value: netToSeller}("");
        require(ok, "Transfer to seller failed");

        emit InvoiceFunded(_invoiceId, msg.value);
        if (fee > 0) emit FeeCollected(_invoiceId, fee);
    }

    // ── Debtor repays the full face value ──────────────────
    function repayInvoice(uint256 _invoiceId) external payable {
        Invoice storage inv = invoices[_invoiceId];
        require(inv.status == InvoiceStatus.FUNDED, "Not funded");
        require(msg.value == inv.faceValue, "Must pay face value");

        inv.status = InvoiceStatus.REPAID;
        // Face value goes to factor (contract holds it for withdrawal)
        emit InvoiceRepaid(_invoiceId);
    }

    // ── Mark invoice as defaulted ──────────────────
    function markDefaulted(uint256 _invoiceId) external onlyRole(FACTOR_ROLE) {
        Invoice storage inv = invoices[_invoiceId];
        require(inv.status == InvoiceStatus.FUNDED, "Not funded");
        require(block.timestamp > inv.dueDate, "Not past due");

        inv.status = InvoiceStatus.DEFAULTED;
        emit InvoiceDefaulted(_invoiceId);
    }

    // ── Cancel a submitted invoice ──────────────────
    function cancelInvoice(uint256 _invoiceId) external {
        Invoice storage inv = invoices[_invoiceId];
        require(inv.status == InvoiceStatus.SUBMITTED, "Cannot cancel");
        require(msg.sender == inv.seller, "Not seller");

        inv.status = InvoiceStatus.CANCELLED;
        emit InvoiceCancelled(_invoiceId);
    }

    // ── Withdraw repaid funds (factor) ──────────────────
    function withdrawRepaid(uint256 _invoiceId) external onlyRole(FACTOR_ROLE) {
        Invoice storage inv = invoices[_invoiceId];
        require(inv.status == InvoiceStatus.REPAID, "Not repaid");

        uint256 amount = inv.faceValue;
        inv.faceValue = 0; // Prevent re-entry

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    // ── View helpers ──────────────────
    function getSellerInvoices(address _seller) external view returns (uint256[] memory) {
        return sellerInvoices[_seller];
    }

    function getDiscountedAmount(uint256 _invoiceId) external view returns (uint256) {
        Invoice storage inv = invoices[_invoiceId];
        return inv.faceValue - (inv.faceValue * inv.discountBps / 10000);
    }

    function isOverdue(uint256 _invoiceId) external view returns (bool) {
        Invoice storage inv = invoices[_invoiceId];
        return inv.status == InvoiceStatus.FUNDED && block.timestamp > inv.dueDate;
    }

    // ── Admin ──────────────────
    function withdrawFees(address _to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_to != address(0), "Invalid address");
        uint256 amount = accruedFees;
        require(amount > 0, "No fees");
        accruedFees = 0;
        (bool ok, ) = _to.call{value: amount}("");
        require(ok, "Transfer failed");
        emit FeesWithdrawn(_to, amount);
    }

    function setPlatformFee(uint256 _newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newFeeBps <= 500, "Fee too high"); // max 5%
        platformFeeBps = _newFeeBps;
    }

    function setTreasury(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newTreasury != address(0), "Invalid address");
        treasury = _newTreasury;
    }
}
