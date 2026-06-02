// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {BEZPolygonBridge} from "../../src/core/BEZPolygonBridge.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";

// ─── Handler ─────────────────────────────────────────────────────
contract PolygonBridgeHandler is Test {
    BEZPolygonBridge public bridge;
    BEZCoinV2 public bez;
    address public admin;
    address public relayer;

    // Ghost variables
    uint256 public ghost_totalLocked;
    uint256 public ghost_totalFees;
    uint256 public ghost_totalUnlocked;
    uint256 public ghost_lockCount;
    uint256 public ghost_unlockCount;
    uint256 public ghost_dailyLimitHits;

    address[] internal users;
    bytes32[] internal processedHashes;

    uint256 constant POLYGON_CHAIN_ID = 137;

    constructor(
        BEZPolygonBridge _bridge,
        BEZCoinV2 _bez,
        address _admin,
        address _relayer
    ) {
        bridge = _bridge;
        bez = _bez;
        admin = _admin;
        relayer = _relayer;

        for (uint256 i = 1; i <= 8; i++) {
            address user = address(uint160(0x5000 + i));
            users.push(user);
            vm.prank(admin);
            bez.transfer(user, 5_000_000 ether);
            vm.prank(user);
            bez.approve(address(bridge), type(uint256).max);
        }
    }

    function lock(uint256 userSeed, uint256 amount) external {
        address user = users[userSeed % users.length];
        amount = bound(amount, 1 ether, 500_000 ether);

        uint256 fee = (amount * 10) / 10_000; // 0.1%
        uint256 net = amount - fee;

        vm.prank(user);
        try bridge.lock(amount, POLYGON_CHAIN_ID) {
            ghost_totalLocked += net;
            ghost_totalFees += fee;
            ghost_lockCount++;
        } catch {
            ghost_dailyLimitHits++;
        }
    }

    function unlock(uint256 userSeed, uint256 amount) external {
        if (ghost_totalLocked <= ghost_totalUnlocked) return;

        address user = users[userSeed % users.length];
        amount = bound(amount, 1 ether, ghost_totalLocked - ghost_totalUnlocked);
        if (amount == 0) return;

        bytes32 srcTxHash = keccak256(abi.encodePacked("polygon-tx", ghost_unlockCount));

        vm.prank(relayer);
        try bridge.unlock(user, amount, srcTxHash) {
            ghost_totalUnlocked += amount;
            ghost_unlockCount++;
            processedHashes.push(srcTxHash);
        } catch {}
    }

    function replayUnlock(uint256 hashSeed) external {
        if (processedHashes.length == 0) return;
        bytes32 srcTxHash = processedHashes[hashSeed % processedHashes.length];

        vm.prank(relayer);
        vm.expectRevert(bytes("Already processed"));
        bridge.unlock(users[0], 1, srcTxHash);
    }

    /// @dev Advance time to reset daily limit
    function skipDay() external {
        vm.warp(block.timestamp + 1 days + 1);
    }
}

// ─── Invariant Test Suite ────────────────────────────────────────
contract PolygonBridgeInvariantTest is Test {
    BEZPolygonBridge public bridge;
    BEZCoinV2 public bez;
    PolygonBridgeHandler public handler;

    address admin = address(this);
    address relayer = address(0xB01D);

    function setUp() public {
        bez = new BEZCoinV2(admin);
        bridge = new BEZPolygonBridge(address(bez), admin);
        bridge.grantRole(bridge.RELAYER_ROLE(), relayer);

        handler = new PolygonBridgeHandler(bridge, bez, admin, relayer);
        targetContract(address(handler));
    }

    /// @dev totalLocked tracks net locked amount (excluding fees)
    function invariant_totalLockedMatchesGhost() public view {
        assertEq(bridge.totalLocked(), handler.ghost_totalLocked() - handler.ghost_totalUnlocked());
    }

    /// @dev totalFees matches ghost tracking
    function invariant_totalFeesMatchesGhost() public view {
        assertEq(bridge.totalFees(), handler.ghost_totalFees());
    }

    /// @dev Bridge BEZ balance >= totalLocked + totalFees (solvency)
    function invariant_bridgeSolvency() public view {
        assertGe(
            bez.balanceOf(address(bridge)),
            bridge.totalLocked() + bridge.totalFees(),
            "Bridge insolvent"
        );
    }

    /// @dev Unlocked never exceeds locked
    function invariant_unlockedBounded() public view {
        assertLe(handler.ghost_totalUnlocked(), handler.ghost_totalLocked(), "More unlocked than locked");
    }

    function invariant_callSummary() public view {
        console.log("Locks:      ", handler.ghost_lockCount());
        console.log("Unlocks:    ", handler.ghost_unlockCount());
        console.log("Locked:     ", handler.ghost_totalLocked());
        console.log("Unlocked:   ", handler.ghost_totalUnlocked());
        console.log("Fees:       ", handler.ghost_totalFees());
        console.log("Daily hits: ", handler.ghost_dailyLimitHits());
    }
}

// ─── Fuzz Tests ──────────────────────────────────────────────────
contract PolygonBridgeFuzzTest is Test {
    BEZPolygonBridge public bridge;
    BEZCoinV2 public bez;

    address admin = address(this);
    address relayer = address(0xB01D);
    address user = address(0xBEEF);
    uint256 constant POLYGON = 137;

    function setUp() public {
        bez = new BEZCoinV2(admin);
        bridge = new BEZPolygonBridge(address(bez), admin);
        bridge.grantRole(bridge.RELAYER_ROLE(), relayer);

        bez.transfer(user, 50_000_000 ether);
        vm.prank(user);
        bez.approve(address(bridge), type(uint256).max);
    }

    /// @dev Fee is always exactly 0.1% of amount
    function testFuzz_feeExactly01Percent(uint256 amount) public {
        amount = bound(amount, 1 ether, 1_000_000 ether);

        uint256 expectedFee = (amount * 10) / 10_000;
        uint256 expectedNet = amount - expectedFee;

        vm.prank(user);
        bridge.lock(amount, POLYGON);

        assertEq(bridge.totalLocked(), expectedNet);
        assertEq(bridge.totalFees(), expectedFee);
    }

    /// @dev Max per tx enforced
    function testFuzz_maxPerTxEnforced(uint256 amount) public {
        amount = bound(amount, 1_000_001 ether, 5_000_000 ether);

        vm.prank(user);
        vm.expectRevert(bytes("Exceeds max per tx"));
        bridge.lock(amount, POLYGON);
    }

    /// @dev Daily limit resets across days
    function testFuzz_dailyLimitResetsAcrossDays(uint256 day1Amount, uint256 day2Amount) public {
        day1Amount = bound(day1Amount, 1 ether, 500_000 ether);
        day2Amount = bound(day2Amount, 1 ether, 500_000 ether);

        vm.prank(user);
        bridge.lock(day1Amount, POLYGON);

        // Skip to next day
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(user);
        bridge.lock(day2Amount, POLYGON);

        // Both succeeded — daily limit reset
        assertEq(bridge.dailyVolume(), day2Amount);
    }

    /// @dev Replay protection: same srcTxHash always reverts on second use
    function testFuzz_replayProtection(bytes32 srcTxHash, uint256 amount) public {
        vm.assume(srcTxHash != bytes32(0));
        amount = bound(amount, 1 ether, 100_000 ether);

        // Lock first
        vm.prank(user);
        bridge.lock(amount, POLYGON);

        vm.prank(relayer);
        bridge.unlock(user, amount - (amount * 10 / 10_000), srcTxHash);

        vm.prank(relayer);
        vm.expectRevert(bytes("Already processed"));
        bridge.unlock(user, 1, srcTxHash);
    }

    /// @dev Nonces increment per user on each lock
    function testFuzz_noncesIncrement(uint256 lockCount) public {
        lockCount = bound(lockCount, 1, 10);

        for (uint256 i = 0; i < lockCount; i++) {
            vm.prank(user);
            bridge.lock(1 ether, POLYGON);
        }

        assertEq(bridge.nonces(user), lockCount);
    }

    /// @dev Pause blocks locks and unlocks
    function testFuzz_pauseBlocksOps(uint256 amount) public {
        amount = bound(amount, 1 ether, 100_000 ether);

        vm.prank(admin);
        bridge.pause();

        vm.prank(user);
        vm.expectRevert();
        bridge.lock(amount, POLYGON);

        vm.prank(admin);
        bridge.unpause();

        vm.prank(user);
        bridge.lock(amount, POLYGON);
    }

    /// @dev Fee rate change applies to subsequent locks
    function testFuzz_feeRateChangeApplies(uint256 newRate) public {
        newRate = bound(newRate, 0, 500); // 0-5%

        vm.prank(admin);
        bridge.setFeeRate(newRate);

        uint256 amount = 100_000 ether;
        uint256 expectedFee = (amount * newRate) / 10_000;

        vm.prank(user);
        bridge.lock(amount, POLYGON);

        assertEq(bridge.totalFees(), expectedFee);
    }

    /// @dev Fee rate > 500 (5%) always reverts
    function testFuzz_feeRateMaxEnforced(uint256 newRate) public {
        newRate = bound(newRate, 501, 10_000);

        vm.prank(admin);
        vm.expectRevert(bytes("Fee too high"));
        bridge.setFeeRate(newRate);
    }

    /// @dev Non-relayer cannot unlock
    function testFuzz_onlyRelayerUnlocks(address attacker) public {
        vm.assume(attacker != relayer);
        vm.assume(attacker != admin);

        vm.prank(user);
        bridge.lock(1 ether, POLYGON);

        vm.prank(attacker);
        vm.expectRevert();
        bridge.unlock(user, 1 ether, bytes32("tx1"));
    }

    /// @dev Lock + unlock round-trip preserves solvency
    function testFuzz_roundTripSolvency(uint256 amount) public {
        amount = bound(amount, 100 ether, 500_000 ether);

        vm.prank(user);
        bridge.lock(amount, POLYGON);

        uint256 netLocked = bridge.totalLocked();

        vm.prank(relayer);
        bridge.unlock(user, netLocked, bytes32("tx1"));

        assertEq(bridge.totalLocked(), 0);
        // Fees remain in bridge
        assertGe(bez.balanceOf(address(bridge)), bridge.totalFees());
    }
}
