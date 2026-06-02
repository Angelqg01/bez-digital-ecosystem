const fs = require('fs');
const path = require('path');

// Paths
const backendConfigPath = path.join(__dirname, '../backend/config.json');
const frontendAddressesPath = path.join(__dirname, '../frontend/src/contract-addresses.json');
const artifactsDir = path.join(__dirname, '../artifacts/contracts');
const frontendAbiDir = path.join(__dirname, '../frontend/src/abis');
const backendAbiDir = path.join(__dirname, '../backend/abis');

// Ensure directories exist
if (!fs.existsSync(frontendAbiDir)) {
    fs.mkdirSync(frontendAbiDir, { recursive: true });
}
if (!fs.existsSync(backendAbiDir)) {
    fs.mkdirSync(backendAbiDir, { recursive: true });
}

// 1. Sync Addresses
console.log("🔄 Syncing Addresses...");
try {
    if (fs.existsSync(backendConfigPath)) {
        const backendConfig = JSON.parse(fs.readFileSync(backendConfigPath, 'utf8'));
        if (backendConfig.contractAddresses) {
            fs.writeFileSync(frontendAddressesPath, JSON.stringify(backendConfig.contractAddresses, null, 2));
            console.log(`   ✅ Addresses synced to ${frontendAddressesPath}`);
        } else {
            console.warn("   ⚠️ No contractAddresses found in backend config.");
        }
    } else {
        console.warn("   ⚠️ Backend config not found.");
    }
} catch (err) {
    console.error("   ❌ Error syncing addresses:", err);
}

// 2. Sync ABIs
console.log("\n🔄 Syncing ABIs...");

const contractsToSync = [
    { name: 'UserProfile', path: 'UserProfile.sol/UserProfile.json' },
    { name: 'Post', path: 'Post.sol/Post.json' },
    { name: 'BezhasNFT', path: 'BezhasNFT.sol/BezhasNFT.json' },
    { name: 'AdvancedMarketplace', path: 'AdvancedMarketplace.sol/AdvancedMarketplace.json' },
    { name: 'StakingPool', path: 'StakingPool.sol/StakingPool.json' },
    { name: 'BezhasToken', path: 'BezhasToken.sol/BezhasToken.json' },
    { name: 'TokenSale', path: 'TokenSale.sol/TokenSale.json' },
    { name: 'Messages', path: 'Messages.sol/Messages.json' },
    { name: 'BezhasBridge', path: 'BezhasBridge.sol/BezhasBridge.json' },
    { name: 'BeZhasMarketplace', path: 'BeZhasMarketplace.sol/BeZhasMarketplace.json' },
    { name: 'GamificationSystem', path: 'GamificationSystem.sol/GamificationSystem.json' }
];

contractsToSync.forEach(contract => {
    const artifactPath = path.join(artifactsDir, contract.path);

    if (fs.existsSync(artifactPath)) {
        try {
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            const abi = artifact.abi;

            // Save to Frontend
            const frontendPath = path.join(frontendAbiDir, `${contract.name}.json`);
            fs.writeFileSync(frontendPath, JSON.stringify(abi, null, 2));
            console.log(`   ✅ ${contract.name} ABI -> Frontend`);

            // Save to Backend (optional but good practice)
            const backendPath = path.join(backendAbiDir, `${contract.name}.json`);
            fs.writeFileSync(backendPath, JSON.stringify(abi, null, 2));
            // console.log(`   ✅ ${contract.name} ABI -> Backend`);

        } catch (e) {
            console.error(`   ❌ Error processing ${contract.name}: ${e.message}`);
        }
    } else {
        console.warn(`   ⚠️ Artifact not found for ${contract.name}`);
    }
});

console.log("\n✨ Synchronization Complete!");
