/**
 * BeZhas SDK — Gateway Client
 * 
 * Lightweight client for external apps (DeFi, App, Web3) to interact
 * with the BeZhas Core API Gateway. Works in both Node.js and browser.
 * 
 * Usage:
 *   const { GatewayClient } = require('@bezhas/sdk/gateway-client');
 *   const gw = new GatewayClient({ 
 *     gatewayUrl: 'http://localhost:3001/api/gateway/v1',
 *     apiKey: 'bzk_...' 
 *   });
 *   const tokens = await gw.sso.login({ walletAddress, signature, message, appOrigin: 'defi' });
 *   const balance = await gw.wallet.getBalance('0x...');
 */

class GatewayClient {
    /**
     * @param {Object} config
     * @param {string} config.gatewayUrl - Core Gateway base URL
     * @param {string} config.apiKey - Registered app API key
     * @param {string} [config.accessToken] - Pre-existing SSO access token
     */
    constructor(config = {}) {
        this.gatewayUrl = (config.gatewayUrl || 'http://localhost:3001/api/gateway/v1').replace(/\/$/, '');
        this.apiKey = config.apiKey || '';
        this.accessToken = config.accessToken || null;
        this.refreshToken = config.refreshToken || null;
        this.onTokenRefresh = config.onTokenRefresh || null; // callback(tokens)

        // Service namespaces
        this.sso = this._createSSOClient();
        this.wallet = this._createWalletClient();
        this.staking = this._createStakingClient();
        this.farming = this._createFarmingClient();
        this.governance = this._createGovernanceClient();
        this.bridge = this._createBridgeClient();
        this.treasury = this._createTreasuryClient();
        this.token = this._createTokenClient();
        this.contracts = this._createContractsClient();
        this.apps = this._createAppsClient();
        this.payments = this._createPaymentsClient();
        this.dex = this._createDEXClient();
    }

    // ── Internal HTTP ──────────────────────────────────────

    async _fetch(path, options = {}) {
        const url = `${this.gatewayUrl}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'x-api-key': this.apiKey }),
            ...(this.accessToken && { 'Authorization': `Bearer ${this.accessToken}` }),
            ...options.headers,
        };

        // Use native fetch (Node 18+ / browser)
        const response = await fetch(url, {
            ...options,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });

        const data = await response.json();

        // Auto-refresh on 403
        if (response.status === 403 && this.refreshToken && !options._retried) {
            const refreshed = await this.sso.refresh(this.refreshToken);
            if (refreshed.success) {
                this.accessToken = refreshed.accessToken;
                this.refreshToken = refreshed.refreshToken;
                if (this.onTokenRefresh) this.onTokenRefresh(refreshed);
                return this._fetch(path, { ...options, _retried: true });
            }
        }

        if (!response.ok) {
            const error = new Error(data.error || `Gateway error ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    }

    _get(path, query = {}) {
        const qs = new URLSearchParams(query).toString();
        const fullPath = qs ? `${path}?${qs}` : path;
        return this._fetch(fullPath, { method: 'GET' });
    }

    _post(path, body) {
        return this._fetch(path, { method: 'POST', body });
    }

    // ── SSO ────────────────────────────────────────────────

    _createSSOClient() {
        return {
            login: async ({ walletAddress, signature, message, appOrigin }) => {
                const result = await this._fetch('/sso/login', {
                    method: 'POST',
                    body: { walletAddress, signature, message, appOrigin },
                    headers: {}, // No API key needed for SSO
                });
                if (result.success) {
                    this.accessToken = result.accessToken;
                    this.refreshToken = result.refreshToken;
                }
                return result;
            },
            refresh: async (refreshToken, appOrigin) => {
                const result = await this._fetch('/sso/refresh', {
                    method: 'POST',
                    body: { refreshToken: refreshToken || this.refreshToken, appOrigin },
                    headers: {},
                });
                if (result.success) {
                    this.accessToken = result.accessToken;
                    this.refreshToken = result.refreshToken;
                }
                return result;
            },
            fiatRegister: async ({ email, password, username, appOrigin = 'app' }) => {
                const result = await this._fetch('/sso/fiat/register', {
                    method: 'POST',
                    body: { email, password, username, appOrigin },
                    headers: {},
                });
                if (result.success) {
                    this.accessToken = result.accessToken;
                    this.refreshToken = result.refreshToken;
                }
                return result;
            },
            fiatLogin: async ({ email, password, appOrigin = 'app' }) => {
                const result = await this._fetch('/sso/fiat/login', {
                    method: 'POST',
                    body: { email, password, appOrigin },
                    headers: {},
                });
                if (result.success) {
                    this.accessToken = result.accessToken;
                    this.refreshToken = result.refreshToken;
                }
                return result;
            },
            logout: () => this._post('/sso/logout', {}),
            me: () => this._get('/sso/me'),
        };
    }

    // ── Wallet ─────────────────────────────────────────────

    _createWalletClient() {
        return {
            me: () => this._get('/wallet/me'),
            getBalance: (address) => this._get(`/wallet/balance/${address}`),
            getHistory: (address, opts = {}) => this._get(`/wallet/history/${address}`, opts),
        };
    }

    // ── Staking ────────────────────────────────────────────

    _createStakingClient() {
        return {
            getPositions: (address) => this._get(`/staking/positions/${address}`),
            stake: (walletAddress, amount) => this._post('/staking/stake', { walletAddress, amount }),
            unstake: (positionId) => this._post('/staking/unstake', { positionId }),
        };
    }

    // ── Farming ────────────────────────────────────────────

    _createFarmingClient() {
        return {
            getPositions: (address) => this._get(`/farming/positions/${address}`),
            deposit: (walletAddress, poolId, amount) =>
                this._post('/farming/deposit', { walletAddress, poolId, amount }),
        };
    }

    // ── Governance ─────────────────────────────────────────

    _createGovernanceClient() {
        return {
            getProposals: (opts = {}) => this._get('/governance/proposals', opts),
            vote: (proposalId, walletAddress, vote) =>
                this._post('/governance/vote', { proposalId, walletAddress, vote }),
        };
    }

    // ── Bridge ─────────────────────────────────────────────

    _createBridgeClient() {
        return {
            getTransfers: (address, opts = {}) => this._get(`/bridge/transfers/${address}`, opts),
            initiate: (params) => this._post('/bridge/initiate', params),
            getStatus: (transferId) => this._get(`/bridge/status/${transferId}`),
        };
    }

    // ── Treasury ───────────────────────────────────────────

    _createTreasuryClient() {
        return {
            getOverview: () => this._get('/treasury/overview'),
        };
    }

    // ── Token ──────────────────────────────────────────────

    _createTokenClient() {
        return {
            getInfo: () => this._get('/token/info'),
        };
    }

    // ── Contracts ──────────────────────────────────────────

    _createContractsClient() {
        return {
            list: (chainId) => this._get('/contracts/list', chainId ? { chainId } : {}),
            get: (name, chainId, includeAbi = false) => this._get(`/contracts/${name}`, { ...(chainId ? { chainId } : {}), ...(includeAbi ? { includeAbi: 'true' } : {}) }),
        };
    }

    // ── DEX / Trading ─────────────────────────────────────

    _createDEXClient() {
        return {
            getPool: ({ tokenA, tokenB, chainId }) =>
                this._get('/dex/pool', { tokenA, tokenB, ...(chainId ? { chainId } : {}) }),
            quote: ({ tokenIn, tokenOut, amountIn, chainId }) =>
                this._get('/dex/quote', { tokenIn, tokenOut, amountIn, ...(chainId ? { chainId } : {}) }),
            swapTx: ({ tokenIn, tokenOut, amountIn, minAmountOut = '0', chainId }) =>
                this._post('/dex/swap', { tokenIn, tokenOut, amountIn, minAmountOut, chainId }),
            addLiquidityTx: ({ tokenA, tokenB, amountA, amountB, minLiquidity = '0', chainId }) =>
                this._post('/dex/add-liquidity', { tokenA, tokenB, amountA, amountB, minLiquidity, chainId }),
        };
    }

    // ── Apps (admin) ───────────────────────────────────────

    _createAppsClient() {
        return {
            register: (params) => this._post('/apps/register', params),
            list: () => this._get('/apps/list'),
        };
    }

    // ── Payments / BeZhas Pay ─────────────────────────────

    _createPaymentsClient() {
        return {
            buyBEZ: ({ walletAddress, amountUSD, paymentMethod = 'card', stripeUseCase = 'token_purchase', email }) =>
                this._post('/payments/buy', { walletAddress, amountUSD, paymentMethod, stripeUseCase, email }),
            buyBEZForCurrentUser: ({ amountUSD, paymentMethod = 'card', stripeUseCase = 'token_purchase', email }) =>
                this._post('/payments/buy', { amountUSD, paymentMethod, stripeUseCase, email }),
            getStripeLinks: () => this._get('/payments/stripe-links'),
            getBankTransferDetails: () => this._get('/payments/bank-transfer-details'),
            getTokenomics: ({ amountUSD, priceUSD } = {}) =>
                this._get('/payments/tokenomics', { ...(amountUSD ? { amountUSD } : {}), ...(priceUSD ? { priceUSD } : {}) }),
            send: ({ sender, recipient, amount, note }) =>
                this._post('/payments/send', { sender, recipient, amount, note }),
            history: (address, opts = {}) => this._get(`/payments/history/${address}`, opts),
        };
    }
}

module.exports = { GatewayClient };
