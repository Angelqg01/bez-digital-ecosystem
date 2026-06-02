// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IVotes} from
    "openzeppelin-contracts/contracts/governance/utils/IVotes.sol";
import {TimelockController} from
    "openzeppelin-contracts/contracts/governance/TimelockController.sol";

import {BEZCoinV2} from "../src/tokens/BEZCoinV2.sol";
import {ValidatorRegistry} from "../src/core/ValidatorRegistry.sol";
import {EdgeNodeRewards} from "../src/core/EdgeNodeRewards.sol";
import {SequencerRotation} from "../src/core/SequencerRotation.sol";
import {SlashingManager} from "../src/core/SlashingManager.sol";
import {GovernanceSystem} from "../src/core/GovernanceSystem.sol";

/**
 * @title DeployValidation
 * @notice Deploys ONLY the validation system contracts on top of an existing
 *         deployment that already has BEZCoinV2 and StakingPool.
 *
 * Prerequisites:
 *   - BEZCoinV2 must be deployed (address from deployments/<chainId>.json)
 *
 * Usage (local Anvil):
 *   forge script script/DeployValidation.s.sol --rpc-url http://localhost:8545 --broadcast
 *
 * Usage (testnet):
 *   forge script script/DeployValidation.s.sol --rpc-url $RPC --private-key $KEY --broadcast --verify
 */
contract DeployValidation is Script {
    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address edgeNode = vm.envOr(
            "EDGE_NODE_ADDRESS",
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8) // Anvil #1
        );
        address bezTokenAddr = vm.envAddress("BEZ_TOKEN_ADDRESS");

        console.log("=== BeZhas Validation System Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Edge Node:", edgeNode);
        console.log("BEZCoinV2:", bezTokenAddr);

        BEZCoinV2 bezToken = BEZCoinV2(bezTokenAddr);

        vm.startBroadcast(deployerKey);

        // ─────────────────────────────────────────────
        // 1. ValidatorRegistry — Corporate validator system
        // ─────────────────────────────────────────────
        ValidatorRegistry validatorRegistry =
            new ValidatorRegistry(bezTokenAddr, deployer);
        console.log("ValidatorRegistry:", address(validatorRegistry));

        // ─────────────────────────────────────────────
        // 2. EdgeNodeRewards — DePIN mining rewards
        // ─────────────────────────────────────────────
        EdgeNodeRewards edgeNodeRewards = new EdgeNodeRewards(
            bezTokenAddr, address(validatorRegistry), deployer
        );
        console.log("EdgeNodeRewards:", address(edgeNodeRewards));

        // ─────────────────────────────────────────────
        // 3. SequencerRotation — Shared sequencing
        // ─────────────────────────────────────────────
        SequencerRotation sequencerRotation =
            new SequencerRotation(address(validatorRegistry), deployer);
        console.log("SequencerRotation:", address(sequencerRotation));

        // ─────────────────────────────────────────────
        // 4. SlashingManager — Penalty system
        // ─────────────────────────────────────────────
        SlashingManager slashingManager =
            new SlashingManager(address(validatorRegistry), deployer);
        console.log("SlashingManager:", address(slashingManager));

        // ─────────────────────────────────────────────
        // 5. TimelockController — DAO execution delay (1 day)
        // ─────────────────────────────────────────────
        address[] memory proposers = new address[](1);
        proposers[0] = deployer;
        address[] memory executors = new address[](1);
        executors[0] = address(0); // anyone can execute after timelock
        TimelockController timelock = new TimelockController(
            1 days, // minDelay
            proposers,
            executors,
            deployer // admin
        );
        console.log("TimelockController:", address(timelock));

        // ─────────────────────────────────────────────
        // 6. GovernanceSystem — DAO proposals & voting
        // ─────────────────────────────────────────────
        GovernanceSystem governance = new GovernanceSystem(
            IVotes(bezTokenAddr), timelock, address(validatorRegistry)
        );
        console.log("GovernanceSystem:", address(governance));

        // ═══════════════════════════════════════════════
        //  ROLE CONFIGURATION
        // ═══════════════════════════════════════════════

        // ValidatorRegistry: ORACLE role for EdgeNodeRewards
        validatorRegistry.grantRole(
            validatorRegistry.ORACLE_ROLE(), address(edgeNodeRewards)
        );
        console.log("  VR ORACLE_ROLE -> EdgeNodeRewards");

        // ValidatorRegistry: SLASHER role for SlashingManager
        validatorRegistry.grantRole(
            validatorRegistry.SLASHER_ROLE(), address(slashingManager)
        );
        console.log("  VR SLASHER_ROLE -> SlashingManager");

        // EdgeNodeRewards: Oracle role for edge node
        edgeNodeRewards.grantRole(edgeNodeRewards.ORACLE_ROLE(), edgeNode);
        console.log("  ENR ORACLE_ROLE -> EdgeNode");

        // SlashingManager: Slasher role for deployer (initial) + Aegis AI later
        slashingManager.grantRole(slashingManager.SLASHER_ROLE(), deployer);
        console.log("  SM SLASHER_ROLE -> Deployer");

        // TimelockController: Governance can propose actions
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governance));
        console.log("  TL PROPOSER_ROLE -> Governance");

        // Fund EdgeNodeRewards pool with BEZ
        bezToken.transfer(address(edgeNodeRewards), 5_000_000 ether);
        console.log("  Transferred 5M BEZ to EdgeNodeRewards pool");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Validation System Deployment Complete ===");
        console.log("Next steps:");
        console.log("  1. node script/parse-deployment-validation.js");
        console.log("  2. node api/db/seed-contracts.js");
    }
}
