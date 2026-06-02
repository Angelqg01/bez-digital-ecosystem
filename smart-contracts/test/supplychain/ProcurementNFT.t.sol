// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/ProcurementNFT.sol";

contract ProcurementNFTTest is Test {
    ProcurementNFT proc;
    address admin = address(this);
    address approver1 = address(0xA1);
    address approver2 = address(0xA2);
    address buyer1 = address(0xB1);
    address supplier1 = address(0xC1);

    function setUp() public {
        proc = new ProcurementNFT();
        proc.grantRole(proc.PROCUREMENT_ROLE(), approver1);
        proc.grantRole(proc.PROCUREMENT_ROLE(), approver2);
        vm.deal(buyer1, 100 ether);
    }

    // Helper
    function _createPO() internal returns (uint256) {
        vm.prank(buyer1);
        return proc.createPO{value: 1 ether}(supplier1, keccak256("items"), 1 ether, 2);
    }

    // ── createPO ──────────────────
    function testCreatePO() public {
        uint256 poId = _createPO();
        (uint256 id, address b, address s, bytes32 h, uint256 amt, uint256 cat, uint256 sat, ProcurementNFT.POStatus st, uint256 ac, uint256 ra) = proc.purchaseOrders(poId);
        assertEq(id, 0);
        assertEq(b, buyer1);
        assertEq(s, supplier1);
        assertEq(amt, 1 ether);
        assertEq(uint8(st), uint8(ProcurementNFT.POStatus.DRAFT));
        assertEq(ra, 2);
        assertEq(ac, 0);
        assertEq(proc.escrow(poId), 1 ether);
    }

    function testCreatePORevertZeroSupplier() public {
        vm.prank(buyer1);
        vm.expectRevert("Invalid supplier");
        proc.createPO{value: 1 ether}(address(0), keccak256("x"), 1 ether, 1);
    }

    function testCreatePORevertInsufficientEscrow() public {
        vm.prank(buyer1);
        vm.expectRevert("Insufficient escrow");
        proc.createPO{value: 0.5 ether}(supplier1, keccak256("x"), 1 ether, 1);
    }

    // ── submitForApproval ──────────────────
    function testSubmitForApproval() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);
        (, , , , , , , ProcurementNFT.POStatus st, ,) = proc.purchaseOrders(poId);
        assertEq(uint8(st), uint8(ProcurementNFT.POStatus.PENDING_APPROVAL));
    }

    function testSubmitForApprovalRevertNotBuyer() public {
        uint256 poId = _createPO();
        vm.prank(supplier1);
        vm.expectRevert("Not buyer");
        proc.submitForApproval(poId);
    }

    // ── approvePO (multi-approval) ──────────────────
    function testApprovePOSingleApproval() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);

        vm.prank(approver1);
        proc.approvePO(poId);
        (, , , , , , , ProcurementNFT.POStatus st, uint256 ac,) = proc.purchaseOrders(poId);
        assertEq(ac, 1);
        assertEq(uint8(st), uint8(ProcurementNFT.POStatus.PENDING_APPROVAL));
    }

    function testApprovePOFullApproval() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);

        vm.prank(approver1);
        proc.approvePO(poId);
        vm.prank(approver2);
        proc.approvePO(poId);
        (, , , , , , , ProcurementNFT.POStatus st, uint256 ac,) = proc.purchaseOrders(poId);
        assertEq(ac, 2);
        assertEq(uint8(st), uint8(ProcurementNFT.POStatus.APPROVED));
    }

    function testApprovePORevertDoubleApproval() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);
        vm.prank(approver1);
        proc.approvePO(poId);
        vm.prank(approver1);
        vm.expectRevert("Already approved");
        proc.approvePO(poId);
    }

    // ── markShipped ──────────────────
    function testMarkShipped() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);
        vm.prank(approver1);
        proc.approvePO(poId);
        vm.prank(approver2);
        proc.approvePO(poId);

        vm.prank(supplier1);
        proc.markShipped(poId);
        (, , , , , , , ProcurementNFT.POStatus st, ,) = proc.purchaseOrders(poId);
        assertEq(uint8(st), uint8(ProcurementNFT.POStatus.SHIPPED));
    }

    function testMarkShippedRevertNotSupplier() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);
        vm.prank(approver1);
        proc.approvePO(poId);
        vm.prank(approver2);
        proc.approvePO(poId);
        vm.prank(buyer1);
        vm.expectRevert("Not supplier");
        proc.markShipped(poId);
    }

    // ── confirmReceipt ──────────────────
    function testConfirmReceipt() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);
        vm.prank(approver1);
        proc.approvePO(poId);
        vm.prank(approver2);
        proc.approvePO(poId);
        vm.prank(supplier1);
        proc.markShipped(poId);

        vm.prank(buyer1);
        proc.confirmReceipt(poId);
        (, , , , , , , ProcurementNFT.POStatus st, ,) = proc.purchaseOrders(poId);
        assertEq(uint8(st), uint8(ProcurementNFT.POStatus.RECEIVED));
    }

    // ── settle ──────────────────
    function testSettle() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);
        vm.prank(approver1);
        proc.approvePO(poId);
        vm.prank(approver2);
        proc.approvePO(poId);
        vm.prank(supplier1);
        proc.markShipped(poId);
        vm.prank(buyer1);
        proc.confirmReceipt(poId);

        uint256 balBefore = supplier1.balance;
        vm.prank(buyer1);
        proc.settle(poId);
        assertEq(supplier1.balance - balBefore, 1 ether);
        assertEq(proc.escrow(poId), 0);
        (, , , , , , , ProcurementNFT.POStatus st, ,) = proc.purchaseOrders(poId);
        assertEq(uint8(st), uint8(ProcurementNFT.POStatus.SETTLED));
    }

    // ── cancelPO ──────────────────
    function testCancelPO() public {
        uint256 poId = _createPO();
        uint256 balBefore = buyer1.balance;
        vm.prank(buyer1);
        proc.cancelPO(poId);
        assertEq(buyer1.balance - balBefore, 1 ether);
        (, , , , , , , ProcurementNFT.POStatus st, ,) = proc.purchaseOrders(poId);
        assertEq(uint8(st), uint8(ProcurementNFT.POStatus.CANCELLED));
    }

    function testCancelPORevertAfterApproval() public {
        uint256 poId = _createPO();
        vm.prank(buyer1);
        proc.submitForApproval(poId);
        vm.prank(approver1);
        proc.approvePO(poId);
        vm.prank(approver2);
        proc.approvePO(poId);
        vm.prank(buyer1);
        vm.expectRevert("Cannot cancel");
        proc.cancelPO(poId);
    }

    // ── View helpers ──────────────────
    function testGetBuyerOrders() public {
        _createPO();
        _createPO();
        uint256[] memory ids = proc.getBuyerOrders(buyer1);
        assertEq(ids.length, 2);
    }

    function testGetSupplierOrders() public {
        _createPO();
        uint256[] memory ids = proc.getSupplierOrders(supplier1);
        assertEq(ids.length, 1);
    }
}
