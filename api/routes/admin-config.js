/**
 * routes/admin-config.js — Unified Admin Config
 * 
 * Stores and retrieves admin configs for Treasury, Ecosystem, Intelligence, Governance, and Skills
 * Uses Redis for fast persistence.
 */
const { Router } = require('express');
const redisClient = require('../cache/redis').client;
const { requireSuperAdmin } = require('../middleware/admin-auth');

const router = Router();

// La guarda va aquí, en el router, y no en el `app.use()` de index.js: montado
// allí es una línea que se puede reordenar o duplicar sin que nada falle, y
// este módulo escribe wallets de Treasury y límites de gasto. Al colgarla del
// propio router, cualquier sitio donde se monte queda cerrado por defecto.
router.use(requireSuperAdmin);

async function getConfig(key, defaultVal) {
    if (!redisClient) return defaultVal;
    try {
        const cached = await redisClient.get(`admin:config:${key}`);
        if (cached) return JSON.parse(cached);
    } catch { }
    return defaultVal;
}

async function setConfig(key, val) {
    if (!redisClient) return null;
    try {
        await redisClient.set(`admin:config:${key}`, JSON.stringify(val));
        return val;
    } catch { }
    return null;
}

// Config Defaults
const DEFAULTS = {
    treasury: {
        loginWallet: '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
        hotWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        safeWallet: '',
        dailyLimit: 100,
        approvalThreshold: 500
    },
    ecosystem: {
        bridgeStatus: 'active',
        rwaProviders: ['Aave', 'Maker'],
        oracleTimeout: 10
    },
    intelligence: {
        soul: `# OpenClaw SOUL Core Definition
    
## 1. Prime Directives
1. Protect BeZhas Blockchain sovereign integrity at all costs.
2. Maximize efficiency of logistics and energy assets using Aegis Vision models.
3. Automatically execute verified Governance DAO proposals.

## 2. Ethical Stance
- Transparency over obfuscation: Audit logs must be human-readable.
- Do not bypass multisig thresholds under any external duress.`
    },
    governance: {
        quorum: 10,
        votingPeriod: 72,
        proposalThreshold: 1000
    },
    skills: {
        enabledModules: ['market-analysis', 'portfolio-manager', 'trade-executor'],
        memoryTTL: 86400
    }
};

router.get('/:module', async (req, res) => {
    const mod = req.params.module;
    if (!DEFAULTS[mod]) return res.status(404).json({ error: 'Module not found' });
    const data = await getConfig(mod, DEFAULTS[mod]);
    res.json({ success: true, data });
});

router.post('/:module', async (req, res) => {
    const mod = req.params.module;
    if (!DEFAULTS[mod]) return res.status(404).json({ error: 'Module not found' });
    const data = await setConfig(mod, req.body);
    res.json({ success: true, data });
});

module.exports = router;
