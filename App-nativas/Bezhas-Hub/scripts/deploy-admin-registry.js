const hre = require("hardhat");

async function main() {
    console.log("Deploying BeZhasAdminRegistry...");

    const BeZhasAdminRegistry = await hre.ethers.getContractFactory("BeZhasAdminRegistry");
    const adminRegistry = await BeZhasAdminRegistry.deploy();

    await adminRegistry.waitForDeployment();

    const address = await adminRegistry.getAddress();
    console.log("BeZhasAdminRegistry deployed to:", address);

    // Verify contract if on a live network (optional)
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("Waiting for block confirmations...");
        await adminRegistry.deploymentTransaction().wait(6);
        await verify(address, []);
    }
}

async function verify(contractAddress, args) {
    console.log("Verifying contract...");
    try {
        await hre.run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(e);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
