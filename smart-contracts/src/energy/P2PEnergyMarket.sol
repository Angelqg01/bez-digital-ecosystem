// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title P2PEnergyMarket — Peer-to-peer energy trading with smart meter verification
/// @notice Prosumers create offers, buyers match & settle, meter proofs recorded on-chain
contract P2PEnergyMarket is AccessControl {

    bytes32 public constant METER_ROLE = keccak256("METER_ROLE");

    struct Prosumer {
        string  meterId;
        string  gridZone;
        uint256 capacityKW;
        bool    isActive;
    }

    struct EnergyOffer {
        address seller;
        uint256 whOffered;       // Watt-hours offered
        uint256 pricePerWh;      // Price in BEZ wei per Wh
        uint256 expiry;
        bool    filled;
        bool    cancelled;
    }

    struct Settlement {
        uint256 offerId;
        address seller;
        address buyer;
        uint256 wh;
        uint256 totalPaid;
        uint256 timestamp;
        bytes32 meterProof;
    }

    uint256 public nextOfferId;
    uint256 public nextSettlementId;
    mapping(address => Prosumer) public prosumers;
    mapping(uint256 => EnergyOffer) public offers;
    mapping(uint256 => Settlement) public settlements;
    mapping(address => uint256) public earnings;
    uint256 public totalEnergyTraded; // Wh

    event ProsumerRegistered(address indexed wallet, string meterId, string gridZone);
    event OfferCreated(uint256 indexed offerId, address indexed seller, uint256 wh, uint256 pricePerWh);
    event OfferCancelled(uint256 indexed offerId);
    event Settled(uint256 indexed settlementId, uint256 indexed offerId, address seller, address buyer, uint256 wh);
    event EarningsWithdrawn(address indexed prosumer, uint256 amount);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(METER_ROLE, admin);
    }

    function registerProsumer(string calldata meterId, string calldata gridZone, uint256 capacityKW) external {
        require(bytes(meterId).length > 0, "Empty meter ID");
        require(!prosumers[msg.sender].isActive, "Already registered");
        prosumers[msg.sender] = Prosumer(meterId, gridZone, capacityKW, true);
        emit ProsumerRegistered(msg.sender, meterId, gridZone);
    }

    function createOffer(uint256 wh, uint256 pricePerWh, uint256 duration) external {
        require(prosumers[msg.sender].isActive, "Not registered");
        require(wh > 0, "Zero energy");
        uint256 offerId = nextOfferId++;
        offers[offerId] = EnergyOffer({
            seller: msg.sender,
            whOffered: wh,
            pricePerWh: pricePerWh,
            expiry: block.timestamp + duration,
            filled: false,
            cancelled: false
        });
        emit OfferCreated(offerId, msg.sender, wh, pricePerWh);
    }

    function cancelOffer(uint256 offerId) external {
        EnergyOffer storage o = offers[offerId];
        require(o.seller == msg.sender, "Not seller");
        require(!o.filled, "Already filled");
        o.cancelled = true;
        emit OfferCancelled(offerId);
    }

    function matchAndSettle(
        uint256 offerId,
        uint256 wh,
        bytes32 meterProof
    ) external payable {
        EnergyOffer storage o = offers[offerId];
        require(!o.filled && !o.cancelled, "Offer inactive");
        require(block.timestamp <= o.expiry, "Offer expired");
        require(wh <= o.whOffered, "Exceeds offer");
        uint256 totalCost = wh * o.pricePerWh;
        require(msg.value >= totalCost, "Insufficient payment");

        o.filled = true;
        earnings[o.seller] += totalCost;
        totalEnergyTraded += wh;

        uint256 sid = nextSettlementId++;
        settlements[sid] = Settlement({
            offerId: offerId,
            seller: o.seller,
            buyer: msg.sender,
            wh: wh,
            totalPaid: totalCost,
            timestamp: block.timestamp,
            meterProof: meterProof
        });

        // refund excess
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit Settled(sid, offerId, o.seller, msg.sender, wh);
    }

    function withdrawEarnings() external {
        uint256 amount = earnings[msg.sender];
        require(amount > 0, "No earnings");
        earnings[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit EarningsWithdrawn(msg.sender, amount);
    }
}
