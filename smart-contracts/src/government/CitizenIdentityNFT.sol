// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title CitizenIdentityNFT — Digital citizen identity with KYC, document registry and biometrics
contract CitizenIdentityNFT is AccessControl {

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum KYCStatus { NONE, PENDING, VERIFIED, REVOKED }
    enum DocType { NATIONAL_ID, PASSPORT, DRIVERS_LICENSE, BIRTH_CERT, TAX_ID, OTHER }

    struct Citizen {
        uint256 id;
        address wallet;
        bytes32 nameHash;
        bytes32 biometricHash;
        KYCStatus kycStatus;
        uint256 registeredAt;
        uint256 kycVerifiedAt;
        bool active;
    }

    struct Document {
        uint256 id;
        uint256 citizenId;
        DocType docType;
        bytes32 docHash;
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
    }

    uint256 public nextCitizenId;
    uint256 public nextDocId;

    mapping(uint256 => Citizen) public citizens;
    mapping(address => uint256) public walletToCitizen;
    mapping(uint256 => Document) public documents;
    mapping(uint256 => uint256[]) public citizenDocs;

    event CitizenRegistered(uint256 indexed citizenId, address indexed wallet);
    event KYCSubmitted(uint256 indexed citizenId);
    event KYCVerified(uint256 indexed citizenId);
    event KYCRevoked(uint256 indexed citizenId);
    event DocumentIssued(uint256 indexed docId, uint256 indexed citizenId, DocType docType);
    event DocumentRevoked(uint256 indexed docId);
    event CitizenDeactivated(uint256 indexed citizenId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    // ── Register a citizen ──────────────────
    function registerCitizen(
        address _wallet,
        bytes32 _nameHash,
        bytes32 _biometricHash
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        require(_wallet != address(0), "Invalid wallet");
        require(walletToCitizen[_wallet] == 0 && (nextCitizenId == 0 || citizens[0].wallet != _wallet), "Already registered");

        uint256 cid = nextCitizenId++;
        citizens[cid] = Citizen({
            id: cid,
            wallet: _wallet,
            nameHash: _nameHash,
            biometricHash: _biometricHash,
            kycStatus: KYCStatus.NONE,
            registeredAt: block.timestamp,
            kycVerifiedAt: 0,
            active: true
        });
        walletToCitizen[_wallet] = cid;

        emit CitizenRegistered(cid, _wallet);
        return cid;
    }

    // ── Submit KYC ──────────────────
    function submitKYC(uint256 _citizenId) external {
        Citizen storage c = citizens[_citizenId];
        require(msg.sender == c.wallet, "Not citizen");
        require(c.active, "Not active");
        require(c.kycStatus == KYCStatus.NONE || c.kycStatus == KYCStatus.REVOKED, "KYC not submittable");
        c.kycStatus = KYCStatus.PENDING;
        emit KYCSubmitted(_citizenId);
    }

    // ── Verify KYC ──────────────────
    function verifyKYC(uint256 _citizenId) external onlyRole(REGISTRAR_ROLE) {
        Citizen storage c = citizens[_citizenId];
        require(c.kycStatus == KYCStatus.PENDING, "Not pending");
        c.kycStatus = KYCStatus.VERIFIED;
        c.kycVerifiedAt = block.timestamp;
        emit KYCVerified(_citizenId);
    }

    // ── Revoke KYC ──────────────────
    function revokeKYC(uint256 _citizenId) external onlyRole(REGISTRAR_ROLE) {
        Citizen storage c = citizens[_citizenId];
        require(c.kycStatus == KYCStatus.VERIFIED, "Not verified");
        c.kycStatus = KYCStatus.REVOKED;
        emit KYCRevoked(_citizenId);
    }

    // ── Issue a document ──────────────────
    function issueDocument(
        uint256 _citizenId,
        DocType _docType,
        bytes32 _docHash,
        uint256 _expiresAt
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        require(citizens[_citizenId].active, "Citizen not active");
        require(_expiresAt > block.timestamp, "Already expired");

        uint256 did = nextDocId++;
        documents[did] = Document({
            id: did,
            citizenId: _citizenId,
            docType: _docType,
            docHash: _docHash,
            issuedAt: block.timestamp,
            expiresAt: _expiresAt,
            revoked: false
        });
        citizenDocs[_citizenId].push(did);

        emit DocumentIssued(did, _citizenId, _docType);
        return did;
    }

    // ── Revoke a document ──────────────────
    function revokeDocument(uint256 _docId) external onlyRole(REGISTRAR_ROLE) {
        Document storage d = documents[_docId];
        require(!d.revoked, "Already revoked");
        d.revoked = true;
        emit DocumentRevoked(_docId);
    }

    // ── Deactivate citizen ──────────────────
    function deactivateCitizen(uint256 _citizenId) external onlyRole(REGISTRAR_ROLE) {
        Citizen storage c = citizens[_citizenId];
        require(c.active, "Already inactive");
        c.active = false;
        emit CitizenDeactivated(_citizenId);
    }

    // ── View helpers ──────────────────
    function getCitizenDocs(uint256 _citizenId) external view returns (uint256[] memory) {
        return citizenDocs[_citizenId];
    }

    function isDocValid(uint256 _docId) external view returns (bool) {
        Document storage d = documents[_docId];
        return !d.revoked && block.timestamp < d.expiresAt;
    }

    function isKYCVerified(uint256 _citizenId) external view returns (bool) {
        return citizens[_citizenId].kycStatus == KYCStatus.VERIFIED;
    }
}
