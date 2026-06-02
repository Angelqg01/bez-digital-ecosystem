// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";
import {ValidatorRegistry} from "../../src/core/ValidatorRegistry.sol";
import {SlashingManager} from "../../src/core/SlashingManager.sol";

contract SlashingManagerTest is Test {
    BEZCoinV2 public bez;
    ValidatorRegistry public registry;
    SlashingManager public slashing;

    address public admin = address(1);
    address public oracle = address(2);
    address public slasherBot = address(3);
    address public aegisAI = address(4);
    address public company1 = address(10);
    address public company2 = address(11);

    uint256 public constant PLATINUM_AMOUNT = 1_000_000 * 1e18;
    uint256 public constant GOLD_AMOUNT = 250_000 * 1e18;

    function setUp() public {
        // Warp past 24h so cooldown check (block.timestamp >= lastSlashTime + 24h) passes
        // since lastSlashTime defaults to 0
        vm.warp(86_401);
        vm.startPrank(admin);
        bez = new BEZCoinV2(admin);
        registry = new ValidatorRegistry(address(bez), admin);
        slashing = new SlashingManager(address(registry), admin);

        // Grant SlashingManager the SLASHER_ROLE on ValidatorRegistry
        registry.grantRole(registry.SLASHER_ROLE(), address(slashing));
        registry.grantRole(registry.ORACLE_ROLE(), oracle);

        // Grant roles on SlashingManager
        slashing.grantRole(slashing.SLASHER_ROLE(), slasherBot);
        slashing.grantRole(slashing.AEGIS_AI_ROLE(), aegisAI);

        // Fund companies
        bez.transfer(company1, PLATINUM_AMOUNT * 2);
        bez.transfer(company2, GOLD_AMOUNT * 2);
        vm.stopPrank();

        _registerValidator(company1, PLATINUM_AMOUNT, "Slash Target Platinum");
        _registerValidator(company2, GOLD_AMOUNT, "Slash Target Gold");
    }

    // ─── Downtime Slash Tests ────────────────────────────────────────

    function test_SlashForDowntime() public {
        // 2% of 1M = 20K BEZ
        uint256 expectedSlash = (PLATINUM_AMOUNT * 200) / 10000;

        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "4h+ without heartbeat");

        (, uint256 staked, , , , , ) = registry.getValidatorInfo(company1);
        assertEq(staked, PLATINUM_AMOUNT - expectedSlash);
        assertEq(slashing.getSlashCount(), 1);
    }

    // ─── Fraudulent Data Slash (Aegis AI) ────────────────────────────

    function test_SlashForFraudulentData() public {
        // 5% of 250K = 12.5K BEZ
        uint256 expectedSlash = (GOLD_AMOUNT * 500) / 10000;

        vm.prank(aegisAI);
        slashing.slashForFraudulentData(company2, "AI detected manipulated IoT data");

        (, uint256 staked, , , , , ) = registry.getValidatorInfo(company2);
        assertEq(staked, GOLD_AMOUNT - expectedSlash);
    }

    // ─── DAO Inactivity Tests ────────────────────────────────────────

    function test_DAOInactivitySlashAfterThreeMisses() public {
        vm.startPrank(slasherBot);
        slashing.recordMissedDAOVote(company1);
        slashing.recordMissedDAOVote(company1);

        // Third miss triggers slash
        slashing.recordMissedDAOVote(company1);
        vm.stopPrank();

        // 1% of 1M = 10K BEZ
        uint256 expectedSlash = (PLATINUM_AMOUNT * 100) / 10000;
        (, uint256 staked, , , , , ) = registry.getValidatorInfo(company1);
        assertEq(staked, PLATINUM_AMOUNT - expectedSlash);
    }

    function test_DAOInactivityCounterResets() public {
        vm.startPrank(slasherBot);
        slashing.recordMissedDAOVote(company1);
        slashing.recordMissedDAOVote(company1);
        slashing.recordMissedDAOVote(company1); // Triggers slash + resets

        // Counter should be 0 now
        assertEq(slashing.missedDAOVotes(company1), 0);
        vm.stopPrank();
    }

    // ─── Sequencer Failure Slash ─────────────────────────────────────

    function test_SlashForSequencerFailure() public {
        // 3% of 1M = 30K BEZ
        uint256 expectedSlash = (PLATINUM_AMOUNT * 300) / 10000;

        vm.prank(slasherBot);
        slashing.slashForSequencerFailure(company1, "Failed to produce blocks in epoch 5");

        (, uint256 staked, , , , , ) = registry.getValidatorInfo(company1);
        assertEq(staked, PLATINUM_AMOUNT - expectedSlash);
    }

    // ─── Double Signing Slash ────────────────────────────────────────

    function test_SlashForDoubleSigning() public {
        // 10% of 1M = 100K BEZ
        uint256 expectedSlash = (PLATINUM_AMOUNT * 1000) / 10000;

        vm.prank(slasherBot);
        slashing.slashForDoubleSigning(company1, "Double-signed block at height 12345");

        (, uint256 staked, , , , , ) = registry.getValidatorInfo(company1);
        assertEq(staked, PLATINUM_AMOUNT - expectedSlash);
    }

    // ─── Cooldown Tests ──────────────────────────────────────────────

    function test_SlashCooldownEnforced() public {
        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "First slash");

        // Second slash immediately should fail
        vm.prank(slasherBot);
        vm.expectRevert("SM: cooldown active");
        slashing.slashForDowntime(company1, "Too soon");
    }

    function test_SlashAfterCooldown() public {
        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "First slash");

        // Advance past cooldown
        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "Second slash");

        assertEq(slashing.getSlashCount(), 2);
    }

    // ─── Period Limit Tests ──────────────────────────────────────────

    function test_MaxSlashPerPeriodEnforced() public {
        // Max 25% per 30 days = 250K BEZ on 1M stake
        // Double-signing = 10% = 100K
        // We can do 2 double-sign slashes (200K), but third (300K total) exceeds 250K
        
        vm.warp(100_000);
        vm.prank(slasherBot);
        slashing.slashForDoubleSigning(company1, "Double sign 1");
        
        vm.warp(200_000);
        
        vm.prank(slasherBot);
        slashing.slashForDoubleSigning(company1, "Double sign 2");

        vm.warp(300_000);

        // Third attempt — should only slash remaining allowance
        vm.prank(slasherBot);
        slashing.slashForDoubleSigning(company1, "Double sign 3");

        // Check total slashed doesn't exceed ~250K (25% of original 1M)
        uint256[] memory history = slashing.getValidatorSlashHistory(company1);
        uint256 totalSlashedAmt = 0;
        for (uint256 i = 0; i < history.length; i++) {
            (, , uint256 amt, , , , ) = slashing.getSlashRecord(history[i]);
            totalSlashedAmt += amt;
        }
        assertLe(totalSlashedAmt, (PLATINUM_AMOUNT * 2500) / 10000);
    }

    // ─── Appeal Tests ────────────────────────────────────────────────

    function test_AppealSlash() public {
        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "Downtime");

        vm.prank(company1);
        slashing.appealSlash(0);

        (, , , , , bool appealed, ) = slashing.getSlashRecord(0);
        assertTrue(appealed);
    }

    function test_ReverseSlashAfterAppeal() public {
        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "Downtime");

        vm.prank(company1);
        slashing.appealSlash(0);

        vm.prank(admin);
        slashing.reverseSlash(0);

        (, , , , , , bool reversed) = slashing.getSlashRecord(0);
        assertTrue(reversed);
    }

    function test_RevertReverseWithoutAppeal() public {
        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "Downtime");

        vm.prank(admin);
        vm.expectRevert("SM: not appealed");
        slashing.reverseSlash(0);
    }

    function test_RevertAppealNotYourSlash() public {
        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "Downtime");

        vm.prank(company2);
        vm.expectRevert("SM: not your slash");
        slashing.appealSlash(0);
    }

    // ─── View Functions ──────────────────────────────────────────────

    function test_GetSlashHistory() public {
        vm.prank(slasherBot);
        slashing.slashForDowntime(company1, "Downtime 1");

        uint256[] memory history = slashing.getValidatorSlashHistory(company1);
        assertEq(history.length, 1);
        assertEq(history[0], 0);
    }

    function test_ResetDAOVoteCounter() public {
        vm.startPrank(slasherBot);
        slashing.recordMissedDAOVote(company1);
        slashing.recordMissedDAOVote(company1);
        slashing.resetDAOVoteCounter(company1);
        vm.stopPrank();

        assertEq(slashing.missedDAOVotes(company1), 0);
    }

    // ─── Access Control Tests ────────────────────────────────────────

    function test_RevertSlashNotSlasher() public {
        vm.prank(company2);
        vm.expectRevert();
        slashing.slashForDowntime(company1, "Unauthorized");
    }

    function test_RevertFraudNotAegis() public {
        vm.prank(slasherBot);
        vm.expectRevert();
        slashing.slashForFraudulentData(company1, "Not AI");
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    function _registerValidator(address who, uint256 amount, string memory name) internal {
        vm.startPrank(who);
        bez.approve(address(registry), amount);
        registry.registerValidator(name, amount);
        vm.stopPrank();
    }
}
