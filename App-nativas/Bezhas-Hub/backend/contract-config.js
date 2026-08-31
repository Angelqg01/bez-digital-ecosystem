/**
 * Smart Contract Configuration
 * Addresses and ABIs for BeZhas contracts
 */

const fs = require('fs');
const path = require('path');

// Load contract addresses from deployment file
let contractAddresses = {};
try {
    const addressFile = path.join(__dirname, 'contract-addresses.json');
    if (fs.existsSync(addressFile)) {
        contractAddresses = JSON.parse(fs.readFileSync(addressFile, 'utf8'));
    }
} catch (error) {
    console.warn('⚠️  Could not load contract addresses:', error.message);
}

// Load ABIs from artifacts
function loadABI(contractName) {
    try {
        const artifactPath = path.join(__dirname, '../artifacts/contracts', `${contractName}.sol/${contractName}.json`);
        if (fs.existsSync(artifactPath)) {
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            return artifact.abi;
        }
    } catch (error) {
        console.warn(`⚠️  Could not load ABI for ${contractName}:`, error.message);
    }
    return [];
}

// Export configuration
module.exports = {
    // Post Contract
    PostAddress: contractAddresses.Post || process.env.POST_CONTRACT_ADDRESS,
    PostABI: loadABI('Post'),

    // BezhasToken Contract
    BezhasTokenAddress: contractAddresses.BezhasToken || process.env.TOKEN_CONTRACT_ADDRESS,
    BezhasTokenABI: loadABI('BezhasToken'),

    // Marketplace Contract
    MarketplaceAddress: contractAddresses.Marketplace || process.env.MARKETPLACE_CONTRACT_ADDRESS,
    MarketplaceABI: loadABI('Marketplace'),

    // UserProfile Contract
    UserProfileAddress: contractAddresses.UserProfile || process.env.USERPROFILE_CONTRACT_ADDRESS,
    UserProfileABI: loadABI('UserProfile'),

    // StakingPool Contract
    StakingPoolAddress: contractAddresses.StakingPool || process.env.STAKING_CONTRACT_ADDRESS,
    StakingPoolABI: loadABI('StakingPool'),
};
