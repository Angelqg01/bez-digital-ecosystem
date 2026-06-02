// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/otros/CharityVault.sol";

contract CharityVaultTest is Test {
    CharityVault charity;
    address admin = address(this);
    address manager = address(0xA1);
    address beneficiary = address(0xB1);
    address donor1 = address(0xC1);
    address donor2 = address(0xC2);

    function setUp() public {
        charity = new CharityVault();
        charity.grantRole(charity.MANAGER_ROLE(), manager);
        vm.deal(donor1, 100 ether);
        vm.deal(donor2, 100 ether);
    }

    // ── createCause ──────────────────
    function testCreateCause() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Clean Water"));
        (uint256 rid, address b, uint256 goal, uint256 raised, uint256 withdrawn, , CharityVault.CauseStatus st, , ) = charity.causes(cid);
        assertEq(b, beneficiary);
        assertEq(goal, 10 ether);
        assertEq(raised, 0);
        assertEq(withdrawn, 0);
        assertEq(uint8(st), uint8(CharityVault.CauseStatus.ACTIVE));
    }

    function testCreateCauseRevertZeroGoal() public {
        vm.prank(manager);
        vm.expectRevert("Goal required");
        charity.createCause(beneficiary, 0, keccak256("x"));
    }

    function testCreateCauseRevertInvalidBeneficiary() public {
        vm.prank(manager);
        vm.expectRevert("Invalid beneficiary");
        charity.createCause(address(0), 10 ether, keccak256("x"));
    }

    // ── donate ──────────────────
    function testDonate() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));

        vm.prank(donor1);
        uint256 did = charity.donate{value: 3 ether}(cid, keccak256("For the kids"));
        (, uint256 dcid, address d, uint256 amt, , ) = charity.donations(did);
        assertEq(dcid, cid);
        assertEq(d, donor1);
        assertEq(amt, 3 ether);

        (, , , uint256 raised, , , , uint256 dc, ) = charity.causes(cid);
        assertEq(raised, 3 ether);
        assertEq(dc, 1);
    }

    function testDonateRevertNotActive() public {
        vm.startPrank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        charity.pauseCause(cid);
        vm.stopPrank();

        vm.prank(donor1);
        vm.expectRevert("Not active");
        charity.donate{value: 1 ether}(cid, keccak256("x"));
    }

    function testDonateRevertZeroAmount() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));

        vm.prank(donor1);
        vm.expectRevert("Amount required");
        charity.donate(cid, keccak256("x"));
    }

    function testDonateAutoCompletes() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 5 ether, keccak256("Water"));

        vm.prank(donor1);
        charity.donate{value: 5 ether}(cid, keccak256("All in"));
        (, , , , , , CharityVault.CauseStatus st, , ) = charity.causes(cid);
        assertEq(uint8(st), uint8(CharityVault.CauseStatus.COMPLETED));
    }

    // ── withdrawFunds ──────────────────
    function testWithdrawFunds() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        vm.prank(donor1);
        charity.donate{value: 7 ether}(cid, keccak256("x"));

        uint256 balBefore = beneficiary.balance;
        vm.prank(beneficiary);
        charity.withdrawFunds(cid, 5 ether);
        assertEq(beneficiary.balance, balBefore + 5 ether);

        (, , , , uint256 withdrawn, , , , ) = charity.causes(cid);
        assertEq(withdrawn, 5 ether);
    }

    function testWithdrawFundsRevertNotBeneficiary() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        vm.prank(donor1);
        charity.donate{value: 5 ether}(cid, keccak256("x"));

        vm.prank(donor1);
        vm.expectRevert("Not beneficiary");
        charity.withdrawFunds(cid, 1 ether);
    }

    function testWithdrawFundsRevertInsufficient() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        vm.prank(donor1);
        charity.donate{value: 3 ether}(cid, keccak256("x"));

        vm.prank(beneficiary);
        vm.expectRevert("Insufficient funds");
        charity.withdrawFunds(cid, 5 ether);
    }

    // ── pauseCause / resumeCause ──────────────────
    function testPauseCause() public {
        vm.startPrank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        charity.pauseCause(cid);
        vm.stopPrank();
        (, , , , , , CharityVault.CauseStatus st, , ) = charity.causes(cid);
        assertEq(uint8(st), uint8(CharityVault.CauseStatus.PAUSED));
    }

    function testResumeCause() public {
        vm.startPrank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        charity.pauseCause(cid);
        charity.resumeCause(cid);
        vm.stopPrank();
        (, , , , , , CharityVault.CauseStatus st, , ) = charity.causes(cid);
        assertEq(uint8(st), uint8(CharityVault.CauseStatus.ACTIVE));
    }

    function testPauseCauseRevertNotActive() public {
        vm.startPrank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        charity.pauseCause(cid);
        vm.expectRevert("Not active");
        charity.pauseCause(cid);
        vm.stopPrank();
    }

    function testResumeCauseRevertNotPaused() public {
        vm.startPrank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        vm.expectRevert("Not paused");
        charity.resumeCause(cid);
        vm.stopPrank();
    }

    // ── View helpers ──────────────────
    function testGetCauseDonations() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        vm.prank(donor1);
        charity.donate{value: 1 ether}(cid, keccak256("a"));
        vm.prank(donor2);
        charity.donate{value: 2 ether}(cid, keccak256("b"));
        uint256[] memory ids = charity.getCauseDonations(cid);
        assertEq(ids.length, 2);
    }

    function testGetDonorHistory() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        vm.startPrank(donor1);
        charity.donate{value: 1 ether}(cid, keccak256("a"));
        charity.donate{value: 2 ether}(cid, keccak256("b"));
        vm.stopPrank();
        uint256[] memory ids = charity.getDonorHistory(donor1);
        assertEq(ids.length, 2);
    }

    function testGetAvailableFunds() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        vm.prank(donor1);
        charity.donate{value: 8 ether}(cid, keccak256("x"));
        vm.prank(beneficiary);
        charity.withdrawFunds(cid, 3 ether);
        assertEq(charity.getAvailableFunds(cid), 5 ether);
    }

    function testGetCauseProgress() public {
        vm.prank(manager);
        uint256 cid = charity.createCause(beneficiary, 10 ether, keccak256("Water"));
        vm.prank(donor1);
        charity.donate{value: 5 ether}(cid, keccak256("x"));
        (uint256 raised, uint256 goal, uint256 pct) = charity.getCauseProgress(cid);
        assertEq(raised, 5 ether);
        assertEq(goal, 10 ether);
        assertEq(pct, 50);
    }
}
