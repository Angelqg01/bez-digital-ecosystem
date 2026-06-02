// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/otros/P2PMarketplace.sol";

contract P2PMarketplaceTest is Test {
    P2PMarketplace market;
    address admin = address(this);
    address seller = address(0xA1);
    address buyer = address(0xB1);
    address arbiter = address(0xC1);
    address outsider = address(0xD1);

    function setUp() public {
        market = new P2PMarketplace();
        market.grantRole(market.ARBITER_ROLE(), arbiter);
        vm.deal(buyer, 100 ether);
        vm.deal(seller, 10 ether);
    }

    // ── createListing ──────────────────
    function testCreateListing() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Vintage Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        (uint256 rid, address s, uint256 price, , , P2PMarketplace.ListingStatus st, , , , , ) = market.listings(lid);
        assertEq(s, seller);
        assertEq(price, 5 ether);
        assertEq(uint8(st), uint8(P2PMarketplace.ListingStatus.ACTIVE));
    }

    function testCreateListingRevertZeroPrice() public {
        vm.prank(seller);
        vm.expectRevert("Price required");
        market.createListing(0, keccak256("x"), P2PMarketplace.ListingType.SALE, 0, 0);
    }

    // ── purchase ──────────────────
    function testPurchase() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);

        vm.prank(buyer);
        market.purchase{value: 5 ether}(lid);

        (, , , , , P2PMarketplace.ListingStatus st, address b, uint256 escrow, , , ) = market.listings(lid);
        assertEq(uint8(st), uint8(P2PMarketplace.ListingStatus.SOLD));
        assertEq(b, buyer);
        assertEq(escrow, 5 ether);
    }

    function testPurchaseRevertWrongPrice() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);

        vm.prank(buyer);
        vm.expectRevert("Must pay exact price");
        market.purchase{value: 3 ether}(lid);
    }

    function testPurchaseRevertOwnListing() public {
        vm.prank(seller);
        uint256 lid = market.createListing(1 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.deal(seller, 10 ether);

        vm.prank(seller);
        vm.expectRevert("Cannot buy own listing");
        market.purchase{value: 1 ether}(lid);
    }

    // ── confirmDelivery ──────────────────
    function testConfirmDelivery() public {
        vm.prank(seller);
        uint256 lid = market.createListing(10 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(buyer);
        market.purchase{value: 10 ether}(lid);

        uint256 sellerBal = seller.balance;
        vm.prank(buyer);
        market.confirmDelivery(lid);

        // 2.5% fee = 0.25 ETH, seller gets 9.75 ETH
        assertEq(seller.balance, sellerBal + 9.75 ether);
        (, , , , , , , uint256 escrow, , , ) = market.listings(lid);
        assertEq(escrow, 0);
    }

    function testConfirmDeliveryRevertNotBuyer() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(buyer);
        market.purchase{value: 5 ether}(lid);

        vm.prank(outsider);
        vm.expectRevert("Not buyer");
        market.confirmDelivery(lid);
    }

    // ── raiseDispute ──────────────────
    function testRaiseDispute() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(buyer);
        market.purchase{value: 5 ether}(lid);

        vm.prank(buyer);
        market.raiseDispute(lid);
        (, , , , , P2PMarketplace.ListingStatus st, , , , , ) = market.listings(lid);
        assertEq(uint8(st), uint8(P2PMarketplace.ListingStatus.DISPUTED));
    }

    function testRaiseDisputeRevertNotParty() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(buyer);
        market.purchase{value: 5 ether}(lid);

        vm.prank(outsider);
        vm.expectRevert("Not party");
        market.raiseDispute(lid);
    }

    // ── resolveDispute ──────────────────
    function testResolveDisputeToSeller() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(buyer);
        market.purchase{value: 5 ether}(lid);
        vm.prank(buyer);
        market.raiseDispute(lid);

        uint256 sellerBal = seller.balance;
        vm.prank(arbiter);
        market.resolveDispute(lid, seller);
        assertEq(seller.balance, sellerBal + 5 ether);
    }

    function testResolveDisputeToBuyer() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(buyer);
        market.purchase{value: 5 ether}(lid);
        vm.prank(buyer);
        market.raiseDispute(lid);

        uint256 buyerBal = buyer.balance;
        vm.prank(arbiter);
        market.resolveDispute(lid, buyer);
        assertEq(buyer.balance, buyerBal + 5 ether);
    }

    function testResolveDisputeRevertNotDisputed() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);

        vm.prank(arbiter);
        vm.expectRevert("Not disputed");
        market.resolveDispute(lid, seller);
    }

    // ── cancelListing ──────────────────
    function testCancelListing() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(seller);
        market.cancelListing(lid);
        (, , , , , P2PMarketplace.ListingStatus st, , , , , ) = market.listings(lid);
        assertEq(uint8(st), uint8(P2PMarketplace.ListingStatus.CANCELLED));
    }

    function testCancelListingRevertNotSeller() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(buyer);
        vm.expectRevert("Not seller");
        market.cancelListing(lid);
    }

    // ── setPlatformFee ──────────────────
    function testSetPlatformFee() public {
        market.setPlatformFee(500); // 5%
        assertEq(market.platformFeeBps(), 500);
    }

    function testSetPlatformFeeRevertTooHigh() public {
        vm.expectRevert("Fee too high");
        market.setPlatformFee(1001);
    }

    // ── View helpers ──────────────────
    function testGetSellerListings() public {
        vm.startPrank(seller);
        market.createListing(1 ether, keccak256("A"), P2PMarketplace.ListingType.SALE, 0, 0);
        market.createListing(2 ether, keccak256("B"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.stopPrank();
        uint256[] memory ids = market.getSellerListings(seller);
        assertEq(ids.length, 2);
    }

    function testGetBuyerPurchases() public {
        vm.prank(seller);
        uint256 lid = market.createListing(1 ether, keccak256("A"), P2PMarketplace.ListingType.SALE, 0, 0);
        vm.prank(buyer);
        market.purchase{value: 1 ether}(lid);
        uint256[] memory ids = market.getBuyerPurchases(buyer);
        assertEq(ids.length, 1);
    }

    function testIsListingActive() public {
        vm.prank(seller);
        uint256 lid = market.createListing(5 ether, keccak256("Watch"), P2PMarketplace.ListingType.SALE, 0, 0);
        assertTrue(market.isListingActive(lid));

        vm.prank(seller);
        market.cancelListing(lid);
        assertFalse(market.isListingActive(lid));
    }
}
