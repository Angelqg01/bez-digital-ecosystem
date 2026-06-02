// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";
import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

/// @title IPRegistryNFT — Intellectual property registration and licensing
contract IPRegistryNFT is ERC721, AccessControl {

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum IPType { PATENT, TRADEMARK, COPYRIGHT, TRADE_SECRET, DESIGN, CONTRACT, OTHER }
    enum IPStatus { PENDING, REGISTERED, LICENSED, DISPUTED, REVOKED }
    enum Visibility { PRIVATE, SHARED, PUBLIC }

    struct Permissions {
        Visibility visibility;
        bool listable;
        bool saleEnabled;
        bool rentEnabled;
        uint256 price;
    }

    struct IPAsset {
        uint256 id;
        address owner;
        IPType ipType;
        string title;
        bytes32 proofHash;
        uint256 registeredAt;
        uint256 expiresAt;
        IPStatus status;
        uint256 licenseCount;
        uint256 totalRevenue;
        Permissions permissions;
    }

    struct License {
        uint256 ipId;
        address licensee;
        uint256 fee;
        uint256 grantedAt;
        uint256 expiresAt;
        bool exclusive;
        bool active;
    }

    uint256 public nextIPId;
    uint256 public nextLicenseId;
    uint256 public registrationFee = 0.01 ether;

    mapping(uint256 => IPAsset) public ipAssets;
    mapping(uint256 => License) public licenses;
    mapping(uint256 => uint256[]) public ipLicenses;
    mapping(bytes32 => bool) public proofExists;
    mapping(address => uint256) public ownerBalance;

    event IPRegistered(uint256 indexed ipId, address indexed owner, IPType ipType, string title);
    event IPStatusChanged(uint256 indexed ipId, IPStatus newStatus);
    event LicenseGranted(uint256 indexed ipId, uint256 indexed licenseId, address indexed licensee, bool exclusive);
    event LicenseRevoked(uint256 indexed ipId, uint256 indexed licenseId);
    event RevenueDeposited(uint256 indexed ipId, uint256 amount);
    event RevenueWithdrawn(address indexed owner, uint256 amount);

    constructor() ERC721("BeZhas IP Document", "BIPD") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    // ── Register IP asset ──────────────────
    function registerIP(
        IPType _ipType,
        string calldata _title,
        bytes32 _proofHash,
        uint256 _duration,
        Permissions calldata _perms
    ) external payable returns (uint256) {
        require(msg.value >= registrationFee, "Insufficient fee");
        require(_proofHash != bytes32(0), "Empty proof");
        require(!proofExists[_proofHash], "Proof already registered");
        require(_duration > 0, "Duration must be > 0");

        uint256 ipId = nextIPId++;
        ipAssets[ipId] = IPAsset({
            id: ipId,
            owner: msg.sender,
            ipType: _ipType,
            title: _title,
            proofHash: _proofHash,
            registeredAt: block.timestamp,
            expiresAt: block.timestamp + _duration,
            status: IPStatus.PENDING,
            licenseCount: 0,
            totalRevenue: 0,
            permissions: _perms
        });
        proofExists[_proofHash] = true;
        _safeMint(msg.sender, ipId);

        emit IPRegistered(ipId, msg.sender, _ipType, _title);
        return ipId;
    }

    // ── Approve registration (registrar confirms) ──────────────────
    function approveRegistration(uint256 _ipId) external onlyRole(REGISTRAR_ROLE) {
        IPAsset storage ip = ipAssets[_ipId];
        require(ip.status == IPStatus.PENDING, "Not pending");

        ip.status = IPStatus.REGISTERED;
        emit IPStatusChanged(_ipId, IPStatus.REGISTERED);
    }

    // ── Grant a license ──────────────────
    function grantLicense(
        uint256 _ipId,
        address _licensee,
        uint256 _duration,
        bool _exclusive
    ) external payable returns (uint256) {
        IPAsset storage ip = ipAssets[_ipId];
        require(ip.status == IPStatus.REGISTERED || ip.status == IPStatus.LICENSED, "Not licensable");
        require(msg.sender == ip.owner, "Not IP owner");
        require(_licensee != address(0), "Invalid licensee");

        uint256 lid = nextLicenseId++;
        licenses[lid] = License({
            ipId: _ipId,
            licensee: _licensee,
            fee: msg.value,
            grantedAt: block.timestamp,
            expiresAt: block.timestamp + _duration,
            exclusive: _exclusive,
            active: true
        });
        ipLicenses[_ipId].push(lid);
        ip.licenseCount++;
        ip.status = IPStatus.LICENSED;
        ip.totalRevenue += msg.value;
        ownerBalance[ip.owner] += msg.value;

        emit LicenseGranted(_ipId, lid, _licensee, _exclusive);
        return lid;
    }

    // ── Revoke a license ──────────────────
    function revokeLicense(uint256 _ipId, uint256 _licenseId) external {
        IPAsset storage ip = ipAssets[_ipId];
        require(msg.sender == ip.owner, "Not IP owner");

        License storage lic = licenses[_licenseId];
        require(lic.ipId == _ipId, "License mismatch");
        require(lic.active, "Already revoked");

        lic.active = false;
        emit LicenseRevoked(_ipId, _licenseId);
    }

    // ── Dispute an IP asset ──────────────────
    function disputeIP(uint256 _ipId) external {
        IPAsset storage ip = ipAssets[_ipId];
        require(
            ip.status == IPStatus.REGISTERED || ip.status == IPStatus.LICENSED,
            "Cannot dispute"
        );
        ip.status = IPStatus.DISPUTED;
        emit IPStatusChanged(_ipId, IPStatus.DISPUTED);
    }

    // ── Revoke IP by registrar ──────────────────
    function revokeIP(uint256 _ipId) external onlyRole(REGISTRAR_ROLE) {
        IPAsset storage ip = ipAssets[_ipId];
        require(ip.status != IPStatus.REVOKED, "Already revoked");
        ip.status = IPStatus.REVOKED;
        emit IPStatusChanged(_ipId, IPStatus.REVOKED);
    }

    // ── Withdraw revenue (pull pattern) ──────────────────
    function withdrawRevenue() external {
        uint256 bal = ownerBalance[msg.sender];
        require(bal > 0, "Nothing to withdraw");

        ownerBalance[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: bal}("");
        require(ok, "Transfer failed");

        emit RevenueWithdrawn(msg.sender, bal);
    }

    // ── View helpers ──────────────────
    function getIPLicenses(uint256 _ipId) external view returns (uint256[] memory) {
        return ipLicenses[_ipId];
    }

    function verifyProof(uint256 _ipId, bytes32 _hash) external view returns (bool) {
        return ipAssets[_ipId].proofHash == _hash;
    }

    function updatePermissions(uint256 _ipId, Permissions calldata _perms) external {
        require(msg.sender == ipAssets[_ipId].owner, "Not owner");
        ipAssets[_ipId].permissions = _perms;
    }

    function isListable(uint256 _ipId) external view returns (bool) {
        return ipAssets[_ipId].permissions.listable;
    }

    // Overrides required by Solidity
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
