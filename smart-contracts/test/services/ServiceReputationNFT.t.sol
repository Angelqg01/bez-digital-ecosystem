// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/services/ServiceReputationNFT.sol";

contract ServiceReputationNFTTest is Test {
    ServiceReputationNFT rep;
    address admin = address(this);
    address reviewer = address(0xA1);
    address provWallet = address(0xB1);
    address provWallet2 = address(0xB2);
    address outsider = address(0xD1);

    function setUp() public {
        rep = new ServiceReputationNFT();
        rep.grantRole(rep.REVIEWER_ROLE(), reviewer);
    }

    // ── registerProvider ──────────────────
    function testRegisterProvider() public {
        vm.prank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme Inc"));
        (address w, bytes32 nh, uint256 tr, uint256 ts, uint256 cj, uint256 d, ServiceReputationNFT.BadgeLevel b, bool a, uint256 ra) = rep.providers(provWallet);
        assertEq(w, provWallet);
        assertTrue(a);
        assertEq(uint8(b), uint8(ServiceReputationNFT.BadgeLevel.NONE));
    }

    function testRegisterProviderRevertAlreadyRegistered() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        vm.expectRevert("Already registered");
        rep.registerProvider(provWallet, keccak256("Acme2"));
        vm.stopPrank();
    }

    // ── submitReview ──────────────────
    function testSubmitReview() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        rep.submitReview(provWallet, 5, keccak256("Great work"));
        vm.stopPrank();

        (, , uint256 tr, uint256 ts, , , , ,) = rep.providers(provWallet);
        assertEq(tr, 1);
        assertEq(ts, 5);
    }

    function testSubmitReviewRevertInvalidScore() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        vm.expectRevert("Score must be 1-5");
        rep.submitReview(provWallet, 0, keccak256("bad"));
        vm.expectRevert("Score must be 1-5");
        rep.submitReview(provWallet, 6, keccak256("bad"));
        vm.stopPrank();
    }

    function testSubmitReviewRevertNotActive() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        rep.deactivateProvider(provWallet);
        vm.expectRevert("Not active provider");
        rep.submitReview(provWallet, 4, keccak256("x"));
        vm.stopPrank();
    }

    // ── recordJobCompleted ──────────────────
    function testRecordJobCompleted() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        rep.recordJobCompleted(provWallet);
        rep.recordJobCompleted(provWallet);
        vm.stopPrank();
        (, , , , uint256 cj, , , ,) = rep.providers(provWallet);
        assertEq(cj, 2);
    }

    // ── recordDispute ──────────────────
    function testRecordDispute() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        rep.recordDispute(provWallet);
        vm.stopPrank();
        (, , , , , uint256 d, , ,) = rep.providers(provWallet);
        assertEq(d, 1);
    }

    // ── deactivateProvider ──────────────────
    function testDeactivateProvider() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        rep.deactivateProvider(provWallet);
        vm.stopPrank();
        (, , , , , , , bool a,) = rep.providers(provWallet);
        assertFalse(a);
    }

    // ── getProviderReviews ──────────────────
    function testGetProviderReviews() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        rep.submitReview(provWallet, 5, keccak256("a"));
        rep.submitReview(provWallet, 4, keccak256("b"));
        rep.submitReview(provWallet, 3, keccak256("c"));
        vm.stopPrank();
        uint256[] memory ids = rep.getProviderReviews(provWallet);
        assertEq(ids.length, 3);
    }

    // ── getAverageScore ──────────────────
    function testGetAverageScore() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        rep.submitReview(provWallet, 5, keccak256("a"));
        rep.submitReview(provWallet, 3, keccak256("b"));
        vm.stopPrank();
        // avg = (5+3)/2 = 4.0 → returns 400
        assertEq(rep.getAverageScore(provWallet), 400);
    }

    function testGetAverageScoreZeroReviews() public {
        vm.prank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        assertEq(rep.getAverageScore(provWallet), 0);
    }

    // ── getProviderCount ──────────────────
    function testGetProviderCount() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("A"));
        rep.registerProvider(provWallet2, keccak256("B"));
        vm.stopPrank();
        assertEq(rep.getProviderCount(), 2);
    }

    // ── getBadge ──────────────────
    function testGetBadgeNone() public {
        vm.prank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        assertEq(uint8(rep.getBadge(provWallet)), uint8(ServiceReputationNFT.BadgeLevel.NONE));
    }

    function testBadgeBronze() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        // 3 jobs, avg >= 3.0
        for (uint i = 0; i < 3; i++) rep.recordJobCompleted(provWallet);
        rep.submitReview(provWallet, 3, keccak256("ok"));
        vm.stopPrank();
        assertEq(uint8(rep.getBadge(provWallet)), uint8(ServiceReputationNFT.BadgeLevel.BRONZE));
    }

    function testBadgeSilver() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        for (uint i = 0; i < 10; i++) rep.recordJobCompleted(provWallet);
        rep.submitReview(provWallet, 4, keccak256("good"));
        vm.stopPrank();
        assertEq(uint8(rep.getBadge(provWallet)), uint8(ServiceReputationNFT.BadgeLevel.SILVER));
    }

    function testBadgeGold() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        for (uint i = 0; i < 25; i++) rep.recordJobCompleted(provWallet);
        rep.submitReview(provWallet, 4, keccak256("great"));
        vm.stopPrank();
        assertEq(uint8(rep.getBadge(provWallet)), uint8(ServiceReputationNFT.BadgeLevel.GOLD));
    }

    function testBadgePlatinum() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        for (uint i = 0; i < 50; i++) rep.recordJobCompleted(provWallet);
        rep.submitReview(provWallet, 5, keccak256("perfect"));
        vm.stopPrank();
        assertEq(uint8(rep.getBadge(provWallet)), uint8(ServiceReputationNFT.BadgeLevel.PLATINUM));
    }

    function testBadgeDowngradeOnDispute() public {
        vm.startPrank(reviewer);
        rep.registerProvider(provWallet, keccak256("Acme"));
        for (uint i = 0; i < 50; i++) rep.recordJobCompleted(provWallet);
        rep.submitReview(provWallet, 5, keccak256("perfect"));
        assertEq(uint8(rep.getBadge(provWallet)), uint8(ServiceReputationNFT.BadgeLevel.PLATINUM));
        // 3 disputes → no longer platinum (max 2 for platinum)
        rep.recordDispute(provWallet);
        rep.recordDispute(provWallet);
        rep.recordDispute(provWallet);
        vm.stopPrank();
        // should be GOLD (50 jobs, avg 500, 3 disputes → <=5 disputes, jobs>=25, avg>=400)
        assertEq(uint8(rep.getBadge(provWallet)), uint8(ServiceReputationNFT.BadgeLevel.GOLD));
    }
}
