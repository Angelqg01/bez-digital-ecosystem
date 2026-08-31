const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const initialSupply = hre.ethers.parseUnits("1000000", 18); // 1M BZH
    const BZH = await hre.ethers.getContractFactory("BZHToken");
    const bzh = await BZH.deploy(initialSupply);
    await bzh.waitForDeployment();

    const addr = await bzh.getAddress();
    console.log("BZH deployed at:", addr);

    // write to frontend addresses if exists
    const frontendPath = path.join(__dirname, "..", "frontend", "public", "contract-addresses.json");
    try {
        const current = fs.existsSync(frontendPath) ? JSON.parse(fs.readFileSync(frontendPath, "utf8")) : {};
        current.BZHToken = addr;
        fs.writeFileSync(frontendPath, JSON.stringify(current, null, 2));
        console.log("Updated frontend/public/contract-addresses.json with BZHToken address");
    } catch (e) {
        console.warn("Could not update frontend addresses:", e.message);
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
