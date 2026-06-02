// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title VehicleIdentityNFT — ERC-721 vehicle digital twin on BeZhas Chain
/// @notice Each NFT represents a unique vehicle identified by VIN
contract VehicleIdentityNFT is ERC721, AccessControl {

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant ORACLE_ROLE    = keccak256("ORACLE_ROLE");

    struct Vehicle {
        string  vin;
        string  make;
        string  model;
        uint256 mileage;
        uint256 mintTimestamp;
        bool    active;
        bool    stolen;
    }

    struct HistoryEntry {
        address fromOwner;
        address toOwner;
        uint256 mileageAtTransfer;
        uint256 timestamp;
    }

    uint256 public nextTokenId;
    mapping(uint256 => Vehicle) public vehicles;
    mapping(uint256 => HistoryEntry[]) private _history;
    mapping(string => uint256) public vinToTokenId;
    uint256 public totalVehicles;

    event VehicleMinted(uint256 indexed tokenId, string vin, address owner);
    event MileageUpdated(uint256 indexed tokenId, uint256 oldMileage, uint256 newMileage);
    event VehicleTransferred(uint256 indexed tokenId, address from, address to, uint256 mileage);
    event VehicleReportedStolen(uint256 indexed tokenId, string vin);

    constructor(address admin) ERC721("BeZhas Vehicle Identity", "BEZ-VH") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    function mintVehicle(
        address owner,
        string calldata vin,
        string calldata make,
        string calldata model
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        require(bytes(vin).length > 0, "VIN required");
        require(vinToTokenId[vin] == 0 || nextTokenId == 0, "VIN already registered");

        uint256 tokenId = nextTokenId++;
        vehicles[tokenId] = Vehicle({
            vin: vin,
            make: make,
            model: model,
            mileage: 0,
            mintTimestamp: block.timestamp,
            active: true,
            stolen: false
        });

        vinToTokenId[vin] = tokenId;
        totalVehicles++;
        _safeMint(owner, tokenId);

        emit VehicleMinted(tokenId, vin, owner);
        return tokenId;
    }

    function updateMileage(uint256 tokenId, uint256 newMileage) external onlyRole(ORACLE_ROLE) {
        require(vehicles[tokenId].active, "Vehicle not active");
        require(newMileage > vehicles[tokenId].mileage, "Mileage must increase");

        uint256 old = vehicles[tokenId].mileage;
        vehicles[tokenId].mileage = newMileage;

        emit MileageUpdated(tokenId, old, newMileage);
    }

    function transferVehicle(uint256 tokenId, address newOwner) external {
        require(ownerOf(tokenId) == msg.sender, "Not vehicle owner");
        require(!vehicles[tokenId].stolen, "Vehicle reported stolen");
        require(vehicles[tokenId].active, "Vehicle not active");

        _history[tokenId].push(HistoryEntry({
            fromOwner: msg.sender,
            toOwner: newOwner,
            mileageAtTransfer: vehicles[tokenId].mileage,
            timestamp: block.timestamp
        }));

        _transfer(msg.sender, newOwner, tokenId);

        emit VehicleTransferred(tokenId, msg.sender, newOwner, vehicles[tokenId].mileage);
    }

    function reportStolen(uint256 tokenId) external onlyRole(REGISTRAR_ROLE) {
        require(vehicles[tokenId].active, "Vehicle not active");
        vehicles[tokenId].stolen = true;

        emit VehicleReportedStolen(tokenId, vehicles[tokenId].vin);
    }

    function clearStolen(uint256 tokenId) external onlyRole(REGISTRAR_ROLE) {
        vehicles[tokenId].stolen = false;
    }

    function getHistory(uint256 tokenId) external view returns (HistoryEntry[] memory) {
        return _history[tokenId];
    }

    function getHistoryLength(uint256 tokenId) external view returns (uint256) {
        return _history[tokenId].length;
    }

    // Required overrides
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
