'use strict';

const http = require('http');
const https = require('https');
const logger = require('../utils/logger');

const DEFAULT_RUNTIME_URL = 'http://localhost:3001';

function normalizeBaseUrl(value) {
  return (value || DEFAULT_RUNTIME_URL).replace(/\/+$/, '');
}

function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const req = transport.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      method,
      headers: {
        ...headers,
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      },
      timeout: timeoutMs
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { raw };
        }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Unified Agent timeout'));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

class UnifiedAgentProxyService {
  constructor() {
    this.baseUrl = normalizeBaseUrl(
      process.env.BEZHAS_AGENT_RUNTIME_URL ||
      process.env.BLOCKCHAIN_API_URL ||
      process.env.AGENT_RUNTIME_URL
    );
    this.internalKey = process.env.INTERNAL_API_KEY || process.env.OPENCLAW_API_KEY || 'dev-internal-key';
    this.timeoutMs = Number(process.env.BEZHAS_AGENT_TIMEOUT_MS || 20000);
  }

  async chat({ message, userId, walletAddress, agentId, context = {} }) {
    if (!message || !message.trim()) {
      throw new Error('message is required');
    }

    const payload = {
      message: message.trim(),
      user: {
        userId: userId || walletAddress || 'hub:anonymous',
        address: walletAddress || userId || 'anonymous',
        role: context.role || context.user?.role || 'admin',
        channel: 'hub-chat',
        sectors: context.sectors || []
      },
      agentId: agentId || context.agentId || 'unified-agent',
      context
    };

    try {
      const response = await requestJson(`${this.baseUrl}/api/agent/internal/chat`, {
        method: 'POST',
        headers: {
          'x-internal-key': this.internalKey
        },
        body: payload,
        timeoutMs: this.timeoutMs
      });

      if (!response.ok) {
        throw new Error(response.data.error || response.data.details || `Unified Agent returned ${response.status}`);
      }

      return {
        success: true,
        reply: response.data.data?.text || response.data.reply || response.data.text || '',
        source: response.data.source || 'unified-agent',
        data: response.data.data || response.data
      };
    } catch (error) {
      logger.warn({ err: error.message, baseUrl: this.baseUrl }, '[UnifiedAgentProxy] Chat fallback triggered');
      return {
        success: false,
        error: error.message,
        source: 'unified-agent-unavailable'
      };
    }
  }

  async health() {
    try {
      const response = await requestJson(`${this.baseUrl}/api/agent/internal/status`, {
        headers: { 'x-internal-key': this.internalKey },
        timeoutMs: 5000
      });
      return { ok: response.ok, status: response.status, data: response.data };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
}

module.exports = new UnifiedAgentProxyService();
