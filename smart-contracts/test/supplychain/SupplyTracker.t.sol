// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/SupplyTracker.sol";

contract SupplyTrackerTest is Test {
    SupplyTracker tracker;
    address admin = address(this);
    address operator = address(0xA1);
    address sender1 = address(0xB1);
    address receiver1 = address(0xC1);

    function setUp() public {
        tracker = new SupplyTracker();
        tracker.grantRole(tracker.OPERATOR_ROLE(), operator);
    }

    // ── createShipment ──────────────────
    function testCreateShipment() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("items"), 500);
        (uint256 id, address snd, address rcv, bytes32 h, uint256 cat, uint256 dat, SupplyTracker.ShipmentStatus st, uint256 cpc, uint256 w) = tracker.shipments(sid);
        assertEq(id, 0);
        assertEq(snd, sender1);
        assertEq(rcv, receiver1);
        assertEq(h, keccak256("items"));
        assertEq(w, 500);
        assertEq(uint8(st), uint8(SupplyTracker.ShipmentStatus.CREATED));
        assertEq(cpc, 0);
        assertGt(cat, 0);
        assertEq(dat, 0);
    }

    function testCreateShipmentRevertZeroReceiver() public {
        vm.expectRevert("Invalid receiver");
        tracker.createShipment(address(0), keccak256("x"), 100);
    }

    function testCreateShipmentRevertZeroWeight() public {
        vm.expectRevert("Weight must be > 0");
        tracker.createShipment(receiver1, keccak256("x"), 0);
    }

    function testSenderShipments() public {
        vm.startPrank(sender1);
        tracker.createShipment(receiver1, keccak256("a"), 100);
        tracker.createShipment(receiver1, keccak256("b"), 200);
        vm.stopPrank();
        uint256[] memory ids = tracker.getSenderShipments(sender1);
        assertEq(ids.length, 2);
    }

    // ── recordCheckpoint ──────────────────
    function testRecordCheckpoint() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("items"), 500);
        vm.prank(operator);
        uint256 cpId = tracker.recordCheckpoint(sid, SupplyTracker.CheckpointType.ORIGIN, keccak256("loc"), -5);
        (uint256 shipId, SupplyTracker.CheckpointType cpt, bytes32 loc, uint256 ts, int256 temp, address ver) = tracker.checkpoints(cpId);
        assertEq(shipId, sid);
        assertEq(uint8(cpt), uint8(SupplyTracker.CheckpointType.ORIGIN));
        assertEq(loc, keccak256("loc"));
        assertEq(temp, -5);
        assertEq(ver, operator);
        assertGt(ts, 0);
    }

    function testRecordCheckpointRevertUnauthorized() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(sender1);
        vm.expectRevert();
        tracker.recordCheckpoint(sid, SupplyTracker.CheckpointType.WAREHOUSE, keccak256("l"), 0);
    }

    function testRecordCheckpointRevertDelivered() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(receiver1);
        tracker.confirmDelivery(sid);
        vm.prank(operator);
        vm.expectRevert("Not trackable");
        tracker.recordCheckpoint(sid, SupplyTracker.CheckpointType.PORT, keccak256("l"), 0);
    }

    function testGetShipmentCheckpoints() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.startPrank(operator);
        tracker.recordCheckpoint(sid, SupplyTracker.CheckpointType.ORIGIN, keccak256("a"), 0);
        tracker.recordCheckpoint(sid, SupplyTracker.CheckpointType.CUSTOMS, keccak256("b"), 10);
        vm.stopPrank();
        uint256[] memory cps = tracker.getShipmentCheckpoints(sid);
        assertEq(cps.length, 2);
    }

    // ── markInTransit ──────────────────
    function testMarkInTransit() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(operator);
        tracker.markInTransit(sid);
        (, , , , , , SupplyTracker.ShipmentStatus st, ,) = tracker.shipments(sid);
        assertEq(uint8(st), uint8(SupplyTracker.ShipmentStatus.IN_TRANSIT));
    }

    function testMarkInTransitRevertCancelled() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(sender1);
        tracker.cancelShipment(sid);
        vm.prank(operator);
        vm.expectRevert("Cannot transition");
        tracker.markInTransit(sid);
    }

    // ── confirmDelivery ──────────────────
    function testConfirmDelivery() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(receiver1);
        tracker.confirmDelivery(sid);
        (, , , , , uint256 dat, SupplyTracker.ShipmentStatus st, ,) = tracker.shipments(sid);
        assertEq(uint8(st), uint8(SupplyTracker.ShipmentStatus.DELIVERED));
        assertGt(dat, 0);
    }

    function testConfirmDeliveryRevertNotReceiver() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(sender1);
        vm.expectRevert("Not receiver");
        tracker.confirmDelivery(sid);
    }

    // ── cancelShipment ──────────────────
    function testCancelShipment() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(sender1);
        tracker.cancelShipment(sid);
        (, , , , , , SupplyTracker.ShipmentStatus st, ,) = tracker.shipments(sid);
        assertEq(uint8(st), uint8(SupplyTracker.ShipmentStatus.CANCELLED));
    }

    function testCancelShipmentRevertNotSender() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(receiver1);
        vm.expectRevert("Not sender");
        tracker.cancelShipment(sid);
    }

    function testCancelShipmentRevertAlreadyDelivered() public {
        vm.prank(sender1);
        uint256 sid = tracker.createShipment(receiver1, keccak256("x"), 100);
        vm.prank(receiver1);
        tracker.confirmDelivery(sid);
        vm.prank(sender1);
        vm.expectRevert("Already closed");
        tracker.cancelShipment(sid);
    }
}
