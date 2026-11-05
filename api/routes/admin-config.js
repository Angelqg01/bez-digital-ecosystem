/**
 * routes/admin-config.js — Unified Admin Config
 * 
 * Stores and retrieves admin configs for Treasury, Ecosystem, Intelligence, Governance, and Skills
 * Uses Redis for fast persistence.
 */
const { Router } = require('express');
const { cacheGet, cacheSet } = require('../cache/redis');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const treasuryConfig = require('../services/treasuryConfig');

const router = Router();

// La guarda va aquí, en el router, y no en el `app.use()` de index.js: montado
// allí es una línea que se puede reordenar o duplicar sin que nada falle, y
// este módulo escribe wallets de Treasury y límites de gasto. Al colgarla del
// propio router, cualquier sitio donde se monte queda cerrado por defecto.
router.use(requireSuperAdmin);

// Antes leía `require('../cache/redis').client`, que no existe: nada se guardaba
// y siempre se devolvían los valores por defecto. cacheGet/cacheSet son los
// helpers reales del módulo (con su plazo y su «si Redis cae, se degrada»).
async function getConfig(key, defaultVal) {
    const cached = await cacheGet(`admin:config:${key}`);
    return cached && typeof cached === 'object' ? cached : defaultVal;
}

async function setConfig(key, val) {
    return (await cacheSet(`admin:config:${key}`, val)) ? val : null;
}

// Config Defaults
const DEFAULTS = {
    // treasury: services/treasuryConfig.js (validada; la usa también /api/admin-hot-wallet).
    treasury: treasuryConfig.DEFAULTS,
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

// Tesorería: validada y compartida con la sección Treasury & Web3 (admin-hot-wallet).
router.get('/treasury', async (_req, res) => {
    res.json({ success: true, data: { ...(await treasuryConfig.leer()), ...treasuryConfig.delDespliegue() } });
});

router.post('/treasury', async (req, res) => {
    try {
        const { config, persistida } = await treasuryConfig.guardar(req.body || {});
        res.status(persistida ? 200 : 503).json({ success: persistida, data: config, ...(persistida ? {} : { error: 'Redis no disponible: no se guardó.' }) });
    } catch (err) {
        if (err instanceof treasuryConfig.ConfigInvalida) return res.status(400).json({ error: err.message, code: err.code, details: err.errores });
        res.status(500).json({ error: 'No se pudo guardar la configuración de tesorería' });
    }
});

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
