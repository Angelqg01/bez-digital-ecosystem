/**
 * Diagnostic: verify Anvil start → deploy → nonce works
 * Run: node __tests__/integration/diag.js
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const { ethers } = require('ethers');

const PORT = 8546;
const RPC = `http://127.0.0.1:${PORT}`;
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ARTIFACTS = path.resolve(__dirname, '..', '..', '..', 'smart-contracts', 'out');

(async () => {
    // 1) Kill stale
    try { execSync('taskkill /F /IM anvil.exe', { stdio: 'ignore' }); } catch { }
    await new Promise(r => setTimeout(r, 1500));

    // 2) Spawn Anvil
    const anvilBin = path.join(process.env.USERPROFILE, '.foundry', 'bin', 'anvil');
    const proc = spawn(anvilBin, ['--port', String(PORT), '--host', '127.0.0.1', '--chain-id', '31337', '--gas-limit', '30000000', '--silent'], { stdio: 'pipe', detached: true });
    proc.unref();

    // 3) Wait
    let provider;
    for (let i = 0; i < 30; i++) {
        try {
            provider = new ethers.JsonRpcProvider(RPC, undefined, { cacheTimeout: -1 });
            const bn = await provider.getBlockNumber();
            console.log(`Anvil ready at block ${bn}`);
            break;
        } catch {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    if (!provider) { console.log('FAIL: Anvil did not start'); process.exit(1); }

    const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
    console.log('Deployer:', deployer.address);

    // 4) Check initial nonce
    const n0 = await provider.getTransactionCount(deployer.address);
    console.log('Initial nonce:', n0);

    // 5) Deploy BEZCoinV2
    const artifact = require(path.join(ARTIFACTS, 'BEZCoinV2.sol', 'BEZCoinV2.json'));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, deployer);
    const bez = await factory.deploy(deployer.address);
    await bez.waitForDeployment();
    const addr = await bez.getAddress();
    console.log('BEZCoinV2 deployed at:', addr);

    // 6) Check nonce after deploy — test both "latest" and "pending"
    const n1_latest = await provider.getTransactionCount(deployer.address, 'latest');
    const n1_pending = await provider.getTransactionCount(deployer.address, 'pending');
    // Direct RPC call bypassing cache
    const n1_rpc = await provider.send('eth_getTransactionCount', [deployer.address, 'latest']);
    console.log('Nonce after deploy (latest):', n1_latest);
    console.log('Nonce after deploy (pending):', n1_pending);
    console.log('Nonce after deploy (RPC raw):', n1_rpc, '=', parseInt(n1_rpc, 16));

    // Try fresh provider
    const freshProvider = new ethers.JsonRpcProvider(RPC);
    const n1_fresh = await freshProvider.getTransactionCount(deployer.address);
    console.log('Nonce after deploy (fresh provider):', n1_fresh);

    // 7) Mint
    const tx = await bez.mint(deployer.address, ethers.parseEther('1000000'));
    await tx.wait();
    console.log('Mint tx:', tx.hash);

    // 8) Check nonce after mint
    const n2 = await provider.getTransactionCount(deployer.address);
    console.log('Nonce after mint:', n2);

    // 9) Now simulate contractService usage
    process.env.BEZHAS_L2_RPC_URL = RPC;
    process.env.DEPLOYER_PRIVATE_KEY = DEPLOYER_KEY;

    // Fresh require of contractService
    const cs = require('../../services/contractService');
    const signer = cs.getSigner();
    const signerAddr = await signer.getAddress();
    const signerNonce = await signer.getNonce();
    console.log('contractService signer address:', signerAddr);
    console.log('contractService signer nonce:', signerNonce);

    // 10) Try sendTransaction
    try {
        const tx2 = await signer.sendTransaction({ to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', value: ethers.parseEther('1.0') });
        await tx2.wait();
        console.log('SUCCESS - tx hash:', tx2.hash);
    } catch (e) {
        console.log('FAIL -', e.shortMessage || e.message);
    }

    // Cleanup
    try { execSync('taskkill /F /IM anvil.exe', { stdio: 'ignore' }); } catch { }
    process.exit(0);
})();
