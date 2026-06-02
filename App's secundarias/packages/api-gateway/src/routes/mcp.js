import { Router } from 'express';
import { requireAuth } from './auth.js';

const router = Router();

const MCP_TOOLS = {
  'vision-analyze': { endpoint: '/vision/analyze', method: 'POST' },
  'sift-fingerprint': { endpoint: '/vision/sift', method: 'POST' },
  'gas-predict': { endpoint: '/gas/predict', method: 'GET' },
  'nft-mint': { endpoint: '/nft/mint', method: 'POST' },
  'escrow-create': { endpoint: '/escrow/create', method: 'POST' },
  'sensor-register': { endpoint: '/sensor/register', method: 'POST' },
  'bridge-initiate': { endpoint: '/bridge/initiate', method: 'POST' },
  'did-resolve': { endpoint: '/did/resolve', method: 'POST' },
  'reputation-query': { endpoint: '/reputation/query', method: 'GET' },
  'compliance-check': { endpoint: '/compliance/check', method: 'POST' },
  'route-optimize': { endpoint: '/logistics/route', method: 'POST' },
  'anomaly-detect': { endpoint: '/security/anomaly', method: 'POST' },
};

/** GET /api/mcp/tools — List available MCP tools */
router.get('/tools', (req, res) => {
  res.json({
    tools: Object.entries(MCP_TOOLS).map(([id, config]) => ({
      id,
      ...config,
      available: true,
    })),
    total: Object.keys(MCP_TOOLS).length,
  });
});

/** POST /api/mcp/invoke — Invoke an MCP tool (JSON-RPC style) */
router.post('/invoke', requireAuth, async (req, res) => {
  const { toolId, params = {} } = req.body;

  if (!toolId || !MCP_TOOLS[toolId]) {
    return res.status(400).json({
      error: `Unknown tool: ${toolId}`,
      availableTools: Object.keys(MCP_TOOLS),
    });
  }

  const aegisUrl = process.env.AEGIS_BASE_URL;
  const tool = MCP_TOOLS[toolId];

  // Route to Aegis if available
  if (aegisUrl) {
    try {
      const fetchOptions = {
        method: tool.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (tool.method === 'POST') {
        fetchOptions.body = JSON.stringify(params);
      }

      const response = await fetch(`${aegisUrl}${tool.endpoint}`, fetchOptions);
      const data = await response.json();

      return res.json({
        jsonrpc: '2.0',
        id: req.body.id || Date.now(),
        result: data,
        meta: { toolId, source: 'aegis', latencyMs: 0 },
      });
    } catch (error) {
      console.error(`[MCP] Tool ${toolId} via Aegis failed:`, error.message);
    }
  }

  // Fallback: return mock result
  res.json({
    jsonrpc: '2.0',
    id: req.body.id || Date.now(),
    result: {
      status: 'success',
      message: `Tool ${toolId} executed (mock mode)`,
      params,
      timestamp: new Date().toISOString(),
    },
    meta: { toolId, source: 'mock' },
  });
});

export { router as mcpRouter };
