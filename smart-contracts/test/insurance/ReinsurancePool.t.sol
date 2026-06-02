// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/insurance/ReinsurancePool.sol";

contract ReinsurancePoolTest is Test {
    ReinsurancePool public reins;
    address public admin    = address(this);
    address public poolAdm  = address(0xC1);
    address public investor = address(0xC2);
    address public investor2 = address(0xC3);

    function setUp() public {
        reins = new ReinsurancePool();
        reins.grantRole(reins.POOL_ADMIN_ROLE(), poolAdm);
        vm.deal(investor, 100 ether);
        vm.deal(investor2, 100 ether);
    }

    function testCreatePool() public {
        vm.prank(poolAdm);
        uint256 id = reins.createPool("Marine Cargo", "Logistics", 50 ether, 10 ether, ReinsurancePool.RiskTier.MODERATE, 850);

        ReinsurancePool.Pool memory p = reins.getPool(id);
        assertEq(p.name, "Marine Cargo");
        assertEq(p.sector, "Logistics");
        assertEq(p.maxCapacity, 50 ether);
        assertEq(p.yieldBps, 850);
        assertTrue(p.open);
        assertEq(p.tvl, 0);
    }

    function testCreatePoolRevertsZeroCapacity() public {
        vm.prank(poolAdm);
        vm.expectRevert("Capacity must be > 0");
        reins.createPool("Test", "Test", 0, 0, ReinsurancePool.RiskTier.CONSERVATIVE, 500);
    }

    function testCreatePoolRevertsLossExceedsCapacity() public {
        vm.prank(poolAdm);
        vm.expectRevert("Loss > capacity");
        reins.createPool("Test", "Test", 10 ether, 20 ether, ReinsurancePool.RiskTier.CONSERVATIVE, 500);
    }

    function testCreatePoolRevertsYieldTooHigh() public {
        vm.prank(poolAdm);
        vm.expectRevert("Yield too high");
        reins.createPool("Test", "Test", 10 ether, 5 ether, ReinsurancePool.RiskTier.AGGRESSIVE, 6000);
    }

    function testDeposit() public {
        vm.prank(poolAdm);
        uint256 pid = reins.createPool("Agri", "Agriculture", 100 ether, 20 ether, ReinsurancePool.RiskTier.MODERATE, 1200);

        vm.prank(investor);
        reins.deposit{value: 10 ether}(pid);

        ReinsurancePool.Pool memory p = reins.getPool(pid);
        assertEq(p.tvl, 10 ether);
        assertEq(p.investorCount, 1);
        assertEq(reins.getPoolDepositCount(pid), 1);
    }

    function testDepositRevertsExceedsCapacity() public {
        vm.prank(poolAdm);
        uint256 pid = reins.createPool("Small", "Test", 5 ether, 2 ether, ReinsurancePool.RiskTier.CONSERVATIVE, 300);

        vm.prank(investor);
        vm.expectRevert("Exceeds capacity");
        reins.deposit{value: 6 ether}(pid);
    }

    function testWithdraw() public {
        vm.prank(poolAdm);
        uint256 pid = reins.createPool("Fleet", "Auto", 50 ether, 10 ether, ReinsurancePool.RiskTier.MODERATE, 700);

        vm.prank(investor);
        reins.deposit{value: 8 ether}(pid);

        uint256 balBefore = investor.balance;
        vm.prank(investor);
        reins.withdraw(0); // depositId = 0

        assertEq(investor.balance - balBefore, 8 ether);
        ReinsurancePool.Pool memory p = reins.getPool(pid);
        assertEq(p.tvl, 0);
    }

    function testWithdrawRevertsNotInvestor() public {
        vm.prank(poolAdm);
        uint256 pid = reins.createPool("Test", "Test", 50 ether, 10 ether, ReinsurancePool.RiskTier.CONSERVATIVE, 500);

        vm.prank(investor);
        reins.deposit{value: 5 ether}(pid);

        vm.prank(investor2);
        vm.expectRevert("Not investor");
        reins.withdraw(0);
    }

    function testCapPool() public {
        vm.prank(poolAdm);
        uint256 pid = reins.createPool("Cyber", "Tech", 30 ether, 5 ether, ReinsurancePool.RiskTier.AGGRESSIVE, 1500);

        vm.prank(poolAdm);
        reins.capPool(pid);

        ReinsurancePool.Pool memory p = reins.getPool(pid);
        assertFalse(p.open);
    }

    function testCapPoolBlocksDeposits() public {
        vm.prank(poolAdm);
        uint256 pid = reins.createPool("Closed", "Test", 30 ether, 5 ether, ReinsurancePool.RiskTier.MODERATE, 800);

        vm.prank(poolAdm);
        reins.capPool(pid);

        vm.prank(investor);
        vm.expectRevert("Pool is closed");
        reins.deposit{value: 1 ether}(pid);
    }

    function testPayClaimFromPool() public {
        vm.prank(poolAdm);
        uint256 pid = reins.createPool("Health", "Health", 50 ether, 15 ether, ReinsurancePool.RiskTier.MODERATE, 900);

        vm.prank(investor);
        reins.deposit{value: 20 ether}(pid);

        uint256 balBefore = poolAdm.balance;
        vm.prank(poolAdm);
        reins.payClaimFromPool(pid, 10 ether, "Hurricane claim");

        assertEq(poolAdm.balance - balBefore, 10 ether);
        ReinsurancePool.Pool memory p = reins.getPool(pid);
        assertEq(p.tvl, 10 ether);
    }
}
