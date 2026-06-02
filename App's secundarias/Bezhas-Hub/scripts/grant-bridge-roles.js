// Hardhat script to grant MINTER and BURNER roles on BezhasToken to the Bridge
// Usage:
// npx hardhat run scripts/grant-bridge-roles.js --network <network>
// Requires env: TOKEN_ADDRESS, BRIDGE_ADDRESS

const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const bridgeAddress = process.env.BRIDGE_ADDRESS;

  if (!tokenAddress || !bridgeAddress) {
    throw new Error("Please set TOKEN_ADDRESS and BRIDGE_ADDRESS environment variables");
  }

  const BezhasToken = await ethers.getContractAt("BezhasToken", tokenAddress);

  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const BURNER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BURNER_ROLE"));

  console.log("Granting roles to bridge:");
  console.log("Token:", tokenAddress);
  console.log("Bridge:", bridgeAddress);

  const tx1 = await BezhasToken.grantRole(MINTER_ROLE, bridgeAddress);
  await tx1.wait();
  console.log("MINTER_ROLE granted. Tx:", tx1.hash);

  const tx2 = await BezhasToken.grantRole(BURNER_ROLE, bridgeAddress);
  await tx2.wait();
  console.log("BURNER_ROLE granted. Tx:", tx2.hash);

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
