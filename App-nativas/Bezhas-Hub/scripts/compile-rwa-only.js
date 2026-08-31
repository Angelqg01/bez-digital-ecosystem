const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Compile only RWA contracts (BeZhasRWAFactory and BeZhasVault)
 * This avoids compilation errors from other contracts with old OpenZeppelin imports
 */
async function main() {
    console.log("🔧 Compiling RWA contracts only...\n");

    try {
        // Use solc directly to compile specific contracts
        const { stdout, stderr } = await execAsync(
            'npx solc --optimize --bin --abi ' +
            '--base-path . ' +
            '--include-path node_modules ' +
            '-o artifacts/contracts/BeZhasRWAFactory.sol ' +
            '--overwrite ' +
            'contracts/BeZhasRWAFactory.sol contracts/BeZhasVault.sol',
            { cwd: process.cwd() }
        );

        if (stdout) console.log(stdout);
        if (stderr && !stderr.includes('Warning')) console.error(stderr);

        console.log("\n✅ RWA contracts compiled successfully!");
        console.log("📁 Artifacts saved to artifacts/contracts/");

    } catch (error) {
        console.error("❌ Compilation failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
