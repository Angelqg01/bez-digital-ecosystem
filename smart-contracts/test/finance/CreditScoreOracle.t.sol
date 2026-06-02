// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/finance/CreditScoreOracle.sol";

contract CreditScoreOracleTest is Test {
    CreditScoreOracle oracle;
    address admin = address(this);
    address reporter = address(0xA1);
    address subject1 = address(0xB1);
    address subject2 = address(0xB2);

    function setUp() public {
        oracle = new CreditScoreOracle();
        oracle.grantRole(oracle.REPORTER_ROLE(), reporter);
    }

    // ── createProfile ──────────────────
    function testCreateProfile() public {
        vm.prank(reporter);
        oracle.createProfile(subject1);
        (address s, uint256 sc, uint256 tl, uint256 dl, uint256 otp, uint256 lp, CreditScoreOracle.RiskTier t, bool act, uint256 lu) = oracle.profiles(subject1);
        assertEq(s, subject1);
        assertEq(sc, 500);
        assertTrue(act);
        assertEq(uint8(t), uint8(CreditScoreOracle.RiskTier.UNRATED));
    }

    function testCreateProfileRevertZeroAddress() public {
        vm.prank(reporter);
        vm.expectRevert("Invalid address");
        oracle.createProfile(address(0));
    }

    function testCreateProfileRevertAlreadyExists() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        vm.expectRevert("Profile exists");
        oracle.createProfile(subject1);
        vm.stopPrank();
    }

    // ── recordPayment ──────────────────
    function testRecordPaymentOnTime() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        oracle.recordPayment(subject1, 1 ether, true, keccak256("pay1"));
        vm.stopPrank();

        (, uint256 sc, , , uint256 otp, uint256 lp, , ,) = oracle.profiles(subject1);
        assertEq(otp, 1);
        assertEq(lp, 0);
        // 500 base + 200 * (1/1) = 700
        assertEq(sc, 700);
    }

    function testRecordPaymentLate() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        oracle.recordPayment(subject1, 1 ether, false, keccak256("pay1"));
        vm.stopPrank();

        (, uint256 sc, , , uint256 otp, uint256 lp, , ,) = oracle.profiles(subject1);
        assertEq(otp, 0);
        assertEq(lp, 1);
        // 500 base + 200 * (0/1) = 500
        assertEq(sc, 500);
    }

    function testRecordPaymentRevertNoProfile() public {
        vm.prank(reporter);
        vm.expectRevert("No active profile");
        oracle.recordPayment(subject1, 1 ether, true, keccak256("x"));
    }

    // ── recordLoan ──────────────────
    function testRecordLoanNotDefaulted() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        oracle.recordLoan(subject1, false);
        vm.stopPrank();

        (, , uint256 tl, uint256 dl, , , , ,) = oracle.profiles(subject1);
        assertEq(tl, 1);
        assertEq(dl, 0);
    }

    function testRecordLoanDefaulted() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        oracle.recordLoan(subject1, true);
        vm.stopPrank();

        (, , uint256 tl, uint256 dl, , , , ,) = oracle.profiles(subject1);
        assertEq(tl, 1);
        assertEq(dl, 1);
    }

    function testRecordLoanRevertNoProfile() public {
        vm.prank(reporter);
        vm.expectRevert("No active profile");
        oracle.recordLoan(subject1, false);
    }

    // ── openDispute ──────────────────
    function testOpenDispute() public {
        vm.prank(reporter);
        oracle.createProfile(subject1);

        vm.prank(subject1);
        oracle.openDispute(keccak256("reason1"));

        uint256[] memory dids = oracle.getSubjectDisputes(subject1);
        assertEq(dids.length, 1);

        (uint256 did, address s, bytes32 rh, CreditScoreOracle.DisputeStatus ds, bytes32 resh, uint256 ca) = oracle.disputes(dids[0]);
        assertEq(s, subject1);
        assertEq(uint8(ds), uint8(CreditScoreOracle.DisputeStatus.OPEN));
    }

    function testOpenDisputeRevertNoProfile() public {
        vm.prank(subject1);
        vm.expectRevert("No active profile");
        oracle.openDispute(keccak256("x"));
    }

    // ── resolveDispute ──────────────────
    function testResolveDisputeAccepted() public {
        vm.prank(reporter);
        oracle.createProfile(subject1);
        vm.prank(subject1);
        oracle.openDispute(keccak256("reason"));

        vm.prank(reporter);
        oracle.resolveDispute(0, true, keccak256("resolved"));

        (, , , CreditScoreOracle.DisputeStatus ds, bytes32 resh,) = oracle.disputes(0);
        assertEq(uint8(ds), uint8(CreditScoreOracle.DisputeStatus.RESOLVED));
        assertEq(resh, keccak256("resolved"));
    }

    function testResolveDisputeRejected() public {
        vm.prank(reporter);
        oracle.createProfile(subject1);
        vm.prank(subject1);
        oracle.openDispute(keccak256("reason"));

        vm.prank(reporter);
        oracle.resolveDispute(0, false, keccak256("denied"));

        (, , , CreditScoreOracle.DisputeStatus ds, ,) = oracle.disputes(0);
        assertEq(uint8(ds), uint8(CreditScoreOracle.DisputeStatus.REJECTED));
    }

    function testResolveDisputeRevertNotOpen() public {
        vm.prank(reporter);
        oracle.createProfile(subject1);
        vm.prank(subject1);
        oracle.openDispute(keccak256("reason"));
        vm.startPrank(reporter);
        oracle.resolveDispute(0, true, keccak256("ok"));
        vm.expectRevert("Not open");
        oracle.resolveDispute(0, true, keccak256("again"));
        vm.stopPrank();
    }

    // ── overrideScore ──────────────────
    function testOverrideScore() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        oracle.overrideScore(subject1, 750);
        vm.stopPrank();

        (uint256 sc, CreditScoreOracle.RiskTier t) = oracle.getScore(subject1);
        assertEq(sc, 750);
        assertEq(uint8(t), uint8(CreditScoreOracle.RiskTier.PRIME));
    }

    function testOverrideScoreRevertTooHigh() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        vm.expectRevert("Score too high");
        oracle.overrideScore(subject1, 851);
        vm.stopPrank();
    }

    // ── deactivateProfile ──────────────────
    function testDeactivateProfile() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        oracle.deactivateProfile(subject1);
        vm.stopPrank();

        (, , , , , , , bool act,) = oracle.profiles(subject1);
        assertFalse(act);
    }

    function testDeactivateProfileRevertNotActive() public {
        vm.prank(reporter);
        vm.expectRevert("Not active");
        oracle.deactivateProfile(subject1);
    }

    // ── View helpers ──────────────────
    function testGetSubjectRecords() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        oracle.recordPayment(subject1, 1 ether, true, keccak256("p1"));
        oracle.recordPayment(subject1, 2 ether, false, keccak256("p2"));
        vm.stopPrank();

        uint256[] memory rids = oracle.getSubjectRecords(subject1);
        assertEq(rids.length, 2);
    }

    function testGetScore() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);
        oracle.overrideScore(subject1, 650);
        vm.stopPrank();

        (uint256 sc, CreditScoreOracle.RiskTier t) = oracle.getScore(subject1);
        assertEq(sc, 650);
        assertEq(uint8(t), uint8(CreditScoreOracle.RiskTier.NEAR_PRIME));
    }

    function testRiskTierCalculation() public {
        vm.startPrank(reporter);
        oracle.createProfile(subject1);

        oracle.overrideScore(subject1, 720);
        (, CreditScoreOracle.RiskTier t1) = oracle.getScore(subject1);
        assertEq(uint8(t1), uint8(CreditScoreOracle.RiskTier.PRIME));

        oracle.overrideScore(subject1, 620);
        (, CreditScoreOracle.RiskTier t2) = oracle.getScore(subject1);
        assertEq(uint8(t2), uint8(CreditScoreOracle.RiskTier.NEAR_PRIME));

        oracle.overrideScore(subject1, 500);
        (, CreditScoreOracle.RiskTier t3) = oracle.getScore(subject1);
        assertEq(uint8(t3), uint8(CreditScoreOracle.RiskTier.SUBPRIME));

        oracle.overrideScore(subject1, 499);
        (, CreditScoreOracle.RiskTier t4) = oracle.getScore(subject1);
        assertEq(uint8(t4), uint8(CreditScoreOracle.RiskTier.DEEP_SUBPRIME));

        vm.stopPrank();
    }
}
