// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {LiquidityFarming} from "../src/core/LiquidityFarming.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployFarming
 * @notice Deploys LiquidityFarming with initial pools on top of an existing BEZCoinV2.
 *
 * Usage (local Anvil):
 *   forge script script/DeployFarming.s.sol --rpc-url http://localhost:8545 --broadcast
 *
 * Usage (testnet):
 *   BEZ_TOKEN=0x... QUICKSWAP_LP=0x... forge script script/DeployFarming.s.sol \
 *     --rpc-url $RPC_URL --private-key $KEY --broadcast --verify
 */
contract DeployFarming is Script {
    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address bezToken = vm.envAddress("BEZ_TOKEN");
        address quickswapLP = vm.envOr(
            "QUICKSWAP_LP", address(0x4edc77DE01f2A2c87611c2F8e9249Be43dF745A9)
        );
        uint256 bezPerBlock = vm.envOr("BEZ_PER_BLOCK", uint256(1e18));
        uint256 startBlock = vm.envOr("START_BLOCK", block.number);

        console.log("=== BeZhas LiquidityFarming Deployment ===");
        console.log("Deployer:", deployer);
        console.log("BEZ Token:", bezToken);
        console.log("QuickSwap LP:", quickswapLP);
        console.log("BEZ per block:", bezPerBlock);
        console.log("Start block:", startBlock);

        vm.startBroadcast(deployerKey);

        LiquidityFarming farming = new LiquidityFarming(
            IERC20(bezToken), bezPerBlock, startBlock, deployer
        );
        console.log("LiquidityFarming:", address(farming));

        // Pool 0: Staking simple BEZ
        farming.add(1000, IERC20(bezToken), false, false);
        console.log("  Pool 0: BEZ staking (alloc 1000)");

        // Pool 1: LP Farming QuickSwap
        farming.add(2000, IERC20(quickswapLP), false, true);
        console.log("  Pool 1: QuickSwap LP (alloc 2000)");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Farming Deployment Complete ===");
    }
}
