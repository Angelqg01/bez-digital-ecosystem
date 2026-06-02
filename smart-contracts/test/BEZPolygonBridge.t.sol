// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {BEZCoinV2} from "../src/tokens/BEZCoinV2.sol";
import {BEZPolygonBridge} from "../src/core/BEZPolygonBridge.sol";

contract BEZPolygonBridgeTest is Test {
    address admin = address(0xA11CE);
    address relayer = address(0xB01D);
    address user = address(0xBEEF);
    uint256 constant POLYGON_CHAIN_ID = 137;

    BEZCoinV2 bez;
    BEZPolygonBridge bridge;

    function setUp() public {
        vm.startPrank(admin);
        bez = new BEZCoinV2(admin);
        bridge = new BEZPolygonBridge(address(bez), admin);
        bridge.grantRole(bridge.RELAYER_ROLE(), relayer);
        // Transfer some BEZ to user for testing
        bez.transfer(user, 100_000 ether);
        vm.stopPrank();
    }

    // ─── Lock Tests ─────────────────────────────────

    function testLock() public {
        vm.startPrank(user);
        bez.approve(address(bridge), 1000 ether);
        bridge.lock(1000 ether, POLYGON_CHAIN_ID);
        vm.stopPrank();

        // Fee = max(0.5% of 1000, 10 BEZ minimum) = 10 ether
        assertEq(bridge.totalLocked(), 990 ether);
        assertEq(bridge.totalFees(), 10 ether);
        assertEq(bridge.nonces(user), 1);
    }

    function testLockZeroReverts() public {
        vm.expectRevert("Amount must be > 0");
        vm.prank(user);
        bridge.lock(0, POLYGON_CHAIN_ID);
    }

    function testLockExceedsMaxPerTx() public {
        vm.startPrank(user);
        bez.approve(address(bridge), type(uint256).max);
        vm.expectRevert("Exceeds max per tx");
        bridge.lock(2_000_000 ether, POLYGON_CHAIN_ID);
        vm.stopPrank();
    }

    function testLockDailyLimit() public {
        // Give user enough tokens
        vm.prank(admin);
        bez.transfer(user, 15_000_000 ether);

        vm.startPrank(user);
        bez.approve(address(bridge), type(uint256).max);

        // Lock 10 times of 1M each = 10M (daily limit)
        for (uint256 i = 0; i < 10; i++) {
            bridge.lock(1_000_000 ether, POLYGON_CHAIN_ID);
        }

        // 11th should fail
        vm.expectRevert("Daily limit exceeded");
        bridge.lock(1_000_000 ether, POLYGON_CHAIN_ID);
        vm.stopPrank();
    }

    function testLockWhenPausedReverts() public {
        vm.prank(admin);
        bridge.pause();

        vm.startPrank(user);
        bez.approve(address(bridge), 100 ether);
        vm.expectRevert();
        bridge.lock(100 ether, POLYGON_CHAIN_ID);
        vm.stopPrank();
    }

    // ─── Unlock Tests ───────────────────────────────

    function testUnlock() public {
        // First lock some tokens
        vm.startPrank(user);
        bez.approve(address(bridge), 1000 ether);
        bridge.lock(1000 ether, POLYGON_CHAIN_ID);
        vm.stopPrank();

        uint256 balBefore = bez.balanceOf(user);

        // Relayer unlocks
        vm.prank(relayer);
        bridge.unlock(user, 500 ether, bytes32("polygonTx1"));

        assertEq(bez.balanceOf(user), balBefore + 500 ether);
        assertTrue(bridge.isProcessed(bytes32("polygonTx1")));
    }

    function testUnlockOnlyRelayer() public {
        vm.startPrank(user);
        bez.approve(address(bridge), 1000 ether);
        bridge.lock(1000 ether, POLYGON_CHAIN_ID);
        vm.stopPrank();

        vm.expectRevert();
        vm.prank(user);
        bridge.unlock(user, 500 ether, bytes32("badTx"));
    }

    function testUnlockReplayProtection() public {
        vm.startPrank(user);
        bez.approve(address(bridge), 2000 ether);
        bridge.lock(2000 ether, POLYGON_CHAIN_ID);
        vm.stopPrank();

        vm.prank(relayer);
        bridge.unlock(user, 500 ether, bytes32("txReplay"));

        vm.expectRevert("Already processed");
        vm.prank(relayer);
        bridge.unlock(user, 500 ether, bytes32("txReplay"));
    }

    // ─── Admin Tests ────────────────────────────────

    function testWithdrawFees() public {
        vm.startPrank(user);
        bez.approve(address(bridge), 10000 ether);
        bridge.lock(10000 ether, POLYGON_CHAIN_ID);
        vm.stopPrank();

        uint256 fees = bridge.totalFees();
        assertTrue(fees > 0);

        uint256 balBefore = bez.balanceOf(admin);
        vm.prank(admin);
        bridge.withdrawFees(admin);
        assertEq(bez.balanceOf(admin), balBefore + fees);
        assertEq(bridge.totalFees(), 0);
    }

    function testSetFeeRate() public {
        vm.prank(admin);
        bridge.setFeeRate(50); // 0.5%
        assertEq(bridge.bridgeFeeRate(), 50);
    }

    function testSetFeeRateTooHigh() public {
        vm.expectRevert("Fee too high");
        vm.prank(admin);
        bridge.setFeeRate(600); // 6% > 5% max
    }

    function testPauseUnpause() public {
        vm.prank(admin);
        bridge.pause();
        assertTrue(bridge.paused());

        vm.prank(admin);
        bridge.unpause();
        assertFalse(bridge.paused());
    }

    // ─── Nonce Tests ────────────────────────────────

    function testNonceIncrements() public {
        vm.startPrank(user);
        bez.approve(address(bridge), 3000 ether);
        bridge.lock(1000 ether, POLYGON_CHAIN_ID);
        assertEq(bridge.nonces(user), 1);
        bridge.lock(1000 ether, POLYGON_CHAIN_ID);
        assertEq(bridge.nonces(user), 2);
        vm.stopPrank();
    }
}
