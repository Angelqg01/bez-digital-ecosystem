// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BeZhasPayment} from "../src/core/BeZhasPayment.sol";
import {DeliveryEscrow} from "../src/core/DeliveryEscrow.sol";

/**
 * @title DeployPayment
 * @notice Despliega BeZhasPayment usando BEZCoinV2 ya deployado
 *
 * Uso local (Anvil):
 *   forge script script/DeployPayment.s.sol \
 *     --rpc-url http://localhost:8545 \
 *     --broadcast -vvvv
 *
 * Uso BSC Testnet:
 *   DEPLOYER_KEY=<key> BEZ_TOKEN=0x... TREASURY=0x... \
 *   forge script script/DeployPayment.s.sol \
 *     --rpc-url https://data-seed-prebsc-1-s1.binance.org:8545 \
 *     --broadcast --verify
 */
contract DeployPayment is Script {
    BeZhasPayment public paymentContract;
    DeliveryEscrow public deliveryEscrow;

    function run() external {
        // ── Configuración por entorno ──────────────────────────────────────────
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // BEZCoinV2 ya desplegado (leer del deployment o env)
        address bezToken = vm.envOr(
            "BEZ_TOKEN", address(0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43)
        );
        address treasury = vm.envOr("TREASURY", deployer);
        address edgeNode = vm.envOr("EDGE_NODE_ADDRESS", address(0));
        uint16 feeBps = uint16(vm.envOr("PLATFORM_FEE_BPS", uint256(250))); // 2.5% por defecto

        console.log("=== BeZhasPayment Deployment ===");
        console.log("Deployer:", deployer);
        console.log("BEZCoinV2:", bezToken);
        console.log("Treasury:", treasury);
        console.log("Edge Node:", edgeNode);
        console.log("Platform Fee Bps:", feeBps);

        vm.startBroadcast(deployerKey);

        paymentContract =
            new BeZhasPayment(bezToken, treasury, feeBps, deployer);
        deliveryEscrow =
            new DeliveryEscrow(bezToken, treasury, feeBps, deployer);
        if (edgeNode != address(0)) {
            deliveryEscrow.grantRole(deliveryEscrow.EDGE_NODE_ROLE(), edgeNode);
        }

        console.log("BeZhasPayment deployed at:", address(paymentContract));
        console.log("  - bezToken:      ", address(paymentContract.bezToken()));
        console.log("  - treasury:      ", paymentContract.treasury());
        console.log("  - platformFeeBps:", paymentContract.platformFeeBps());
        console.log("DeliveryEscrow deployed at:", address(deliveryEscrow));
        console.log("  - bezToken:      ", address(deliveryEscrow.bezToken()));
        console.log("  - treasury:      ", deliveryEscrow.treasury());
        console.log("  - feeBps:        ", deliveryEscrow.feeBps());
        if (edgeNode != address(0)) {
            console.log("  - edgeNode role: ", edgeNode);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== SIGUIENTE PASO ===");
        console.log("Actualiza deployments/{chainId}.json con:");
        console.log("  \"BeZhasPayment\":", address(paymentContract));
        console.log("  \"DeliveryEscrow\":", address(deliveryEscrow));
        console.log("Luego ejecuta: node sync-daemon.js --force --once");
        console.log("======================");
    }
}
