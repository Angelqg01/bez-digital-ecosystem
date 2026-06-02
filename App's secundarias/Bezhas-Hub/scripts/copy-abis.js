const fs = require('fs');
const path = require('path');

const contracts = [
  'UserProfile',
  'BezhasToken',
  'StakingPool',
  'Marketplace',
  'BezhasNFT',
  'GovernanceSystem'
];

const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts');
const frontendAbisPath = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'blockchain', 'abis');

if (!fs.existsSync(frontendAbisPath)) {
  fs.mkdirSync(frontendAbisPath, { recursive: true });
}

contracts.forEach(contractName => {
  try {
    const contractArtifactPath = path.join(artifactsPath, `${contractName}.sol`, `${contractName}.json`);
    
    if (!fs.existsSync(contractArtifactPath)) {
      console.warn(`[WARNING] Artifact for ${contractName} not found at ${contractArtifactPath}. Skipping.`);
      return;
    }

    const artifact = JSON.parse(fs.readFileSync(contractArtifactPath, 'utf8'));
    const abi = artifact.abi;

    if (!abi) {
      console.warn(`[WARNING] ABI not found in artifact for ${contractName}. Skipping.`);
      return;
    }

    const frontendAbiFile = path.join(frontendAbisPath, `${contractName}.json`);
    fs.writeFileSync(frontendAbiFile, JSON.stringify(abi, null, 2));
    console.log(`[SUCCESS] Copied ABI for ${contractName} to ${frontendAbiFile}`);
  } catch (error) {
    console.error(`[ERROR] Failed to copy ABI for ${contractName}:`, error);
  }
});

console.log('\nABI copy process completed.');
