// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/entertainment/RoyaltyDistributor.sol";

contract RoyaltyDistributorTest is Test {
    RoyaltyDistributor public rd;
    address public admin      = address(this);
    address public creator    = address(0xA1);
    address public artist1    = address(0xB1);
    address public artist2    = address(0xB2);
    address public producer   = address(0xB3);
    address public depositor  = address(0xC1);

    function setUp() public {
        rd = new RoyaltyDistributor();
        rd.grantRole(rd.DISTRIBUTOR_ROLE(), admin);
        vm.deal(depositor, 100 ether);
        vm.deal(creator, 10 ether);
    }

    // ── registerContent ──────────────────────────────────────────────

    function testRegisterContent() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Neon Dreams Album", RoyaltyDistributor.ContentType.MUSIC);

        RoyaltyDistributor.Content memory c = rd.getContent(id);
        assertEq(c.title, "Neon Dreams Album");
        assertEq(c.creator, creator);
        assertEq(uint(c.contentType), uint(RoyaltyDistributor.ContentType.MUSIC));
        assertTrue(c.active);
        assertEq(c.totalRevenue, 0);
    }

    // ── configureSplits ─────────────────────────────────────────────

    function testConfigureSplits() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Track 1", RoyaltyDistributor.ContentType.MUSIC);

        address[] memory bens = new address[](3);
        bens[0] = artist1;
        bens[1] = artist2;
        bens[2] = producer;
        uint256[] memory shares = new uint256[](3);
        shares[0] = 5000; // 50%
        shares[1] = 3000; // 30%
        shares[2] = 2000; // 20%

        vm.prank(creator);
        rd.configureSplits(id, bens, shares);

        assertEq(rd.getSplitCount(id), 3);
        RoyaltyDistributor.Split memory s0 = rd.getSplit(id, 0);
        assertEq(s0.beneficiary, artist1);
        assertEq(s0.shareBps, 5000);
    }

    function testConfigureSplitsRevertNotCreator() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Track", RoyaltyDistributor.ContentType.MUSIC);

        address[] memory bens = new address[](1);
        bens[0] = artist1;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;

        vm.prank(artist1);
        vm.expectRevert("Not creator");
        rd.configureSplits(id, bens, shares);
    }

    function testConfigureSplitsRevertNot100Percent() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Track", RoyaltyDistributor.ContentType.MUSIC);

        address[] memory bens = new address[](2);
        bens[0] = artist1;
        bens[1] = artist2;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 5000;
        shares[1] = 4000; // total 90%, not 100%

        vm.prank(creator);
        vm.expectRevert("Splits must total 100%");
        rd.configureSplits(id, bens, shares);
    }

    // ── depositRevenue ──────────────────────────────────────────────

    function testDepositRevenue() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Video Clip", RoyaltyDistributor.ContentType.VIDEO);

        vm.prank(depositor);
        rd.depositRevenue{value: 10 ether}(id);

        RoyaltyDistributor.Content memory c = rd.getContent(id);
        assertEq(c.totalRevenue, 10 ether);
    }

    function testDepositRevenueRevertInactive() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Old Content", RoyaltyDistributor.ContentType.ART);

        vm.prank(creator);
        rd.deactivateContent(id);

        vm.prank(depositor);
        vm.expectRevert("Content not active");
        rd.depositRevenue{value: 1 ether}(id);
    }

    // ── distributeRoyalties & withdraw ──────────────────────────────

    function testDistributeAndWithdraw() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Hit Song", RoyaltyDistributor.ContentType.MUSIC);

        address[] memory bens = new address[](2);
        bens[0] = artist1;
        bens[1] = artist2;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 7000; // 70%
        shares[1] = 3000; // 30%

        vm.prank(creator);
        rd.configureSplits(id, bens, shares);

        vm.prank(depositor);
        rd.depositRevenue{value: 10 ether}(id);

        // Distribute 10 ether
        rd.distributeRoyalties(id, 10 ether);

        assertEq(rd.pendingWithdrawals(artist1), 7 ether);
        assertEq(rd.pendingWithdrawals(artist2), 3 ether);
        assertEq(rd.getDistributionCount(id), 1);

        // Artist1 withdraws
        uint256 balBefore = artist1.balance;
        vm.prank(artist1);
        rd.withdraw();

        assertEq(artist1.balance, balBefore + 7 ether);
        assertEq(rd.pendingWithdrawals(artist1), 0);
    }

    function testDistributeRevertInsufficientRevenue() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Track", RoyaltyDistributor.ContentType.PODCAST);

        address[] memory bens = new address[](1);
        bens[0] = artist1;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;

        vm.prank(creator);
        rd.configureSplits(id, bens, shares);

        vm.prank(depositor);
        rd.depositRevenue{value: 1 ether}(id);

        vm.expectRevert("Insufficient revenue");
        rd.distributeRoyalties(id, 5 ether);
    }

    function testDistributeRevertNoSplits() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("No Splits", RoyaltyDistributor.ContentType.GAME);

        vm.prank(depositor);
        rd.depositRevenue{value: 1 ether}(id);

        vm.expectRevert("No splits configured");
        rd.distributeRoyalties(id, 1 ether);
    }

    function testWithdrawRevertNothing() public {
        vm.prank(artist1);
        vm.expectRevert("Nothing to withdraw");
        rd.withdraw();
    }

    // ── deactivateContent ───────────────────────────────────────────

    function testDeactivateContent() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Old Song", RoyaltyDistributor.ContentType.MUSIC);

        vm.prank(creator);
        rd.deactivateContent(id);

        RoyaltyDistributor.Content memory c = rd.getContent(id);
        assertFalse(c.active);
    }

    function testDeactivateRevertNotAuthorized() public {
        vm.prank(creator);
        uint256 id = rd.registerContent("Song", RoyaltyDistributor.ContentType.MUSIC);

        vm.prank(artist1);
        vm.expectRevert("Not authorized");
        rd.deactivateContent(id);
    }
}
