// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/finance/MicroLendingPool.sol";

contract MicroLendingPoolTest is Test {
    MicroLendingPool pool;
    address admin = address(this);
    address lender = address(0xA1);
    address borrower1 = address(0xB1);
    address borrower2 = address(0xB2);
    address treasury = address(0xD1);

    function setUp() public {
        pool = new MicroLendingPool(treasury);
        pool.grantRole(pool.LENDER_ROLE(), lender);
        vm.deal(borrower1, 100 ether);
        vm.deal(borrower2, 100 ether);
        vm.deal(lender, 100 ether);
    }

    // ── requestLoan ──────────────────
    function testRequestLoan() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        (uint256 rid, address b, address l, uint256 p, uint256 iBps, uint256 c, uint256 rep, uint256 dur, uint256 fa, MicroLendingPool.LoanStatus s) = pool.loans(id);
        assertEq(b, borrower1);
        assertEq(p, 5 ether);
        assertEq(iBps, 500);
        assertEq(c, 1 ether);
        assertEq(dur, 30 days);
        assertEq(uint8(s), uint8(MicroLendingPool.LoanStatus.REQUESTED));
    }

    function testRequestLoanRevertZeroPrincipal() public {
        vm.prank(borrower1);
        vm.expectRevert("Principal must be > 0");
        pool.requestLoan{value: 1 ether}(0, 500, 30 days);
    }

    function testRequestLoanRevertNoCollateral() public {
        vm.prank(borrower1);
        vm.expectRevert("Collateral required");
        pool.requestLoan(5 ether, 500, 30 days);
    }

    function testRequestLoanRevertInterestTooHigh() public {
        vm.prank(borrower1);
        vm.expectRevert("Interest too high");
        pool.requestLoan{value: 1 ether}(5 ether, 5001, 30 days);
    }

    // ── fundLoan ──────────────────
    function testFundLoan() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);

        uint256 borrowerBalBefore = borrower1.balance;
        vm.prank(lender);
        pool.fundLoan{value: 5 ether}(id);

        (, , address l, , , , , , uint256 fa, MicroLendingPool.LoanStatus s) = pool.loans(id);
        assertEq(l, lender);
        assertEq(uint8(s), uint8(MicroLendingPool.LoanStatus.FUNDED));
        assertGt(fa, 0);
        // Borrower receives principal minus 1% origination fee
        uint256 expectedNet = 5 ether - (5 ether * 100 / 10_000); // 4.95 ether
        assertEq(borrower1.balance, borrowerBalBefore + expectedNet);
    }

    function testFundLoanRevertNotRequested() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(lender);
        pool.fundLoan{value: 5 ether}(id);

        vm.prank(lender);
        vm.expectRevert("Not requested");
        pool.fundLoan{value: 5 ether}(id);
    }

    function testFundLoanRevertWrongAmount() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(lender);
        vm.expectRevert("Must match principal");
        pool.fundLoan{value: 3 ether}(id);
    }

    // ── repay ──────────────────
    function testRepayPartial() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(lender);
        pool.fundLoan{value: 5 ether}(id);

        vm.prank(borrower1);
        pool.repay{value: 1 ether}(id);
        (, , , , , , uint256 rep, , , MicroLendingPool.LoanStatus s) = pool.loans(id);
        assertEq(rep, 1 ether);
        assertEq(uint8(s), uint8(MicroLendingPool.LoanStatus.REPAYING));
    }

    function testRepayFullCloses() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 2 ether}(5 ether, 1000, 30 days);
        vm.prank(lender);
        pool.fundLoan{value: 5 ether}(id);

        // total owed = 5 ether + 10% = 5.5 ether
        vm.prank(borrower1);
        pool.repay{value: 5.5 ether}(id);
        (, , , , , , , , , MicroLendingPool.LoanStatus s) = pool.loans(id);
        assertEq(uint8(s), uint8(MicroLendingPool.LoanStatus.CLOSED));
    }

    function testRepayRevertNotActive() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(borrower1);
        vm.expectRevert("Not active");
        pool.repay{value: 1 ether}(id);
    }

    function testRepayRevertNotBorrower() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(lender);
        pool.fundLoan{value: 5 ether}(id);

        vm.prank(borrower2);
        vm.expectRevert("Not borrower");
        pool.repay{value: 1 ether}(id);
    }

    // ── markDefault ──────────────────
    function testMarkDefault() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(lender);
        pool.fundLoan{value: 5 ether}(id);

        vm.warp(block.timestamp + 31 days);
        uint256 lenderBalBefore = lender.balance;
        vm.prank(lender);
        pool.markDefault(id);

        (, , , , , , , , , MicroLendingPool.LoanStatus s) = pool.loans(id);
        assertEq(uint8(s), uint8(MicroLendingPool.LoanStatus.DEFAULTED));
        assertEq(lender.balance, lenderBalBefore + 1 ether);
    }

    function testMarkDefaultRevertNotPastDue() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(lender);
        pool.fundLoan{value: 5 ether}(id);

        vm.prank(lender);
        vm.expectRevert("Not past due");
        pool.markDefault(id);
    }

    // ── cancelLoan ──────────────────
    function testCancelLoan() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);

        uint256 balBefore = borrower1.balance;
        vm.prank(borrower1);
        pool.cancelLoan(id);

        (, , , , , , , , , MicroLendingPool.LoanStatus s) = pool.loans(id);
        assertEq(uint8(s), uint8(MicroLendingPool.LoanStatus.CANCELLED));
        assertEq(borrower1.balance, balBefore + 1 ether);
    }

    function testCancelLoanRevertNotRequested() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(lender);
        pool.fundLoan{value: 5 ether}(id);

        vm.prank(borrower1);
        vm.expectRevert("Cannot cancel");
        pool.cancelLoan(id);
    }

    function testCancelLoanRevertNotBorrower() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        vm.prank(borrower2);
        vm.expectRevert("Not borrower");
        pool.cancelLoan(id);
    }

    // ── View helpers ──────────────────
    function testGetBorrowerLoans() public {
        vm.startPrank(borrower1);
        pool.requestLoan{value: 1 ether}(5 ether, 500, 30 days);
        pool.requestLoan{value: 1 ether}(3 ether, 300, 60 days);
        vm.stopPrank();
        uint256[] memory ids = pool.getBorrowerLoans(borrower1);
        assertEq(ids.length, 2);
    }

    function testGetTotalOwed() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 1 ether}(10 ether, 1000, 30 days);
        // 10 ether + 10% = 11 ether
        assertEq(pool.getTotalOwed(id), 11 ether);
    }

    function testGetRemainingDebt() public {
        vm.prank(borrower1);
        uint256 id = pool.requestLoan{value: 2 ether}(10 ether, 1000, 30 days);
        vm.prank(lender);
        pool.fundLoan{value: 10 ether}(id);

        vm.prank(borrower1);
        pool.repay{value: 3 ether}(id);
        // total owed 11 ether - 3 repaid = 8 ether
        assertEq(pool.getRemainingDebt(id), 8 ether);
    }
}
