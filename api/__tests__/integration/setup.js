/**
 * Integration test setup — Anvil lifecycle + contract deployment.
 *
 * Spawns a local Anvil instance, deploys core contracts (BEZCoinV2,
 * BeZhasLogisticsNFT, QualityEscrow), and provides ethers.js primitives
 * for the test suites.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const { ethers } = require('ethers');

const ANVIL_PORT = 8546; // use non-default port to avoid conflicts
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const ARTIFACTS = path.resolve(__dirname, '..', '..', '..', 'smart-contracts', 'out');

// Anvil default accounts (deterministic)
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ENTERPRISE_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

let anvilProcess = null;
let provider = null;
let deployer = null;
let user = null;
let enterprise = null;

// Deployed contract addresses (filled after deploy)
const contracts = {};

function loadArtifact(name) {
    return require(path.join(ARTIFACTS, `${name}.sol`, `${name}.json`));
}

async function waitForAnvil(maxRetries = 60) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            // cacheTimeout: -1 disables ethers v6 internal result caching
            // which returns stale nonces on the same provider instance
            const p = new ethers.JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: -1 });
            await p.getBlockNumber();
            return p;
        } catch {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    throw new Error('Anvil failed to start');
}

/**
 * Start Anvil and deploy core contracts.
 * Call this in beforeAll().
 */
async function startAnvil() {
    // Kill any stale Anvil processes from previous runs
    try { execSync('taskkill /F /IM anvil.exe', { stdio: 'ignore' }); } catch { /* no-op */ }
    await new Promise(r => setTimeout(r, 1000)); // give OS time to free port

    // Locate anvil binary
    const anvilBin = process.env.ANVIL_BIN ||
        path.join(process.env.USERPROFILE || process.env.HOME, '.foundry', 'bin', 'anvil');

    anvilProcess = spawn(anvilBin, [
        '--port', String(ANVIL_PORT),
        '--host', '127.0.0.1',
        '--chain-id', '31337',
        '--gas-limit', '30000000',
        '--silent',
    ], { stdio: 'ignore' });

    anvilProcess.on('error', (err) => {
        console.error('Anvil spawn error:', err.message);
    });

    provider = await waitForAnvil();
    deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
    user = new ethers.Wallet(USER_KEY, provider);
    enterprise = new ethers.Wallet(ENTERPRISE_KEY, provider);

    // Clear cached provider/signer in contractService so it picks up our Anvil
    clearContractServiceCache();
}

/**
 * Deploy core contracts used in integration tests.
 */
async function deployContracts() {
    // BEZCoinV2
    const bezArtifact = loadArtifact('BEZCoinV2');
    const BEZFactory = new ethers.ContractFactory(bezArtifact.abi, bezArtifact.bytecode.object, deployer);
    const bez = await BEZFactory.deploy(deployer.address);
    await bez.waitForDeployment();
    contracts.BEZCoinV2 = { address: await bez.getAddress(), instance: bez };

    // Mint tokens to deployer, user, enterprise
    await (await bez.mint(deployer.address, ethers.parseEther('1000000'))).wait();
    await (await bez.mint(user.address, ethers.parseEther('10000'))).wait();
    await (await bez.mint(enterprise.address, ethers.parseEther('50000'))).wait();

    // BeZhasLogisticsNFT
    const nftArtifact = loadArtifact('BeZhasLogisticsNFT');
    const NFTFactory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode.object, deployer);
    const nft = await NFTFactory.deploy(deployer.address);
    await nft.waitForDeployment();
    contracts.BeZhasLogisticsNFT = { address: await nft.getAddress(), instance: nft };

    // Grant MINTER_ROLE to deployer (for test minting)
    const MINTER_ROLE = await nft.MINTER_ROLE();
    await (await nft.grantRole(MINTER_ROLE, deployer.address)).wait();

    // QualityEscrow
    const escrowArtifact = loadArtifact('QualityEscrow');
    const EscrowFactory = new ethers.ContractFactory(escrowArtifact.abi, escrowArtifact.bytecode.object, deployer);
    const escrow = await EscrowFactory.deploy();
    await escrow.waitForDeployment();
    contracts.QualityEscrow = { address: await escrow.getAddress(), instance: escrow };

    // Grant EDGE_NODE_ROLE on escrow for IoT data registration
    const EDGE_NODE_ROLE = await escrow.EDGE_NODE_ROLE();
    await (await escrow.grantRole(EDGE_NODE_ROLE, deployer.address)).wait();

    return contracts;
}

/**
 * Stop Anvil. Call this in afterAll().
 */
async function stopAnvil() {
    if (anvilProcess) {
        // On Windows SIGTERM doesn't work; use taskkill
        try { execSync('taskkill /F /IM anvil.exe', { stdio: 'ignore' }); } catch { /* no-op */ }
        anvilProcess = null;
    }
}

/**
 * Clear cached provider/signer in contractService so tests use our Anvil.
 * Must be called after Anvil starts and env vars are set.
 */
function clearContractServiceCache() {
    const csPath = require.resolve('../../services/contractService');
    delete require.cache[csPath];
    // Also clear txService since it imports from contractService
    const txPath = require.resolve('../../services/txService');
    if (require.cache[txPath]) delete require.cache[txPath];
    const aegisPath = path.resolve(__dirname, '..', '..', 'services', 'aegisService.js');
    if (require.cache[aegisPath]) delete require.cache[aegisPath];
    const gasPath = path.resolve(__dirname, '..', '..', 'services', 'gasMonitor.js');
    if (require.cache[gasPath]) delete require.cache[gasPath];
}

/**
 * Get the mock DB query function that returns contract addresses.
 * Used to override the DB lookup in contractService.
 */
function mockContractAddressQuery() {
    return jest.fn().mockImplementation((sql, params) => {
        // Handle contract address lookups
        if (sql.includes('contract_addresses') && sql.includes('SELECT')) {
            // Detect contract name from SQL param order
            let contractName;
            if (sql.match(/name\s*=\s*\$1/)) {
                contractName = params?.[0]; // route: WHERE name = $1 AND chain_id = $2
            } else if (sql.match(/name\s*=\s*\$2/)) {
                contractName = params?.[1]; // contractService: WHERE chain_id = $1 AND name = $2
            }

            if (contractName && contracts[contractName]) {
                return { rows: [{ address: contracts[contractName].address, name: contractName, chain_id: 31337, category: 'core', deployed_at: new Date().toISOString() }], rowCount: 1 };
            }

            // getAllAddresses query (no specific contract name)
            if (!contractName) {
                const rows = Object.entries(contracts).map(([n, c]) => ({
                    name: n, address: c.address, category: 'core', deployed_at: new Date().toISOString(),
                }));
                return { rows, rowCount: rows.length };
            }
            return { rows: [], rowCount: 0 };
        }
        // Default: return empty
        return { rows: [], rowCount: 0 };
    });
}

/**
 * Override contractService's getProvider/getSigner to use our Anvil
 * provider and deployer wallet directly. This avoids all singleton/nonce
 * issues because the deployer wallet already has the correct nonce state
 * after deployContracts(). Must be called AFTER startAnvil + deployContracts,
 * and BEFORE requiring any service that depends on contractService.
 */
function patchContractService() {
    clearContractServiceCache();
    const cs = require('../../services/contractService');
    // Set internal provider/signer variables directly so that internal calls
    // (e.g. getSignedContract calling local getSigner) use Anvil instances.
    cs._setForTests(provider, deployer);
    // Also overwrite exports for any code that destructures getProvider/getSigner.
    cs.getProvider = () => provider;
    cs.getSigner = () => deployer;
    return cs;
}

module.exports = {
    ANVIL_PORT,
    RPC_URL,
    DEPLOYER_KEY,
    USER_KEY,
    ENTERPRISE_KEY,
    startAnvil,
    deployContracts,
    stopAnvil,
    clearContractServiceCache,
    patchContractService,
    contracts,
    mockContractAddressQuery,
    get provider() { return provider; },
    get deployer() { return deployer; },
    get user() { return user; },
    get enterprise() { return enterprise; },
};
