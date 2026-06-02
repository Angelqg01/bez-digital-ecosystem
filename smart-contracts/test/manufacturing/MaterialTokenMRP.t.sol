// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/manufacturing/MaterialTokenMRP.sol";

contract MaterialTokenMRPTest is Test {
    MaterialTokenMRP mrp;
    address manager = address(0xA1);
    address other   = address(0xB2);

    function setUp() public {
        mrp = new MaterialTokenMRP();
        mrp.grantRole(mrp.MANAGER_ROLE(), manager);
        vm.deal(manager, 100 ether);
    }

    function testRegisterMaterial() public {
        vm.startPrank(manager);
        uint256 id = mrp.registerMaterial("AL6061-3mm", "6061-T6 Aluminum Sheet", 4.8 ether, 3000);
        vm.stopPrank();

        (string memory sku, string memory name,,, uint256 supply,, bool active) = mrp.materials(id);
        assertEq(sku, "AL6061-3mm");
        assertEq(name, "6061-T6 Aluminum Sheet");
        assertEq(supply, 0);
        assertTrue(active);
    }

    function testRegisterEmptySkuReverts() public {
        vm.startPrank(manager);
        vm.expectRevert("Empty SKU");
        mrp.registerMaterial("", "Name", 1 ether, 100);
        vm.stopPrank();
    }

    function testCreatePurchaseOrder() public {
        vm.startPrank(manager);
        uint256 matId = mrp.registerMaterial("CATL-LFP", "CATL Cell", 1 ether, 500);
        uint256 poId = mrp.createPurchaseOrder{value: 10 ether}(matId, 10);
        vm.stopPrank();

        (uint256 materialId,, uint256 qty, uint256 cost,, MaterialTokenMRP.OrderStatus status) = mrp.orders(poId);
        assertEq(materialId, matId);
        assertEq(qty, 10);
        assertEq(cost, 10 ether);
        assertEq(uint(status), uint(MaterialTokenMRP.OrderStatus.PENDING));
    }

    function testCreatePOInsufficientPaymentReverts() public {
        vm.startPrank(manager);
        uint256 matId = mrp.registerMaterial("X", "X", 5 ether, 10);
        vm.expectRevert("Insufficient payment");
        mrp.createPurchaseOrder{value: 1 ether}(matId, 10);
        vm.stopPrank();
    }

    function testConfirmOrder() public {
        vm.startPrank(manager);
        uint256 matId = mrp.registerMaterial("Y", "Y", 1 ether, 10);
        uint256 poId = mrp.createPurchaseOrder{value: 5 ether}(matId, 5);
        mrp.confirmOrder(poId);
        vm.stopPrank();

        (,,,,, MaterialTokenMRP.OrderStatus status) = mrp.orders(poId);
        assertEq(uint(status), uint(MaterialTokenMRP.OrderStatus.CONFIRMED));
    }

    function testReceiveOrder() public {
        vm.startPrank(manager);
        uint256 matId = mrp.registerMaterial("Z", "Z", 1 ether, 10);
        uint256 poId = mrp.createPurchaseOrder{value: 5 ether}(matId, 5);
        mrp.confirmOrder(poId);
        mrp.receiveOrder(poId, 5, keccak256("quality-proof"));
        vm.stopPrank();

        (,,,, uint256 supply,,) = mrp.materials(matId);
        assertEq(supply, 5);
    }

    function testReceiveNotConfirmedReverts() public {
        vm.startPrank(manager);
        uint256 matId = mrp.registerMaterial("W", "W", 1 ether, 10);
        uint256 poId = mrp.createPurchaseOrder{value: 3 ether}(matId, 3);
        vm.expectRevert("Not confirmed");
        mrp.receiveOrder(poId, 3, keccak256("proof"));
        vm.stopPrank();
    }

    function testAddBOMEntry() public {
        vm.startPrank(manager);
        uint256 matId = mrp.registerMaterial("BOLT", "M8x30 Bolt", 0.01 ether, 10000);
        mrp.addBOMEntry(1, matId, 64);
        vm.stopPrank();

        assertEq(mrp.totalBOMEntries(), 1);
        (uint256 prodId, uint256 mid, uint256 qty) = mrp.bomEntries(0);
        assertEq(prodId, 1);
        assertEq(mid, matId);
        assertEq(qty, 64);
    }

    function testConsumeMaterial() public {
        vm.startPrank(manager);
        uint256 matId = mrp.registerMaterial("PA6", "Nylon Pellets", 1 ether, 5000);
        uint256 poId = mrp.createPurchaseOrder{value: 100 ether}(matId, 100);
        mrp.confirmOrder(poId);
        mrp.receiveOrder(poId, 100, keccak256("qc"));
        mrp.consumeMaterial(matId, 30);
        vm.stopPrank();

        (,,,, uint256 supply,,) = mrp.materials(matId);
        assertEq(supply, 70);
        assertEq(mrp.totalConsumed(), 30);
    }

    function testConsumeInsufficientReverts() public {
        vm.startPrank(manager);
        uint256 matId = mrp.registerMaterial("T", "T", 1 ether, 10);
        vm.expectRevert("Insufficient supply");
        mrp.consumeMaterial(matId, 1);
        vm.stopPrank();
    }
}
