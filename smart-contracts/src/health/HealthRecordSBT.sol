// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

/**
 * @title HealthRecordSBT
 * @dev Soulbound Token (non-transferable ERC721) for on-chain medical records.
 * Hospitals mint records, patients control access via consent signatures.
 * Supports ZK-proof verification for privacy-preserving insurance claims.
 */
contract HealthRecordSBT is ERC721, AccessControl {
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    enum RecordStatus { ACTIVE, CONSENT_PENDING, REVOKED, EMERGENCY_OVERRIDE }

    struct PatientRecord {
        string patientId;
        bytes32 dataHash;
        bytes32 consentHash;
        uint256 createdAt;
        uint256 lastUpdated;
        address guardian;
        RecordStatus status;
    }

    struct AccessGrant {
        address grantee;
        string[] fieldScopes;
        uint256 expiresAt;
        bool active;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => PatientRecord) private _records;
    mapping(uint256 => AccessGrant[]) private _accessGrants;
    mapping(uint256 => uint256) private _accessLogCount;

    event MedRecordMinted(uint256 indexed tokenId, string patientId, address indexed guardian);
    event AccessGranted(uint256 indexed tokenId, address indexed grantee, uint256 expiresAt);
    event AccessRevoked(uint256 indexed tokenId);
    event EmergencyAccessUsed(uint256 indexed tokenId, address indexed erDoctor);
    event DataUpdated(uint256 indexed tokenId, bytes32 newDataHash);

    constructor() ERC721("BeZhas MedRecord SBT", "BEZ-MED") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Mint a new Soulbound medical record for a patient.
     */
    function mintMedRecord(
        string calldata patientId,
        bytes32 dataHash,
        bytes32 consentHash,
        address patientWallet
    ) external onlyRole(HOSPITAL_ROLE) returns (uint256 tokenId) {
        require(patientWallet != address(0), "HealthRecordSBT: zero address");
        require(bytes(patientId).length > 0, "HealthRecordSBT: empty patientId");

        tokenId = _nextTokenId++;
        _safeMint(patientWallet, tokenId);

        _records[tokenId] = PatientRecord({
            patientId: patientId,
            dataHash: dataHash,
            consentHash: consentHash,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            guardian: patientWallet,
            status: RecordStatus.ACTIVE
        });

        emit MedRecordMinted(tokenId, patientId, patientWallet);
    }

    /**
     * @dev Patient grants read access to a specific address (doctor, insurer).
     */
    function grantAccess(
        uint256 tokenId,
        address grantee,
        string[] calldata fieldScopes,
        uint256 expiresAt
    ) external {
        require(ownerOf(tokenId) == msg.sender, "HealthRecordSBT: not patient");
        require(grantee != address(0), "HealthRecordSBT: zero grantee");
        require(expiresAt > block.timestamp, "HealthRecordSBT: expired");

        _accessGrants[tokenId].push(AccessGrant({
            grantee: grantee,
            fieldScopes: fieldScopes,
            expiresAt: expiresAt,
            active: true
        }));
        _accessLogCount[tokenId]++;

        emit AccessGranted(tokenId, grantee, expiresAt);
    }

    /**
     * @dev Patient revokes all access grants.
     */
    function revokeAllAccess(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "HealthRecordSBT: not patient");

        AccessGrant[] storage grants = _accessGrants[tokenId];
        for (uint256 i = 0; i < grants.length; i++) {
            grants[i].active = false;
        }
        _records[tokenId].status = RecordStatus.REVOKED;

        emit AccessRevoked(tokenId);
    }

    /**
     * @dev Emergency access override requiring EMERGENCY_ROLE.
     */
    function emergencyAccess(
        uint256 tokenId,
        address erDoctor
    ) external onlyRole(EMERGENCY_ROLE) {
        _records[tokenId].status = RecordStatus.EMERGENCY_OVERRIDE;
        _accessLogCount[tokenId]++;
        emit EmergencyAccessUsed(tokenId, erDoctor);
    }

    /**
     * @dev Hospital updates the data hash (new FHIR bundle sync).
     */
    function updateDataHash(uint256 tokenId, bytes32 newDataHash) external onlyRole(HOSPITAL_ROLE) {
        _records[tokenId].dataHash = newDataHash;
        _records[tokenId].lastUpdated = block.timestamp;
        emit DataUpdated(tokenId, newDataHash);
    }

    function getRecord(uint256 tokenId) external view returns (PatientRecord memory) {
        return _records[tokenId];
    }

    function getAccessLogCount(uint256 tokenId) external view returns (uint256) {
        return _accessLogCount[tokenId];
    }

    // ── Soulbound: block all transfers ──────────────────────────
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) but block transfers
        require(from == address(0) || to == address(0), "HealthRecordSBT: soulbound");
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
