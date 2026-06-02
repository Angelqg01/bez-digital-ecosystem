// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";
import {ValidatorRegistry} from "../../src/core/ValidatorRegistry.sol";
import {SequencerRotation} from "../../src/core/SequencerRotation.sol";

contract SequencerRotationTest is Test {
    BEZCoinV2 public bez;
    ValidatorRegistry public registry;
    SequencerRotation public rotation;

    address public admin = address(1);
    address public oracle = address(2);
    address public company1 = address(10); // Platinum
    address public company2 = address(11); // Gold
    address public company3 = address(12); // Gold

    uint256 public constant PLATINUM_AMOUNT = 1_000_000 * 1e18;
    uint256 public constant GOLD_AMOUNT = 250_000 * 1e18;

    function setUp() public {
        vm.startPrank(admin);
        bez = new BEZCoinV2(admin);
        registry = new ValidatorRegistry(address(bez), admin);
        rotation = new SequencerRotation(address(registry), admin);
        registry.grantRole(registry.ORACLE_ROLE(), oracle);

        // Fund companies
        bez.transfer(company1, PLATINUM_AMOUNT * 2);
        bez.transfer(company2, GOLD_AMOUNT * 2);
        bez.transfer(company3, GOLD_AMOUNT * 2);
        vm.stopPrank();

        // Register Gold+ validators
        _registerValidator(company1, PLATINUM_AMOUNT, "Platinum Node");
        _registerValidator(company2, GOLD_AMOUNT, "Gold Node A");
        _registerValidator(company3, GOLD_AMOUNT, "Gold Node B");
    }

    function test_RefreshSequencerQueue() public {
        vm.prank(admin);
        rotation.refreshSequencerQueue();

        assertEq(rotation.getSequencerQueueLength(), 3);
        // First in queue should be Platinum (highest stake)
        assertEq(rotation.activeSequencer(), company1);
    }

    function test_AdvanceEpoch() public {
        vm.prank(admin);
        rotation.refreshSequencerQueue();

        assertEq(rotation.activeSequencer(), company1);

        // Advance blocks past epoch length
        vm.roll(block.number + 7201);

        vm.prank(admin);
        rotation.advanceEpoch();

        // Should have rotated to next candidate
        assertEq(rotation.currentEpoch(), 1);
        assertTrue(rotation.activeSequencer() != address(0));
    }

    function test_ForceRotation() public {
        vm.prank(admin);
        rotation.refreshSequencerQueue();

        address firstSequencer = rotation.activeSequencer();

        vm.prank(admin);
        rotation.forceRotation("Downtime detected");

        // Should have new sequencer
        assertTrue(rotation.activeSequencer() != firstSequencer || rotation.getSequencerQueueLength() == 1);
        assertEq(rotation.currentEpoch(), 1);
    }

    function test_ReportBlocksProduced() public {
        vm.prank(admin);
        rotation.refreshSequencerQueue();

        vm.roll(block.number + 7201);
        vm.prank(admin);
        rotation.advanceEpoch();

        vm.prank(admin);
        rotation.reportBlocksProduced(0, 3600);

        (uint256 epochsServed, uint256 blocksTotal, , ) = rotation.getSequencerStats(company1);
        assertEq(epochsServed, 1);
        assertEq(blocksTotal, 3600);
    }

    function test_EpochInfo() public {
        vm.prank(admin);
        rotation.refreshSequencerQueue();

        (uint256 epoch, address seq, , uint256 remaining, ) = rotation.getEpochInfo();
        assertEq(epoch, 0);
        assertEq(seq, company1);
        assertEq(remaining, 7200);
    }

    function test_IsSequencerTurn() public {
        vm.prank(admin);
        rotation.refreshSequencerQueue();

        assertTrue(rotation.isSequencerTurn(company1));
        assertFalse(rotation.isSequencerTurn(company2));
    }

    function test_SetEpochLength() public {
        vm.prank(admin);
        rotation.setEpochLength(14400);
        assertEq(rotation.epochLength(), 14400);
    }

    function test_RevertEpochLengthTooShort() public {
        vm.prank(admin);
        vm.expectRevert("SR: epoch too short");
        rotation.setEpochLength(100);
    }

    function test_SetFeeShare() public {
        vm.prank(admin);
        rotation.setSequencerFeeShare(7000);
        assertEq(rotation.sequencerFeeShareBps(), 7000);
    }

    function test_AccumulateFees() public {
        vm.prank(admin);
        rotation.refreshSequencerQueue();

        vm.prank(admin);
        rotation.accumulateFees(company1, 1000 * 1e18);

        (, , uint256 fees, ) = rotation.getSequencerStats(company1);
        assertEq(fees, 1000 * 1e18);
    }

    function test_RevertAdvanceEpochTooEarly() public {
        vm.prank(admin);
        rotation.refreshSequencerQueue();

        vm.prank(admin);
        vm.expectRevert("SR: epoch not finished");
        rotation.advanceEpoch();
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    function _registerValidator(address who, uint256 amount, string memory name) internal {
        vm.startPrank(who);
        bez.approve(address(registry), amount);
        registry.registerValidator(name, amount);
        vm.stopPrank();
    }
}
