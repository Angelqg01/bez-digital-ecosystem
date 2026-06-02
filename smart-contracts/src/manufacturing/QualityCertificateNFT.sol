// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title QualityCertificateNFT — ERC-721 quality certificates for manufacturing on BeZhas Chain
/// @notice Mint certificates per batch, log defects, revoke/recertify
contract QualityCertificateNFT is ERC721, AccessControl {

    bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");

    struct Certificate {
        string  productName;
        string  batchId;
        string  standard;       // e.g. "ISO 9001:2025"
        address inspector;
        uint256 score;           // 0-100
        uint256 issuedAt;
        bool    valid;
        string  revokeReason;
    }

    struct DefectReport {
        uint256 certId;
        string  description;
        uint8   severity;        // 1=minor … 5=critical
        uint256 timestamp;
    }

    uint256 public nextCertId;
    mapping(uint256 => Certificate) public certificates;

    uint256 public totalDefects;
    mapping(uint256 => DefectReport) public defects;
    mapping(uint256 => uint256) public certDefectCount;

    event CertificateMinted(uint256 indexed certId, string batchId, string standard, uint256 score);
    event DefectLogged(uint256 indexed certId, uint256 defectId, uint8 severity);
    event CertificateRevoked(uint256 indexed certId, string reason);
    event Recertified(uint256 indexed certId, uint256 newScore);

    constructor() ERC721("BeZhas Quality Certificate", "BQC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(INSPECTOR_ROLE, msg.sender);
    }

    function mintCertificate(
        string calldata productName,
        string calldata batchId,
        string calldata standard,
        uint256 score
    ) external onlyRole(INSPECTOR_ROLE) returns (uint256) {
        require(score <= 100, "Score must be 0-100");
        require(bytes(batchId).length > 0, "Empty batchId");

        uint256 certId = nextCertId++;
        certificates[certId] = Certificate({
            productName: productName,
            batchId: batchId,
            standard: standard,
            inspector: msg.sender,
            score: score,
            issuedAt: block.timestamp,
            valid: true,
            revokeReason: ""
        });

        _safeMint(msg.sender, certId);
        emit CertificateMinted(certId, batchId, standard, score);
        return certId;
    }

    function logDefect(
        uint256 certId,
        string calldata description,
        uint8 severity
    ) external onlyRole(INSPECTOR_ROLE) {
        require(certId < nextCertId, "Certificate does not exist");
        require(severity >= 1 && severity <= 5, "Severity must be 1-5");

        uint256 defectId = totalDefects++;
        defects[defectId] = DefectReport({
            certId: certId,
            description: description,
            severity: severity,
            timestamp: block.timestamp
        });

        certDefectCount[certId]++;
        emit DefectLogged(certId, defectId, severity);
    }

    function revokeCertificate(
        uint256 certId,
        string calldata reason
    ) external onlyRole(INSPECTOR_ROLE) {
        require(certId < nextCertId, "Certificate does not exist");
        require(certificates[certId].valid, "Already revoked");

        certificates[certId].valid = false;
        certificates[certId].revokeReason = reason;
        emit CertificateRevoked(certId, reason);
    }

    function recertify(
        uint256 certId,
        uint256 newScore
    ) external onlyRole(INSPECTOR_ROLE) {
        require(certId < nextCertId, "Certificate does not exist");
        require(newScore <= 100, "Score must be 0-100");

        certificates[certId].score = newScore;
        certificates[certId].valid = true;
        certificates[certId].revokeReason = "";
        emit Recertified(certId, newScore);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
