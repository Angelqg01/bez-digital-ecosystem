// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/otros/LoyaltyRewards.sol";

contract LoyaltyRewardsTest is Test {
    LoyaltyRewards loyalty;
    address admin = address(this);
    address issuer = address(0xA1);
    address member1 = address(0xB1);
    address member2 = address(0xB2);

    function setUp() public {
        loyalty = new LoyaltyRewards();
        loyalty.grantRole(loyalty.ISSUER_ROLE(), issuer);
    }

    // ── registerMember ──────────────────
    function testRegisterMember() public {
        vm.prank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        (address w, , , , , bool a, ) = loyalty.members(member1);
        assertEq(w, member1);
        assertTrue(a);
    }

    function testRegisterMemberRevertAlreadyRegistered() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        vm.expectRevert("Already registered");
        loyalty.registerMember(member1, keccak256("Alice2"));
        vm.stopPrank();
    }

    // ── issuePoints ──────────────────
    function testIssuePoints() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 1000);
        vm.stopPrank();
        assertEq(loyalty.getPoints(member1), 1000);
    }

    function testIssuePointsRevertNotActive() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.deactivateMember(member1);
        vm.expectRevert("Not active");
        loyalty.issuePoints(member1, 100);
        vm.stopPrank();
    }

    function testIssuePointsRevertZero() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        vm.expectRevert("Amount required");
        loyalty.issuePoints(member1, 0);
        vm.stopPrank();
    }

    // ── redeemPoints ──────────────────
    function testRedeemPoints() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 5000);
        uint256 rid = loyalty.redeemPoints(member1, 2000, keccak256("Reward A"));
        vm.stopPrank();

        assertEq(loyalty.getPoints(member1), 3000);
        (, address m, uint256 pts, , ) = loyalty.redemptions(rid);
        assertEq(m, member1);
        assertEq(pts, 2000);
    }

    function testRedeemPointsRevertInsufficient() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 100);
        vm.expectRevert("Insufficient points");
        loyalty.redeemPoints(member1, 200, keccak256("x"));
        vm.stopPrank();
    }

    // ── deactivateMember ──────────────────
    function testDeactivateMember() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.deactivateMember(member1);
        vm.stopPrank();
        (, , , , , bool a, ) = loyalty.members(member1);
        assertFalse(a);
    }

    // ── Tier upgrades ──────────────────
    function testTierBronze() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 100);
        vm.stopPrank();
        assertEq(uint8(loyalty.getMemberTier(member1)), uint8(LoyaltyRewards.Tier.BRONZE));
    }

    function testTierSilver() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 5000);
        vm.stopPrank();
        assertEq(uint8(loyalty.getMemberTier(member1)), uint8(LoyaltyRewards.Tier.SILVER));
    }

    function testTierGold() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 20000);
        vm.stopPrank();
        assertEq(uint8(loyalty.getMemberTier(member1)), uint8(LoyaltyRewards.Tier.GOLD));
    }

    function testTierPlatinum() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 50000);
        vm.stopPrank();
        assertEq(uint8(loyalty.getMemberTier(member1)), uint8(LoyaltyRewards.Tier.PLATINUM));
    }

    function testTierDiamond() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 100000);
        vm.stopPrank();
        assertEq(uint8(loyalty.getMemberTier(member1)), uint8(LoyaltyRewards.Tier.DIAMOND));
    }

    // ── View helpers ──────────────────
    function testGetMemberCount() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("A"));
        loyalty.registerMember(member2, keccak256("B"));
        vm.stopPrank();
        assertEq(loyalty.getMemberCount(), 2);
    }

    function testGetPoints() public {
        vm.startPrank(issuer);
        loyalty.registerMember(member1, keccak256("Alice"));
        loyalty.issuePoints(member1, 7777);
        vm.stopPrank();
        assertEq(loyalty.getPoints(member1), 7777);
    }
}
