// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IRegistry {
    function isListable(uint256 _ipId) external view returns (bool);
    function ownerOf(uint256 _ipId) external view returns (address);
}

/// @title P2PMarketplace — Peer-to-peer listings with escrow and dispute resolution
contract P2PMarketplace is AccessControl {
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    enum ListingType { SALE, RENT }
    enum ListingStatus { ACTIVE, SOLD, CANCELLED, DISPUTED, RESOLVED, RENTED }

    struct Listing {
        uint256 id;
        address seller;
        uint256 price;
        bytes32 itemHash;
        ListingType listingType;
        ListingStatus status;
        address buyer;
        uint256 escrowAmount;
        uint256 duration; // in seconds, for rent
        uint256 createdAt;
        uint256 ipId; // optional, if 0 it's a generic item
    }

    mapping(uint256 => Listing) public listings;
    mapping(address => uint256[]) internal _sellerListings;
    mapping(address => uint256[]) internal _buyerPurchases;

    uint256 public nextListingId = 1;
    uint256 public platformFeeBps = 250; // 2.5%
    address public ipRegistry;

    event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 price);
    event ItemPurchased(uint256 indexed listingId, address indexed buyer);
    event ItemDelivered(uint256 indexed listingId);
    event DisputeRaised(uint256 indexed listingId, address indexed by);
    event DisputeResolved(uint256 indexed listingId, address indexed winner);
    event ListingCancelled(uint256 indexed listingId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, msg.sender);
    }

    function createListing(
        uint256 _price, 
        bytes32 _itemHash, 
        ListingType _type, 
        uint256 _duration,
        uint256 _ipId
    ) external returns (uint256) {
        require(_price > 0, "Price required");
        
        if (_ipId > 0 && ipRegistry != address(0)) {
            require(IRegistry(ipRegistry).isListable(_ipId), "Not listable by creator");
            require(IRegistry(ipRegistry).ownerOf(_ipId) == msg.sender, "Not asset owner");
        }

        uint256 lid = nextListingId++;
        listings[lid] = Listing({
            id: lid,
            seller: msg.sender,
            price: _price,
            itemHash: _itemHash,
            listingType: _type,
            status: ListingStatus.ACTIVE,
            buyer: address(0),
            escrowAmount: 0,
            duration: _duration,
            createdAt: block.timestamp,
            ipId: _ipId
        });
        _sellerListings[msg.sender].push(lid);

        emit ListingCreated(lid, msg.sender, _price);
        return lid;
    }

    function purchase(uint256 _listingId) external payable {
        Listing storage l = listings[_listingId];
        require(l.status == ListingStatus.ACTIVE, "Not active");
        require(msg.value == l.price, "Must pay exact price");
        require(msg.sender != l.seller, "Cannot buy own listing");

        l.buyer = msg.sender;
        l.escrowAmount = msg.value;
        l.status = (l.listingType == ListingType.RENT) ? ListingStatus.RENTED : ListingStatus.SOLD;
        _buyerPurchases[msg.sender].push(_listingId);

        emit ItemPurchased(_listingId, msg.sender);
    }

    function confirmDelivery(uint256 _listingId) external {
        Listing storage l = listings[_listingId];
        require(l.status == ListingStatus.SOLD, "Not sold");
        require(msg.sender == l.buyer, "Not buyer");
        require(l.escrowAmount > 0, "No escrow");

        uint256 fee = (l.escrowAmount * platformFeeBps) / 10000;
        uint256 payout = l.escrowAmount - fee;
        l.escrowAmount = 0;

        (bool ok,) = l.seller.call{value: payout}("");
        require(ok, "Seller transfer failed");

        emit ItemDelivered(_listingId);
    }

    function raiseDispute(uint256 _listingId) external {
        Listing storage l = listings[_listingId];
        require(l.status == ListingStatus.SOLD, "Not sold");
        require(msg.sender == l.buyer || msg.sender == l.seller, "Not party");

        l.status = ListingStatus.DISPUTED;
        emit DisputeRaised(_listingId, msg.sender);
    }

    function resolveDispute(uint256 _listingId, address _winner) external onlyRole(ARBITER_ROLE) {
        Listing storage l = listings[_listingId];
        require(l.status == ListingStatus.DISPUTED, "Not disputed");
        require(_winner == l.buyer || _winner == l.seller, "Invalid winner");
        require(l.escrowAmount > 0, "No escrow");

        uint256 amount = l.escrowAmount;
        l.escrowAmount = 0;
        l.status = ListingStatus.RESOLVED;

        (bool ok,) = _winner.call{value: amount}("");
        require(ok, "Transfer failed");

        emit DisputeResolved(_listingId, _winner);
    }

    function cancelListing(uint256 _listingId) external {
        Listing storage l = listings[_listingId];
        require(msg.sender == l.seller, "Not seller");
        require(l.status == ListingStatus.ACTIVE, "Not active");
        l.status = ListingStatus.CANCELLED;
        emit ListingCancelled(_listingId);
    }

    function setPlatformFee(uint256 _feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeBps <= 1000, "Fee too high");
        platformFeeBps = _feeBps;
    }

    // ── View helpers ──
    function getSellerListings(address _seller) external view returns (uint256[] memory) {
        return _sellerListings[_seller];
    }

    function getBuyerPurchases(address _buyer) external view returns (uint256[] memory) {
        return _buyerPurchases[_buyer];
    }

    function isListingActive(uint256 _listingId) external view returns (bool) {
        return listings[_listingId].status == ListingStatus.ACTIVE;
    }

    function setRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ipRegistry = _registry;
    }
}
