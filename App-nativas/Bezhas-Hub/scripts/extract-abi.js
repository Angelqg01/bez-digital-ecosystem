const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, '../artifacts/contracts/BeZhasMarketplace.sol/BeZhasMarketplace.json');
const outputPath = path.join(__dirname, '../backend/abis/BeZhasMarketplace.json');

const artifact = require(artifactPath);
fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));
console.log(`ABI extracted to ${outputPath}`);
