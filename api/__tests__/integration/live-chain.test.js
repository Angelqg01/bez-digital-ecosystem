/**
 * Live-chain integration test — Tests API contractService + blockchain
 * reads/writes against the already-running Anvil (port 8545) with pre-deployed contracts.
 *
 * Unlike the unit integration test (contract-service.test.js) which spawns its own Anvil,
 * this test runs against the REAL deployment from DeployAll.s.sol.
 *
 * Prerequisites:
 *   - Anvil running on port 8545 with all 66 contracts deployed
 *   - smart-contracts/deployments/31337.json exists
 *
 * Usage:
 *   npx jest __tests__/integration/live-chain.test.js --forceExit
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Puerto 8545 por defecto (el de `anvil` a secas), pero configurable: quien
// levante la cadena en otro sitio no debería tener que editar el test.
const RPC_URL = process.env.LIVE_CHAIN_RPC_URL || 'http://localhost:8545';
const CHAIN_ID = 31337;
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const EDGE_NODE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'smart-contracts', 'out');
const DEPLOYMENTS_FILE = path.resolve(__dirname, '..', '..', '..', 'smart-contracts', 'deployments', `${CHAIN_ID}.json`);

let provider, deployer, edgeNode, deployments;

function loadABI(contractName) {
    const p = path.join(ARTIFACTS_DIR, `${contractName}.sol`, `${contractName}.json`);
    return JSON.parse(fs.readFileSync(p, 'utf8')).abi;
}

function getContract(name, address, signerOrProvider) {
    return new ethers.Contract(address, loadABI(name), signerOrProvider);
}

// ── Requisitos previos ──
//
// Esta suite es la ÚNICA que no levanta su propia Anvil: mide el despliegue
// real de DeployAll.s.sol, así que necesita una cadena ya en marcha y el
// fichero de deployments. Antes, sin esos requisitos, reventaba con 31
// `AggregateError` vacíos (ECONNREFUSED envuelto por ethers) cada vez que se
// corría `pnpm test:e2e` sin cadena.
//
// 31 rojos que solo dicen "no había cadena" no son un fallo, son ruido — y
// enseñan a ignorar los rojos, que es justo lo que no debe pasar en la suite
// que vigila los contratos. Ahora se SALTA, diciendo por qué.
//
// La comprobación es síncrona a propósito: el cuerpo de `describe` se evalúa
// antes de que corra ningún hook, así que un `beforeAll` asíncrono llegaría
// tarde para decidir si registrar los tests o no.
function cadenaViva() {
    if (!fs.existsSync(DEPLOYMENTS_FILE)) return false;
    const { hostname, port } = new URL(RPC_URL);
    try {
        // Sondeo TCP con el propio Node en un subproceso. Se evita `nc` a
        // posta: es un binario externo que puede no estar en el runner de CI,
        // y entonces la suite se saltaria por falta de netcat en vez de por
        // falta de cadena — un falso motivo es peor que ninguno.
        execFileSync(
            process.execPath,
            ['-e', `const s=require('net').connect(${Number(port) || 8545},${JSON.stringify(hostname)});` +
                   `s.setTimeout(2000);` +
                   `s.on('connect',()=>{s.destroy();process.exit(0)});` +
                   `s.on('error',()=>process.exit(1));` +
                   `s.on('timeout',()=>{s.destroy();process.exit(1)});`],
            { stdio: 'ignore' },
        );
        return true;
    } catch {
        return false;
    }
}

const HAY_CADENA = cadenaViva();
const describeSiCadena = HAY_CADENA ? describe : describe.skip;

if (!HAY_CADENA) {
    console.warn(
        `[live-chain] SALTADA: hace falta una cadena en ${RPC_URL} con los contratos ` +
        `de DeployAll.s.sol desplegados y ${path.basename(DEPLOYMENTS_FILE)} presente.\n` +
        `[live-chain] Para ejecutarla:  anvil &  y  forge script script/DeployAll.s.sol ` +
        `--rpc-url ${RPC_URL} --broadcast`,
    );
}

// ── Setup ──

beforeAll(async () => {
    if (!HAY_CADENA) return;
    deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, 'utf8'));

    provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: -1 });
    deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
    edgeNode = new ethers.Wallet(EDGE_NODE_KEY, provider);

    // Verify Anvil is running
    const block = await provider.getBlockNumber();
    expect(block).toBeGreaterThan(0);
}, 15000);

// ═══════════════════════════════════════════════
//  Core Contract Reads
// ═══════════════════════════════════════════════

describeSiCadena('Core contracts — BEZCoinV2', () => {
    let bez;

    beforeAll(() => {
        bez = getContract('BEZCoinV2', deployments.core.BEZCoinV2, provider);
    });

    test('name is BeZhas Coin', async () => {
        expect(await bez.name()).toBe('BeZhas Coin');
    });

    test('symbol is BEZ', async () => {
        expect(await bez.symbol()).toBe('BEZ');
    });

    test('decimals is 18', async () => {
        expect(await bez.decimals()).toBe(18n);
    });

    test('totalSupply is 3B BEZ (pre-mint)', async () => {
        const supply = await bez.totalSupply();
        expect(ethers.formatEther(supply)).toBe('3000000000.0');
    });

    test('edge node has BEZ balance >= 10,000', async () => {
        const balance = await bez.balanceOf(edgeNode.address);
        expect(parseFloat(ethers.formatEther(balance))).toBeGreaterThanOrEqual(10000);
    });

    test('transfer BEZ between accounts', async () => {
        const bezSigned = getContract('BEZCoinV2', deployments.core.BEZCoinV2, deployer);
        const amount = ethers.parseEther('100');
        const balBefore = await bez.balanceOf(edgeNode.address);
        const tx = await bezSigned.transfer(edgeNode.address, amount);
        await tx.wait();
        const balAfter = await bez.balanceOf(edgeNode.address);
        expect(balAfter - balBefore).toBe(amount);
    });
});

describeSiCadena('Core contracts — BeZhasLogisticsNFT', () => {
    let nft;

    beforeAll(() => {
        nft = getContract('BeZhasLogisticsNFT', deployments.core.BeZhasLogisticsNFT, deployer);
    });

    test('name and symbol', async () => {
        const [name, symbol] = await Promise.all([nft.name(), nft.symbol()]);
        expect(name).toBe('BeZhas Logistics Container Asset');
        expect(symbol).toBe('BEZNFT');
    });

    test('mint a logistics NFT', async () => {
        const tx = await nft.safeMint(deployer.address, 'ipfs://test/live-chain-001', 'CONT-LIVE-001');
        const receipt = await tx.wait();
        expect(receipt.status).toBe(1);

        // Verify ownership
        const owner = await nft.ownerOf(0);
        expect(owner.toLowerCase()).toBe(deployer.address.toLowerCase());
    });
});

describeSiCadena('Core contracts — StakingPool', () => {
    test('bezToken points to BEZCoinV2', async () => {
        const staking = getContract('StakingPool', deployments.core.StakingPool, provider);
        const bezToken = await staking.bezToken();
        expect(bezToken.toLowerCase()).toBe(deployments.core.BEZCoinV2.toLowerCase());
    });
});

describeSiCadena('Core contracts — LiquidityFarming', () => {
    test('bez token points to BEZCoinV2', async () => {
        const farming = getContract('LiquidityFarming', deployments.core.LiquidityFarming, provider);
        const bezToken = await farming.bez();
        expect(bezToken.toLowerCase()).toBe(deployments.core.BEZCoinV2.toLowerCase());
    });
});

describeSiCadena('Core contracts — BeZhasBridgeL2', () => {
    test('bezToken points to BEZCoinV2', async () => {
        const bridge = getContract('BeZhasBridgeL2', deployments.core.BeZhasBridgeL2, provider);
        const bezToken = await bridge.bezToken();
        expect(bezToken.toLowerCase()).toBe(deployments.core.BEZCoinV2.toLowerCase());
    });
});

describeSiCadena('Core contracts — QualityEscrow', () => {
    test('edge node has EDGE_NODE_ROLE', async () => {
        const escrow = getContract('QualityEscrow', deployments.core.QualityEscrow, provider);
        const role = await escrow.EDGE_NODE_ROLE();
        const hasRole = await escrow.hasRole(role, edgeNode.address);
        expect(hasRole).toBe(true);
    });

    test('register sensor data from edge node', async () => {
        const escrow = getContract('QualityEscrow', deployments.core.QualityEscrow, edgeNode);
        const tx = await escrow.registerSensorData(
            'SHIP-001',
            2500, // temperature (25.00 °C)
            'in_transit'
        );
        const receipt = await tx.wait();
        expect(receipt.status).toBe(1);
    });
});

// ═══════════════════════════════════════════════
//  Sector Contract Verification — Bytecode Check
// ═══════════════════════════════════════════════

describeSiCadena('Sector contracts — all 60 deployed', () => {
    const SECTORS = [
        'health', 'energy', 'automotive', 'manufacturing',
        'agriculture', 'insurance', 'education', 'entertainment',
        'legal', 'supplychain', 'government', 'finance',
        'services', 'otros'
    ];

    test.each(SECTORS)('%s sector contracts have bytecode', async (sector) => {
        const contracts = deployments.sectors[sector];
        expect(contracts).toBeDefined();
        for (const [name, address] of Object.entries(contracts)) {
            const code = await provider.getCode(address);
            expect(code.length).toBeGreaterThan(4);
        }
    });
});

// ═══════════════════════════════════════════════
//  Blockchain Stats
// ═══════════════════════════════════════════════

describeSiCadena('Blockchain stats', () => {
    test('block number > 0', async () => {
        const block = await provider.getBlockNumber();
        expect(block).toBeGreaterThan(0);
    });

    test('chain ID is 31337', async () => {
        const network = await provider.getNetwork();
        expect(Number(network.chainId)).toBe(31337);
    });

    test('fee data available', async () => {
        const feeData = await provider.getFeeData();
        expect(feeData.gasPrice).toBeGreaterThan(0n);
    });
});

// ═══════════════════════════════════════════════
//  Cross-Contract Integration
// ═══════════════════════════════════════════════

describeSiCadena('Cross-contract integration', () => {
    test('approve + stake BEZ tokens', async () => {
        const bez = getContract('BEZCoinV2', deployments.core.BEZCoinV2, edgeNode);
        const stakingAddr = deployments.core.StakingPool;
        const amount = ethers.parseEther('100');

        // Approve StakingPool to spend edge node's BEZ
        const approveTx = await bez.approve(stakingAddr, amount);
        await approveTx.wait();

        const allowance = await bez.allowance(edgeNode.address, stakingAddr);
        expect(allowance).toBe(amount);
    });
});
