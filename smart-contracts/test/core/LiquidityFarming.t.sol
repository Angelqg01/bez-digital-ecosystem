// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";
import {LiquidityFarming} from "../../src/core/LiquidityFarming.sol";

contract MockLPToken is ERC20 {
    constructor() ERC20("Mock LP", "MLP") {
        _mint(msg.sender, 1_000_000 ether);
    }
}

contract LiquidityFarmingTest is Test {
    BEZCoinV2 public bez;
    MockLPToken public lp;
    LiquidityFarming public farming;

    address public admin = address(1);
    address public farmer = address(2);

    function setUp() public {
        vm.startPrank(admin);
        bez = new BEZCoinV2(admin);
        lp = new MockLPToken();
        farming = new LiquidityFarming(bez, 1 ether, block.number, admin);
        bez.transfer(address(farming), 1_000_000 ether);
        lp.transfer(farmer, 1_000 ether);
        farming.add(100, lp, false, true);
        vm.stopPrank();
    }

    function test_AddPoolAndDeposit() public {
        vm.startPrank(farmer);
        lp.approve(address(farming), 100 ether);
        farming.deposit(0, 100 ether, 30);
        vm.stopPrank();

        (uint128 amount,, uint64 lockEndTimestamp, uint64 multiplier,) =
            farming.userInfo(0, farmer);

        assertEq(amount, 100 ether);
        assertGt(lockEndTimestamp, block.timestamp);
        assertEq(multiplier, 125);
    }

    function test_ClaimRewardsAfterBlocks() public {
        vm.startPrank(farmer);
        lp.approve(address(farming), 100 ether);
        farming.deposit(0, 100 ether, 0);
        vm.stopPrank();

        vm.roll(block.number + 10);

        uint256 beforeBalance = bez.balanceOf(farmer);
        vm.prank(farmer);
        farming.claim(0);

        assertGt(bez.balanceOf(farmer), beforeBalance);
    }

    function test_CannotWithdrawBeforeLockEnds() public {
        vm.startPrank(farmer);
        lp.approve(address(farming), 100 ether);
        farming.deposit(0, 100 ether, 30);

        vm.expectRevert("Tokens are locked");
        farming.withdraw(0, 1 ether);
        vm.stopPrank();
    }

    function test_OwnerCannotSetEmissionAboveCap() public {
        // Cache the view BEFORE expectRevert: otherwise vm.expectRevert binds to the
        // MAX_BEZ_PER_BLOCK() call (evaluated as an argument) instead of setBezPerBlock.
        uint256 aboveCap = farming.MAX_BEZ_PER_BLOCK() + 1;
        vm.prank(admin);
        vm.expectRevert("LF: exceeds max per block");
        farming.setBezPerBlock(aboveCap);
    }

    // ── Las recompensas pendientes sobreviven a depositar y retirar (SEC-03) ──
    // Antes, deposit() y withdraw() recalculaban rewardDebt sobre el saldo nuevo y
    // borraban lo devengado y no reclamado.

    function _depositFarmer(uint256 amount) internal {
        vm.startPrank(farmer);
        lp.approve(address(farming), amount);
        farming.deposit(0, amount, 0);
        vm.stopPrank();
    }

    function test_SecondDepositKeepsPendingRewards() public {
        _depositFarmer(100 ether);
        vm.roll(block.number + 10);
        uint256 pendingBefore = farming.pendingBez(0, farmer);
        assertGt(pendingBefore, 0);

        _depositFarmer(100 ether); // mismo bloque: no devenga nada más

        assertEq(farming.pendingBez(0, farmer), pendingBefore, "el segundo deposito borro lo devengado");
        uint256 balBefore = bez.balanceOf(farmer);
        vm.prank(farmer);
        farming.claim(0);
        assertEq(bez.balanceOf(farmer) - balBefore, pendingBefore);
    }

    function test_PartialWithdrawKeepsPendingRewards() public {
        _depositFarmer(100 ether);
        vm.roll(block.number + 10);
        uint256 pendingBefore = farming.pendingBez(0, farmer);

        vm.prank(farmer);
        farming.withdraw(0, 40 ether);

        assertEq(farming.pendingBez(0, farmer), pendingBefore, "el retiro borro lo devengado");
        uint256 balBefore = bez.balanceOf(farmer);
        vm.prank(farmer);
        farming.claim(0);
        assertEq(bez.balanceOf(farmer) - balBefore, pendingBefore);
    }

    function test_FullWithdrawThenClaimStillPays() public {
        _depositFarmer(100 ether);
        vm.roll(block.number + 10);
        uint256 pendingBefore = farming.pendingBez(0, farmer);

        vm.prank(farmer);
        farming.withdraw(0, 100 ether);

        assertEq(farming.pendingBez(0, farmer), pendingBefore);
        uint256 balBefore = bez.balanceOf(farmer);
        vm.prank(farmer);
        farming.claim(0);
        assertEq(bez.balanceOf(farmer) - balBefore, pendingBefore);
    }

    function test_RewardsKeepAccruingAfterSecondDeposit() public {
        _depositFarmer(100 ether);
        vm.roll(block.number + 10);
        uint256 afterFirst = farming.pendingBez(0, farmer);
        _depositFarmer(100 ether);
        // vm.getBlockNumber() y no block.number: con via_ir el optimizador reutiliza el
        // block.number leído antes del primer roll y el segundo no avanzaba.
        vm.roll(vm.getBlockNumber() + 10);
        // Diez bloques más con el doble de saldo, único farmer: se llevan toda la emision.
        assertEq(farming.pendingBez(0, farmer), afterFirst + 10 ether);
    }

    function test_EmergencyWithdrawAbandonsPendingRewards() public {
        _depositFarmer(100 ether);
        vm.roll(block.number + 10);
        vm.prank(farmer);
        farming.emergencyWithdraw(0);
        assertEq(farming.pendingBez(0, farmer), 0);
    }

    // ── El tope diario paga hasta donde llega y guarda el resto ──

    function test_ClaimAboveDailyCapPaysRemainderAndKeepsRest() public {
        vm.prank(admin);
        farming.setBezPerBlock(5 ether);
        _depositFarmer(100 ether);
        vm.roll(block.number + 6_000); // 30.000 BEZ devengados, tope diario 25.000
        uint256 pending = farming.pendingBez(0, farmer);
        assertGt(pending, farming.DAILY_EMISSION_CAP());

        uint256 balBefore = bez.balanceOf(farmer);
        vm.prank(farmer);
        farming.claim(0); // antes: revert "LF: daily cap reached" con todo bloqueado
        assertEq(bez.balanceOf(farmer) - balBefore, farming.DAILY_EMISSION_CAP());

        // El resto sigue ahí y no se pierde.
        uint256 rest = farming.pendingBez(0, farmer);
        assertEq(rest, pending - farming.DAILY_EMISSION_CAP());

        // Mismo dia: no hay nada que pagar, y no revierte.
        vm.prank(farmer);
        farming.claim(0);
        assertEq(bez.balanceOf(farmer) - balBefore, farming.DAILY_EMISSION_CAP());

        // Al dia siguiente el tope se renueva y se vuelve a cobrar. Ese dia se devengan
        // otros 216.000 BEZ, así que vuelve a pagarse el tope entero y lo guardado sigue ahi.
        uint256 paidDay1 = bez.balanceOf(farmer) - balBefore;
        vm.roll(vm.getBlockNumber() + 43_200);
        uint256 pendingDay2 = farming.pendingBez(0, farmer);
        vm.prank(farmer);
        farming.claim(0);
        assertEq(bez.balanceOf(farmer) - balBefore - paidDay1, farming.DAILY_EMISSION_CAP());
        assertEq(farming.pendingBez(0, farmer), pendingDay2 - farming.DAILY_EMISSION_CAP());
    }
}
