// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/entertainment/EventTicketNFT.sol";

contract EventTicketNFTTest is Test {
    EventTicketNFT public nft;
    address public admin     = address(this);
    address public organizer = address(0xA1);
    address public buyer1    = address(0xB1);
    address public buyer2    = address(0xB2);
    address public anyone    = address(0xC1);

    function setUp() public {
        nft = new EventTicketNFT();
        nft.grantRole(nft.ORGANIZER_ROLE(), organizer);
        vm.deal(buyer1, 50 ether);
        vm.deal(buyer2, 50 ether);
        vm.deal(address(nft), 100 ether);
    }

    // ── createEvent ──────────────────────────────────────────────────

    function testCreateEvent() public {
        vm.prank(organizer);
        uint256 id = nft.createEvent("Rock Fest 2026", "Arena CDMX", block.timestamp + 30 days, 5000, 1500);

        EventTicketNFT.Event memory e = nft.getEvent(id);
        assertEq(e.name, "Rock Fest 2026");
        assertEq(e.venue, "Arena CDMX");
        assertEq(e.organizer, organizer);
        assertEq(e.maxCapacity, 5000);
        assertEq(e.maxResaleMarkup, 1500);
        assertTrue(e.active);
        assertFalse(e.cancelled);
    }

    function testCreateEventRevertZeroCapacity() public {
        vm.prank(organizer);
        vm.expectRevert("Capacity must be > 0");
        nft.createEvent("Bad", "Venue", block.timestamp + 1 days, 0, 1000);
    }

    function testCreateEventRevertHighMarkup() public {
        vm.prank(organizer);
        vm.expectRevert("Max markup 50%");
        nft.createEvent("Bad", "Venue", block.timestamp + 1 days, 100, 5001);
    }

    function testCreateEventRevertNotOrganizer() public {
        vm.prank(anyone);
        vm.expectRevert();
        nft.createEvent("Bad", "Venue", block.timestamp + 1 days, 100, 1000);
    }

    // ── purchaseTicket ───────────────────────────────────────────────

    function testPurchaseTicket() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Concert", "Auditorio", block.timestamp + 30 days, 100, 1500);

        vm.prank(buyer1);
        uint256 tid = nft.purchaseTicket{value: 1 ether}(eid, EventTicketNFT.TicketTier.VIP);

        EventTicketNFT.Ticket memory t = nft.getTicket(tid);
        assertEq(t.eventId, eid);
        assertEq(t.owner, buyer1);
        assertEq(t.originalPrice, 1 ether);
        assertFalse(t.used);
        assertFalse(t.refunded);
        assertEq(uint(t.tier), uint(EventTicketNFT.TicketTier.VIP));
        assertEq(nft.getEventTicketCount(eid), 1);
    }

    function testPurchaseTicketRevertSoldOut() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Tiny Show", "Bar", block.timestamp + 30 days, 1, 1000);

        vm.prank(buyer1);
        nft.purchaseTicket{value: 0.5 ether}(eid, EventTicketNFT.TicketTier.GENERAL);

        vm.prank(buyer2);
        vm.expectRevert("Sold out");
        nft.purchaseTicket{value: 0.5 ether}(eid, EventTicketNFT.TicketTier.GENERAL);
    }

    function testPurchaseTicketRevertNoPayment() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Show", "Venue", block.timestamp + 30 days, 100, 1000);

        vm.prank(buyer1);
        vm.expectRevert("Payment required");
        nft.purchaseTicket(eid, EventTicketNFT.TicketTier.GENERAL);
    }

    // ── useTicket ────────────────────────────────────────────────────

    function testUseTicket() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Live Show", "Teatro", block.timestamp + 30 days, 100, 1000);

        vm.prank(buyer1);
        uint256 tid = nft.purchaseTicket{value: 1 ether}(eid, EventTicketNFT.TicketTier.GENERAL);

        vm.prank(buyer1);
        nft.useTicket(tid);

        EventTicketNFT.Ticket memory t = nft.getTicket(tid);
        assertTrue(t.used);
    }

    function testUseTicketRevertNotOwner() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Show", "Venue", block.timestamp + 30 days, 100, 1000);

        vm.prank(buyer1);
        uint256 tid = nft.purchaseTicket{value: 1 ether}(eid, EventTicketNFT.TicketTier.GENERAL);

        vm.prank(buyer2);
        vm.expectRevert("Not ticket owner");
        nft.useTicket(tid);
    }

    function testUseTicketRevertAlreadyUsed() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Show", "Venue", block.timestamp + 30 days, 100, 1000);

        vm.prank(buyer1);
        uint256 tid = nft.purchaseTicket{value: 1 ether}(eid, EventTicketNFT.TicketTier.GENERAL);

        vm.startPrank(buyer1);
        nft.useTicket(tid);
        vm.expectRevert("Already used");
        nft.useTicket(tid);
        vm.stopPrank();
    }

    // ── resale ───────────────────────────────────────────────────────

    function testListAndBuyResale() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Festival", "Playa", block.timestamp + 30 days, 100, 2000); // 20% max markup

        vm.prank(buyer1);
        uint256 tid = nft.purchaseTicket{value: 1 ether}(eid, EventTicketNFT.TicketTier.PREMIUM);

        // List for resale at 1.15 ether (within 20% markup)
        vm.prank(buyer1);
        nft.listForResale(tid, 1.15 ether);

        EventTicketNFT.Ticket memory t = nft.getTicket(tid);
        assertTrue(t.forSale);
        assertEq(t.resalePrice, 1.15 ether);

        // Buy resale
        uint256 balBefore = buyer1.balance;
        vm.prank(buyer2);
        nft.buyResale{value: 1.15 ether}(tid);

        t = nft.getTicket(tid);
        assertEq(t.owner, buyer2);
        assertFalse(t.forSale);
        assertGt(buyer1.balance, balBefore);
    }

    function testListResaleRevertExceedsMarkup() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Show", "Venue", block.timestamp + 30 days, 100, 1000); // 10% max

        vm.prank(buyer1);
        uint256 tid = nft.purchaseTicket{value: 1 ether}(eid, EventTicketNFT.TicketTier.GENERAL);

        vm.prank(buyer1);
        vm.expectRevert("Exceeds max resale price");
        nft.listForResale(tid, 1.2 ether); // 20% > 10% allowed
    }

    // ── cancel & refund ──────────────────────────────────────────────

    function testCancelEventAndRefund() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Cancelled Show", "Arena", block.timestamp + 30 days, 100, 1000);

        vm.prank(buyer1);
        uint256 tid = nft.purchaseTicket{value: 2 ether}(eid, EventTicketNFT.TicketTier.BACKSTAGE);

        vm.prank(organizer);
        nft.cancelEvent(eid);

        EventTicketNFT.Event memory e = nft.getEvent(eid);
        assertTrue(e.cancelled);
        assertFalse(e.active);

        uint256 balBefore = buyer1.balance;
        vm.prank(buyer1);
        nft.refundTicket(tid);

        assertGt(buyer1.balance, balBefore);
        EventTicketNFT.Ticket memory t = nft.getTicket(tid);
        assertTrue(t.refunded);
    }

    function testRefundRevertEventNotCancelled() public {
        vm.prank(organizer);
        uint256 eid = nft.createEvent("Active Show", "Arena", block.timestamp + 30 days, 100, 1000);

        vm.prank(buyer1);
        uint256 tid = nft.purchaseTicket{value: 1 ether}(eid, EventTicketNFT.TicketTier.GENERAL);

        vm.prank(buyer1);
        vm.expectRevert("Event not cancelled");
        nft.refundTicket(tid);
    }
}
