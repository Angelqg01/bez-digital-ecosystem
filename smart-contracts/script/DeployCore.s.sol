// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

// ── Tokens ──
import {BEZCoinV2} from "../src/tokens/BEZCoinV2.sol";
import {BeZhasLogisticsNFT} from "../src/tokens/BeZhasLogisticsNFT.sol";

// ── Core ──
import {QualityEscrow} from "../src/core/QualityEscrow.sol";
import {BeZhasBridgeL2} from "../src/core/BeZhasBridgeL2.sol";
import {StakingPool} from "../src/core/StakingPool.sol";
import {LiquidityFarming} from "../src/core/LiquidityFarming.sol";
import {ValidatorRegistry} from "../src/core/ValidatorRegistry.sol";
import {EdgeNodeRewards} from "../src/core/EdgeNodeRewards.sol";
import {SequencerRotation} from "../src/core/SequencerRotation.sol";
import {SlashingManager} from "../src/core/SlashingManager.sol";

/**
 * @title DeployCore
 * @notice Deploys all core BeZhas contracts and configures roles.
 *
 * Usage:
 *   forge script script/DeployCore.s.sol --rpc-url http://localhost:8545 --broadcast
 *   forge script script/DeployCore.s.sol --rpc-url $SEPOLIA_RPC --private-key $DEPLOYER_KEY --broadcast --verify
 */
contract DeployCore is Script {
    // ── Deployed addresses (set after deployment) ──
    BEZCoinV2 public bezToken;
    BeZhasLogisticsNFT public logisticsNFT;
    QualityEscrow public qualityEscrow;
    BeZhasBridgeL2 public bridge;
    StakingPool public staking;
    LiquidityFarming public farming;
    ValidatorRegistry public validatorRegistry;
    EdgeNodeRewards public edgeNodeRewards;
    SequencerRotation public sequencerRotation;
    SlashingManager public slashingManager;

    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address edgeNode = vm.envOr(
            "EDGE_NODE_ADDRESS",
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
        ); // Anvil #1

        console.log("=== BeZhas Core Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Edge Node:", edgeNode);

        vm.startBroadcast(deployerKey);

        // ─────────────────────────────────────────────
        // 1. BEZCoinV2 — Native gas token
        // ─────────────────────────────────────────────
        bezToken = new BEZCoinV2(deployer);
        console.log("BEZCoinV2:", address(bezToken));

        // ─────────────────────────────────────────────
        // 2. BeZhasLogisticsNFT — Container asset NFTs
        // ─────────────────────────────────────────────
        logisticsNFT = new BeZhasLogisticsNFT(deployer);
        console.log("BeZhasLogisticsNFT:", address(logisticsNFT));

        // ─────────────────────────────────────────────
        // 3. QualityEscrow — IoT sensor data registry
        // ─────────────────────────────────────────────
        qualityEscrow = new QualityEscrow();
        console.log("QualityEscrow:", address(qualityEscrow));

        // ─────────────────────────────────────────────
        // 4. BeZhasBridgeL2 — L1↔L2 bridge
        // ─────────────────────────────────────────────
        bridge = new BeZhasBridgeL2(address(bezToken), deployer);
        console.log("BeZhasBridgeL2:", address(bridge));

        // ─────────────────────────────────────────────
        // 5. ValidatorRegistry — Corporate validator system
        // ─────────────────────────────────────────────
        validatorRegistry = new ValidatorRegistry(address(bezToken), deployer);
        console.log("ValidatorRegistry:", address(validatorRegistry));

        // ─────────────────────────────────────────────
        // 6. StakingPool — BEZ staking with validator boost
        // ─────────────────────────────────────────────
        staking = new StakingPool(
            address(bezToken), address(validatorRegistry), deployer
        );
        console.log("StakingPool:", address(staking));

        // ─────────────────────────────────────────────
        // 7. LiquidityFarming — MasterChef-style farming
        //    0.5 BEZ per block, starts at current block
        // ─────────────────────────────────────────────
        farming = new LiquidityFarming(
            IERC20(address(bezToken)),
            5e17, // 0.5 BEZ per block (~21,600 BEZ/day)
            block.number, // start immediately
            deployer
        );
        console.log("LiquidityFarming:", address(farming));

        // ─────────────────────────────────────────────
        // 8. EdgeNodeRewards — DePIN mining rewards
        // ─────────────────────────────────────────────
        edgeNodeRewards = new EdgeNodeRewards(
            address(bezToken), address(validatorRegistry), deployer
        );
        console.log("EdgeNodeRewards:", address(edgeNodeRewards));

        // ─────────────────────────────────────────────
        // 9. SequencerRotation — Shared sequencing
        // ─────────────────────────────────────────────
        sequencerRotation =
            new SequencerRotation(address(validatorRegistry), deployer);
        console.log("SequencerRotation:", address(sequencerRotation));

        // ─────────────────────────────────────────────
        // 10. SlashingManager — Penalty system
        // ─────────────────────────────────────────────
        slashingManager =
            new SlashingManager(address(validatorRegistry), deployer);
        console.log("SlashingManager:", address(slashingManager));

        // ═══════════════════════════════════════════════
        //  ROLE CONFIGURATION
        // ═══════════════════════════════════════════════

        // BEZCoinV2: Bridge can burn tokens for cross-chain transfers
        bezToken.grantRole(bezToken.BRIDGE_ROLE(), address(bridge));
        console.log("  BEZ BRIDGE_ROLE -> Bridge");

        // BEZCoinV2: Staking pool can mint rewards
        bezToken.grantRole(bezToken.MINTER_ROLE(), address(staking));
        console.log("  BEZ MINTER_ROLE -> StakingPool");

        // BEZCoinV2: Farming can mint rewards
        bezToken.grantRole(bezToken.MINTER_ROLE(), address(farming));
        console.log("  BEZ MINTER_ROLE -> LiquidityFarming");

        // LogisticsNFT: QualityEscrow can mint NFTs on verified shipments
        logisticsNFT.grantRole(
            logisticsNFT.MINTER_ROLE(), address(qualityEscrow)
        );
        console.log("  NFT MINTER_ROLE -> QualityEscrow");

        // QualityEscrow: Edge node can submit sensor data
        qualityEscrow.grantRole(qualityEscrow.EDGE_NODE_ROLE(), edgeNode);
        console.log("  ESCROW EDGE_NODE_ROLE -> EdgeNode");

        // ValidatorRegistry: ORACLE and SLASHER roles
        validatorRegistry.grantRole(
            validatorRegistry.ORACLE_ROLE(), address(edgeNodeRewards)
        );
        console.log("  VR ORACLE_ROLE -> EdgeNodeRewards");
        validatorRegistry.grantRole(
            validatorRegistry.SLASHER_ROLE(), address(slashingManager)
        );
        console.log("  VR SLASHER_ROLE -> SlashingManager");

        // EdgeNodeRewards: Oracle role for edge node
        edgeNodeRewards.grantRole(edgeNodeRewards.ORACLE_ROLE(), edgeNode);
        console.log("  ENR ORACLE_ROLE -> EdgeNode");

        // SlashingManager: Slasher role for automated monitoring
        slashingManager.grantRole(slashingManager.SLASHER_ROLE(), deployer);
        console.log("  SM SLASHER_ROLE -> Deployer");

        // Fund edge node with BEZ for gas
        bezToken.transfer(edgeNode, 10_000 ether);
        console.log("  Transferred 10,000 BEZ to EdgeNode");

        // Fund reward pools
        bezToken.transfer(address(edgeNodeRewards), 5_000_000 ether);
        console.log("  Transferred 5M BEZ to EdgeNodeRewards pool");
        bezToken.transfer(address(staking), 10_000_000 ether);
        console.log("  Transferred 10M BEZ to StakingPool rewards");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Core Deployment Complete ===");
    }
}
