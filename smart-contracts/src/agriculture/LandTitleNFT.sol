// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title LandTitleNFT — ERC-721 land title registry with soil data on BeZhas Chain
/// @notice Mint land parcels as NFTs, log soil data, transfer, fractionalize
contract LandTitleNFT is ERC721, AccessControl {

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant SURVEYOR_ROLE  = keccak256("SURVEYOR_ROLE");

    struct LandParcel {
        string  title;
        string  location;
        uint256 area;           // in m²
        string  soilType;
        bytes32 gpsBounds;
        uint256 registeredAt;
        bool    active;
        uint256 fractions;      // 0 = not fractionalized
    }

    struct SoilDataLog {
        uint256 parcelId;
        uint256 nitrogen;       // mg/kg
        uint256 phosphorus;     // mg/kg
        uint256 potassium;      // mg/kg
        uint256 organicMatter;  // scaled 1e2 (380 = 3.80%)
        uint256 moisture;       // percentage 0-100
        uint256 timestamp;
    }

    uint256 public nextParcelId;
    mapping(uint256 => LandParcel) public parcels;

    uint256 public totalSoilLogs;
    mapping(uint256 => SoilDataLog) public soilLogs;
    mapping(uint256 => uint256) public parcelSoilLogCount;

    event TitleMinted(uint256 indexed parcelId, string title, string location, uint256 area, address indexed owner);
    event SoilDataUpdated(uint256 indexed parcelId, uint256 logId, uint256 nitrogen, uint256 phosphorus, uint256 potassium);
    event TitleTransferred(uint256 indexed parcelId, address indexed from, address indexed to);
    event TitleFractionalized(uint256 indexed parcelId, uint256 fractions);

    constructor() ERC721("BeZhas Land Title", "BLT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(SURVEYOR_ROLE, msg.sender);
    }

    function mintTitle(
        string calldata title,
        string calldata location,
        uint256 area,
        string calldata soilType,
        bytes32 gpsBounds
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        require(area > 0, "Area must be > 0");
        require(bytes(title).length > 0, "Empty title");

        uint256 id = nextParcelId++;
        parcels[id] = LandParcel({
            title: title,
            location: location,
            area: area,
            soilType: soilType,
            gpsBounds: gpsBounds,
            registeredAt: block.timestamp,
            active: true,
            fractions: 0
        });

        _safeMint(msg.sender, id);
        emit TitleMinted(id, title, location, area, msg.sender);
        return id;
    }

    function updateSoilData(
        uint256 parcelId,
        uint256 nitrogen,
        uint256 phosphorus,
        uint256 potassium,
        uint256 organicMatter,
        uint256 moisture
    ) external onlyRole(SURVEYOR_ROLE) {
        require(parcelId < nextParcelId, "Parcel does not exist");
        require(moisture <= 100, "Moisture max 100%");

        uint256 logId = totalSoilLogs++;
        soilLogs[logId] = SoilDataLog({
            parcelId: parcelId,
            nitrogen: nitrogen,
            phosphorus: phosphorus,
            potassium: potassium,
            organicMatter: organicMatter,
            moisture: moisture,
            timestamp: block.timestamp
        });
        parcelSoilLogCount[parcelId]++;

        emit SoilDataUpdated(parcelId, logId, nitrogen, phosphorus, potassium);
    }

    function transferTitle(uint256 parcelId, address newOwner) external {
        require(parcelId < nextParcelId, "Parcel does not exist");
        require(newOwner != address(0), "Invalid new owner");
        address currentOwner = ownerOf(parcelId);
        require(msg.sender == currentOwner, "Not the owner");

        _transfer(currentOwner, newOwner, parcelId);
        emit TitleTransferred(parcelId, currentOwner, newOwner);
    }

    function fractionalizeTitle(uint256 parcelId, uint256 fractions) external {
        require(parcelId < nextParcelId, "Parcel does not exist");
        require(msg.sender == ownerOf(parcelId), "Not the owner");
        require(fractions >= 2, "Min 2 fractions");
        require(parcels[parcelId].fractions == 0, "Already fractionalized");

        parcels[parcelId].fractions = fractions;
        emit TitleFractionalized(parcelId, fractions);
    }

    function getParcel(uint256 id) external view returns (
        string memory title, string memory location, uint256 area,
        string memory soilType, bytes32 gpsBounds, uint256 registeredAt,
        bool active, uint256 fractions
    ) {
        LandParcel storage p = parcels[id];
        return (p.title, p.location, p.area, p.soilType, p.gpsBounds,
                p.registeredAt, p.active, p.fractions);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
