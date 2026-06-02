// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/finance/TreasuryVault.sol";

contract TreasuryVaultTest is Test {
    TreasuryVault vault;
    address admin = address(this);
    address treasurer = address(0xA1);
    address approver1 = address(0xA2);
    address approver2 = address(0xA3);
    address depositor = address(0xB1);
    address recipient = address(0xC1);

    function setUp() public {
        vault = new TreasuryVault(2, 50 ether); // require 2 approvals, 50 ether daily limit
        vault.grantRole(vault.TREASURER_ROLE(), treasurer);
        vault.grantRole(vault.APPROVER_ROLE(), approver1);
        vault.grantRole(vault.APPROVER_ROLE(), approver2);
        vm.deal(depositor, 100 ether);
        vm.deal(admin, 100 ether);
    }

    // ── deposit ──────────────────
    function testDeposit() public {
        vm.prank(depositor);
        vault.deposit{value: 10 ether}();
        assertEq(vault.getVaultBalance(), 10 ether);
        assertEq(vault.depositorBalance(depositor), 10 ether);
    }

    function testDepositRevertZero() public {
        vm.prank(depositor);
        vm.expectRevert("Amount must be > 0");
        vault.deposit();
    }

    function testReceiveDeposit() public {
        vm.prank(depositor);
        (bool ok, ) = address(vault).call{value: 5 ether}("");
        assertTrue(ok);
        assertEq(vault.depositorBalance(depositor), 5 ether);
    }

    // ── requestWithdrawal ──────────────────
    function testRequestWithdrawal() public {
        vm.prank(depositor);
        vault.deposit{value: 20 ether}();

        vm.prank(treasurer);
        uint256 wid = vault.requestWithdrawal(recipient, 10 ether, keccak256("salary"));
        (uint256 rid, address req, address rec, uint256 amt, bytes32 rh, uint256 apr, uint256 rej, TreasuryVault.WithdrawalStatus st, uint256 ca) = vault.withdrawals(wid);
        assertEq(req, treasurer);
        assertEq(rec, recipient);
        assertEq(amt, 10 ether);
        assertEq(uint8(st), uint8(TreasuryVault.WithdrawalStatus.PENDING));
    }

    function testRequestWithdrawalRevertZeroRecipient() public {
        vm.prank(depositor);
        vault.deposit{value: 20 ether}();
        vm.prank(treasurer);
        vm.expectRevert("Invalid recipient");
        vault.requestWithdrawal(address(0), 10 ether, keccak256("x"));
    }

    function testRequestWithdrawalRevertInsufficientBalance() public {
        vm.prank(treasurer);
        vm.expectRevert("Insufficient balance");
        vault.requestWithdrawal(recipient, 10 ether, keccak256("x"));
    }

    // ── approveWithdrawal ──────────────────
    function testApproveWithdrawal() public {
        vm.prank(depositor);
        vault.deposit{value: 20 ether}();
        vm.prank(treasurer);
        uint256 wid = vault.requestWithdrawal(recipient, 10 ether, keccak256("x"));

        vm.prank(approver1);
        vault.approveWithdrawal(wid);
        (, , , , , uint256 apr, , TreasuryVault.WithdrawalStatus st,) = vault.withdrawals(wid);
        assertEq(apr, 1);
        assertEq(uint8(st), uint8(TreasuryVault.WithdrawalStatus.PENDING));
    }

    function testApproveWithdrawalAutoApproves() public {
        vm.prank(depositor);
        vault.deposit{value: 20 ether}();
        vm.prank(treasurer);
        uint256 wid = vault.requestWithdrawal(recipient, 10 ether, keccak256("x"));

        vm.prank(approver1);
        vault.approveWithdrawal(wid);
        vm.prank(approver2);
        vault.approveWithdrawal(wid);

        (, , , , , , , TreasuryVault.WithdrawalStatus st,) = vault.withdrawals(wid);
        assertEq(uint8(st), uint8(TreasuryVault.WithdrawalStatus.APPROVED));
    }

    function testApproveWithdrawalRevertAlreadyVoted() public {
        vm.prank(depositor);
        vault.deposit{value: 20 ether}();
        vm.prank(treasurer);
        uint256 wid = vault.requestWithdrawal(recipient, 10 ether, keccak256("x"));

        vm.startPrank(approver1);
        vault.approveWithdrawal(wid);
        vm.expectRevert("Already voted");
        vault.approveWithdrawal(wid);
        vm.stopPrank();
    }

    // ── rejectWithdrawal ──────────────────
    function testRejectWithdrawal() public {
        vm.prank(depositor);
        vault.deposit{value: 20 ether}();
        vm.prank(treasurer);
        uint256 wid = vault.requestWithdrawal(recipient, 10 ether, keccak256("x"));

        vm.prank(approver1);
        vault.rejectWithdrawal(wid);
        (, , , , , , , TreasuryVault.WithdrawalStatus st,) = vault.withdrawals(wid);
        assertEq(uint8(st), uint8(TreasuryVault.WithdrawalStatus.REJECTED));
    }

    // ── executeWithdrawal ──────────────────
    function testExecuteWithdrawal() public {
        vm.prank(depositor);
        vault.deposit{value: 20 ether}();
        vm.prank(treasurer);
        uint256 wid = vault.requestWithdrawal(recipient, 10 ether, keccak256("x"));

        vm.prank(approver1);
        vault.approveWithdrawal(wid);
        vm.prank(approver2);
        vault.approveWithdrawal(wid);

        uint256 recipientBalBefore = recipient.balance;
        vm.prank(treasurer);
        vault.executeWithdrawal(wid);

        (, , , , , , , TreasuryVault.WithdrawalStatus st,) = vault.withdrawals(wid);
        assertEq(uint8(st), uint8(TreasuryVault.WithdrawalStatus.EXECUTED));
        assertEq(recipient.balance, recipientBalBefore + 10 ether);
    }

    function testExecuteWithdrawalRevertNotApproved() public {
        vm.prank(depositor);
        vault.deposit{value: 20 ether}();
        vm.prank(treasurer);
        uint256 wid = vault.requestWithdrawal(recipient, 10 ether, keccak256("x"));

        vm.prank(treasurer);
        vm.expectRevert("Not approved");
        vault.executeWithdrawal(wid);
    }

    function testExecuteWithdrawalRevertDailyLimit() public {
        vm.prank(depositor);
        vault.deposit{value: 100 ether}();

        // Request and approve two withdrawals that exceed daily limit
        vm.prank(treasurer);
        uint256 w1 = vault.requestWithdrawal(recipient, 40 ether, keccak256("a"));
        vm.prank(approver1);
        vault.approveWithdrawal(w1);
        vm.prank(approver2);
        vault.approveWithdrawal(w1);
        vm.prank(treasurer);
        vault.executeWithdrawal(w1);

        vm.prank(treasurer);
        uint256 w2 = vault.requestWithdrawal(recipient, 20 ether, keccak256("b"));
        vm.prank(approver1);
        vault.approveWithdrawal(w2);
        vm.prank(approver2);
        vault.approveWithdrawal(w2);

        vm.prank(treasurer);
        vm.expectRevert("Daily limit exceeded");
        vault.executeWithdrawal(w2);
    }

    // ── setDailyLimit / setRequiredApprovals ──────────────────
    function testSetDailyLimit() public {
        vault.setDailyLimit(100 ether);
        assertEq(vault.dailyLimit(), 100 ether);
    }

    function testSetRequiredApprovals() public {
        vault.setRequiredApprovals(3);
        assertEq(vault.requiredApprovals(), 3);
    }

    function testSetRequiredApprovalsRevertZero() public {
        vm.expectRevert("Need at least 1");
        vault.setRequiredApprovals(0);
    }

    // ── View helpers ──────────────────
    function testGetVaultBalance() public {
        vm.prank(depositor);
        vault.deposit{value: 15 ether}();
        assertEq(vault.getVaultBalance(), 15 ether);
    }

    function testGetDailyRemaining() public {
        assertEq(vault.getDailyRemaining(), 50 ether);
    }
}
