// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/finance/InvoiceFactoring.sol";

contract InvoiceFactoringTest is Test {
    InvoiceFactoring inv;
    address admin = address(this);
    address factor = address(0xA1);
    address seller1 = address(0xB1);
    address seller2 = address(0xB2);
    address debtor = address(0xC1);
    address treasury = address(0xD1);

    function setUp() public {
        inv = new InvoiceFactoring(treasury);
        inv.grantRole(inv.FACTOR_ROLE(), factor);
        vm.deal(factor, 100 ether);
        vm.deal(debtor, 100 ether);
    }

    // ── submitInvoice ──────────────────
    function testSubmitInvoice() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        (uint256 rid, address s, address d, uint256 fv, uint256 dbps, uint256 fa, uint256 dd, InvoiceFactoring.InvoiceStatus st, uint256 ca) = inv.invoices(id);
        assertEq(s, seller1);
        assertEq(d, debtor);
        assertEq(fv, 10 ether);
        assertEq(dbps, 500);
        assertEq(uint8(st), uint8(InvoiceFactoring.InvoiceStatus.SUBMITTED));
    }

    function testSubmitInvoiceRevertZeroDebtor() public {
        vm.prank(seller1);
        vm.expectRevert("Invalid debtor");
        inv.submitInvoice(address(0), 10 ether, 500, block.timestamp + 30 days);
    }

    function testSubmitInvoiceRevertZeroFaceValue() public {
        vm.prank(seller1);
        vm.expectRevert("Face value must be > 0");
        inv.submitInvoice(debtor, 0, 500, block.timestamp + 30 days);
    }

    function testSubmitInvoiceRevertDiscountTooHigh() public {
        vm.prank(seller1);
        vm.expectRevert("Discount too high");
        inv.submitInvoice(debtor, 10 ether, 3001, block.timestamp + 30 days);
    }

    function testSubmitInvoiceRevertPastDueDate() public {
        vm.prank(seller1);
        vm.expectRevert("Due date must be future");
        inv.submitInvoice(debtor, 10 ether, 500, block.timestamp - 1);
    }

    // ── approveInvoice ──────────────────
    function testApproveInvoice() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(factor);
        inv.approveInvoice(id);
        (, , , , , , , InvoiceFactoring.InvoiceStatus st,) = inv.invoices(id);
        assertEq(uint8(st), uint8(InvoiceFactoring.InvoiceStatus.APPROVED));
    }

    function testApproveInvoiceRevertNotSubmitted() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.startPrank(factor);
        inv.approveInvoice(id);
        vm.expectRevert("Not submitted");
        inv.approveInvoice(id);
        vm.stopPrank();
    }

    // ── fundInvoice ──────────────────
    function testFundInvoice() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(factor);
        inv.approveInvoice(id);

        // discounted = 10 ether - 5% = 9.5 ether
        uint256 sellerBalBefore = seller1.balance;
        vm.prank(factor);
        inv.fundInvoice{value: 9.5 ether}(id);

        (, , , , , uint256 fa, , InvoiceFactoring.InvoiceStatus st,) = inv.invoices(id);
        assertEq(fa, 9.5 ether);
        assertEq(uint8(st), uint8(InvoiceFactoring.InvoiceStatus.FUNDED));
        // Seller receives funded amount minus 1% platform fee
        uint256 fee = (9.5 ether * 100) / 10_000;
        assertEq(seller1.balance, sellerBalBefore + 9.5 ether - fee);
    }

    function testFundInvoiceRevertNotApproved() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(factor);
        vm.expectRevert("Not approved");
        inv.fundInvoice{value: 9.5 ether}(id);
    }

    function testFundInvoiceRevertWrongAmount() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(factor);
        inv.approveInvoice(id);
        vm.prank(factor);
        vm.expectRevert("Must match discounted amount");
        inv.fundInvoice{value: 8 ether}(id);
    }

    // ── repayInvoice ──────────────────
    function testRepayInvoice() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.startPrank(factor);
        inv.approveInvoice(id);
        inv.fundInvoice{value: 9.5 ether}(id);
        vm.stopPrank();

        vm.prank(debtor);
        inv.repayInvoice{value: 10 ether}(id);
        (, , , , , , , InvoiceFactoring.InvoiceStatus st,) = inv.invoices(id);
        assertEq(uint8(st), uint8(InvoiceFactoring.InvoiceStatus.REPAID));
    }

    function testRepayInvoiceRevertNotFunded() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(debtor);
        vm.expectRevert("Not funded");
        inv.repayInvoice{value: 10 ether}(id);
    }

    function testRepayInvoiceRevertWrongAmount() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.startPrank(factor);
        inv.approveInvoice(id);
        inv.fundInvoice{value: 9.5 ether}(id);
        vm.stopPrank();

        vm.prank(debtor);
        vm.expectRevert("Must pay face value");
        inv.repayInvoice{value: 5 ether}(id);
    }

    // ── markDefaulted ──────────────────
    function testMarkDefaulted() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.startPrank(factor);
        inv.approveInvoice(id);
        inv.fundInvoice{value: 9.5 ether}(id);
        vm.stopPrank();

        vm.warp(block.timestamp + 31 days);
        vm.prank(factor);
        inv.markDefaulted(id);
        (, , , , , , , InvoiceFactoring.InvoiceStatus st,) = inv.invoices(id);
        assertEq(uint8(st), uint8(InvoiceFactoring.InvoiceStatus.DEFAULTED));
    }

    function testMarkDefaultedRevertNotPastDue() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.startPrank(factor);
        inv.approveInvoice(id);
        inv.fundInvoice{value: 9.5 ether}(id);
        vm.stopPrank();

        vm.prank(factor);
        vm.expectRevert("Not past due");
        inv.markDefaulted(id);
    }

    // ── cancelInvoice ──────────────────
    function testCancelInvoice() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(seller1);
        inv.cancelInvoice(id);
        (, , , , , , , InvoiceFactoring.InvoiceStatus st,) = inv.invoices(id);
        assertEq(uint8(st), uint8(InvoiceFactoring.InvoiceStatus.CANCELLED));
    }

    function testCancelInvoiceRevertNotSubmitted() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(factor);
        inv.approveInvoice(id);
        vm.prank(seller1);
        vm.expectRevert("Cannot cancel");
        inv.cancelInvoice(id);
    }

    function testCancelInvoiceRevertNotSeller() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(seller2);
        vm.expectRevert("Not seller");
        inv.cancelInvoice(id);
    }

    // ── withdrawRepaid ──────────────────
    function testWithdrawRepaid() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.startPrank(factor);
        inv.approveInvoice(id);
        inv.fundInvoice{value: 9.5 ether}(id);
        vm.stopPrank();

        vm.prank(debtor);
        inv.repayInvoice{value: 10 ether}(id);

        uint256 factorBalBefore = factor.balance;
        vm.prank(factor);
        inv.withdrawRepaid(id);
        assertEq(factor.balance, factorBalBefore + 10 ether);
    }

    function testWithdrawRepaidRevertNotRepaid() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.prank(factor);
        vm.expectRevert("Not repaid");
        inv.withdrawRepaid(id);
    }

    // ── View helpers ──────────────────
    function testGetSellerInvoices() public {
        vm.startPrank(seller1);
        inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        inv.submitInvoice(debtor, 20 ether, 300, block.timestamp + 60 days);
        vm.stopPrank();
        uint256[] memory ids = inv.getSellerInvoices(seller1);
        assertEq(ids.length, 2);
    }

    function testGetDiscountedAmount() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        // 10 ether - 5% = 9.5 ether
        assertEq(inv.getDiscountedAmount(id), 9.5 ether);
    }

    function testIsOverdue() public {
        vm.prank(seller1);
        uint256 id = inv.submitInvoice(debtor, 10 ether, 500, block.timestamp + 30 days);
        vm.startPrank(factor);
        inv.approveInvoice(id);
        inv.fundInvoice{value: 9.5 ether}(id);
        vm.stopPrank();

        assertFalse(inv.isOverdue(id));
        vm.warp(block.timestamp + 31 days);
        assertTrue(inv.isOverdue(id));
    }
}
