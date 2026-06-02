// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";
import {BeZhasDEX} from "../../src/core/BeZhasDEX.sol";

contract BeZhasDEXTest is Test {
    BEZCoinV2 private bez;
    BEZCoinV2 private quote;
    BeZhasDEX private dex;

    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);

    function setUp() public {
        bez = new BEZCoinV2(address(this));
        quote = new BEZCoinV2(address(this));
        dex = new BeZhasDEX(address(this), 30);

        bez.mint(alice, 20_000 ether);
        quote.mint(alice, 20_000 ether);
        bez.mint(bob, 1_000 ether);
        quote.mint(bob, 1_000 ether);
    }

    function testCreatePoolAddLiquidityAndSwap() public {
        dex.createPool(address(bez), address(quote));

        vm.startPrank(alice);
        bez.approve(address(dex), 10_000 ether);
        quote.approve(address(dex), 10_000 ether);
        uint256 liquidity = dex.addLiquidity(address(bez), address(quote), 10_000 ether, 10_000 ether, 1);
        vm.stopPrank();

        assertGt(liquidity, 0);

        uint256 quoted = dex.quoteSwap(address(bez), address(quote), 100 ether);
        assertGt(quoted, 0);

        vm.startPrank(bob);
        bez.approve(address(dex), 100 ether);
        uint256 beforeOut = quote.balanceOf(bob);
        uint256 out = dex.swap(address(bez), address(quote), 100 ether, 1);
        vm.stopPrank();

        assertEq(out, quoted);
        assertEq(quote.balanceOf(bob), beforeOut + out);
    }
}
