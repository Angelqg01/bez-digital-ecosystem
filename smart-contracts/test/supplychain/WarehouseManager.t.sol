// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/WarehouseManager.sol";

contract WarehouseManagerTest is Test {
    WarehouseManager wm;
    address admin = address(this);
    address op1 = address(0xA1);
    address op2 = address(0xA2);

    function setUp() public {
        wm = new WarehouseManager();
        wm.grantRole(wm.WAREHOUSE_ROLE(), op1);
        wm.grantRole(wm.WAREHOUSE_ROLE(), op2);
    }

    // Helper
    function _registerWarehouse(uint256 cap) internal returns (uint256) {
        vm.prank(op1);
        return wm.registerWarehouse(keccak256("WH-A"), cap);
    }

    function _receiveLot(uint256 wid, uint256 qty) internal returns (uint256) {
        vm.prank(op1);
        return wm.receiveLot(wid, keccak256("ProductA"), qty, block.timestamp + 365 days);
    }

    // ── registerWarehouse ──────────────────
    function testRegisterWarehouse() public {
        uint256 wid = _registerWarehouse(1000);
        (uint256 id, bytes32 n, address op, uint256 cap, uint256 used, bool act) = wm.warehouses(wid);
        assertEq(id, 0);
        assertEq(op, op1);
        assertEq(cap, 1000);
        assertEq(used, 0);
        assertTrue(act);
    }

    function testRegisterWarehouseRevertZeroCapacity() public {
        vm.prank(op1);
        vm.expectRevert("Capacity must be > 0");
        wm.registerWarehouse(keccak256("x"), 0);
    }

    // ── receiveLot ──────────────────
    function testReceiveLot() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 200);
        (uint256 id, uint256 whId, bytes32 ph, uint256 qty, uint256 exp, WarehouseManager.LotStatus st, uint256 cat) = wm.lots(lid);
        assertEq(whId, wid);
        assertEq(qty, 200);
        assertEq(uint8(st), uint8(WarehouseManager.LotStatus.ACTIVE));
        (, , , , uint256 used,) = wm.warehouses(wid);
        assertEq(used, 200);
    }

    function testReceiveLotRevertExceedsCapacity() public {
        uint256 wid = _registerWarehouse(100);
        vm.prank(op1);
        vm.expectRevert("Exceeds capacity");
        wm.receiveLot(wid, keccak256("x"), 200, block.timestamp + 1 days);
    }

    function testReceiveLotRevertAlreadyExpired() public {
        uint256 wid = _registerWarehouse(1000);
        vm.prank(op1);
        vm.expectRevert("Already expired");
        wm.receiveLot(wid, keccak256("x"), 50, block.timestamp - 1);
    }

    // ── reserveLot ──────────────────
    function testReserveLot() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 100);
        vm.prank(op1);
        wm.reserveLot(lid);
        (, , , , , WarehouseManager.LotStatus st,) = wm.lots(lid);
        assertEq(uint8(st), uint8(WarehouseManager.LotStatus.RESERVED));
    }

    function testReserveLotRevertNotActive() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 100);
        vm.prank(op1);
        wm.reserveLot(lid);
        vm.prank(op1);
        vm.expectRevert("Not active");
        wm.reserveLot(lid);
    }

    // ── consumeLot ──────────────────
    function testConsumeLotPartially() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 100);
        vm.prank(op1);
        wm.consumeLot(lid, 30);
        (, , , uint256 qty, , WarehouseManager.LotStatus st,) = wm.lots(lid);
        assertEq(qty, 70);
        assertEq(uint8(st), uint8(WarehouseManager.LotStatus.ACTIVE));
    }

    function testConsumeLotFully() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 100);
        vm.prank(op1);
        wm.consumeLot(lid, 100);
        (, , , uint256 qty, , WarehouseManager.LotStatus st,) = wm.lots(lid);
        assertEq(qty, 0);
        assertEq(uint8(st), uint8(WarehouseManager.LotStatus.CONSUMED));
    }

    function testConsumeLotRevertExcessQuantity() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 100);
        vm.prank(op1);
        vm.expectRevert("Invalid quantity");
        wm.consumeLot(lid, 200);
    }

    // ── markExpired ──────────────────
    function testMarkExpired() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 100);
        vm.warp(block.timestamp + 366 days);
        vm.prank(op1);
        wm.markExpired(lid);
        (, , , , , WarehouseManager.LotStatus st,) = wm.lots(lid);
        assertEq(uint8(st), uint8(WarehouseManager.LotStatus.EXPIRED));
        (, , , , uint256 used,) = wm.warehouses(wid);
        assertEq(used, 0);
    }

    function testMarkExpiredRevertNotYet() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 100);
        vm.prank(op1);
        vm.expectRevert("Not yet expired");
        wm.markExpired(lid);
    }

    // ── transferLot ──────────────────
    function testTransferLot() public {
        uint256 wid1 = _registerWarehouse(1000);
        vm.prank(op1);
        uint256 wid2 = wm.registerWarehouse(keccak256("WH-B"), 500);
        uint256 lid = _receiveLot(wid1, 200);

        vm.prank(op1);
        uint256 tid = wm.transferLot(lid, wid2);

        // Old lot marked TRANSFERRED
        (, , , , , WarehouseManager.LotStatus st,) = wm.lots(lid);
        assertEq(uint8(st), uint8(WarehouseManager.LotStatus.TRANSFERRED));

        // Source capacity freed, destination capacity used
        (, , , , uint256 used1,) = wm.warehouses(wid1);
        assertEq(used1, 0);
        (, , , , uint256 used2,) = wm.warehouses(wid2);
        assertEq(used2, 200);
    }

    function testTransferLotRevertExceedsDestCapacity() public {
        uint256 wid1 = _registerWarehouse(1000);
        vm.prank(op1);
        uint256 wid2 = wm.registerWarehouse(keccak256("WH-B"), 50);
        uint256 lid = _receiveLot(wid1, 200);

        vm.prank(op1);
        vm.expectRevert("Exceeds destination capacity");
        wm.transferLot(lid, wid2);
    }

    // ── deactivateWarehouse ──────────────────
    function testDeactivateWarehouse() public {
        uint256 wid = _registerWarehouse(1000);
        vm.prank(op1);
        wm.deactivateWarehouse(wid);
        (, , , , , bool act) = wm.warehouses(wid);
        assertFalse(act);
    }

    function testDeactivateWarehouseRevertNotEmpty() public {
        uint256 wid = _registerWarehouse(1000);
        _receiveLot(wid, 100);
        vm.prank(op1);
        vm.expectRevert("Warehouse not empty");
        wm.deactivateWarehouse(wid);
    }

    // ── View helpers ──────────────────
    function testGetWarehouseLots() public {
        uint256 wid = _registerWarehouse(1000);
        _receiveLot(wid, 100);
        _receiveLot(wid, 200);
        uint256[] memory lids = wm.getWarehouseLots(wid);
        assertEq(lids.length, 2);
    }

    function testIsLotExpired() public {
        uint256 wid = _registerWarehouse(1000);
        uint256 lid = _receiveLot(wid, 100);
        assertFalse(wm.isLotExpired(lid));
        vm.warp(block.timestamp + 366 days);
        assertTrue(wm.isLotExpired(lid));
    }
}
