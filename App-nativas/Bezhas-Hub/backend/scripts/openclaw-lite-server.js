'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

const express = require('express');
const cors = require('cors');
const unifiedAgentProxy = require('../services/unified-agent-proxy.service');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: false,
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'bezhas-hub-openclaw-lite',
    agentRuntimeUrl: process.env.BEZHAS_AGENT_RUNTIME_URL || process.env.BLOCKCHAIN_API_URL || 'http://localhost:3001',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/chat/agent-health', async (_req, res) => {
  const health = await unifiedAgentProxy.health();
  res.status(health.ok ? 200 : 503).json({
    success: health.ok,
    service: 'hub-to-unified-agent',
    runtime: health,
    timestamp: Date.now(),
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context = {}, userId, agentId, walletAddress } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    const result = await unifiedAgentProxy.chat({
      message,
      userId: userId || 'web-chat',
      walletAddress,
      agentId: agentId || 'openclaw-unified-agent',
      context: { role: 'admin', ...context },
    });

    res.status(result.success ? 200 : 503).json({
      success: result.success,
      reply: result.reply || result.error,
      source: result.source,
      agent: agentId || 'openclaw-unified-agent',
      data: result.data,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/openclaw/health', (_req, res) => {
  res.json({
    success: true,
    service: 'OpenClaw via BeZhas Unified Agent',
    mode: 'lite-hub-bridge',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/openclaw/chat', async (req, res) => {
  const result = await unifiedAgentProxy.chat({
    message: req.body?.message,
    userId: req.body?.walletAddress || 'openclaw-web',
    walletAddress: req.body?.walletAddress,
    agentId: 'openclaw-unified-agent',
    context: { role: 'admin', source: 'openclaw-chat' },
  });

  res.status(result.success ? 200 : 503).json({
    success: result.success,
    response: result.reply || result.error,
    source: result.source,
    agent: 'OpenClaw',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[OpenClaw Lite] Hub bridge listening on http://localhost:${PORT}`);
});
