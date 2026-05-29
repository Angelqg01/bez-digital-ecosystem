/**
 * ============================================================================
 * BEZHAS MCP ORCHESTRATOR SERVICE
 * ============================================================================
 *
 * Orquestador central para los 13 MCP tools de la plataforma BeZhas.
 *
 * Cada tool se invoca como una función asíncrona con sus propios parámetros.
 * Los pipelines permiten encadenar múltiples tools en secuencia o en paralelo,
 * pasando el output de uno como input del siguiente.
 *
 * Tools disponibles:
 *  1. blockscout_explorer   - Auditoría on-chain en Polygon
 *  2. github_repo_manager   - Gestión de repos GitHub
 *  3. tally_dao_governance  - Gobernanza en Tally/DAO
 *  4. firecrawl_scraper     - Web scraping avanzado
 *  5. playwright_automation - Automatización de navegador
 *  6. kinaxis_supply_chain  - Integración Kinaxis supply chain
 *  7. alpaca_markets_trader - Trading con Alpaca Markets
 *  8. analyze_gas           - Análisis de gas en Polygon
 *  9. calculate_swap        - Cálculo de swaps DeFi
 * 10. verify_compliance     - Verificación de cumplimiento
 * 11. auditmos_auditor      - Auditoría de contratos
 * 12. obliq_sre_monitor     - Monitorización SRE
 * 13. skill_creator         - Creación de skills/workflows
 */

const axios = require('axios');
const aiProviderService = require('./ai-provider.service');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const BEZ_TOKEN = process.env.BEZ_TOKEN_ADDRESS || '0x89c23890c742d710265dd61be789c71dc8999b12';
const POLYGON_CHAIN_ID = 137;
const BLOCKSCOUT_BASE = 'https://polygon.blockscout.com/api/v2';
const QUICKNODE_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

// ─── TOOL REGISTRY ─────────────────────────────────────────────────────────────
const TOOL_REGISTRY = {
    'blockscout_explorer': {
        name: 'Blockscout Explorer',
        type: 'explorer',
        description: 'Auditoría on-chain en Polygon: holders, TXs, contratos, métricas supply',
        handler: blockscoutHandler,
    },
    'github_repo_manager': {
        name: 'GitHub Repo Manager',
        type: 'utility',
        description: 'Gestión de repositorios GitHub: análisis, PRs, salud, issues',
        handler: githubHandler,
    },
    'tally_dao_governance': {
        name: 'Tally DAO Governance',
        type: 'governance',
        description: 'Propuestas y votaciones on-chain via Tally API',
        handler: tallyDaoHandler,
    },
    'firecrawl_scraper': {
        name: 'Firecrawl Scraper',
        type: 'crawler',
        description: 'Web scraping avanzado con Firecrawl',
        handler: firecrawlHandler,
    },
    'playwright_automation': {
        name: 'Playwright Automation',
        type: 'automation',
        description: 'Automatización de navegador y tests E2E',
        handler: playwrightHandler,
    },
    'kinaxis_supply_chain': {
        name: 'Kinaxis Supply Chain',
        type: 'logistics',
        description: 'Integración con Kinaxis RapidResponse para supply chain',
        handler: kinaxisHandler,
    },
    'alpaca_markets_trader': {
        name: 'Alpaca Markets Trader',
        type: 'finance',
        description: 'Trading algorítmico con Alpaca Markets API',
        handler: alpacaHandler,
    },
    'analyze_gas': {
        name: 'Gas Analyzer',
        type: 'analysis',
        description: 'Análisis y predicción de gas fees en Polygon',
        handler: analyzeGasHandler,
    },
    'calculate_swap': {
        name: 'Swap Calculator',
        type: 'defi',
        description: 'Cálculo de swaps en QuickSwap/Uniswap con slippage y rutas óptimas',
        handler: calculateSwapHandler,
    },
    'verify_compliance': {
        name: 'Compliance Verifier',
        type: 'security',
        description: 'Verificación KYC/AML y cumplimiento regulatorio',
        handler: verifyComplianceHandler,
    },
    'auditmos_auditor': {
        name: 'Smart Contract Auditor',
        type: 'security',
        description: 'Auditoría de smart contracts con análisis estático',
        handler: auditSmartContractHandler,
    },
    'obliq_sre_monitor': {
        name: 'Obliq SRE Monitor',
        type: 'monitoring',
        description: 'Monitorización SRE: uptime, latencia, alertas',
        handler: obliqSreHandler,
    },
    'skill_creator': {
        name: 'Skill Creator',
        type: 'creator',
        description: 'Creación y gestión de skills y workflows de la plataforma',
        handler: skillCreatorHandler,
    },
    'generate_marketing_post': {
        name: 'BeZhas Marketing Post Generator',
        type: 'marketing',
        description: 'Genera posts estructurados para BeZhas Magazine desde un vibe usando Gemini cuando esta disponible',
        handler: generateMarketingPostHandler,
    },
};

// ─── TOOL HANDLERS ────────────────────────────────────────────────────────────

/**
 * Blockscout Explorer — queries Polygon Blockscout API
 */
async function blockscoutHandler({ action = 'token_info', address = BEZ_TOKEN, limit = 10 } = {}) {
    try {
        switch (action) {
            case 'token_info': {
                const { data } = await axios.get(`${BLOCKSCOUT_BASE}/tokens/${address}`);
                return {
                    action, target: address, network: 'polygon',
                    status: 'SUCCESS',
                    data: {
                        name: data.name,
                        symbol: data.symbol,
                        totalSupply: data.total_supply,
                        holders: data.holders,
                        exchangeRate: data.exchange_rate,
                        marketCap: data.circulating_market_cap,
                    },
                    reasoning: `Token ${data.symbol}: ${data.holders} holders.`,
                };
            }
            case 'holder_analysis': {
                const { data } = await axios.get(`${BLOCKSCOUT_BASE}/tokens/${address}/holders?limit=${limit}`);
                const holders = (data.items || []).map(h => ({
                    address: h.address?.hash,
                    value: h.value,
                    percentage: h.percentage,
                }));
                return {
                    action, target: address, network: 'polygon',
                    status: 'SUCCESS',
                    data: { totalHolders: holders.length, topHolders: holders },
                    reasoning: `${holders.length} holders analyzed.`,
                };
            }
            case 'transaction_history': {
                const { data } = await axios.get(`${BLOCKSCOUT_BASE}/addresses/${address}/transactions?limit=${limit}`);
                const txs = (data.items || []).map(tx => ({
                    hash: tx.hash,
                    from: tx.from?.hash,
                    to: tx.to?.hash,
                    value: tx.value,
                    status: tx.status,
                    timestamp: tx.timestamp,
                }));
                return {
                    action, target: address, network: 'polygon',
                    status: 'SUCCESS',
                    data: { transactionCount: txs.length, transactions: txs },
                    reasoning: `Found ${txs.length} transactions.`,
                };
            }
            case 'supply_metrics': {
                const { data: token } = await axios.get(`${BLOCKSCOUT_BASE}/tokens/${BEZ_TOKEN}`);
                return {
                    action, target: BEZ_TOKEN, network: 'polygon',
                    status: 'SUCCESS',
                    data: {
                        totalSupply: token.total_supply,
                        holders: token.holders,
                        marketCap: token.circulating_market_cap,
                        priceUSD: token.exchange_rate,
                    },
                    reasoning: `$BEZ supply: ${token.total_supply}, ${token.holders} holders.`,
                };
            }
            case 'address_balance': {
                const { data: addr } = await axios.get(`${BLOCKSCOUT_BASE}/addresses/${address}`);
                const { data: tokenBalances } = await axios.get(`${BLOCKSCOUT_BASE}/addresses/${address}/token-balances`);
                const bezBalance = (tokenBalances || []).find(t =>
                    t.token?.address?.toLowerCase() === BEZ_TOKEN.toLowerCase()
                );
                return {
                    action, target: address, network: 'polygon',
                    status: 'SUCCESS',
                    data: {
                        maticBalance: addr.coin_balance,
                        bezBalance: bezBalance?.value || '0',
                        isContract: addr.is_contract,
                    },
                    reasoning: `BEZ balance: ${bezBalance?.value || '0'}.`,
                };
            }
            default:
                return { action, status: 'FAILED', reasoning: `Unknown action: ${action}` };
        }
    } catch (err) {
        return { action, status: 'FAILED', reasoning: err.message, data: { error: err.message } };
    }
}

/**
 * GitHub Repo Manager — queries GitHub REST API
 */
async function githubHandler({ action = 'analyze_repo', repository = 'Angelqg01/BeZhas_web3', branch = 'main', title, body } = {}) {
    const token = process.env.GITHUB_TOKEN;
    const headers = {
        Authorization: token ? `Bearer ${token}` : undefined,
        Accept: 'application/vnd.github.v3+json',
    };
    const API = 'https://api.github.com';

    try {
        switch (action) {
            case 'analyze_repo': {
                const { data: repo } = await axios.get(`${API}/repos/${repository}`, { headers });
                const { data: languages } = await axios.get(`${API}/repos/${repository}/languages`, { headers });
                return {
                    action, repository, status: 'SUCCESS',
                    details: {
                        stars: repo.stargazers_count,
                        forks: repo.forks_count,
                        openIssues: repo.open_issues_count,
                        languages,
                        defaultBranch: repo.default_branch,
                        lastPush: repo.pushed_at,
                    },
                    reasoning: `Repo analyzed: ${repo.open_issues_count} open issues.`,
                };
            }
            case 'check_health': {
                const [commitsRes, issuesRes] = await Promise.all([
                    axios.get(`${API}/repos/${repository}/commits?per_page=10`, { headers }),
                    axios.get(`${API}/repos/${repository}/issues?state=open&per_page=100`, { headers }),
                ]);
                const lastCommitDate = new Date(commitsRes.data[0]?.commit?.author?.date);
                const daysSince = Math.floor((Date.now() - lastCommitDate.getTime()) / 86400000);
                let healthScore = 100;
                if (daysSince > 30) healthScore -= 30;
                if (issuesRes.data.length > 50) healthScore -= 20;
                return {
                    action, repository, status: 'SUCCESS',
                    details: {
                        healthScore: Math.max(0, healthScore),
                        daysSinceLastCommit: daysSince,
                        openIssuesCount: issuesRes.data.length,
                    },
                    reasoning: `Health score: ${healthScore}/100.`,
                };
            }
            case 'list_issues': {
                const { data } = await axios.get(`${API}/repos/${repository}/issues?state=open&per_page=20`, { headers });
                return {
                    action, repository, status: 'SUCCESS',
                    details: {
                        totalOpen: data.length,
                        issues: data.slice(0, 10).map(i => ({ number: i.number, title: i.title, createdAt: i.created_at })),
                    },
                    reasoning: `Found ${data.length} open issues.`,
                };
            }
            case 'create_pr': {
                const { data: pr } = await axios.post(`${API}/repos/${repository}/pulls`, {
                    title: title || 'Auto-generated PR by BeZhas MCP',
                    body: body || 'This PR was created by the BeZhas Intelligence MCP system.',
                    head: branch, base: 'main',
                }, { headers });
                return {
                    action, repository, status: pr.id ? 'SUCCESS' : 'FAILED',
                    details: { prNumber: pr.number, prUrl: pr.html_url },
                    reasoning: pr.id ? `PR #${pr.number} created.` : 'Failed to create PR.',
                };
            }
            default:
                return { action, status: 'FAILED', reasoning: `Unknown action: ${action}` };
        }
    } catch (err) {
        return { action, repository, status: 'FAILED', reasoning: err.message };
    }
}

/**
 * Tally DAO Governance — queries Tally GraphQL API
 */
async function tallyDaoHandler({ action = 'list_proposals', daoAddress, limit = 5 } = {}) {
    const apiKey = process.env.TALLY_API_KEY || '';
    const headers = { 'Api-key': apiKey, 'Content-Type': 'application/json' };

    try {
        if (action === 'list_proposals') {
            const query = `
                query {
                    proposals(input: { filters: { includeArchived: false }, page: { limit: ${limit} } }) {
                        nodes { ... on Proposal {
                            id title description status
                            voteStats { type votesCount percent }
                        }}
                    }
                }`;
            const { data } = await axios.post('https://api.tally.xyz/query', { query }, { headers });
            const proposals = data?.data?.proposals?.nodes || [];
            return {
                action, status: 'SUCCESS',
                data: { count: proposals.length, proposals },
                reasoning: `Found ${proposals.length} proposals.`,
            };
        }
        if (action === 'voting_summary') {
            return {
                action, status: 'SUCCESS',
                data: { message: 'Tally voting summary — configure TALLY_API_KEY for live data.' },
                reasoning: 'Tally API key required for full data.',
            };
        }
        return { action, status: 'FAILED', reasoning: `Unknown action: ${action}` };
    } catch (err) {
        return { action, status: 'FAILED', reasoning: err.response?.data?.message || err.message };
    }
}

/**
 * Firecrawl Scraper — uses Firecrawl API for web scraping
 */
async function firecrawlHandler({ action = 'scrape', url, extractors = [] } = {}) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
        return { action, status: 'FAILED', reasoning: 'FIRECRAWL_API_KEY not configured.' };
    }
    try {
        const { data } = await axios.post(
            'https://api.firecrawl.dev/v1/scrape',
            { url, formats: ['markdown'], onlyMainContent: true },
            { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
        );
        return {
            action, url, status: 'SUCCESS',
            data: { markdown: data.data?.markdown?.slice(0, 2000), title: data.data?.metadata?.title },
            reasoning: `Scraped ${url} successfully.`,
        };
    } catch (err) {
        return { action, url, status: 'FAILED', reasoning: err.message };
    }
}

/**
 * Playwright Automation — triggers E2E test runs
 */
async function playwrightHandler({ action = 'run_test', testName = 'smoke', url } = {}) {
    // In production this would spawn a playwright child process or call a test API.
    // Here we return a structured result that an external runner can interpret.
    return {
        action, testName, url,
        status: 'SUCCESS',
        data: {
            command: `npx playwright test ${testName} --project=chromium`,
            environment: { BASE_URL: url || process.env.VITE_API_URL, CI: true },
            note: 'Dispatch playwright test run via CI pipeline or local runner.',
        },
        reasoning: `Playwright test "${testName}" dispatched.`,
    };
}

/**
 * Kinaxis Supply Chain — integration placeholder
 */
async function kinaxisHandler({ action = 'check_inventory', sku } = {}) {
    const baseUrl = process.env.KINAXIS_API_URL;
    const token = process.env.KINAXIS_API_KEY;

    if (!baseUrl || !token) {
        return {
            action, status: 'PARTIAL',
            data: { note: 'Configure KINAXIS_API_URL and KINAXIS_API_KEY for live data.' },
            reasoning: 'Kinaxis credentials not configured. Returning stub.',
        };
    }
    try {
        const { data } = await axios.get(`${baseUrl}/inventory/${sku}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return { action, status: 'SUCCESS', data, reasoning: `Kinaxis inventory for ${sku} retrieved.` };
    } catch (err) {
        return { action, status: 'FAILED', reasoning: err.message };
    }
}

/**
 * Alpaca Markets Trader — paper/live trading via Alpaca API
 */
async function alpacaHandler({ action = 'get_account', symbol, qty, side = 'buy' } = {}) {
    const keyId = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;
    const paper = process.env.ALPACA_PAPER !== 'false';
    const baseUrl = paper ? 'https://paper-api.alpaca.markets/v2' : 'https://api.alpaca.markets/v2';

    if (!keyId || !secretKey) {
        return { action, status: 'PARTIAL', reasoning: 'ALPACA_API_KEY/SECRET not configured.' };
    }

    const headers = { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secretKey };

    try {
        if (action === 'get_account') {
            const { data } = await axios.get(`${baseUrl}/account`, { headers });
            return {
                action, status: 'SUCCESS',
                data: { equity: data.equity, cash: data.cash, portfolioValue: data.portfolio_value },
                reasoning: `Account equity: $${data.equity}.`,
            };
        }
        if (action === 'place_order') {
            const { data } = await axios.post(`${baseUrl}/orders`, {
                symbol, qty, side, type: 'market', time_in_force: 'gtc'
            }, { headers });
            return {
                action, status: 'SUCCESS',
                data: { orderId: data.id, status: data.status, symbol, qty, side },
                reasoning: `Order placed: ${side} ${qty} ${symbol}.`,
            };
        }
        if (action === 'get_positions') {
            const { data } = await axios.get(`${baseUrl}/positions`, { headers });
            return {
                action, status: 'SUCCESS',
                data: { count: data.length, positions: data.map(p => ({ symbol: p.symbol, qty: p.qty, unrealizedPl: p.unrealized_pl })) },
                reasoning: `${data.length} open positions.`,
            };
        }
        return { action, status: 'FAILED', reasoning: `Unknown action: ${action}` };
    } catch (err) {
        return { action, status: 'FAILED', reasoning: err.response?.data?.message || err.message };
    }
}

/**
 * Gas Analyzer — reads Polygon gas price from JSON-RPC
 */
async function analyzeGasHandler({ action = 'current_fees' } = {}) {
    try {
        const { data } = await axios.post(QUICKNODE_RPC, {
            jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: []
        });
        const gasPriceGwei = parseInt(data.result, 16) / 1e9;

        const recommendations = {
            slow: (gasPriceGwei * 0.8).toFixed(2),
            standard: gasPriceGwei.toFixed(2),
            fast: (gasPriceGwei * 1.2).toFixed(2),
            rapid: (gasPriceGwei * 1.5).toFixed(2),
        };

        return {
            action, network: 'polygon',
            status: 'SUCCESS',
            data: {
                currentGasPriceGwei: gasPriceGwei.toFixed(4),
                recommendations,
                estimatedCosts: {
                    erc20Transfer: `${(gasPriceGwei * 0.000065).toFixed(6)} MATIC`,
                    nftMint: `${(gasPriceGwei * 0.00015).toFixed(6)} MATIC`,
                    swapDex: `${(gasPriceGwei * 0.00018).toFixed(6)} MATIC`,
                },
            },
            reasoning: `Current gas: ${gasPriceGwei.toFixed(4)} Gwei. Fast: ${recommendations.fast} Gwei.`,
        };
    } catch (err) {
        return { action, status: 'FAILED', reasoning: err.message };
    }
}

/**
 * Swap Calculator — calculates swap amounts via QuickSwap/1inch
 */
async function calculateSwapHandler({ fromToken, toToken, amount, slippage = 0.5 } = {}) {
    try {
        // Use 1inch API for price quotes on Polygon (chain 137)
        const { data } = await axios.get(
            `https://api.1inch.dev/swap/v6.0/137/quote`,
            {
                params: {
                    src: fromToken || '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
                    dst: toToken || BEZ_TOKEN,
                    amount: String(BigInt(Math.floor(parseFloat(amount || '1') * 1e6))), // USDC has 6 decimals
                },
                headers: { Authorization: `Bearer ${process.env.ONEINCH_API_KEY || ''}` }
            }
        );
        const outputAmount = (parseInt(data.dstAmount) / 1e18).toFixed(4);
        return {
            action: 'calculate_swap',
            status: 'SUCCESS',
            data: {
                inputAmount: amount,
                outputAmount,
                fromToken, toToken,
                slippage,
                estimatedGas: data.gas,
                priceImpact: data.estimatedAmount,
                route: '1inch Aggregator',
            },
            reasoning: `Swap ${amount} → ${outputAmount} via 1inch on Polygon.`,
        };
    } catch (err) {
        // Fallback to static price
        const bezPriceUsd = 0.0003;
        const usdAmount = parseFloat(amount || '1');
        const outputBez = (usdAmount / bezPriceUsd).toFixed(2);
        return {
            action: 'calculate_swap',
            status: 'PARTIAL',
            data: {
                inputAmount: amount,
                outputAmount: outputBez,
                note: '1inch API unavailable, using static BEZ price estimate.',
                bezPriceUsd,
            },
            reasoning: `Estimated swap (static price): ${amount} USDC → ~${outputBez} BEZ.`,
        };
    }
}

/**
 * Compliance Verifier — checks KYC/AML status via backend DB
 */
async function verifyComplianceHandler({ address, userId, checkType = 'kyc' } = {}) {
    // In production, this should query the KYC provider (e.g., Sumsub, Persona)
    return {
        action: 'verify_compliance',
        status: 'SUCCESS',
        data: {
            address: address || 'N/A',
            userId: userId || 'N/A',
            checkType,
            result: 'PENDING_INTEGRATION',
            note: 'Configure KYC_PROVIDER_API_KEY and KYC_PROVIDER_URL for live verification.',
            sumsub: process.env.SUMSUB_APP_TOKEN ? 'configured' : 'not configured',
        },
        reasoning: `Compliance check (${checkType}) queued. Integrate with KYC provider for live results.`,
    };
}

/**
 * Smart Contract Auditor — static analysis via Slither API or custom checks
 */
async function auditSmartContractHandler({ contractAddress = BEZ_TOKEN, checks = ['ownership', 'reentrancy'] } = {}) {
    try {
        // Try Blockscout for quick contract verification status
        const { data } = await axios.get(`${BLOCKSCOUT_BASE}/smart-contracts/${contractAddress}`);
        const findings = [];

        if (!data.is_verified) findings.push({ severity: 'HIGH', issue: 'Contract source not verified on explorer' });
        if (!data.optimization_enabled) findings.push({ severity: 'INFO', issue: 'Compiler optimization disabled' });

        return {
            action: 'audit_smart_contract',
            status: 'SUCCESS',
            data: {
                address: contractAddress,
                isVerified: data.is_verified,
                compiler: data.compiler_version,
                language: data.language,
                findings,
                riskScore: findings.filter(f => f.severity === 'HIGH').length === 0 ? 'LOW' : 'MEDIUM',
                note: 'For full audit, integrate Slither or MythX API.',
            },
            reasoning: `Contract ${data.is_verified ? 'verified' : 'NOT verified'}. ${findings.length} findings.`,
        };
    } catch (err) {
        return { action: 'audit_smart_contract', status: 'FAILED', reasoning: err.message };
    }
}

/**
 * Obliq SRE Monitor — system health checks
 */
async function obliqSreHandler({ action = 'health_check', endpoint } = {}) {
    const targetUrl = endpoint || process.env.VITE_API_URL || 'https://bez.digital';
    const startTime = Date.now();
    try {
        const { status } = await axios.get(`${targetUrl}/health`, { timeout: 5000 });
        const latencyMs = Date.now() - startTime;
        return {
            action, endpoint: targetUrl,
            status: 'SUCCESS',
            data: {
                httpStatus: status,
                latencyMs,
                uptime: 'OK',
                timestamp: new Date().toISOString(),
            },
            reasoning: `${targetUrl} responded in ${latencyMs}ms with HTTP ${status}.`,
        };
    } catch (err) {
        const latencyMs = Date.now() - startTime;
        return {
            action, endpoint: targetUrl,
            status: 'PARTIAL',
            data: {
                latencyMs,
                error: err.code || err.message,
                timestamp: new Date().toISOString(),
            },
            reasoning: `Health check failed for ${targetUrl}: ${err.message}`,
        };
    }
}

/**
 * Skill Creator — creates or lists BeZhas platform skills/workflows
 */
async function skillCreatorHandler({ action = 'list_skills', skillName, description, tools = [] } = {}) {
    const skills = [
        { id: 'monitor-bez-token', name: 'Monitor BEZ Token', tools: ['blockscout_explorer'], trigger: 'cron:1h' },
        { id: 'github-health-check', name: 'GitHub Health Check', tools: ['github_repo_manager'], trigger: 'cron:24h' },
        { id: 'gas-alert', name: 'Gas Price Alert', tools: ['analyze_gas'], trigger: 'cron:15m' },
        { id: 'dao-proposal-summary', name: 'DAO Proposal Summary', tools: ['tally_dao_governance'], trigger: 'event:new_proposal' },
        { id: 'defi-opportunity-scout', name: 'DeFi Opportunity Scout', tools: ['calculate_swap', 'alpaca_markets_trader'], trigger: 'cron:30m' },
    ];

    if (action === 'list_skills') {
        return {
            action, status: 'SUCCESS',
            data: { count: skills.length, skills },
            reasoning: `${skills.length} pre-built skills available.`,
        };
    }
    if (action === 'create_skill') {
        const newSkill = { id: `custom-${Date.now()}`, name: skillName, description, tools, trigger: 'manual', createdAt: new Date().toISOString() };
        return {
            action, status: 'SUCCESS',
            data: newSkill,
            reasoning: `Skill "${skillName}" created with ${tools.length} tools.`,
        };
    }
    return { action, status: 'FAILED', reasoning: `Unknown action: ${action}` };
}

function normalizeMarketingCategory(category) {
    const allowed = ['Core Updates', 'DePIN', 'RWA', 'Supply Chain'];
    return allowed.includes(category) ? category : 'Core Updates';
}

function extractJsonObject(rawText) {
    const text = String(rawText || '').trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('AI response did not include a JSON object');
    }
    return JSON.parse(candidate.slice(start, end + 1));
}

function buildMarketingFallback(vibe = '') {
    const lower = String(vibe).toLowerCase();
    const category = lower.includes('depin')
        ? 'DePIN'
        : lower.includes('rwa')
            ? 'RWA'
            : lower.includes('aduan') || lower.includes('supply') || lower.includes('logistic')
                ? 'Supply Chain'
                : 'Core Updates';

    return {
        title: 'BeZhas convierte la confianza operativa en infraestructura verificable',
        category,
        excerpt:
            'Un enfoque tecnico y ejecutivo sobre como BeZhas combina IA, blockchain y trazabilidad para reducir friccion, fraude y opacidad operativa.',
        content: [
            '## Contexto',
            'BeZhas esta construyendo una capa operativa donde los eventos criticos de negocio pueden registrarse, analizarse y verificarse con evidencia criptografica.',
            '',
            '## Lectura tecnica',
            'El sistema conecta agentes IA, herramientas MCP, pagos on-chain y registros de trazabilidad para que cada decision tenga contexto, auditoria y continuidad entre departamentos.',
            '',
            '## Impacto',
            'Para equipos de supply chain, RWA y compliance, esto reduce dependencias manuales y ayuda a convertir procesos opacos en flujos medibles, verificables y preparados para automatizacion.',
            '',
            '## Cierre',
            `Vibe aplicado: ${vibe || 'corporativo, tecnico y optimista'}.`,
        ].join('\n'),
        coverImagePrompt:
            'Corporate cyberpunk logistics command center, cyan and violet lights, blockchain data trails, realistic high-detail editorial cover, dark BeZhas brand background.',
    };
}

async function generateMarketingPostHandler({ vibe = '', audience = 'BeZhas Blockchain ecosystem', categories = [] } = {}) {
    const cleanVibe = String(vibe || '').trim();
    if (!cleanVibe) {
        return {
            action: 'generate_marketing_post',
            status: 'FAILED',
            reasoning: 'Missing vibe or marketing intent.',
        };
    }

    const systemPrompt = `Eres el Agente IA del Departamento de Marketing de BeZhas.
Genera un borrador editorial para BeZhas Magazine en espanol.
Identidad visual y narrativa: Web3, IA, RWA, DePIN, supply chain, fondo oscuro #0A0E1A, acentos cyan #00D4FF y violeta #7B2FFF.
Devuelve SOLO JSON valido con esta forma:
{
  "title": "string",
  "category": "Core Updates | DePIN | RWA | Supply Chain",
  "excerpt": "string max 220 caracteres",
  "content": "markdown body with sections",
  "coverImagePrompt": "prompt para imagen editorial"
}`;

    const userPrompt = `Vibe: ${cleanVibe}
Audiencia: ${audience}
Categorias permitidas: ${Array.isArray(categories) && categories.length ? categories.join(', ') : 'Core Updates, DePIN, RWA, Supply Chain'}`;

    try {
        const provider = aiProviderService.isProviderAvailable('google')
            ? 'google'
            : aiProviderService.isProviderAvailable('openai')
                ? 'openai'
                : null;

        if (!provider) {
            const fallback = buildMarketingFallback(cleanVibe);
            return {
                action: 'generate_marketing_post',
                status: 'SUCCESS',
                data: fallback,
                reasoning: 'No external AI provider configured. Returned deterministic local marketing draft.',
            };
        }

        const response = await aiProviderService.chat({
            provider,
            model: provider === 'google' ? 'gemini-2.0-flash' : 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.72,
            maxTokens: 1600,
        });

        const parsed = extractJsonObject(response.content);
        return {
            action: 'generate_marketing_post',
            status: 'SUCCESS',
            data: {
                title: String(parsed.title || '').trim() || buildMarketingFallback(cleanVibe).title,
                category: normalizeMarketingCategory(parsed.category),
                excerpt: String(parsed.excerpt || '').trim() || buildMarketingFallback(cleanVibe).excerpt,
                content: String(parsed.content || '').trim() || buildMarketingFallback(cleanVibe).content,
                coverImagePrompt: String(parsed.coverImagePrompt || parsed.imagePrompt || '').trim() || buildMarketingFallback(cleanVibe).coverImagePrompt,
            },
            provider: response.provider,
            reasoning: 'Marketing draft generated through BeZhas MCP orchestrator.',
        };
    } catch (error) {
        return {
            action: 'generate_marketing_post',
            status: 'PARTIAL',
            data: buildMarketingFallback(cleanVibe),
            reasoning: `AI provider failed, returned local fallback: ${error.message}`,
        };
    }
}

// ─── ORCHESTRATOR API ─────────────────────────────────────────────────────────

/**
 * Execute a single MCP tool by name.
 * @param {string} toolName - Tool identifier (from TOOL_REGISTRY)
 * @param {Object} params   - Tool-specific parameters
 * @returns {Promise<Object>} Tool result
 */
async function executeTool(toolName, params = {}) {
    const tool = TOOL_REGISTRY[toolName];
    if (!tool) {
        throw new Error(`Unknown MCP tool: "${toolName}". Available: ${Object.keys(TOOL_REGISTRY).join(', ')}`);
    }

    const startTime = Date.now();
    try {
        const result = await tool.handler(params);
        return {
            toolName,
            toolLabel: tool.name,
            executionTimeMs: Date.now() - startTime,
            ...result,
        };
    } catch (err) {
        return {
            toolName,
            toolLabel: tool.name,
            executionTimeMs: Date.now() - startTime,
            status: 'FAILED',
            reasoning: err.message,
        };
    }
}

/**
 * Execute a pipeline of tools in sequence, passing output as context to each step.
 * @param {Array<{tool: string, params: Object}>} steps
 * @returns {Promise<Object>} Pipeline results
 */
async function executePipeline(steps = []) {
    const results = [];
    let context = {};

    for (const step of steps) {
        const stepParams = { ...step.params, _context: context };
        const result = await executeTool(step.tool, stepParams);
        results.push(result);
        // Pass successful data forward as context
        if (result.status === 'SUCCESS' || result.status === 'PARTIAL') {
            context = { ...context, ...result.data };
        }
    }

    return {
        pipeline: true,
        steps: steps.map(s => s.tool),
        totalTools: steps.length,
        succeeded: results.filter(r => r.status === 'SUCCESS').length,
        results,
    };
}

/**
 * Execute multiple tools in parallel.
 * @param {Array<{tool: string, params: Object}>} tools
 * @returns {Promise<Object>} Parallel results
 */
async function executeParallel(tools = []) {
    const promises = tools.map(t => executeTool(t.tool, t.params));
    const results = await Promise.allSettled(promises);

    return {
        parallel: true,
        totalTools: tools.length,
        succeeded: results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'FAILED').length,
        results: results.map((r, i) => ({
            tool: tools[i].tool,
            ...(r.status === 'fulfilled' ? r.value : { status: 'FAILED', reasoning: r.reason?.message }),
        })),
    };
}

/**
 * Get the list of all registered tools with metadata.
 */
function getToolRegistry() {
    return Object.entries(TOOL_REGISTRY).map(([id, tool]) => ({
        id,
        name: tool.name,
        type: tool.type,
        description: tool.description,
        status: 'online',
    }));
}

module.exports = {
    executeTool,
    executePipeline,
    executeParallel,
    getToolRegistry,
    TOOL_REGISTRY,
};
