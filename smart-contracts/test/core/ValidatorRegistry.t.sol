// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";
import {ValidatorRegistry} from "../../src/core/ValidatorRegistry.sol";

contract ValidatorRegistryTest is Test {
    BEZCoinV2 public bez;
    ValidatorRegistry public registry;

    address public admin = address(1);
    address public oracle = address(2);
    address public slasher = address(3);
    address public company1 = address(10);
    address public company2 = address(11);
    address public company3 = address(12);
    address public company4 = address(13);

    uint256 public constant BRONZE_AMOUNT = 10_000 * 1e18;
    uint256 public constant SILVER_AMOUNT = 50_000 * 1e18;
    uint256 public constant GOLD_AMOUNT = 250_000 * 1e18;
    uint256 public constant PLATINUM_AMOUNT = 1_000_000 * 1e18;

    function setUp() public {
        vm.startPrank(admin);
        bez = new BEZCoinV2(admin);
        registry = new ValidatorRegistry(address(bez), admin);
        registry.grantRole(registry.ORACLE_ROLE(), oracle);
        registry.grantRole(registry.SLASHER_ROLE(), slasher);

        // Fund companies
        bez.transfer(company1, PLATINUM_AMOUNT * 2);
        bez.transfer(company2, GOLD_AMOUNT * 2);
        bez.transfer(company3, SILVER_AMOUNT * 2);
        bez.transfer(company4, SILVER_AMOUNT * 2);
        vm.stopPrank();
    }

    // ─── Registration Tests ──────────────────────────────────────────

    function test_RegisterBronzeValidator() public {
        vm.startPrank(company4);
        bez.approve(address(registry), BRONZE_AMOUNT);
        registry.registerValidator("Bronze Corp", BRONZE_AMOUNT);
        vm.stopPrank();

        (string memory name, uint256 staked, , uint8 tier, bool isActive, bool isSeqEligible, ) 
            = registry.getValidatorInfo(company4);

        assertEq(name, "Bronze Corp");
        assertEq(staked, BRONZE_AMOUNT);
        assertEq(tier, 1);
        assertTrue(isActive);
        assertFalse(isSeqEligible);
    }

    function test_RegisterSilverValidator() public {
        vm.startPrank(company3);
        bez.approve(address(registry), SILVER_AMOUNT);
        registry.registerValidator("Silver Corp", SILVER_AMOUNT);
        vm.stopPrank();

        (, , , uint8 tier, , , ) = registry.getValidatorInfo(company3);
        assertEq(tier, 2);
    }

    function test_RegisterGoldValidator() public {
        vm.startPrank(company2);
        bez.approve(address(registry), GOLD_AMOUNT);
        registry.registerValidator("Gold Corp", GOLD_AMOUNT);
        vm.stopPrank();

        (, , , uint8 tier, , bool isSeqEligible, ) = registry.getValidatorInfo(company2);
        assertEq(tier, 3);
        assertTrue(isSeqEligible);
    }

    function test_RegisterPlatinumValidator() public {
        vm.startPrank(company1);
        bez.approve(address(registry), PLATINUM_AMOUNT);
        registry.registerValidator("Platinum Corp", PLATINUM_AMOUNT);
        vm.stopPrank();

        (, , , uint8 tier, , bool isSeqEligible, ) = registry.getValidatorInfo(company1);
        assertEq(tier, 4);
        assertTrue(isSeqEligible);
    }

    function test_RevertRegisterBelowMinimum() public {
        uint256 tooLow = 5000 * 1e18;
        vm.startPrank(company4);
        bez.approve(address(registry), tooLow);
        vm.expectRevert("VR: stake below Bronze minimum");
        registry.registerValidator("Too Small Corp", tooLow);
        vm.stopPrank();
    }

    function test_RevertRegisterTwice() public {
        vm.startPrank(company4);
        bez.approve(address(registry), BRONZE_AMOUNT * 2);
        registry.registerValidator("Corp", BRONZE_AMOUNT);
        vm.expectRevert("VR: already registered");
        registry.registerValidator("Corp Again", BRONZE_AMOUNT);
        vm.stopPrank();
    }

    // ─── Stake Addition Tests ────────────────────────────────────────

    function test_AddStakeUpgradesTier() public {
        _registerValidator(company4, BRONZE_AMOUNT, "Upgrade Corp");

        vm.startPrank(company4);
        bez.approve(address(registry), SILVER_AMOUNT - BRONZE_AMOUNT);
        registry.addStake(SILVER_AMOUNT - BRONZE_AMOUNT);
        vm.stopPrank();

        (, , , uint8 tier, , , ) = registry.getValidatorInfo(company4);
        assertEq(tier, 2);
    }

    function test_TotalStakedTracking() public {
        _registerValidator(company1, PLATINUM_AMOUNT, "Corp A");
        _registerValidator(company2, GOLD_AMOUNT, "Corp B");

        assertEq(registry.totalStaked(), PLATINUM_AMOUNT + GOLD_AMOUNT);
    }

    // ─── Unbonding Tests ─────────────────────────────────────────────

    function test_InitiateAndCompleteUnbonding() public {
        _registerValidator(company3, SILVER_AMOUNT, "Unbond Corp");

        uint256 withdrawAmount = 30_000 * 1e18;

        vm.prank(company3);
        registry.initiateUnbonding(withdrawAmount);

        // Should fail before unbonding period
        vm.prank(company3);
        vm.expectRevert("VR: unbonding not complete");
        registry.completeWithdraw();

        // Advance time past unbonding period
        vm.warp(block.timestamp + 7 days + 1);

        uint256 balBefore = bez.balanceOf(company3);
        vm.prank(company3);
        registry.completeWithdraw();
        uint256 balAfter = bez.balanceOf(company3);

        assertEq(balAfter - balBefore, withdrawAmount);
    }

    function test_UnbondingDeactivatesIfBelowMinimum() public {
        _registerValidator(company4, BRONZE_AMOUNT, "Small Corp");

        vm.prank(company4);
        registry.initiateUnbonding(BRONZE_AMOUNT);

        (, , , , bool isActive, , ) = registry.getValidatorInfo(company4);
        assertFalse(isActive);
    }

    // ─── Heartbeat Tests ─────────────────────────────────────────────

    function test_HeartbeatUpdatesTimestamp() public {
        _registerValidator(company1, PLATINUM_AMOUNT, "Heartbeat Corp");

        vm.warp(block.timestamp + 1 hours);
        vm.prank(company1);
        registry.heartbeat();

        // Validator should still be active
        (, , , , bool isActive, , ) = registry.getValidatorInfo(company1);
        assertTrue(isActive);
    }

    // ─── Contribution Tests ──────────────────────────────────────────

    function test_RecordContribution() public {
        _registerValidator(company1, PLATINUM_AMOUNT, "Contrib Corp");

        vm.prank(oracle);
        registry.recordContribution(company1, 100, "IoT Traceability");

        (, , uint256 points, , , , ) = registry.getValidatorInfo(company1);
        assertEq(points, 100);
    }

    function test_RevertContributionNotOracle() public {
        _registerValidator(company1, PLATINUM_AMOUNT, "Corp");

        vm.prank(company2);
        vm.expectRevert();
        registry.recordContribution(company1, 100, "IoT");
    }

    // ─── Slashing Tests ──────────────────────────────────────────────

    function test_SlashReducesStake() public {
        _registerValidator(company1, PLATINUM_AMOUNT, "Slash Target");

        uint256 slashAmount = 50_000 * 1e18;
        vm.prank(slasher);
        registry.slash(company1, slashAmount, "Test slash");

        (, uint256 staked, , , , , ) = registry.getValidatorInfo(company1);
        assertEq(staked, PLATINUM_AMOUNT - slashAmount);
    }

    function test_SlashDeactivatesIfBelowMinimum() public {
        _registerValidator(company4, BRONZE_AMOUNT, "Small Slash");

        vm.prank(slasher);
        registry.slash(company4, BRONZE_AMOUNT, "Full slash");

        (, , , , bool isActive, , ) = registry.getValidatorInfo(company4);
        assertFalse(isActive);
    }

    // ─── Reactivation Tests ──────────────────────────────────────────

    function test_ReactivateAfterDeactivation() public {
        _registerValidator(company4, BRONZE_AMOUNT, "Reactivate Corp");

        vm.prank(slasher);
        registry.slash(company4, BRONZE_AMOUNT, "Slash all");

        (, , , , bool isActiveBefore, , ) = registry.getValidatorInfo(company4);
        assertFalse(isActiveBefore);

        vm.startPrank(company4);
        bez.approve(address(registry), BRONZE_AMOUNT);
        registry.reactivateValidator(BRONZE_AMOUNT);
        vm.stopPrank();

        (, , , , bool isActiveAfter, , ) = registry.getValidatorInfo(company4);
        assertTrue(isActiveAfter);
    }

    // ─── Sequencer Candidates ────────────────────────────────────────

    function test_GetActiveSequencerCandidates() public {
        _registerValidator(company1, PLATINUM_AMOUNT, "Platinum Corp");
        _registerValidator(company2, GOLD_AMOUNT, "Gold Corp");
        _registerValidator(company4, BRONZE_AMOUNT, "Bronze Corp");

        address[] memory candidates = registry.getActiveSequencerCandidates();
        assertEq(candidates.length, 2); // Only Gold and Platinum
    }

    // ─── Reward Boost ────────────────────────────────────────────────

    function test_RewardBoostByTier() public {
        _registerValidator(company1, PLATINUM_AMOUNT, "Platinum");
        _registerValidator(company2, GOLD_AMOUNT, "Gold");
        _registerValidator(company3, SILVER_AMOUNT, "Silver");
        _registerValidator(company4, BRONZE_AMOUNT, "Bronze");

        assertEq(registry.getRewardBoost(company1), 20000); // 2x
        assertEq(registry.getRewardBoost(company2), 15000); // 1.5x
        assertEq(registry.getRewardBoost(company3), 12500); // 1.25x
        assertEq(registry.getRewardBoost(company4), 10000); // 1x
    }

    function test_ValidatorCount() public {
        _registerValidator(company1, PLATINUM_AMOUNT, "Corp1");
        _registerValidator(company2, GOLD_AMOUNT, "Corp2");

        assertEq(registry.getValidatorCount(), 2);
        assertEq(registry.activeValidatorCount(), 2);
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    function _registerValidator(address who, uint256 amount, string memory name) internal {
        vm.startPrank(who);
        bez.approve(address(registry), amount);
        registry.registerValidator(name, amount);
        vm.stopPrank();
    }
}
