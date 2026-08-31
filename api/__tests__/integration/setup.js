/**
 * Integration test setup — Anvil lifecycle + contract deployment.
 *
 * Spawns a local Anvil instance, deploys core contracts (BEZCoinV2,
 * BeZhasLogisticsNFT, QualityEscrow), and provides ethers.js primitives
 * for the test suites.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { ethers } = require('ethers');

const ARTIFACTS = path.resolve(__dirname, '..', '..', '..', 'smart-contracts', 'out');

// ─── Un puerto por suite ─────────────────────────────────────────────────────
//
// Antes todas las suites compartían el 8546. Al encadenarlas, cada una mataba
// y relevantaba Anvil en ese mismo puerto: si el socket no se había liberado
// todavía, la siguiente se enganchaba a la cadena de la anterior —con los
// contratos ya desplegados— y el despliegue reventaba con errores que no
// apuntaban a nada. En paralelo era peor: dos suites en el mismo puerto a la vez.
//
// Ahora el puerto sale de dos datos: el worker de Jest (los workers corren a la
// vez, así que cada uno recibe un bloque propio y disjunto) y el nombre del
// fichero de test (dentro del bloque, cada suite cae en su propia ranura).
const PORT_BASE = 8600;
const BLOCK_SIZE = 50;

function suiteName() {
    // El fichero que nos ha requerido. Disponible en tiempo de carga porque
    // este módulo siempre se importa desde una suite.
    try {
        if (typeof expect !== 'undefined' && expect.getState) {
            const p = expect.getState().testPath;
            if (p) return path.basename(p);
        }
    } catch { /* fuera de Jest */ }
    return path.basename(module.parent?.filename || 'default');
}

function slotFor(name) {
    const digest = crypto.createHash('sha1').update(name).digest();
    return digest.readUInt16BE(0) % BLOCK_SIZE;
}

const WORKER = Number(process.env.JEST_WORKER_ID || 1);
// Puerto propuesto. `startAnvil` lo confirma y, si estuviera ocupado, avanza al
// siguiente libre — de ahí que se exponga por getter y no como constante.
let ANVIL_PORT = PORT_BASE + (WORKER - 1) * BLOCK_SIZE + slotFor(suiteName());
let RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

function setPort(port) {
    ANVIL_PORT = port;
    RPC_URL = `http://127.0.0.1:${port}`;
    // Las suites fijan BEZHAS_L2_RPC_URL al cargar el módulo; si el puerto se
    // desplaza hay que reflejarlo, porque contractService lo lee al recargarse.
    process.env.BEZHAS_L2_RPC_URL = RPC_URL;
}

// Anvil default accounts (deterministic)
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ENTERPRISE_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

let anvilProcess = null;
let provider = null;

/**
 * Mata Anvil de forma portable.
 *
 * Antes solo se ejecutaba `taskkill` (Windows): en Linux/macOS el comando no
 * existe, la excepción se tragaba y el Anvil que lanza esta suite quedaba
 * huérfano ocupando el puerto. Los procesos se iban acumulando entre
 * ejecuciones y competían con el Anvil compartido del resto de tests, que
 * empezaba a responder `request timeout`. De ahí que fallara una suite
 * distinta en cada vuelta.
 *
 * `child` a null = barrido de restos de ejecuciones anteriores de ESTA suite.
 */
function killAnvil(child = null) {
    if (process.platform === 'win32') {
        try { execSync('taskkill /F /IM anvil.exe', { stdio: 'ignore' }); } catch { /* no-op */ }
        return;
    }

    if (child && child.pid) {
        try { process.kill(child.pid, 'SIGTERM'); } catch { /* ya estaba muerto */ }
        // Cortesía primero, contundencia después: si sigue vivo, SIGKILL.
        try { execSync(`kill -0 ${child.pid} 2>/dev/null && sleep 0.3 && kill -9 ${child.pid} 2>/dev/null`, { stdio: 'ignore', shell: '/bin/sh' }); } catch { /* no-op */ }
        return;
    }

    // Barrido de restos: `pgrep -x` exige que el proceso se LLAME anvil, y solo
    // entonces se mira si su línea de órdenes lleva nuestro puerto. Un `pkill -f`
    // a secas casaría con cualquier proceso que mencione la cadena (el propio
    // shell que lanza los tests, por ejemplo) y se lo llevaría por delante.
    try {
        execSync(
            `for p in $(pgrep -x anvil 2>/dev/null); do ` +
            `grep -qa -- "--port ${ANVIL_PORT}" /proc/$p/cmdline 2>/dev/null && kill -9 "$p" 2>/dev/null; ` +
            `done`,
            { stdio: 'ignore', shell: '/bin/sh' }
        );
    } catch { /* ninguno vivo */ }
}
let deployer = null;
let user = null;
let enterprise = null;

// Deployed contract addresses (filled after deploy)
const contracts = {};

function loadArtifact(name) {
    return require(path.join(ARTIFACTS, `${name}.sol`, `${name}.json`));
}

/**
 * Espera a que el puerto quede realmente libre antes de volver a ocuparlo.
 *
 * Las cinco suites de integración comparten el puerto 8546 y cada una levanta
 * y mata su propio Anvil. Una espera fija de 1 s no garantiza que el sistema
 * haya soltado el socket, y la siguiente suite arrancaba contra un puerto aún
 * ocupado. Aquí se comprueba de verdad, con un tope por si acaso.
 */
function isPortBusy(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(200);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.once('error', () => { socket.destroy(); resolve(false); });
        socket.connect(port, '127.0.0.1');
    });
}

async function waitForPortFree(port, maxRetries = 40) {
    for (let i = 0; i < maxRetries; i++) {
        if (!await isPortBusy(port)) return true;
        await new Promise(r => setTimeout(r, 250));
    }
    return false;
}

/**
 * Puerto libre a partir del propuesto. El de la suite debería estarlo siempre;
 * el barrido es la red de seguridad para que dos suites nunca acaben peleándose
 * por el mismo socket aunque el reparto colisione o quede algo de otra ejecución.
 */
async function resolveFreePort(preferred, span = BLOCK_SIZE) {
    if (await waitForPortFree(preferred, 8)) return preferred;
    for (let p = preferred + 1; p < preferred + span; p++) {
        if (!await isPortBusy(p)) return p;
    }
    return null;
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
    // Restos de esta misma suite en ejecuciones anteriores.
    killAnvil();

    const port = await resolveFreePort(ANVIL_PORT);
    if (port === null) {
        // Arrancar de todos modos haría que el spawn fallase en silencio y que
        // `waitForAnvil` se enganchase a la cadena AJENA que ocupa el puerto.
        // Desplegar encima de contratos ya existentes revienta con un
        // `execution reverted` que no dice nada del problema real.
        throw new Error(
            `No hay ningún puerto libre para Anvil entre ${ANVIL_PORT} y ${ANVIL_PORT + BLOCK_SIZE - 1}.`
        );
    }
    setPort(port);

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

// Gas explícito para las transacciones de montaje.
//
// Sin esto, ethers pide una estimación por transacción y la envía como límite
// exacto. Al encadenar transacciones contra Anvil, la estimación se calcula a
// veces sobre un estado en el que la ranura de almacenamiento ya está caliente,
// y al ejecutarse en frío el `mint` cuesta más de lo estimado: la transacción se
// queda sin gas y revierte con `gasUsed == gasLimit`. Era intermitente (~1 de
// cada 8 arranques) y se manifestaba como un `execution reverted` sin motivo,
// que además hacía caer una suite distinta en cada vuelta.
//
// El bloque local admite 30M de gas, así que un techo holgado no cuesta nada y
// saca la estimación del camino.
const SETUP_TX = { gasLimit: 2_000_000 };

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
    await (await bez.mint(deployer.address, ethers.parseEther('1000000'), SETUP_TX)).wait();
    await (await bez.mint(user.address, ethers.parseEther('10000'), SETUP_TX)).wait();
    await (await bez.mint(enterprise.address, ethers.parseEther('50000'), SETUP_TX)).wait();

    // BeZhasLogisticsNFT
    const nftArtifact = loadArtifact('BeZhasLogisticsNFT');
    const NFTFactory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode.object, deployer);
    const nft = await NFTFactory.deploy(deployer.address);
    await nft.waitForDeployment();
    contracts.BeZhasLogisticsNFT = { address: await nft.getAddress(), instance: nft };

    // Grant MINTER_ROLE to deployer (for test minting)
    const MINTER_ROLE = await nft.MINTER_ROLE();
    await (await nft.grantRole(MINTER_ROLE, deployer.address, SETUP_TX)).wait();

    // QualityEscrow
    const escrowArtifact = loadArtifact('QualityEscrow');
    const EscrowFactory = new ethers.ContractFactory(escrowArtifact.abi, escrowArtifact.bytecode.object, deployer);
    const escrow = await EscrowFactory.deploy();
    await escrow.waitForDeployment();
    contracts.QualityEscrow = { address: await escrow.getAddress(), instance: escrow };

    // Grant EDGE_NODE_ROLE on escrow for IoT data registration
    const EDGE_NODE_ROLE = await escrow.EDGE_NODE_ROLE();
    await (await escrow.grantRole(EDGE_NODE_ROLE, deployer.address, SETUP_TX)).wait();

    return contracts;
}

/**
 * Stop Anvil. Call this in afterAll().
 */
async function stopAnvil() {
    if (anvilProcess) {
        killAnvil(anvilProcess);
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
    // Getters: `startAnvil` puede desplazar el puerto si el propuesto no está
    // libre, y quien lea esto después debe ver el que se está usando de verdad.
    get ANVIL_PORT() { return ANVIL_PORT; },
    get RPC_URL() { return RPC_URL; },
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
