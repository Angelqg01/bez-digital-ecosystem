const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

/**
 * Script de despliegue directo para GovernanceSystem y BeZhasCore
 * Network: Polygon Mainnet
 * Ethers: v5
 */

// Direcciones conocidas
const BEZ_COIN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

// Artifacts
const governanceArtifact = require("../artifacts/contracts/GovernanceSystem.sol/GovernanceSystem.json");
const coreArtifact = require("../artifacts/contracts/BeZhasCore.sol/BeZhasCore.json");

async function main() {
    console.log("\n🚀 Desplegando GovernanceSystem y BeZhasCore (Polygon Mainnet)...");
    console.log("⚠️  RED DE PRODUCCIÓN");

    // Setup
    const rpcUrl = process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL || "https://polygon-bor.publicnode.com";
    console.log("📡 RPC:", rpcUrl);

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("❌ PRIVATE_KEY missing");

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("📝 Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Balance:", ethers.utils.formatEther(balance), "MATIC");

    // Gas Config
    const overrides = {
        maxPriorityFeePerGas: ethers.utils.parseUnits("35", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("300", "gwei"),
    };
    console.log("⛽ Gas: 35 Gwei priority, 300 Gwei max\n");

    // ========================================================
    // 1. DEPLOY GOVERNANCE SYSTEM
    // ========================================================
    console.log("📦 Desplegando GovernanceSystem...");

    // Constructor params for GovernanceSystem:
    // (IERC20 _governanceToken, uint256 _votingDelay, uint256 _votingPeriod, uint256 _proposalThreshold, uint256 _quorumPercentage)
    const votingDelay = 2 * 24 * 60 * 60; // 2 days in seconds
    const votingPeriod = 7 * 24 * 60 * 60; // 7 days
    const proposalThreshold = ethers.utils.parseEther("10000"); // 10k tokens to propose
    const quorumPercentage = 4; // 4% quorum

    const GovernanceFactory = new ethers.ContractFactory(
        governanceArtifact.abi,
        governanceArtifact.bytecode,
        wallet
    );

    const governance = await GovernanceFactory.deploy(
        BEZ_COIN_ADDRESS,
        votingDelay,
        votingPeriod,
        proposalThreshold,
        quorumPercentage,
        overrides
    );

    console.log("   Tx Hash:", governance.deployTransaction.hash);
    await governance.deployed();
    console.log("✅ GovernanceSystem Address:", governance.address);

    // ========================================================
    // 2. DEPLOY BEZHAS CORE
    // ========================================================
    console.log("\n📦 Desplegando BeZhasCore...");

    // Constructor params for BeZhasCore:
    // (uint256 initialAPY, uint256 initialEmissionRate)
    const initialAPY = 1200; // 12% APY in basis points
    const initialEmissionRate = ethers.utils.parseEther("100"); // 100 tokens per emission cycle

    const CoreFactory = new ethers.ContractFactory(
        coreArtifact.abi,
        coreArtifact.bytecode,
        wallet
    );

    const core = await CoreFactory.deploy(
        initialAPY,
        initialEmissionRate,
        overrides
    );

    console.log("   Tx Hash:", core.deployTransaction.hash);
    await core.deployed();
    console.log("✅ BeZhasCore Address:", core.address);

    // ========================================================
    // SUMMARY
    // ========================================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DESPLIEGUE COMPLETO!");
    console.log("=".repeat(60));
    console.log("\n📋 Contratos desplegados:\n");
    console.log("GovernanceSystem:", governance.address);
    console.log("BeZhasCore:", core.address);
    console.log("\n📝 Variables de entorno:\n");
    console.log("# Backend .env");
    console.log(`GOVERNANCE_SYSTEM_ADDRESS=${governance.address}`);
    console.log(`BEZHAS_CORE_ADDRESS=${core.address}`);
    console.log("\n# Frontend .env");
    console.log(`VITE_GOVERNANCE_SYSTEM_ADDRESS=${governance.address}`);
    console.log(`VITE_BEZHAS_CORE_ADDRESS=${core.address}`);
    console.log("\n" + "=".repeat(60));

    // Save to JSON
    const deploymentData = {
        network: "polygon",
        chainId: 137,
        timestamp: new Date().toISOString(),
        deployer: wallet.address,
        contracts: {
            governanceSystem: {
                address: governance.address,
                txHash: governance.deployTransaction.hash,
                params: {
                    governanceToken: BEZ_COIN_ADDRESS,
                    votingDelay,
                    votingPeriod,
                    proposalThreshold: proposalThreshold.toString(),
                    quorumPercentage
                }
            },
            bezhasCore: {
                address: core.address,
                txHash: core.deployTransaction.hash,
                params: {
                    initialAPY,
                    initialEmissionRate: initialEmissionRate.toString()
                }
            }
        }
    };

    fs.writeFileSync("governance-core-deployment.json", JSON.stringify(deploymentData, null, 2));
    console.log("✅ Deployment data saved to: governance-core-deployment.json\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    });
