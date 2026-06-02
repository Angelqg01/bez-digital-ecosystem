// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";

contract BEZCoinV2Test is Test {
    BEZCoinV2 public bez;
    address public admin = address(1);
    address public user1 = address(10);
    address public user2 = address(11);
    address public minter = address(20);
    address public bridge = address(30);

    function setUp() public {
        vm.warp(100_000); // Establish meaningful baseline for ERC20Votes timestamp mode
        vm.startPrank(admin);
        bez = new BEZCoinV2(admin);
        bez.grantRole(bez.MINTER_ROLE(), minter);
        bez.grantRole(bez.BRIDGE_ROLE(), bridge);
        bez.transfer(user1, 1_000_000 * 1e18);
        bez.transfer(user2, 500_000 * 1e18);
        vm.stopPrank();
    }

    // ─── ERC20Votes Integration Tests ────────────────────────────────

    function test_InitialSupply() public view {
        assertEq(bez.totalSupply(), 100_000_000 * 1e18);
    }

    function test_DelegateToSelf() public {
        vm.prank(user1);
        bez.delegate(user1);

        assertEq(bez.getVotes(user1), 1_000_000 * 1e18);
    }

    function test_DelegateToAnother() public {
        vm.prank(user1);
        bez.delegate(user2);

        assertEq(bez.getVotes(user2), 1_000_000 * 1e18);
        assertEq(bez.getVotes(user1), 0);
    }

    function test_VotingPowerAfterTransfer() public {
        vm.prank(user1);
        bez.delegate(user1);

        assertEq(bez.getVotes(user1), 1_000_000 * 1e18);

        vm.prank(user1);
        bez.transfer(user2, 500_000 * 1e18);

        assertEq(bez.getVotes(user1), 500_000 * 1e18);
    }

    function test_ClockReturnsTimestamp() public view {
        assertEq(bez.clock(), uint48(block.timestamp));
    }

    function test_ClockModeIsTimestamp() public view {
        assertEq(bez.CLOCK_MODE(), "mode=timestamp");
    }

    function test_PastVotes() public {
        // setUp deploys at timestamp 100_000
        vm.prank(user1);
        bez.delegate(user1); // checkpoint written at 100_000

        vm.warp(200_000); // advance well past checkpoint

        assertEq(bez.getPastVotes(user1, 100_000), 1_000_000 * 1e18);
    }

    function test_PastTotalSupply() public {
        // constructor minted at timestamp 100_000 (setUp warp)
        vm.warp(200_000);

        assertEq(bez.getPastTotalSupply(100_000), 100_000_000 * 1e18);
    }

    // ─── Minting / Burning ───────────────────────────────────────────

    function test_MintByMinter() public {
        vm.prank(minter);
        bez.mint(user1, 1000 * 1e18);

        assertEq(bez.balanceOf(user1), 1_001_000 * 1e18);
    }

    function test_RevertMintByNonMinter() public {
        vm.prank(user1);
        vm.expectRevert();
        bez.mint(user1, 1000 * 1e18);
    }

    function test_BridgeBurn() public {
        vm.prank(bridge);
        bez.bridgeBurn(user1, 500_000 * 1e18);

        assertEq(bez.balanceOf(user1), 500_000 * 1e18);
    }

    function test_RevertBridgeBurnByNonBridge() public {
        vm.prank(user1);
        vm.expectRevert();
        bez.bridgeBurn(user1, 100 * 1e18);
    }

    // ─── ERC20Permit ─────────────────────────────────────────────────

    function test_NonceStartsAtZero() public view {
        assertEq(bez.nonces(user1), 0);
    }

    function test_NameAndSymbol() public view {
        assertEq(bez.name(), "BeZhas Coin");
        assertEq(bez.symbol(), "BEZ");
    }
}
