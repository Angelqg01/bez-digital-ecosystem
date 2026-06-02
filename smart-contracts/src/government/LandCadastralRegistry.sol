// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title LandCadastralRegistry — Government land registry with parcels, ownership and zoning
contract LandCadastralRegistry is AccessControl {

    bytes32 public constant SURVEYOR_ROLE = keccak256("SURVEYOR_ROLE");

    enum ZoneType { RESIDENTIAL, COMMERCIAL, INDUSTRIAL, AGRICULTURAL, PROTECTED, MIXED }
    enum ParcelStatus { REGISTERED, DISPUTED, FROZEN, DEREGISTERED }

    struct Parcel {
        uint256 id;
        bytes32 locationHash;
        uint256 area;
        ZoneType zone;
        address owner;
        uint256 appraisedValue;
        ParcelStatus status;
        uint256 registeredAt;
    }

    struct Transfer {
        uint256 id;
        uint256 parcelId;
        address from;
        address to;
        uint256 price;
        uint256 timestamp;
    }

    uint256 public nextParcelId;
    uint256 public nextTransferId;

    mapping(uint256 => Parcel) public parcels;
    mapping(uint256 => Transfer) public transfers;
    mapping(uint256 => uint256[]) public parcelTransfers;
    mapping(address => uint256[]) public ownerParcels;

    event ParcelRegistered(uint256 indexed parcelId, address indexed owner, ZoneType zone);
    event ParcelTransferred(uint256 indexed transferId, uint256 indexed parcelId, address from, address to);
    event ParcelAppraised(uint256 indexed parcelId, uint256 newValue);
    event ParcelRezoned(uint256 indexed parcelId, ZoneType newZone);
    event ParcelDisputed(uint256 indexed parcelId);
    event ParcelFrozen(uint256 indexed parcelId);
    event ParcelUnfrozen(uint256 indexed parcelId);
    event ParcelDeregistered(uint256 indexed parcelId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SURVEYOR_ROLE, msg.sender);
    }

    // ── Register a parcel ──────────────────
    function registerParcel(
        bytes32 _locationHash,
        uint256 _area,
        ZoneType _zone,
        address _owner,
        uint256 _appraisedValue
    ) external onlyRole(SURVEYOR_ROLE) returns (uint256) {
        require(_owner != address(0), "Invalid owner");
        require(_area > 0, "Area must be > 0");

        uint256 pid = nextParcelId++;
        parcels[pid] = Parcel({
            id: pid,
            locationHash: _locationHash,
            area: _area,
            zone: _zone,
            owner: _owner,
            appraisedValue: _appraisedValue,
            status: ParcelStatus.REGISTERED,
            registeredAt: block.timestamp
        });
        ownerParcels[_owner].push(pid);

        emit ParcelRegistered(pid, _owner, _zone);
        return pid;
    }

    // ── Transfer ownership ──────────────────
    function transferParcel(uint256 _parcelId, address _to, uint256 _price) external {
        Parcel storage p = parcels[_parcelId];
        require(msg.sender == p.owner, "Not owner");
        require(p.status == ParcelStatus.REGISTERED, "Not transferable");
        require(_to != address(0), "Invalid recipient");

        uint256 tid = nextTransferId++;
        transfers[tid] = Transfer({
            id: tid,
            parcelId: _parcelId,
            from: msg.sender,
            to: _to,
            price: _price,
            timestamp: block.timestamp
        });
        parcelTransfers[_parcelId].push(tid);
        ownerParcels[_to].push(_parcelId);

        p.owner = _to;

        emit ParcelTransferred(tid, _parcelId, msg.sender, _to);
    }

    // ── Appraise parcel ──────────────────
    function appraiseParcel(uint256 _parcelId, uint256 _newValue) external onlyRole(SURVEYOR_ROLE) {
        require(parcels[_parcelId].status == ParcelStatus.REGISTERED, "Not registered");
        parcels[_parcelId].appraisedValue = _newValue;
        emit ParcelAppraised(_parcelId, _newValue);
    }

    // ── Rezone parcel ──────────────────
    function rezoneParcel(uint256 _parcelId, ZoneType _newZone) external onlyRole(SURVEYOR_ROLE) {
        require(parcels[_parcelId].status == ParcelStatus.REGISTERED, "Not registered");
        parcels[_parcelId].zone = _newZone;
        emit ParcelRezoned(_parcelId, _newZone);
    }

    // ── Dispute a parcel ──────────────────
    function disputeParcel(uint256 _parcelId) external onlyRole(SURVEYOR_ROLE) {
        Parcel storage p = parcels[_parcelId];
        require(p.status == ParcelStatus.REGISTERED, "Not registered");
        p.status = ParcelStatus.DISPUTED;
        emit ParcelDisputed(_parcelId);
    }

    // ── Freeze / Unfreeze ──────────────────
    function freezeParcel(uint256 _parcelId) external onlyRole(SURVEYOR_ROLE) {
        Parcel storage p = parcels[_parcelId];
        require(p.status == ParcelStatus.REGISTERED || p.status == ParcelStatus.DISPUTED, "Cannot freeze");
        p.status = ParcelStatus.FROZEN;
        emit ParcelFrozen(_parcelId);
    }

    function unfreezeParcel(uint256 _parcelId) external onlyRole(SURVEYOR_ROLE) {
        require(parcels[_parcelId].status == ParcelStatus.FROZEN, "Not frozen");
        parcels[_parcelId].status = ParcelStatus.REGISTERED;
        emit ParcelUnfrozen(_parcelId);
    }

    // ── Deregister ──────────────────
    function deregisterParcel(uint256 _parcelId) external onlyRole(SURVEYOR_ROLE) {
        Parcel storage p = parcels[_parcelId];
        require(p.status != ParcelStatus.DEREGISTERED, "Already deregistered");
        p.status = ParcelStatus.DEREGISTERED;
        emit ParcelDeregistered(_parcelId);
    }

    // ── View helpers ──────────────────
    function getParcelTransfers(uint256 _parcelId) external view returns (uint256[] memory) {
        return parcelTransfers[_parcelId];
    }

    function getOwnerParcels(address _owner) external view returns (uint256[] memory) {
        return ownerParcels[_owner];
    }
}
