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

        (uint128 amount,, uint64 lockEndTimestamp, uint64 multiplier) =
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
        vm.prank(admin);
        vm.expectRevert("LF: exceeds max per block");
        farming.setBezPerBlock(farming.MAX_BEZ_PER_BLOCK() + 1);
    }
}
