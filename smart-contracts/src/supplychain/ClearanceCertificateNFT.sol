// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ClearanceCertificateNFT - NFT proof of customs clearance
/// @dev ERC-721 representing verified customs clearance for shipments
contract ClearanceCertificateNFT is ERC721, AccessControl {

    uint256 private _tokenIdCounter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ── Clearance Certificate Metadata ─────────────────────────
    struct CertificateMetadata {
        uint256 tokenId;
        uint256 shipmentId;
        bytes32 hsCode;
        string commodity;
        uint256 cargoValue;
        uint256 declaredDuty;
        string originCountry;
        string destinationCountry;
        string customsPlatform;
        address issuedBy;
        uint256 issuedAt;
        uint256 expiresAt;
        bool isActive;
        string certificateURI;
    }

    mapping(uint256 => CertificateMetadata) public certificates;
    mapping(uint256 => uint256) public shipmentToCertificate;
    mapping(address => uint256[]) public userCertificates;

    uint256 public totalCertificatesIssued;

    event CertificateIssued(
        uint256 indexed tokenId,
        uint256 indexed shipmentId,
        bytes32 hsCode,
        address indexed operator,
        uint256 cargoValue,
        uint256 declaredDuty
    );

    event CertificateRevoked(uint256 indexed tokenId, string reason);
    event CertificateTransferred(uint256 indexed tokenId, address from, address to);

    modifier onlyMinter() {
        require(hasRole(MINTER_ROLE, msg.sender), "Not minter");
        _;
    }

    constructor() ERC721("BeZhas Clearance Certificate", "BZC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // ── Issue clearance certificate ────────────────────────────
    function issueClearanceCertificate(
        uint256 _shipmentId,
        bytes32 _hsCode,
        string calldata _commodity,
        uint256 _cargoValue,
        uint256 _declaredDuty,
        string calldata _originCountry,
        string calldata _destinationCountry,
        string calldata _customsPlatform,
        address _owner,
        uint256 _validityDays,
        string calldata _metadataURI
    ) external onlyMinter returns (uint256 tokenId) {

        require(_owner != address(0), "Invalid owner");
        require(_validityDays > 0, "Invalid validity");

        tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        // Mint NFT
        _safeMint(_owner, tokenId);

        uint256 expiresAt = block.timestamp + (_validityDays * 1 days);

        certificates[tokenId] = CertificateMetadata({
            tokenId: tokenId,
            shipmentId: _shipmentId,
            hsCode: _hsCode,
            commodity: _commodity,
            cargoValue: _cargoValue,
            declaredDuty: _declaredDuty,
            originCountry: _originCountry,
            destinationCountry: _destinationCountry,
            customsPlatform: _customsPlatform,
            issuedBy: msg.sender,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true,
            certificateURI: _metadataURI
        });

        shipmentToCertificate[_shipmentId] = tokenId;
        userCertificates[_owner].push(tokenId);
        totalCertificatesIssued++;

        emit CertificateIssued(
            tokenId,
            _shipmentId,
            _hsCode,
            msg.sender,
            _cargoValue,
            _declaredDuty
        );

        return tokenId;
    }

    // ── Revoke certificate ────────────────────────────────────
    function revokeCertificate(uint256 _tokenId, string calldata _reason) 
        external 
        onlyRole(MINTER_ROLE) 
    {
        require(_exists(_tokenId), "Certificate not found");
        
        CertificateMetadata storage cert = certificates[_tokenId];
        cert.isActive = false;

        emit CertificateRevoked(_tokenId, _reason);
    }

    // ── Get certificate details ────────────────────────────────
    function getCertificateDetails(uint256 _tokenId) 
        external 
        view 
        returns (CertificateMetadata memory) 
    {
        require(_exists(_tokenId), "Certificate not found");
        return certificates[_tokenId];
    }

    // ── Check if certificate is valid ──────────────────────────
    function isCertificateValid(uint256 _tokenId) 
        external 
        view 
        returns (bool) 
    {
        require(_exists(_tokenId), "Certificate not found");
        CertificateMetadata storage cert = certificates[_tokenId];
        return cert.isActive && block.timestamp < cert.expiresAt;
    }

    // ── Get certificate for shipment ───────────────────────────
    function getCertificateByShipment(uint256 _shipmentId) 
        external 
        view 
        returns (uint256 tokenId, CertificateMetadata memory metadata) 
    {
        tokenId = shipmentToCertificate[_shipmentId];
        require(_exists(tokenId), "No certificate for shipment");
        return (tokenId, certificates[tokenId]);
    }

    // ── Get user certificates ──────────────────────────────────
    function getUserCertificates(address _user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userCertificates[_user];
    }

    // ── Get certificate metadata URI ───────────────────────────
    function tokenURI(uint256 _tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        require(_exists(_tokenId), "Certificate not found");
        return certificates[_tokenId].certificateURI;
    }

    // ── Check expiration ───────────────────────────────────────
    function getDaysUntilExpiration(uint256 _tokenId) 
        external 
        view 
        returns (int256 daysRemaining) 
    {
        require(_exists(_tokenId), "Certificate not found");
        CertificateMetadata storage cert = certificates[_tokenId];
        
        if (block.timestamp >= cert.expiresAt) {
            return -1; // Expired
        }
        
        return int256((cert.expiresAt - block.timestamp) / 1 days);
    }

    // ── Check if specific shipment is cleared ──────────────────
    function isShipmentCleared(uint256 _shipmentId) 
        external 
        view 
        returns (bool) 
    {
        uint256 tokenId = shipmentToCertificate[_shipmentId];
        if (!_exists(tokenId)) return false;
        
        CertificateMetadata storage cert = certificates[tokenId];
        if (cert.shipmentId != _shipmentId) return false;
        return cert.isActive && block.timestamp < cert.expiresAt;
    }

    // ── Transfer override with event ───────────────────────────
    function transferFrom(address from, address to, uint256 tokenId) 
        public 
        override 
    {
        super.transferFrom(from, to, tokenId);
        
        // Update user certificates list
        userCertificates[to].push(tokenId);
        
        emit CertificateTransferred(tokenId, from, to);
    }

    // ── Support interface ──────────────────────────────────────
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ── Check if token exists ──────────────────────────────────
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
