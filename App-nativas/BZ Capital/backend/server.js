const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3003;
const CORE_API_URL = process.env.CORE_API_URL || 'http://localhost:3001';
const CORE_API_KEY = process.env.CORE_API_KEY || 'defi-dev-key';

// ── Middleware ──
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://defi.bez.digital']
        : ['http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use(express.json({ limit: '5mb' }));

// ══════════════════════════════════════════════════════════
//  Core Gateway proxy — aligned with gateway.js real routes
// ══════════════════════════════════════════════════════════

async function gw(path, options = {}) {
    const url = `${CORE_API_URL}/api/gateway/v1${path}`;
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': CORE_API_KEY,
        ...options.headers,
    };
    const resp = await fetch(url, { ...options, headers });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, data };
}

function fwd(req) {
    const t = req.headers.authorization;
    return t ? { Authorization: t } : {};
}

// ── Health ──
app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'bezhas-defi-backend', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ══════════════════════════════════════════════════════════
//  SSO — matches /sso/login, /sso/refresh, /sso/logout, /sso/me
// ══════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
    const { status, data } = await gw('/sso/login', {
        method: 'POST', body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

app.post('/api/auth/refresh', async (req, res) => {
    const { status, data } = await gw('/sso/refresh', {
        method: 'POST', body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

app.post('/api/auth/logout', async (req, res) => {
    const { status, data } = await gw('/sso/logout', {
        method: 'POST', headers: fwd(req), body: JSON.stringify({}),
    });
    res.status(status).json(data);
});

app.get('/api/auth/me', async (req, res) => {
    const { status, data } = await gw('/sso/me', { headers: fwd(req) });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  WALLET — /wallet/balance/:address, /wallet/history/:address
// ══════════════════════════════════════════════════════════

app.get('/api/wallet/balance/:address', async (req, res) => {
    const { status, data } = await gw(`/wallet/balance/${req.params.address}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.get('/api/wallet/history/:address', async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    const { status, data } = await gw(`/wallet/history/${req.params.address}${qs ? '?' + qs : ''}`, { headers: fwd(req) });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  STAKING — /staking/positions/:address, /staking/stake, /staking/unstake
// ══════════════════════════════════════════════════════════

app.get('/api/staking/positions/:address', async (req, res) => {
    const { status, data } = await gw(`/staking/positions/${req.params.address}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.post('/api/staking/stake', async (req, res) => {
    const { status, data } = await gw('/staking/stake', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

app.post('/api/staking/unstake', async (req, res) => {
    const { status, data } = await gw('/staking/unstake', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  FARMING — /farming/positions/:address, /farming/deposit
// ══════════════════════════════════════════════════════════

app.get('/api/farming/positions/:address', async (req, res) => {
    const { status, data } = await gw(`/farming/positions/${req.params.address}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.post('/api/farming/deposit', async (req, res) => {
    const { status, data } = await gw('/farming/deposit', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  GOVERNANCE — /governance/proposals, /governance/vote
// ══════════════════════════════════════════════════════════

app.get('/api/governance/proposals', async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    const { status, data } = await gw(`/governance/proposals${qs ? '?' + qs : ''}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.post('/api/governance/vote', async (req, res) => {
    const { status, data } = await gw('/governance/vote', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  BRIDGE — /bridge/transfers/:address, /bridge/initiate, /bridge/status/:id
// ══════════════════════════════════════════════════════════

app.get('/api/bridge/transfers/:address', async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    const { status, data } = await gw(`/bridge/transfers/${req.params.address}${qs ? '?' + qs : ''}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.post('/api/bridge/initiate', async (req, res) => {
    const { status, data } = await gw('/bridge/initiate', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

app.get('/api/bridge/status/:transferId', async (req, res) => {
    const { status, data } = await gw(`/bridge/status/${req.params.transferId}`, { headers: fwd(req) });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  TREASURY — /treasury/overview
// ══════════════════════════════════════════════════════════

app.get('/api/treasury/overview', async (req, res) => {
    const { status, data } = await gw('/treasury/overview', { headers: fwd(req) });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  TOKEN — /token/info
// ══════════════════════════════════════════════════════════

app.get('/api/token/info', async (req, res) => {
    const { status, data } = await gw('/token/info', { headers: fwd(req) });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  PAYMENTS — buy BEZ, send BezPay, payment history
// ══════════════════════════════════════════════════════════

app.post('/api/payments/buy', async (req, res) => {
    const { status, data } = await gw('/payments/buy', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

app.post('/api/payments/sell', async (req, res) => {
    const { status, data } = await gw('/payments/sell', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

app.post('/api/payments/send', async (req, res) => {
    const { status, data } = await gw('/payments/send', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

app.get('/api/payments/history/:address', async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    const { status, data } = await gw(`/payments/history/${req.params.address}${qs ? '?' + qs : ''}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.get('/api/token/price', async (req, res) => {
    const { status, data } = await gw('/token/price', { headers: fwd(req) });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  CONTRACTS — /contracts/list, /contracts/:name
// ══════════════════════════════════════════════════════════

app.get('/api/contracts/list', async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    const { status, data } = await gw(`/contracts/list${qs ? '?' + qs : ''}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.get('/api/contracts/:name', async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    const { status, data } = await gw(`/contracts/${req.params.name}${qs ? '?' + qs : ''}`, { headers: fwd(req) });
    res.status(status).json(data);
});

// ══════════════════════════════════════════════════════════
//  DEX / TRADING — quotes, pool info, unsigned tx requests
// ══════════════════════════════════════════════════════════

app.get('/api/dex/pool', async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    const { status, data } = await gw(`/dex/pool${qs ? '?' + qs : ''}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.get('/api/dex/quote', async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    const { status, data } = await gw(`/dex/quote${qs ? '?' + qs : ''}`, { headers: fwd(req) });
    res.status(status).json(data);
});

app.post('/api/dex/swap', async (req, res) => {
    const { status, data } = await gw('/dex/swap', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

app.post('/api/dex/add-liquidity', async (req, res) => {
    const { status, data } = await gw('/dex/add-liquidity', {
        method: 'POST', headers: fwd(req), body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
});

// ── Error handling ──
app.use((err, req, res, _next) => {
    console.error('[DEFI-BACKEND]', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`[BeZhas DeFi Backend] v2.0 running on port ${PORT}`);
    console.log(`[BeZhas DeFi Backend] Core Gateway: ${CORE_API_URL}/api/gateway/v1`);
});

module.exports = app;
