const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const orchestrator = require('../services/orchestrator.service');

const app = express();
const port = Number(process.env.MAGAZINE_MCP_DEV_PORT || 3001);

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'magazine-mcp-dev', port });
});

app.post('/api/mcp/execute', async (req, res) => {
  const { tool, params = {} } = req.body || {};

  if (!tool) {
    return res.status(400).json({ success: false, error: 'Missing "tool" in request body.' });
  }

  try {
    const result = await orchestrator.executeTool(tool, params);
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/mcp/marketing-post', async (req, res) => {
  try {
    const result = await orchestrator.executeTool('generate_marketing_post', req.body || {});
    return res.json({ success: true, tool: 'generate_marketing_post', result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Magazine MCP dev server running on http://localhost:${port}`);
});

