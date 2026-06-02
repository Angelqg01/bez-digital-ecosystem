// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title StreamingRightsMarket — Marketplace for streaming and licensing rights on BeZhas Chain
/// @notice Register IPs, create licenses, trade streaming rights, track royalty flows
contract StreamingRightsMarket is AccessControl {

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum MediaType { FILM, SERIES, MUSIC_ALBUM, PODCAST, LIVE_EVENT }
    enum LicenseStatus { ACTIVE, EXPIRED, REVOKED }

    struct IntellectualProperty {
        string    title;
        MediaType mediaType;
        address   rightHolder;
        uint256   registeredAt;
        string    metadataURI; // IPFS hash of DRM proof
        uint256   totalLicenses;
        uint256   totalRevenue;
        bool      active;
    }

    struct License {
        uint256       ipId;
        address       licensee;
        uint256       pricePaid;
        uint256       startDate;
        uint256       endDate;
        string        territory;   // e.g. "LATAM", "GLOBAL", "EU"
        uint256       streamCap;   // max streams allowed (0 = unlimited)
        uint256       streamsUsed;
        LicenseStatus status;
    }

    struct StreamReport {
        uint256 licenseId;
        uint256 streams;
        uint256 reportedAt;
    }

    uint256 public nextIpId;
    mapping(uint256 => IntellectualProperty) public ips;

    uint256 public nextLicenseId;
    mapping(uint256 => License) public licenses;
    mapping(uint256 => uint256[]) public ipLicenses;

    uint256 public nextReportId;
    mapping(uint256 => StreamReport) public reports;
    mapping(uint256 => uint256[]) public licenseReports;

    event IPRegistered(uint256 indexed ipId, string title, MediaType mediaType, address indexed rightHolder);
    event LicenseCreated(uint256 indexed ipId, uint256 licenseId, address indexed licensee, string territory);
    event StreamsReported(uint256 indexed licenseId, uint256 reportId, uint256 streams);
    event LicenseRevoked(uint256 indexed licenseId);
    event RevenueWithdrawn(uint256 indexed ipId, address indexed rightHolder, uint256 amount);
    event IPDeactivated(uint256 indexed ipId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    function registerIP(
        string calldata title,
        MediaType mediaType,
        string calldata metadataURI
    ) external returns (uint256) {
        uint256 id = nextIpId++;
        ips[id] = IntellectualProperty({
            title: title,
            mediaType: mediaType,
            rightHolder: msg.sender,
            registeredAt: block.timestamp,
            metadataURI: metadataURI,
            totalLicenses: 0,
            totalRevenue: 0,
            active: true
        });

        emit IPRegistered(id, title, mediaType, msg.sender);
        return id;
    }

    function createLicense(
        uint256 ipId,
        address licensee,
        uint256 startDate,
        uint256 endDate,
        string calldata territory,
        uint256 streamCap
    ) external payable returns (uint256) {
        IntellectualProperty storage ip = ips[ipId];
        require(ip.active, "IP not active");
        require(ip.rightHolder == msg.sender || hasRole(REGISTRAR_ROLE, msg.sender), "Not authorized");
        require(licensee != address(0), "Invalid licensee");
        require(endDate > startDate, "End must be after start");

        uint256 lid = nextLicenseId++;
        licenses[lid] = License({
            ipId: ipId,
            licensee: licensee,
            pricePaid: msg.value,
            startDate: startDate,
            endDate: endDate,
            territory: territory,
            streamCap: streamCap,
            streamsUsed: 0,
            status: LicenseStatus.ACTIVE
        });
        ipLicenses[ipId].push(lid);
        ip.totalLicenses++;
        ip.totalRevenue += msg.value;

        emit LicenseCreated(ipId, lid, licensee, territory);
        return lid;
    }

    function reportStreams(uint256 licenseId, uint256 streams) external onlyRole(REGISTRAR_ROLE) {
        License storage l = licenses[licenseId];
        require(l.status == LicenseStatus.ACTIVE, "License not active");
        require(streams > 0, "Streams must be > 0");

        if (l.streamCap > 0) {
            require(l.streamsUsed + streams <= l.streamCap, "Exceeds stream cap");
        }

        l.streamsUsed += streams;

        uint256 rid = nextReportId++;
        reports[rid] = StreamReport({
            licenseId: licenseId,
            streams: streams,
            reportedAt: block.timestamp
        });
        licenseReports[licenseId].push(rid);

        emit StreamsReported(licenseId, rid, streams);
    }

    function revokeLicense(uint256 licenseId) external {
        License storage l = licenses[licenseId];
        IntellectualProperty storage ip = ips[l.ipId];
        require(ip.rightHolder == msg.sender || hasRole(REGISTRAR_ROLE, msg.sender), "Not authorized");
        require(l.status == LicenseStatus.ACTIVE, "Not active");

        l.status = LicenseStatus.REVOKED;

        emit LicenseRevoked(licenseId);
    }

    function withdrawRevenue(uint256 ipId, uint256 amount) external {
        IntellectualProperty storage ip = ips[ipId];
        require(ip.rightHolder == msg.sender, "Not right holder");
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient balance");

        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Withdraw failed");

        emit RevenueWithdrawn(ipId, msg.sender, amount);
    }

    function deactivateIP(uint256 ipId) external {
        IntellectualProperty storage ip = ips[ipId];
        require(ip.rightHolder == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        require(ip.active, "Already inactive");
        ip.active = false;

        emit IPDeactivated(ipId);
    }

    function getIP(uint256 ipId) external view returns (IntellectualProperty memory) {
        return ips[ipId];
    }

    function getLicense(uint256 licenseId) external view returns (License memory) {
        return licenses[licenseId];
    }

    function getIPLicenseCount(uint256 ipId) external view returns (uint256) {
        return ipLicenses[ipId].length;
    }

    function getLicenseReportCount(uint256 licenseId) external view returns (uint256) {
        return licenseReports[licenseId].length;
    }

    receive() external payable {}
}
