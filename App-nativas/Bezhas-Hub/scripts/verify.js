// Verify deployed contracts on Etherscan/Polygonscan
// Usage: npx hardhat run scripts/verify.js --network <network>
// Requires env: ETHERSCAN_API_KEY / POLYGONSCAN_API_KEY and the deployed addresses

const hre = require("hardhat");

async function verify(address, constructorArgs = []) {
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`✔ Verified ${address}`);
  } catch (e) {
    if (e.message && e.message.includes('Already Verified')) {
      console.log(`✔ Already verified ${address}`);
    } else {
      console.warn(`✖ Could not verify ${address}:`, e.message);
    }
  }
}

async function main() {
  const config = require('../backend/config.json');
  const addrs = config.contractAddresses || {};

  // Adjust constructor args if needed per contract
  await verify(addrs.BezhasTokenAddress, [hre.ethers.parseUnits("100000000", 18)]);
  await verify(addrs.UserProfileAddress);
  await verify(addrs.PostAddress, [addrs.UserProfileAddress]);
  await verify(addrs.BezhasNFTAddress);
  await verify(addrs.MarketplaceAddress, [addrs.BezhasTokenAddress]);
  await verify(addrs.StakingPoolAddress, [addrs.BezhasTokenAddress]);
  await verify(addrs.TokenSaleAddress, [addrs.BezhasTokenAddress, (await hre.ethers.getSigners())[0].address, hre.ethers.parseEther("0.001")]);
  await verify(addrs.MessagesAddress);

  // Bridge verify requires router + token constructor args
  const networkName = hre.network.name;
  const routers = {
    sepolia: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
    amoy: "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2",
  };
  const router = routers[networkName];
  if (router) {
    await verify(addrs.BezhasBridgeAddress, [router, addrs.BezhasTokenAddress]);
  } else {
    console.log('Skipping bridge verify on this network');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
