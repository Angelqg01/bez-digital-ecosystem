const hre = require("hardhat");

/**
 * Script para verificar todos los contratos desplegados en Polygonscan
 * Verifica el código fuente para transparencia y permite interacción directa desde el explorador
 */

const BEZCOIN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

const contracts = [
    {
        name: "BeZhasQualityEscrow",
        address: "0x3088573c025F197A886b97440761990c9A9e83C9",
        constructorArgs: [BEZCOIN_ADDRESS, 10, 500] // paymentToken, minQualityScore, escrowFee
    },
    {
        name: "BeZhasRWAFactory",
        address: "0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0",
        constructorArgs: [BEZCOIN_ADDRESS]
    },
    {
        name: "BeZhasVault",
        address: "0xCDd23058bf8143680f0A320318604bB749f701ED",
        constructorArgs: ["0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0"] // RWA Factory address
    },
    {
        name: "GovernanceSystem",
        address: "0x304Fd77f64C03482edcec0923f0Cd4A066a305F3",
        constructorArgs: [
            BEZCOIN_ADDRESS,
            172800,  // 2 days voting delay
            604800,  // 7 days voting period
            hre.ethers.utils.parseEther("10000"), // 10k BEZ quorum
            400      // 4% quorum percentage
        ]
    },
    {
        name: "BeZhasCore",
        address: "0x260A9fBcE1c6817c04e51c170b5BFd8d594c0d8A",
        constructorArgs: [
            BEZCOIN_ADDRESS,
            1200,     // 12% APY (basis points)
            63072000, // 2 years halving period
            5         // 5 halvings
        ]
    },
    {
        name: "LiquidityFarming",
        address: "0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26",
        constructorArgs: [
            BEZCOIN_ADDRESS,
            hre.ethers.utils.parseEther("0.1"), // 0.1 BEZ per block
            41832935, // Start block (actual start block when deployed)
            31536000  // 1 year bonus end period
        ]
    },
    {
        name: "NFTOffers",
        address: "0x0C9Bf667b838f6d466619ddb90a08d6c9A64d0A4",
        constructorArgs: [
            BEZCOIN_ADDRESS,
            "0x52Df82920CBAE522880dD7657e43d1A754eD044E" // Fee recipient (deployer)
        ]
    },
    {
        name: "NFTRental",
        address: "0x96B1754BbfdC5a2f6013A8a04cB6AF2E4090C024",
        constructorArgs: [
            BEZCOIN_ADDRESS,
            "0x52Df82920CBAE522880dD7657e43d1A754eD044E" // Fee recipient (deployer)
        ]
    },
    {
        name: "BeZhasMarketplace",
        address: "0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE",
        constructorArgs: [
            BEZCOIN_ADDRESS,
            hre.ethers.utils.parseEther("100"), // 100 BEZ vendor fee
            250 // 2.5% platform commission
        ]
    },
    {
        name: "BeZhasAdminRegistry",
        address: "0xfCe2F7dcf1786d1606b9b858E9ba04dA499F1e3C",
        constructorArgs: [] // No constructor args
    }
];

async function main() {
    console.log("\n🔍 Verificando contratos en Polygonscan...");
    console.log("=".repeat(60));

    let successCount = 0;
    let failCount = 0;

    for (const contract of contracts) {
        console.log(`\n📝 Verificando: ${contract.name}`);
        console.log(`   Address: ${contract.address}`);

        try {
            await hre.run("verify:verify", {
                address: contract.address,
                constructorArguments: contract.constructorArgs,
                contract: getContractPath(contract.name)
            });
            console.log(`   ✅ Verificado exitosamente`);
            successCount++;
        } catch (error) {
            if (error.message.includes("Already Verified")) {
                console.log(`   ℹ️  Ya estaba verificado`);
                successCount++;
            } else {
                console.log(`   ❌ Error: ${error.message}`);
                failCount++;
            }
        }

        // Esperar 2 segundos entre verificaciones para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("\n" + "=".repeat(60));
    console.log(`\n📊 Resumen de Verificación:`);
    console.log(`   ✅ Exitosos: ${successCount}/${contracts.length}`);
    console.log(`   ❌ Fallidos: ${failCount}/${contracts.length}`);

    if (successCount === contracts.length) {
        console.log("\n🎉 Todos los contratos verificados!");
    }

    console.log("\n🔗 Puedes ver los contratos en:");
    contracts.forEach(c => {
        console.log(`   ${c.name}: https://polygonscan.com/address/${c.address}#code`);
    });
}

function getContractPath(name) {
    const paths = {
        "BeZhasQualityEscrow": "contracts/quality-oracle/BeZhasQualityEscrow.sol:BeZhasQualityEscrow",
        "BeZhasRWAFactory": "contracts/BeZhasRWAFactory.sol:BeZhasRWAFactory",
        "BeZhasVault": "contracts/BeZhasVault.sol:BeZhasVault",
        "GovernanceSystem": "contracts/GovernanceSystem.sol:GovernanceSystem",
        "BeZhasCore": "contracts/BeZhasCore.sol:BeZhasCore",
        "LiquidityFarming": "contracts/LiquidityFarming.sol:LiquidityFarming",
        "NFTOffers": "contracts/NFTOffers.sol:NFTOffers",
        "NFTRental": "contracts/NFTRental.sol:NFTRental",
        "BeZhasMarketplace": "contracts/BeZhasMarketplace.sol:BeZhasMarketplace",
        "BeZhasAdminRegistry": "contracts/admin/BeZhasAdminRegistry.sol:BeZhasAdminRegistry"
    };
    return paths[name];
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    });
