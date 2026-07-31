// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BeZhasCommissionSplitter} from "../src/core/BeZhasCommissionSplitter.sol";

/**
 * @title DeployCommissionSplitter
 * @notice Despliega BeZhasCommissionSplitter usando BEZCoinV2 ya deployado
 *
 * Uso local (Anvil):
 *   forge script script/DeployCommissionSplitter.s.sol \
 *     --rpc-url http://localhost:8545 \
 *     --broadcast -vvvv
 *
 * Uso BSC/Polygon:
 *   DEPLOYER_PRIVATE_KEY=<key> BEZ_TOKEN=0x... TREASURY=0x... SETTLER=0x... \
 *   forge script script/DeployCommissionSplitter.s.sol \
 *     --rpc-url <rpc> --broadcast --verify
 */
contract DeployCommissionSplitter is Script {
    BeZhasCommissionSplitter public splitter;

    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address bezToken = vm.envOr(
            "BEZ_TOKEN", address(0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43)
        );
        address treasury = vm.envOr("TREASURY", deployer);
        // Wallet del backend que dispara settlePaymentWithCommissions tras
        // validar la cascada en Postgres (commissionEngine.service.js).
        address settlerWallet = vm.envOr("SETTLER", deployer);
        uint16 feeBps = uint16(vm.envOr("PLATFORM_FEE_BPS", uint256(10))); // 0.1% por defecto

        console.log("=== BeZhasCommissionSplitter Deployment ===");
        console.log("Deployer:", deployer);
        console.log("BEZCoinV2:", bezToken);
        console.log("Treasury:", treasury);
        console.log("Settler:", settlerWallet);
        console.log("Platform Fee Bps:", feeBps);

        vm.startBroadcast(deployerKey);

        splitter = new BeZhasCommissionSplitter(bezToken, treasury, feeBps, deployer);
        if (settlerWallet != deployer) {
            splitter.grantRole(splitter.SETTLER_ROLE(), settlerWallet);
        }

        console.log("BeZhasCommissionSplitter deployed at:", address(splitter));
        console.log("  - bezToken:      ", address(splitter.bezToken()));
        console.log("  - treasury:      ", splitter.treasury());
        console.log("  - platformFeeBps:", splitter.platformFeeBps());

        vm.stopBroadcast();

        console.log("");
        console.log("=== SIGUIENTE PASO ===");
        console.log("Actualiza deployments/{chainId}.json con:");
        console.log("  \"BeZhasCommissionSplitter\":", address(splitter));
        console.log("Luego ejecuta: node sync-daemon.js --force --once");
        console.log("======================");
    }
}
