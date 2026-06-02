// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {WalletGuardian} from "../src/wallet/WalletGuardian.sol";

contract WalletGuardianTest is Test {
    WalletGuardian public wg;
    
    address public admin;
    address public walletOwner;
    address public guardian1;
    address public guardian2;
    address public attacker;

    function setUp() public {
        admin = makeAddr("admin");
        walletOwner = makeAddr("walletOwner");
        guardian1 = makeAddr("guardian1");
        guardian2 = makeAddr("guardian2");
        attacker = makeAddr("attacker");

        wg = new WalletGuardian(admin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Designate Guardians
    // ═══════════════════════════════════════════════════════════════════

    function test_DesignateGuardian() public {
        vm.prank(walletOwner);
        wg.designateGuardian(guardian1, "CFO de Empresa X");
        
        assertTrue(wg.isDesignated(walletOwner, guardian1));
        assertEq(wg.getGuardianCount(walletOwner), 1);
    }

    function test_CannotDesignateSelf() public {
        vm.prank(walletOwner);
        vm.expectRevert("WG: cannot be own guardian");
        wg.designateGuardian(walletOwner, "Self");
    }

    function test_CannotDesignateZero() public {
        vm.prank(walletOwner);
        vm.expectRevert("WG: zero address");
        wg.designateGuardian(address(0), "Zero");
    }

    function test_CannotDesignateDuplicate() public {
        vm.startPrank(walletOwner);
        wg.designateGuardian(guardian1, "CFO");
        vm.expectRevert("WG: already designated");
        wg.designateGuardian(guardian1, "CFO again");
        vm.stopPrank();
    }

    function test_DesignateMultipleGuardians() public {
        vm.startPrank(walletOwner);
        wg.designateGuardian(guardian1, "CFO");
        wg.designateGuardian(guardian2, "CTO");
        vm.stopPrank();
        
        assertEq(wg.getGuardianCount(walletOwner), 2);
        address[] memory guards = wg.getWalletGuardians(walletOwner);
        assertEq(guards.length, 2);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Revoke Guardian
    // ═══════════════════════════════════════════════════════════════════

    function test_RevokeGuardian() public {
        vm.startPrank(walletOwner);
        wg.designateGuardian(guardian1, "CFO");
        wg.revokeGuardian(guardian1);
        vm.stopPrank();
        
        assertFalse(wg.isDesignated(walletOwner, guardian1));
        assertEq(wg.getGuardianCount(walletOwner), 0);
    }

    function test_CannotRevokeNonDesignated() public {
        vm.prank(walletOwner);
        vm.expectRevert("WG: not designated");
        wg.revokeGuardian(guardian1);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Verification
    // ═══════════════════════════════════════════════════════════════════

    function test_VerifyGuardian() public {
        vm.prank(admin);
        wg.verifyGuardian(guardian1);
        assertTrue(wg.verifiedGuardians(guardian1));
        assertGe(wg.guardianTrustScore(guardian1), 50);
    }

    function test_UnverifyGuardian() public {
        vm.startPrank(admin);
        wg.verifyGuardian(guardian1);
        wg.unverifyGuardian(guardian1);
        vm.stopPrank();
        assertFalse(wg.verifiedGuardians(guardian1));
    }

    function test_UpdateTrustScore() public {
        vm.prank(admin);
        wg.updateTrustScore(guardian1, 85);
        assertEq(wg.guardianTrustScore(guardian1), 85);
    }

    function test_TrustScoreMaxEnforced() public {
        vm.prank(admin);
        vm.expectRevert("WG: score too high");
        wg.updateTrustScore(guardian1, 101);
    }

    function test_NonAdminCannotVerify() public {
        vm.prank(attacker);
        vm.expectRevert();
        wg.verifyGuardian(guardian1);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Recovery Recording
    // ═══════════════════════════════════════════════════════════════════

    function test_RecordRecovery() public {
        vm.prank(walletOwner);
        wg.designateGuardian(guardian1, "CFO");
        
        vm.prank(admin);
        wg.recordRecovery(walletOwner, guardian1);
        
        (,uint256 count,,) = wg.getGuardianInfo(walletOwner, guardian1);
        assertEq(count, 1);
    }

    function test_CannotRecordForNonDesignated() public {
        vm.prank(admin);
        vm.expectRevert("WG: not designated");
        wg.recordRecovery(walletOwner, guardian1);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Views
    // ═══════════════════════════════════════════════════════════════════

    function test_GetGuardianInfo() public {
        vm.prank(walletOwner);
        wg.designateGuardian(guardian1, "CFO de MegaCorp");
        
        (uint256 regAt, uint256 recovCount, bool verified, string memory label) = 
            wg.getGuardianInfo(walletOwner, guardian1);
        
        assertGt(regAt, 0);
        assertEq(recovCount, 0);
        assertFalse(verified);
        assertEq(label, "CFO de MegaCorp");
    }

    function test_GetGuardianWallets() public {
        vm.prank(walletOwner);
        wg.designateGuardian(guardian1, "Guard");
        
        address otherWallet = makeAddr("otherWallet");
        vm.prank(otherWallet);
        wg.designateGuardian(guardian1, "Guard2");
        
        address[] memory wallets = wg.getGuardianWallets(guardian1);
        assertEq(wallets.length, 2);
    }
}
