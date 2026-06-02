// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title SupplierScoreOracle — Supplier reputation scoring with on-chain audits and KPIs
contract SupplierScoreOracle is AccessControl {

    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    enum CertStatus { PENDING, APPROVED, REVOKED, EXPIRED }

    struct Supplier {
        address addr;
        bytes32 nameHash;
        uint256 totalOrders;
        uint256 onTimeDeliveries;
        uint256 qualityScore;
        uint256 registeredAt;
        bool active;
    }

    struct Audit {
        uint256 id;
        address supplier;
        address auditor;
        uint256 score;
        bytes32 reportHash;
        uint256 timestamp;
    }

    struct Certification {
        uint256 id;
        address supplier;
        bytes32 certHash;
        CertStatus status;
        uint256 issuedAt;
        uint256 expiresAt;
        address issuer;
    }

    uint256 public nextAuditId;
    uint256 public nextCertId;

    mapping(address => Supplier) public suppliers;
    mapping(uint256 => Audit) public audits;
    mapping(uint256 => Certification) public certifications;
    mapping(address => uint256[]) public supplierAudits;
    mapping(address => uint256[]) public supplierCerts;

    event SupplierRegistered(address indexed supplier, bytes32 nameHash);
    event OrderRecorded(address indexed supplier, bool onTime);
    event AuditCompleted(uint256 indexed auditId, address indexed supplier, uint256 score);
    event CertIssued(uint256 indexed certId, address indexed supplier);
    event CertRevoked(uint256 indexed certId);
    event CertExpired(uint256 indexed certId);
    event SupplierDeactivated(address indexed supplier);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AUDITOR_ROLE, msg.sender);
    }

    // ── Register a supplier ──────────────────
    function registerSupplier(address _supplier, bytes32 _nameHash) external onlyRole(AUDITOR_ROLE) {
        require(_supplier != address(0), "Invalid address");
        require(suppliers[_supplier].registeredAt == 0, "Already registered");

        suppliers[_supplier] = Supplier({
            addr: _supplier,
            nameHash: _nameHash,
            totalOrders: 0,
            onTimeDeliveries: 0,
            qualityScore: 100,
            registeredAt: block.timestamp,
            active: true
        });

        emit SupplierRegistered(_supplier, _nameHash);
    }

    // ── Record an order fulfillment ──────────────────
    function recordOrder(address _supplier, bool _onTime) external onlyRole(AUDITOR_ROLE) {
        Supplier storage s = suppliers[_supplier];
        require(s.active, "Supplier not active");

        s.totalOrders++;
        if (_onTime) {
            s.onTimeDeliveries++;
        }

        emit OrderRecorded(_supplier, _onTime);
    }

    // ── Perform an audit ──────────────────
    function performAudit(
        address _supplier,
        uint256 _score,
        bytes32 _reportHash
    ) external onlyRole(AUDITOR_ROLE) returns (uint256) {
        require(suppliers[_supplier].active, "Supplier not active");
        require(_score <= 100, "Score max 100");

        uint256 aid = nextAuditId++;
        audits[aid] = Audit({
            id: aid,
            supplier: _supplier,
            auditor: msg.sender,
            score: _score,
            reportHash: _reportHash,
            timestamp: block.timestamp
        });
        supplierAudits[_supplier].push(aid);

        // Update quality score as rolling average
        Supplier storage s = suppliers[_supplier];
        uint256 auditCount = supplierAudits[_supplier].length;
        s.qualityScore = ((s.qualityScore * (auditCount - 1)) + _score) / auditCount;

        emit AuditCompleted(aid, _supplier, _score);
        return aid;
    }

    // ── Issue certification ──────────────────
    function issueCertification(
        address _supplier,
        bytes32 _certHash,
        uint256 _expiresAt
    ) external onlyRole(AUDITOR_ROLE) returns (uint256) {
        require(suppliers[_supplier].active, "Supplier not active");
        require(_expiresAt > block.timestamp, "Already expired");

        uint256 cid = nextCertId++;
        certifications[cid] = Certification({
            id: cid,
            supplier: _supplier,
            certHash: _certHash,
            status: CertStatus.APPROVED,
            issuedAt: block.timestamp,
            expiresAt: _expiresAt,
            issuer: msg.sender
        });
        supplierCerts[_supplier].push(cid);

        emit CertIssued(cid, _supplier);
        return cid;
    }

    // ── Revoke certification ──────────────────
    function revokeCertification(uint256 _certId) external onlyRole(AUDITOR_ROLE) {
        Certification storage c = certifications[_certId];
        require(c.status == CertStatus.APPROVED, "Not approved");
        c.status = CertStatus.REVOKED;
        emit CertRevoked(_certId);
    }

    // ── Mark certification expired ──────────────────
    function markCertExpired(uint256 _certId) external onlyRole(AUDITOR_ROLE) {
        Certification storage c = certifications[_certId];
        require(c.status == CertStatus.APPROVED, "Not approved");
        require(block.timestamp >= c.expiresAt, "Not yet expired");
        c.status = CertStatus.EXPIRED;
        emit CertExpired(_certId);
    }

    // ── Deactivate supplier ──────────────────
    function deactivateSupplier(address _supplier) external onlyRole(AUDITOR_ROLE) {
        Supplier storage s = suppliers[_supplier];
        require(s.active, "Already inactive");
        s.active = false;
        emit SupplierDeactivated(_supplier);
    }

    // ── View helpers ──────────────────
    function getDeliveryRate(address _supplier) external view returns (uint256) {
        Supplier storage s = suppliers[_supplier];
        if (s.totalOrders == 0) return 0;
        return (s.onTimeDeliveries * 100) / s.totalOrders;
    }

    function getSupplierAudits(address _supplier) external view returns (uint256[] memory) {
        return supplierAudits[_supplier];
    }

    function getSupplierCerts(address _supplier) external view returns (uint256[] memory) {
        return supplierCerts[_supplier];
    }

    function isCertValid(uint256 _certId) external view returns (bool) {
        Certification storage c = certifications[_certId];
        return c.status == CertStatus.APPROVED && block.timestamp < c.expiresAt;
    }
}
