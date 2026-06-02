const { ethers } = require("ethers");
require("dotenv").config();

/**
 * Script de Configuración Post-Deploy
 * Configura roles, permisos y parámetros iniciales de todos los contratos
 * Network: Polygon Mainnet
 */

const BEZCOIN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

const CONTRACTS = {
    qualityEscrow: "0x3088573c025F197A886b97440761990c9A9e83C9",
    rwaFactory: "0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0",
    rwaVault: "0xCDd23058bf8143680f0A320318604bB749f701ED",
    governance: "0x304Fd77f64C03482edcec0923f0Cd4A066a305F3",
    core: "0x260A9fBcE1c6817c04e51c170b5BFd8d594c0d8A",
    farming: "0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26",
    nftOffers: "0x0C9Bf667b838f6d466619ddb90a08d6c9A64d0A4",
    nftRental: "0x96B1754BbfdC5a2f6013A8a04cB6AF2E4090C024",
    marketplace: "0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE",
    adminRegistry: "0xfCe2F7dcf1786d1606b9b858E9ba04dA499F1e3C"
};

// ABIs mínimos necesarios
const CORE_ABI = [
    "function grantRole(bytes32 role, address account) external",
    "function AUTOMATION_ROLE() view returns (bytes32)",
    "function ADMIN_ROLE() view returns (bytes32)",
    "function hasRole(bytes32 role, address account) view returns (bool)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const FARMING_ABI = [
    "function add(uint256 allocPoint, address lpToken, bool withUpdate) external"
];

const ADMIN_REGISTRY_ABI = [
    "function addAdmin(address account) external",
    "function isAdmin(address account) view returns (bool)"
];

async function main() {
    console.log("\n⚙️  Configurando Contratos Post-Deploy (Polygon Mainnet)...");
    console.log("=".repeat(60));

    // Setup
    const rpcUrl = process.env.POLYGON_MAINNET_RPC || "https://polygon-bor.publicnode.com";
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("❌ PRIVATE_KEY missing");

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("📝 Configurando desde:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Balance:", ethers.utils.formatEther(balance), "MATIC\n");

    const gasOverrides = {
        maxPriorityFeePerGas: ethers.utils.parseUnits("50", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("500", "gwei"),
        gasLimit: 300000
    };

    // ========================================================
    // 1. CONFIGURAR ADMIN REGISTRY
    // ========================================================
    console.log("📋 1. Configurando BeZhasAdminRegistry...");
    const adminRegistry = new ethers.Contract(CONTRACTS.adminRegistry, ADMIN_REGISTRY_ABI, wallet);

    try {
        const isAdmin = await adminRegistry.isAdmin(wallet.address);
        console.log("   Deployer es admin:", isAdmin ? "✅ YES" : "❌ NO");

        // Agregar Safe Wallet como admin adicional
        const safeWallet = "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3";
        const isSafeAdmin = await adminRegistry.isAdmin(safeWallet);
        if (!isSafeAdmin) {
            console.log("   Agregando Safe Wallet como admin...");
            const tx = await adminRegistry.addAdmin(safeWallet, gasOverrides);
            await tx.wait();
            console.log("   ✅ Safe Wallet agregado como admin");
        } else {
            console.log("   ℹ️  Safe Wallet ya es admin");
        }
    } catch (error) {
        console.log("   ⚠️  Error:", error.message);
    }

    // ========================================================
    // 2. CONFIGURAR BEZHAS CORE - ROLES
    // ========================================================
    console.log("\n📋 2. Configurando BeZhasCore Roles...");
    const core = new ethers.Contract(CONTRACTS.core, CORE_ABI, wallet);

    try {
        const AUTOMATION_ROLE = await core.AUTOMATION_ROLE();
        const hasAutomationRole = await core.hasRole(AUTOMATION_ROLE, wallet.address);

        if (!hasAutomationRole) {
            console.log("   Otorgando AUTOMATION_ROLE al deployer...");
            const tx = await core.grantRole(AUTOMATION_ROLE, wallet.address, gasOverrides);
            await tx.wait();
            console.log("   ✅ AUTOMATION_ROLE otorgado");
        } else {
            console.log("   ℹ️  Deployer ya tiene AUTOMATION_ROLE");
        }
    } catch (error) {
        console.log("   ⚠️  Error:", error.message);
    }

    // ========================================================
    // 3. APROBAR BEZ TOKENS PARA CONTRATOS
    // ========================================================
    console.log("\n📋 3. Aprobando BEZ tokens para contratos...");
    const bezToken = new ethers.Contract(BEZCOIN_ADDRESS, ERC20_ABI, wallet);

    const contractsToApprove = [
        { name: "Quality Escrow", address: CONTRACTS.qualityEscrow },
        { name: "RWA Factory", address: CONTRACTS.rwaFactory },
        { name: "Marketplace", address: CONTRACTS.marketplace },
        { name: "NFT Offers", address: CONTRACTS.nftOffers },
        { name: "NFT Rental", address: CONTRACTS.nftRental },
        { name: "Farming", address: CONTRACTS.farming }
    ];

    const approvalAmount = ethers.utils.parseEther("1000000"); // 1M BEZ approval

    for (const contract of contractsToApprove) {
        try {
            const currentAllowance = await bezToken.allowance(wallet.address, contract.address);
            if (currentAllowance.lt(ethers.utils.parseEther("100000"))) {
                console.log(`   Aprobando ${contract.name}...`);
                const tx = await bezToken.approve(contract.address, approvalAmount, gasOverrides);
                await tx.wait();
                console.log(`   ✅ ${contract.name} aprobado`);
            } else {
                console.log(`   ℹ️  ${contract.name} ya tiene suficiente allowance`);
            }
        } catch (error) {
            console.log(`   ⚠️  Error con ${contract.name}:`, error.message);
        }
    }

    // ========================================================
    // RESUMEN
    // ========================================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 CONFIGURACIÓN COMPLETADA!");
    console.log("=".repeat(60));

    console.log("\n✅ Configuraciones aplicadas:");
    console.log("   1. Admin Registry configurado con Safe Wallet");
    console.log("   2. BeZhasCore roles otorgados");
    console.log("   3. BEZ tokens aprobados para todos los contratos");

    console.log("\n📝 Próximos pasos recomendados:");
    console.log("   1. Transferir fondos BEZ a los contratos que lo requieran");
    console.log("   2. Configurar pools en LiquidityFarming");
    console.log("   3. Configurar NFTs permitidos en NFTOffers/NFTRental");
    console.log("   4. Probar flujos completos en testnet primero");
    console.log("   5. Monitorear eventos de contratos en el backend\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    });
