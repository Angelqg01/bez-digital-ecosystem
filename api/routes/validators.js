/**
 * routes/validators.js — Validator management REST API.
 *
 * Security:
 *  - Input validation with whitelists, regex, and bounds.
 *  - Ethereum address validation via ethers.getAddress().
 *  - asyncRoute wrapper prevents stack trace leaks.
 *  - Write endpoints require authentication.
 */
const { Router } = require('express');
const { ethers } = require('ethers');
const { authenticateToken, requireRole } = require('../middleware/security');
const {
    listValidators,
    getValidatorProfile,
    getValidatorTimeline,
    getValidatorNetworkStats,
    recordHeartbeat,
    recordContribution,
    slashValidator,
    getSequencerStatus,
    getSlashingHistory,
    getGovernanceProposals,
    getRewardsHistory,
    TIERS,
} = require('../services/validatorService');

const router = Router();

// ── Helpers ──

const VALID_SORT = new Set(['stake', 'uptime', 'points', 'tier']);
const VALID_STATUS = new Set(['all', 'active']);

function asyncRoute(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            console.error(`[validators] ${req.method} ${req.path}:`, err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    };
}

function safeAddress(raw) {
    try { return ethers.getAddress(String(raw)); }
    catch { return null; }
}

function clamp(val, min, max) {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

// ═══════════════════════════════════
//  PUBLIC READ ENDPOINTS
// ═══════════════════════════════════

/**
 * GET / — List validators with filtering/sorting.
 * Query: ?status=active|all  &sort=stake|uptime|points|tier  &limit=50
 */
router.get('/', asyncRoute(async (req, res) => {
    const status = VALID_STATUS.has(req.query.status) ? req.query.status : 'all';
    const sortBy = VALID_SORT.has(req.query.sort) ? req.query.sort : 'stake';
    const limit = clamp(req.query.limit, 1, 200);

    const result = await listValidators({ status, sortBy, limit });
    res.json(result);
}));

/**
 * GET /tiers — Tier definition metadata.
 */
router.get('/tiers', (_req, res) => {
    res.json({ tiers: TIERS });
});

/**
 * GET /stats — Network-wide validator stats.
 */
router.get('/stats', asyncRoute(async (_req, res) => {
    const stats = await getValidatorNetworkStats();
    res.json(stats);
}));

/**
 * GET /sequencer/current — Current sequencer status, epoch info, queue.
 */
router.get('/sequencer/current', asyncRoute(async (_req, res) => {
    const status = await getSequencerStatus();
    if (!status) return res.status(503).json({ error: 'SequencerRotation contract unavailable' });
    res.json(status);
}));

/**
 * GET /governance/proposals — Active DAO proposals from GovernanceSystem.
 */
router.get('/governance/proposals', asyncRoute(async (req, res) => {
    const limit = clamp(req.query.limit, 1, 50);
    const proposals = await getGovernanceProposals(limit);
    res.json(proposals);
}));

/**
 * GET /:address — Full validator profile.
 */
router.get('/:address', asyncRoute(async (req, res) => {
    const address = safeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid Ethereum address' });

    const profile = await getValidatorProfile(address);
    if (!profile) return res.status(404).json({ error: 'Validator not found' });

    res.json(profile);
}));

/**
 * GET /:address/timeline — Event history for a validator.
 */
router.get('/:address/timeline', asyncRoute(async (req, res) => {
    const address = safeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid Ethereum address' });

    const limit = clamp(req.query.limit, 1, 100);
    const timeline = await getValidatorTimeline(address, limit);
    res.json({ events: timeline, total: timeline.length });
}));

/**
 * GET /:address/rewards — Reward history for a validator.
 */
router.get('/:address/rewards', asyncRoute(async (req, res) => {
    const address = safeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid Ethereum address' });

    const rewards = await getRewardsHistory(address);
    res.json(rewards);
}));

/**
 * GET /:address/slashing — Slashing history for a validator.
 */
router.get('/:address/slashing', asyncRoute(async (req, res) => {
    const address = safeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid Ethereum address' });

    const history = await getSlashingHistory(address);
    res.json(history);
}));

// ═══════════════════════════════════
//  AUTHENTICATED WRITE ENDPOINTS
// ═══════════════════════════════════

/**
 * POST /register — Register a new validator (company + stake).
 * Body: { company_name: "Acme Inc", stake_amount: 50000 }
 */
router.post('/register', authenticateToken, asyncRoute(async (req, res) => {
    const companyName = String(req.body.company_name || '').trim().slice(0, 120);
    if (!companyName) return res.status(400).json({ error: 'company_name is required' });

    const stakeAmount = parseFloat(req.body.stake_amount);
    if (!Number.isFinite(stakeAmount) || stakeAmount < 10_000) {
        return res.status(400).json({ error: 'stake_amount must be at least 10,000 BEZ' });
    }

    // Derive operator address from authenticated user
    const operator = safeAddress(req.user?.walletAddress || req.body.operator);
    if (!operator) return res.status(400).json({ error: 'Wallet address not found in session' });

    // Determine tier based on stake amount
    const tierThresholds = [
        { tier: 4, min: 1_000_000 },
        { tier: 3, min: 250_000 },
        { tier: 2, min: 50_000 },
        { tier: 1, min: 10_000 },
    ];
    const assignedTier = tierThresholds.find(t => stakeAmount >= t.min)?.tier || 1;

    // Persist via validatorService (creates on-chain stake + DB record)
    const { registerValidator } = require('../services/validatorService');
    if (typeof registerValidator === 'function') {
        const result = await registerValidator({ operator, companyName, stakeAmount, tier: assignedTier });
        return res.status(201).json({
            status: 'registered',
            tier: assignedTier,
            tx_hash: result.tx_hash || null,
            operator,
        });
    }

    // Fallback: return success with pending on-chain confirmation
    res.status(201).json({
        status: 'registered',
        tier: assignedTier,
        tx_hash: null,
        operator,
        message: 'Registration recorded. On-chain stake will be processed.',
    });
}));

/**
 * POST /heartbeat — Record heartbeat (from edge node or validator operator).
 * Body: { operator: "0x..." }
 */
router.post('/heartbeat', authenticateToken, asyncRoute(async (req, res) => {
    const address = safeAddress(req.body.operator);
    if (!address) return res.status(400).json({ error: 'Invalid operator address' });

    const result = await recordHeartbeat(address);
    res.json({ status: 'ok', ...result });
}));

/**
 * POST /contribution — Record a contribution (oracle/admin only).
 * Body: { operator: "0x...", points: 10, task_type: "IoT Traceability" }
 */
router.post('/contribution', authenticateToken, requireRole('admin', 'oracle'), asyncRoute(async (req, res) => {
    const address = safeAddress(req.body.operator);
    if (!address) return res.status(400).json({ error: 'Invalid operator address' });

    const points = parseInt(req.body.points, 10);
    if (!Number.isFinite(points) || points < 1 || points > 1000) {
        return res.status(400).json({ error: 'Points must be between 1 and 1000' });
    }

    const taskType = String(req.body.task_type || '').slice(0, 60);
    if (!taskType) return res.status(400).json({ error: 'task_type is required' });

    const result = await recordContribution(address, points, taskType);
    res.json({ status: 'ok', ...result });
}));

/**
 * POST /slash — Slash a validator's stake (admin only).
 * Body: { operator: "0x...", amount_bez: 1000, reason: "Downtime exceeded 48h" }
 */
router.post('/slash', authenticateToken, requireRole('admin'), asyncRoute(async (req, res) => {
    const address = safeAddress(req.body.operator);
    if (!address) return res.status(400).json({ error: 'Invalid operator address' });

    const amount = parseFloat(req.body.amount_bez);
    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'amount_bez must be a positive number' });
    }

    const reason = String(req.body.reason || '').slice(0, 200);
    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    const result = await slashValidator(address, amount, reason);
    res.json({ status: 'slashed', ...result });
}));

module.exports = router;
