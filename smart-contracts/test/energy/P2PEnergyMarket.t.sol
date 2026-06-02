// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/energy/P2PEnergyMarket.sol";

contract P2PEnergyMarketTest is Test {
    P2PEnergyMarket market;
    address admin = address(1);
    address seller = address(2);
    address buyer = address(3);

    function setUp() public {
        vm.startPrank(admin);
        market = new P2PEnergyMarket(admin);
        vm.stopPrank();

        vm.deal(buyer, 100 ether);
        vm.deal(seller, 1 ether);
    }

    function testRegisterProsumer() public {
        vm.startPrank(seller);
        market.registerProsumer("SM-0x7f3a", "ES-VLC-01", 8400);
        vm.stopPrank();

        (string memory meterId,, uint256 cap, bool active) = market.prosumers(seller);
        assertEq(cap, 8400);
        assertTrue(active);
        assertGt(bytes(meterId).length, 0);
    }

    function testRegisterDuplicateReverts() public {
        vm.startPrank(seller);
        market.registerProsumer("SM-001", "ES-01", 100);
        vm.expectRevert("Already registered");
        market.registerProsumer("SM-002", "ES-02", 200);
        vm.stopPrank();
    }

    function testCreateOffer() public {
        vm.startPrank(seller);
        market.registerProsumer("SM-001", "ES-01", 8400);
        market.createOffer(5000, 1e14, 3600); // 5000 Wh, 0.0001 ETH/Wh, 1 hour
        vm.stopPrank();

        (address s, uint256 wh, uint256 price,, bool filled, bool cancelled) = market.offers(0);
        assertEq(s, seller);
        assertEq(wh, 5000);
        assertEq(price, 1e14);
        assertFalse(filled);
        assertFalse(cancelled);
    }

    function testCreateOfferNotRegisteredReverts() public {
        vm.startPrank(buyer);
        vm.expectRevert("Not registered");
        market.createOffer(1000, 1e14, 3600);
        vm.stopPrank();
    }

    function testMatchAndSettle() public {
        vm.startPrank(seller);
        market.registerProsumer("SM-001", "ES-01", 8400);
        market.createOffer(5000, 1e14, 3600);
        vm.stopPrank();

        bytes32 proof = keccak256("meter_reading_12345");
        vm.startPrank(buyer);
        market.matchAndSettle{value: 5000 * 1e14}(0, 5000, proof);
        vm.stopPrank();

        (, , , , bool filled,) = market.offers(0);
        assertTrue(filled);
        assertEq(market.totalEnergyTraded(), 5000);
        assertEq(market.earnings(seller), 5000 * 1e14);
    }

    function testMatchInsufficientPaymentReverts() public {
        vm.startPrank(seller);
        market.registerProsumer("SM-001", "ES-01", 8400);
        market.createOffer(5000, 1e14, 3600);
        vm.stopPrank();

        vm.startPrank(buyer);
        vm.expectRevert("Insufficient payment");
        market.matchAndSettle{value: 1000}(0, 5000, bytes32(0));
        vm.stopPrank();
    }

    function testCancelOffer() public {
        vm.startPrank(seller);
        market.registerProsumer("SM-001", "ES-01", 8400);
        market.createOffer(5000, 1e14, 3600);
        market.cancelOffer(0);
        vm.stopPrank();

        (, , , , , bool cancelled) = market.offers(0);
        assertTrue(cancelled);
    }

    function testWithdrawEarnings() public {
        vm.startPrank(seller);
        market.registerProsumer("SM-001", "ES-01", 8400);
        market.createOffer(1000, 1e14, 3600);
        vm.stopPrank();

        vm.startPrank(buyer);
        market.matchAndSettle{value: 1000 * 1e14}(0, 1000, bytes32(0));
        vm.stopPrank();

        uint256 balBefore = seller.balance;
        vm.startPrank(seller);
        market.withdrawEarnings();
        vm.stopPrank();

        assertEq(seller.balance, balBefore + 1000 * 1e14);
        assertEq(market.earnings(seller), 0);
    }
}
