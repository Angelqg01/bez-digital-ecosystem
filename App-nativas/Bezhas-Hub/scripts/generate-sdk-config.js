const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/contracts');
const ADDRESSES_FILE = path.join(__dirname, '../backend/contract-addresses.json');
const OUTPUT_FILE = path.join(__dirname, '../sdk/bezhas-config.js');

const CONTRACTS_TO_INCLUDE = [
    { name: 'BezhasToken', artifact: 'BezhasToken.sol/BezhasToken.json', addressKey: 'BezhasTokenAddress' },
    { name: 'BezhasNFT', artifact: 'BezhasNFT.sol/BezhasNFT.json', addressKey: 'BezhasNFTAddress' },
    { name: 'Marketplace', artifact: 'Marketplace.sol/Marketplace.json', addressKey: 'MarketplaceAddress' },
    { name: 'StakingPool', artifact: 'StakingPool.sol/StakingPool.json', addressKey: 'StakingPoolAddress' },
    { name: 'GamificationSystem', artifact: 'GamificationSystem.sol/GamificationSystem.json', addressKey: 'GamificationSystemAddress' },
    { name: 'UserProfile', artifact: 'UserProfile.sol/UserProfile.json', addressKey: 'UserProfileAddress' },
    { name: 'Post', artifact: 'Post.sol/Post.json', addressKey: 'PostAddress' },
    { name: 'ContentValidator', artifact: 'ContentValidator.sol/ContentValidator.json', addressKey: 'ContentValidatorAddress' }
];

async function generateConfig() {
    try {
        console.log('Reading contract addresses...');
        let addresses = {};
        if (fs.existsSync(ADDRESSES_FILE)) {
            addresses = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
        } else {
            console.warn('⚠️ Warning: contract-addresses.json not found in backend/. Using placeholders.');
        }

        const config = {
            network: 'localhost', // Default to localhost, can be changed
            contracts: {}
        };

        console.log('Reading ABIs...');
        for (const contract of CONTRACTS_TO_INCLUDE) {
            const artifactPath = path.join(ARTIFACTS_DIR, contract.artifact);

            if (fs.existsSync(artifactPath)) {
                const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
                const address = addresses[contract.addressKey] || '';

                config.contracts[contract.name] = {
                    address: address,
                    abi: artifact.abi
                };
                console.log(`✅ Loaded ${contract.name}`);
            } else {
                console.warn(`⚠️ Warning: Artifact not found for ${contract.name} at ${artifactPath}`);
                config.contracts[contract.name] = {
                    address: addresses[contract.addressKey] || '',
                    abi: []
                };
            }
        }

        const fileContent = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Run 'node scripts/generate-sdk-config.js' to regenerate
 */

export const BezhasConfig = ${JSON.stringify(config, null, 2)};
`;

        fs.writeFileSync(OUTPUT_FILE, fileContent);
        console.log(`\n🎉 SDK Config generated successfully at ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('❌ Error generating SDK config:', error);
        process.exit(1);
    }
}

generateConfig();
