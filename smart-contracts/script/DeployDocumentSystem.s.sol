// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IPRegistryNFT} from "../src/legal/IPRegistryNFT.sol";
import {P2PMarketplace} from "../src/otros/P2PMarketplace.sol";

/**
 * @title DeployDocumentSystem
 * @notice Deploys the Document Proof System (IPRegistryNFT) and the Marketplace.
 *
 * Usage (local Anvil):
 *   forge script script/DeployDocumentSystem.s.sol --rpc-url http://localhost:8545 --broadcast
 */
contract DeployDocumentSystem is Script {
    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== BeZhas Document Proof & Marketplace Deployment ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);

        // 1. Deploy IPRegistryNFT (The Document Registry)
        IPRegistryNFT registry = new IPRegistryNFT();
        console.log("IPRegistryNFT (Document Proof Token):", address(registry));

        // 2. Deploy P2PMarketplace (The Marketplace)
        P2PMarketplace marketplace = new P2PMarketplace();
        console.log("P2PMarketplace:", address(marketplace));

        // 3. Link Marketplace to Registry
        marketplace.setRegistry(address(registry));
        console.log("Registry linked to Marketplace");

        // 4. Initial Config (Optional)
        // marketplace.setPlatformFee(250); // 2.5% already default

        vm.stopBroadcast();

        console.log("=== Deployment Complete ===");
        console.log("Addresses:");
        console.log("REGISTRY_ADDRESS=", address(registry));
        console.log("MARKETPLACE_ADDRESS=", address(marketplace));
    }
}
