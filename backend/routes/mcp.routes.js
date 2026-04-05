/**
 * ============================================================================
 * MCP ROUTES — BeZhas Intelligence Layer
 * ============================================================================
 *
 * Rutas para ejecutar los 13 MCP tools del Orchestrator Service.
 *
 * Endpoints:
 *   GET  /api/mcp/status           → Lista todos los tools con their status
 *   POST /api/mcp/execute          → Ejecuta un tool individual
 *   POST /api/mcp/pipeline         → Ejecuta tools en secuencia (con contexto compartido)
 *   POST /api/mcp/parallel         → Ejecuta varios tools en paralelo
 *   POST /api/mcp/blockscout       → Blockscout Explorer shortcut
 *   POST /api/mcp/github           → GitHub Repo Manager shortcut
 *   POST /api/mcp/tally-dao        → Tally DAO Governance shortcut
 *   POST /api/mcp/analyze-gas      → Gas Analyzer shortcut
 *   POST /api/mcp/calculate-swap   → Swap Calculator shortcut
 *   POST /api/mcp/firecrawl        → Firecrawl Scraper shortcut
 *   POST /api/mcp/alpaca-markets   → Alpaca Markets Trader shortcut
 *   POST /api/mcp/verify-compliance → Compliance Verifier shortcut
 *   POST /api/mcp/audit-contract   → Smart Contract Auditor shortcut
 *   POST /api/mcp/sre-monitor      → Obliq SRE Monitor shortcut
 *   POST /api/mcp/skill-creator    → Skill Creator shortcut
 */

const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/admin.middleware');
const orchestrator = require('../services/orchestrator.service');

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
// All MCP routes require admin authentication
router.use(verifyAdminToken);

// ─── STATUS ────────────────────────────────────────────────────────────────────
/**
 * GET /api/mcp/status
 * Returns the registry of all available MCP tools.
 */
router.get('/status', (req, res) => {
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        tools: orchestrator.getToolRegistry(),
    });
});

// ─── GENERIC EXECUTE ─────────────────────────────────────────────────────────
/**
 * POST /api/mcp/execute
 * Body: { tool: string, params: object }
 * Ejecuta un MCP tool por nombre.
 */
router.post('/execute', async (req, res) => {
    const { tool, params = {} } = req.body;

    if (!tool) {
        return res.status(400).json({ success: false, error: 'Missing "tool" in request body.' });
    }

    try {
        const result = await orchestrator.executeTool(tool, params);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── PIPELINE ────────────────────────────────────────────────────────────────
/**
 * POST /api/mcp/pipeline
 * Body: { steps: Array<{ tool: string, params: object }> }
 * Ejecuta una secuencia de tools pasando contexto entre pasos.
 *
 * Example:
 *   steps: [
 *     { tool: "analyze_gas", params: {} },
 *     { tool: "calculate_swap", params: { amount: "100" } }
 *   ]
 */
router.post('/pipeline', async (req, res) => {
    const { steps = [] } = req.body;

    if (!steps.length) {
        return res.status(400).json({ success: false, error: 'Pipeline "steps" array is empty.' });
    }

    try {
        const result = await orchestrator.executePipeline(steps);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── PARALLEL ────────────────────────────────────────────────────────────────
/**
 * POST /api/mcp/parallel
 * Body: { tools: Array<{ tool: string, params: object }> }
 * Ejecuta varios tools en paralelo.
 */
router.post('/parallel', async (req, res) => {
    const { tools = [] } = req.body;

    if (!tools.length) {
        return res.status(400).json({ success: false, error: 'Parallel "tools" array is empty.' });
    }

    try {
        const result = await orchestrator.executeParallel(tools);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── TOOL SHORTCUTS ───────────────────────────────────────────────────────────
// Each shortcut is a POST endpoint that calls a specific tool directly.

const shortcuts = [
    { path: '/blockscout', tool: 'blockscout_explorer' },
    { path: '/github', tool: 'github_repo_manager' },
    { path: '/tally-dao', tool: 'tally_dao_governance' },
    { path: '/firecrawl', tool: 'firecrawl_scraper' },
    { path: '/playwright', tool: 'playwright_automation' },
    { path: '/kinaxis', tool: 'kinaxis_supply_chain' },
    { path: '/alpaca-markets', tool: 'alpaca_markets_trader' },
    { path: '/analyze-gas', tool: 'analyze_gas' },
    { path: '/calculate-swap', tool: 'calculate_swap' },
    { path: '/verify-compliance', tool: 'verify_compliance' },
    { path: '/audit-contract', tool: 'auditmos_auditor' },
    { path: '/sre-monitor', tool: 'obliq_sre_monitor' },
    { path: '/skill-creator', tool: 'skill_creator' },
];

shortcuts.forEach(({ path: routePath, tool }) => {
    router.post(routePath, async (req, res) => {
        try {
            const result = await orchestrator.executeTool(tool, req.body);
            res.json({ success: true, tool, result });
        } catch (err) {
            res.status(500).json({ success: false, tool, error: err.message });
        }
    });
});

module.exports = router;
