/**
 * Test helpers — mock DB, Redis, services and JWT for unit tests
 */
const jwt = require('jsonwebtoken');

// Mismo fallback que config/secrets.js: si divergen, los tokens que firma
// makeToken() no verifican contra la app y todo falla con un 401 opaco.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

// ─── DB mock ───
const mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
jest.mock('../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

// ─── Redis mock ───
const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue('OK');
const mockPublish = jest.fn().mockResolvedValue(1);
jest.mock('../cache/redis', () => ({
    connectRedis: jest.fn().mockResolvedValue(true),
    cacheGet: (...args) => mockCacheGet(...args),
    cacheSet: (...args) => mockCacheSet(...args),
    publish: (...args) => mockPublish(...args),
    checkRateLimit: jest.fn().mockResolvedValue(false),
}));

// ─── EventListener / GasMonitor mock ───
jest.mock('../services/eventListener', () => ({ startListening: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/gasMonitor', () => ({ startDaemon: jest.fn() }));

// ─── Contract service mock ───
const mockContractService = {
    getContract: jest.fn().mockResolvedValue({ address: '0x' + '1'.repeat(40) }),
    getSignedContract: jest.fn().mockResolvedValue({ address: '0x' + '1'.repeat(40) }),
    getAllAddresses: jest.fn().mockResolvedValue({ BEZCoinV2: '0x' + '1'.repeat(40) }),
    getContractAddress: jest.fn().mockResolvedValue('0x' + '1'.repeat(40)),
    loadABI: jest.fn().mockReturnValue([
        'function stake(uint256 amount)',
        'function swap(address,address,uint256,uint256)',
        'function castVote(uint256 proposalId,uint8 support)',
        'function propose(address[] targets,uint256[] values,bytes[] calldatas,string description)',
        'function queue(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash)',
        'function execute(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash)',
    ]),
    getBlockchainStats: jest.fn().mockResolvedValue({ blockNumber: 100, gasPrice: '1000000000' }),
    getBEZTotalSupply: jest.fn().mockResolvedValue('1000000'),
    getTokenInfo: jest.fn().mockResolvedValue({ name: 'BeZhas Coin', symbol: 'BEZ', decimals: 18, totalSupply: '100000000', totalSupplyWei: '100000000000000000000000000', chainId: 31337 }),
    getBEZBalance: jest.fn().mockResolvedValue('500'),
    getStakingInfo: jest.fn().mockResolvedValue({ stakedAmount: '100', rewards: '1', baseEarned: '1', boostedEarned: '1', boostBps: 10000, validatorTier: 0, isValidator: false }),
    getFarmingInfo: jest.fn().mockResolvedValue({ lpAmount: '10', pendingRewards: '1', rewardDebt: '0', lockEndTimestamp: 0, multiplier: 100 }),
    getFarmingPool: jest.fn().mockResolvedValue({ poolId: 0, lpToken: '0x' + '2'.repeat(40), isLP: true }),
    getDEXPool: jest.fn().mockResolvedValue({ token0: '0x' + '1'.repeat(40), token1: '0x' + '2'.repeat(40), reserve0: '1000', reserve1: '1000', totalLiquidity: '1000', exists: true }),
    quoteDEXSwap: jest.fn().mockResolvedValue({ amountIn: '1', amountOut: '0.99', amountOutWei: '990000000000000000' }),
};
jest.mock('../services/contractService', () => mockContractService);

// ─── Tx service mock ───
const mockTxService = {
    watchTx: jest.fn().mockResolvedValue({ tx_hash: '0x' + 'a'.repeat(64), status: 'confirmed' }),
    getRecentTxs: jest.fn().mockResolvedValue({ transactions: [], total: 0, page: 1 }),
    getTxByHash: jest.fn().mockResolvedValue(null),
};
jest.mock('../services/txService', () => mockTxService);

// ─── Wallet service mock ───
const mockWalletService = {
    createSmartWallet: jest.fn().mockResolvedValue({ walletAddress: '0x' + '2'.repeat(40) }),
    getUserWallets: jest.fn().mockResolvedValue([]),
    getSmartWalletInfo: jest.fn().mockResolvedValue({ owner: '0x' + 'f'.repeat(40) }),
    getRemainingDailyLimit: jest.fn().mockResolvedValue('1000'),
    getBalance: jest.fn().mockResolvedValue({ address: '0x' + '2'.repeat(40), nativeBalance: '0', bezBalance: '0' }),
    ensureFiatSafeWalletForUser: jest.fn().mockResolvedValue({
        userId: 1,
        ownerAddress: '0x' + 'f'.repeat(40),
        smartWalletAddress: '0x' + '2'.repeat(40),
        custodyMode: 'managed',
        status: 'active',
    }),
    getWalletPortfolio: jest.fn().mockResolvedValue({ total: '0' }),
    getMultiSigInfo: jest.fn().mockResolvedValue({ owners: [], threshold: 2 }),
    getMultiSigPendingTxs: jest.fn().mockResolvedValue([]),
    getPaymasterEnterpriseInfo: jest.fn().mockResolvedValue({ balance: '0' }),
    getSecurityStatus: jest.fn().mockResolvedValue({ healthy: true }),
    getRecentAuditLogs: jest.fn().mockResolvedValue([]),
    getWalletGuardians: jest.fn().mockResolvedValue([]),
    getGuardianTrustScore: jest.fn().mockResolvedValue(85),
};
jest.mock('../services/walletService', () => mockWalletService);

// ─── Aegis service mock ───
const mockAegisService = {
    processTelemetryAndTokenize: jest.fn().mockResolvedValue({ success: true, tokenId: 1 }),
};
jest.mock('../services/aegisService', () => mockAegisService);

// ─── Agent service mock ───
const mockAgentService = {
    listAgents: jest.fn().mockResolvedValue({ total_agents: 0, total_groups: 0, mcp_tools: 0, aegis_status: 'healthy', groups: [] }),
    getAgentMetrics: jest.fn().mockResolvedValue({ agent_id: 'test', period_days: 7, stats: {}, timeseries: [], recent_logs: [] }),
    invokeMCPTool: jest.fn().mockResolvedValue({ status: 'ok', result: {} }),
    listMCPTools: jest.fn().mockResolvedValue([]),
    getAgentAnalytics: jest.fn().mockResolvedValue({ agents_active: 0, total_actions_24h: 0, critical_alerts_24h: 0, bez_burned_24h: 0, per_agent: [] }),
    getBEZTokenData: jest.fn().mockResolvedValue({ price: 0.42, total_burned: '1000', circulating_supply: '99000', last_updated: new Date().toISOString() }),
};
jest.mock('../services/agentService', () => mockAgentService);

// ─── Axios mock ───
const mockAxios = { get: jest.fn(), put: jest.fn(), post: jest.fn() };
jest.mock('axios', () => mockAxios);

// ─── Stripe mock (webhook routes are loaded by index.js in route tests) ───
jest.mock('stripe', () => jest.fn(() => ({
    webhooks: {
        constructEvent: jest.fn(() => ({
            id: 'evt_test',
            type: 'checkout.session.completed',
            data: { object: { payment_status: 'paid', metadata: {}, amount_total: 100 } },
        })),
    },
})), { virtual: true });

// ─── JWT helper ───
function makeToken(payload = {}) {
    const defaults = {
        address: '0x' + 'f'.repeat(40),
        userId: 1,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
    };
    return jwt.sign({ ...defaults, ...payload }, JWT_SECRET, { expiresIn: '1h' });
}

function makeAdminToken() {
    return makeToken({ role: 'admin' });
}

function makeEnterpriseToken() {
    return makeToken({ role: 'enterprise' });
}

module.exports = {
    mockQuery, mockCacheGet, mockCacheSet, mockPublish,
    mockContractService, mockTxService, mockWalletService, mockAegisService, mockAgentService, mockAxios,
    makeToken, makeAdminToken, makeEnterpriseToken,
};
