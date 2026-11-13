// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";
import {ValidatorRegistry} from "../../src/core/ValidatorRegistry.sol";
import {StakingPool} from "../../src/core/StakingPool.sol";

contract StakingPoolTest is Test {
    BEZCoinV2 public bez;
    ValidatorRegistry public registry;
    StakingPool public staking;

    address public admin = address(1);
    address public oracle = address(2);
    address public company1 = address(10); // Platinum validator
    address public company2 = address(11); // Non-validator staker
    address public company3 = address(12); // Gold validator

    uint256 public constant PLATINUM_AMOUNT = 1_000_000 * 1e18;
    uint256 public constant GOLD_AMOUNT = 250_000 * 1e18;
    uint256 public constant STAKE_AMOUNT = 100_000 * 1e18;

    function setUp() public {
        vm.startPrank(admin);
        bez = new BEZCoinV2(admin);
        registry = new ValidatorRegistry(address(bez), admin);
        staking = new StakingPool(address(bez), address(registry), admin);
        registry.grantRole(registry.ORACLE_ROLE(), oracle);

        // Fund accounts
        bez.transfer(company1, PLATINUM_AMOUNT + STAKE_AMOUNT);
        bez.transfer(company2, STAKE_AMOUNT * 2);
        bez.transfer(company3, GOLD_AMOUNT + STAKE_AMOUNT);
        bez.transfer(address(staking), 50_000_000 * 1e18); // Reward pool
        vm.stopPrank();

        // Register validators
        _registerValidator(company1, PLATINUM_AMOUNT, "Platinum Corp");
        _registerValidator(company3, GOLD_AMOUNT, "Gold Corp");
    }

    function test_StakeTokens() public {
        vm.startPrank(company1);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();

        assertEq(staking.balanceOf(company1), STAKE_AMOUNT);
    }

    function test_WithdrawTokens() public {
        vm.startPrank(company1);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        
        staking.withdraw(STAKE_AMOUNT / 2);
        vm.stopPrank();

        assertEq(staking.balanceOf(company1), STAKE_AMOUNT / 2);
    }

    function test_EarnRewardsOverTime() public {
        vm.startPrank(company1);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();

        // Advance time
        vm.warp(block.timestamp + 1 days);

        uint256 earned = staking.earned(company1);
        assertGt(earned, 0);
    }

    function test_BoostedRewardsForPlatinumValidator() public {
        // Platinum validator stakes
        vm.startPrank(company1);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();

        // Non-validator stakes same amount
        vm.startPrank(company2);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);

        // Base earned should be similar (proportional to stake)
        uint256 baseEarned1 = staking.earned(company1);
        uint256 baseEarned2 = staking.earned(company2);

        // Boosted earned should be 2x for Platinum
        uint256 boosted1 = staking.earnedBoosted(company1);
        uint256 boosted2 = staking.earnedBoosted(company2);

        // Platinum (2x) should get double the boosted rewards vs base
        assertEq(boosted1, baseEarned1 * 20000 / 10000);
        // Non-validator (1x) should get base
        assertEq(boosted2, baseEarned2 * 10000 / 10000);
    }

    function test_ClaimBoostedReward() public {
        vm.startPrank(company1);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);

        uint256 expectedBoosted = staking.earnedBoosted(company1);
        uint256 balBefore = bez.balanceOf(company1);

        vm.prank(company1);
        staking.getReward();

        uint256 balAfter = bez.balanceOf(company1);
        assertEq(balAfter - balBefore, expectedBoosted);
    }

    function test_GetStakerInfo() public {
        vm.startPrank(company1);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();

        (uint256 stakedAmt, , , uint256 boostBps, uint8 tier, bool isVal) 
            = staking.getStakerInfo(company1);

        assertEq(stakedAmt, STAKE_AMOUNT);
        assertEq(boostBps, 20000); // Platinum 2x
        assertEq(tier, 4);
        assertTrue(isVal);
    }

    function test_NonValidatorStakerInfo() public {
        vm.startPrank(company2);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();

        (, , , uint256 boostBps, uint8 tier, bool isVal) 
            = staking.getStakerInfo(company2);

        assertEq(boostBps, 10000); // 1x base
        assertEq(tier, 0);
        assertFalse(isVal);
    }

    function test_ExitUnstakesAndClaims() public {
        vm.startPrank(company1);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);

        vm.prank(company1);
        staking.exit();

        assertEq(staking.balanceOf(company1), 0);
    }

    function test_SetRewardRate() public {
        uint256 newRate = 5e17; // 0.5 BEZ/s (within new MAX_REWARD_RATE of 1e18)
        vm.prank(admin);
        staking.setRewardRate(newRate);
        assertEq(staking.rewardRate(), newRate);
    }

    function test_SetValidatorRegistry() public {
        address newRegistry = address(999);
        vm.prank(admin);
        staking.setValidatorRegistry(newRegistry);
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    function _registerValidator(address who, uint256 amount, string memory name) internal {
        vm.startPrank(who);
        bez.approve(address(registry), amount);
        registry.registerValidator(name, amount);
        vm.stopPrank();
    }

    // ── Tope diario de emisión (SEC-04) ──
    // getReward() revertía si lo debido superaba DAILY_EMISSION_CAP (50.000 BEZ): quien
    // acumulaba más no podía cobrar NUNCA (lo debido sólo crece) y exit() fallaba entero,
    // dejando el principal sin poder salir por esa vía.

    function _stakeWithBigRewards(address who, uint256 secondsPassed) internal {
        vm.prank(admin);
        staking.setRewardRate(1e18); // 1 BEZ/s, el máximo
        vm.startPrank(who);
        bez.approve(address(staking), STAKE_AMOUNT);
        staking.stake(STAKE_AMOUNT);
        vm.stopPrank();
        vm.warp(block.timestamp + secondsPassed);
    }

    function test_ClaimAboveDailyCapPaysWhatFitsAndKeepsTheRest() public {
        _stakeWithBigRewards(company2, 100_000); // ~100.000 BEZ devengados, tope 50.000
        uint256 owed = staking.earnedBoosted(company2);
        assertGt(owed, staking.DAILY_EMISSION_CAP());

        uint256 before = bez.balanceOf(company2);
        vm.prank(company2);
        staking.getReward(); // antes: revert "SP: daily cap reached"
        assertEq(bez.balanceOf(company2) - before, staking.DAILY_EMISSION_CAP());

        // Lo que sobra sigue siendo suyo.
        assertApproxEqAbs(staking.earnedBoosted(company2), owed - staking.DAILY_EMISSION_CAP(), 1e15);
    }

    function test_ExitReturnsThePrincipalEvenWhenRewardsExceedTheCap() public {
        _stakeWithBigRewards(company2, 100_000);
        uint256 before = bez.balanceOf(company2);

        vm.prank(company2);
        staking.exit(); // antes: revertía entero

        assertEq(staking.balanceOf(company2), 0);
        assertGe(bez.balanceOf(company2) - before, STAKE_AMOUNT, "no recupero el principal");
    }

    function test_TheRestIsClaimableTheNextDay() public {
        _stakeWithBigRewards(company2, 100_000);
        vm.prank(company2);
        staking.getReward();
        uint256 afterDay1 = bez.balanceOf(company2);

        vm.warp(block.timestamp + 1 days);
        vm.prank(company2);
        staking.getReward();
        assertGt(bez.balanceOf(company2), afterDay1, "al dia siguiente no pudo cobrar el resto");
    }

    function test_ClaimWhenTheDayIsExhaustedPaysZeroAndDoesNotRevert() public {
        _stakeWithBigRewards(company2, 100_000);
        vm.prank(company2);
        staking.getReward(); // agota el día

        uint256 before = bez.balanceOf(company2);
        vm.prank(company2);
        staking.getReward(); // mismo día: nada que pagar, sin revert
        assertEq(bez.balanceOf(company2), before);
    }

    function test_BoostedPartialPayoutNeverPaysMoreThanOwed() public {
        // Un validador Platinum (boost) con recompensas por encima del tope.
        _stakeWithBigRewards(company1, 60_000);
        uint256 owed = staking.earnedBoosted(company1);
        assertGt(owed, staking.DAILY_EMISSION_CAP());

        uint256 start = bez.balanceOf(company1);
        vm.prank(company1);
        staking.getReward();
        assertEq(bez.balanceOf(company1) - start, staking.DAILY_EMISSION_CAP());

        // Lo pendiente + lo cobrado no supera lo devengado originalmente (con holgura de redondeo).
        assertLe(staking.earnedBoosted(company1) + staking.DAILY_EMISSION_CAP(), owed + 1e15);
        assertGe(staking.earnedBoosted(company1) + staking.DAILY_EMISSION_CAP() + 1e15, owed);
    }
}
