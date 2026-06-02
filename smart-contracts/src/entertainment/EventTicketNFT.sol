// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title EventTicketNFT — Tokenized event tickets on BeZhas Chain
/// @notice Create events, sell tickets, handle refunds and verified resale with anti-scalping
contract EventTicketNFT is AccessControl {

    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");

    enum TicketTier { GENERAL, VIP, PREMIUM, BACKSTAGE }

    struct Event {
        string   name;
        string   venue;
        address  organizer;
        uint256  date;
        uint256  maxCapacity;
        uint256  sold;
        uint256  maxResaleMarkup; // basis points (e.g. 1500 = 15%)
        bool     active;
        bool     cancelled;
    }

    struct Ticket {
        uint256    eventId;
        address    owner;
        TicketTier tier;
        uint256    originalPrice;
        bool       used;
        bool       refunded;
        bool       forSale;
        uint256    resalePrice;
    }

    uint256 public nextEventId;
    mapping(uint256 => Event) public events;

    uint256 public nextTicketId;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => uint256[]) public eventTickets;

    event EventCreated(uint256 indexed eventId, string name, string venue, address indexed organizer);
    event TicketPurchased(uint256 indexed eventId, uint256 ticketId, address indexed buyer, TicketTier tier);
    event TicketUsed(uint256 indexed ticketId, address indexed holder);
    event TicketRefunded(uint256 indexed ticketId, address indexed holder, uint256 amount);
    event TicketListedForResale(uint256 indexed ticketId, uint256 price);
    event TicketResold(uint256 indexed ticketId, address indexed from, address indexed to, uint256 price);
    event EventCancelled(uint256 indexed eventId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORGANIZER_ROLE, msg.sender);
    }

    function createEvent(
        string calldata name,
        string calldata venue,
        uint256 date,
        uint256 maxCapacity,
        uint256 maxResaleMarkup
    ) external onlyRole(ORGANIZER_ROLE) returns (uint256) {
        require(maxCapacity > 0, "Capacity must be > 0");
        require(maxResaleMarkup <= 5000, "Max markup 50%");

        uint256 id = nextEventId++;
        events[id] = Event({
            name: name,
            venue: venue,
            organizer: msg.sender,
            date: date,
            maxCapacity: maxCapacity,
            sold: 0,
            maxResaleMarkup: maxResaleMarkup,
            active: true,
            cancelled: false
        });

        emit EventCreated(id, name, venue, msg.sender);
        return id;
    }

    function purchaseTicket(uint256 eventId, TicketTier tier) external payable returns (uint256) {
        Event storage e = events[eventId];
        require(e.active, "Event not active");
        require(!e.cancelled, "Event cancelled");
        require(e.sold < e.maxCapacity, "Sold out");
        require(msg.value > 0, "Payment required");

        uint256 tid = nextTicketId++;
        tickets[tid] = Ticket({
            eventId: eventId,
            owner: msg.sender,
            tier: tier,
            originalPrice: msg.value,
            used: false,
            refunded: false,
            forSale: false,
            resalePrice: 0
        });
        eventTickets[eventId].push(tid);
        e.sold++;

        emit TicketPurchased(eventId, tid, msg.sender, tier);
        return tid;
    }

    function useTicket(uint256 ticketId) external {
        Ticket storage t = tickets[ticketId];
        require(t.owner == msg.sender, "Not ticket owner");
        require(!t.used, "Already used");
        require(!t.refunded, "Ticket refunded");
        t.used = true;

        emit TicketUsed(ticketId, msg.sender);
    }

    function listForResale(uint256 ticketId, uint256 price) external {
        Ticket storage t = tickets[ticketId];
        require(t.owner == msg.sender, "Not ticket owner");
        require(!t.used, "Already used");
        require(!t.refunded, "Ticket refunded");

        Event storage e = events[t.eventId];
        uint256 maxPrice = t.originalPrice + (t.originalPrice * e.maxResaleMarkup / 10000);
        require(price <= maxPrice, "Exceeds max resale price");

        t.forSale = true;
        t.resalePrice = price;

        emit TicketListedForResale(ticketId, price);
    }

    function buyResale(uint256 ticketId) external payable {
        Ticket storage t = tickets[ticketId];
        require(t.forSale, "Not for sale");
        require(msg.value >= t.resalePrice, "Insufficient payment");

        address previousOwner = t.owner;
        t.owner = msg.sender;
        t.forSale = false;
        t.resalePrice = 0;

        (bool sent,) = previousOwner.call{value: msg.value}("");
        require(sent, "Transfer failed");

        emit TicketResold(ticketId, previousOwner, msg.sender, msg.value);
    }

    function cancelEvent(uint256 eventId) external onlyRole(ORGANIZER_ROLE) {
        Event storage e = events[eventId];
        require(e.active, "Already inactive");
        e.active = false;
        e.cancelled = true;

        emit EventCancelled(eventId);
    }

    function refundTicket(uint256 ticketId) external {
        Ticket storage t = tickets[ticketId];
        require(t.owner == msg.sender, "Not ticket owner");
        require(!t.used, "Already used");
        require(!t.refunded, "Already refunded");

        Event storage e = events[t.eventId];
        require(e.cancelled, "Event not cancelled");

        t.refunded = true;
        uint256 amount = t.originalPrice;

        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Refund failed");

        emit TicketRefunded(ticketId, msg.sender, amount);
    }

    function getEvent(uint256 eventId) external view returns (Event memory) {
        return events[eventId];
    }

    function getTicket(uint256 ticketId) external view returns (Ticket memory) {
        return tickets[ticketId];
    }

    function getEventTicketCount(uint256 eventId) external view returns (uint256) {
        return eventTickets[eventId].length;
    }

    receive() external payable {}
}
