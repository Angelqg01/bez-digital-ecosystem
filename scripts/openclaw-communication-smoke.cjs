#!/usr/bin/env node
'use strict';

/**
 * Smoke test for OpenClaw communication paths:
 * 1. Telegram bot token validity via getMe.
 * 2. Unified Agent internal chat.
 * 3. Unified Agent Telegram channel startup.
 * 4. Hub chat proxy -> Blockchain Unified Agent.
 * 5. Optional Telegram test message to TELEGRAM_ALLOWED_CHAT_IDS or TELEGRAM_SECURITY_CHAT_ID.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const HUB_BACKEND = 'D:/Bezhas-Hub/backend';

function loadEnvFile(filePath, overwrite = false) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (overwrite || !process.env[key]) process.env[key] = value;
  }
}

function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
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
          'Content-Length': Buffer.byteLength(payload),
        } : {}),
      },
      timeout: timeoutMs,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
      });
    });

    req.on('timeout', () => req.destroy(new Error(`Timeout calling ${url}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function mask(value) {
  if (!value) return '';
  return `${String(value).slice(0, 3)}***${String(value).slice(-3)}`;
}

async function main() {
  loadEnvFile(path.join(HUB_BACKEND, '.env'));
  loadEnvFile(path.join(ROOT, '.env'));

  process.env.SKIP_REDIS_ON_IMPORT = 'true';
  process.env.SKIP_SCHEMA_ON_IMPORT = 'true';
  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || process.env.OPENCLAW_API_KEY || 'dev-internal-key';
  process.env.TELEGRAM_ALLOWED_CHAT_IDS = process.env.TELEGRAM_ALLOWED_CHAT_IDS || process.env.TELEGRAM_SECURITY_CHAT_ID || '';
  process.env.TELEGRAM_AGENT_ROLE = process.env.TELEGRAM_AGENT_ROLE || 'admin';
  process.env.BEZHAS_AGENT_RUNTIME_URL = 'http://127.0.0.1:3996';

  const report = {
    telegramGetMe: null,
    internalChat: null,
    channelRestart: null,
    hubChatProxy: null,
    telegramMessage: null,
  };

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing');
  }

  const getMe = await requestJson(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, { timeoutMs: 15000 });
  report.telegramGetMe = {
    ok: getMe.ok && getMe.data.ok,
    bot: getMe.data.result?.username || null,
  };
  if (!report.telegramGetMe.ok) {
    throw new Error(`Telegram getMe failed with status ${getMe.status}`);
  }

  const app = require(path.join(ROOT, 'api/index.js'));
  const { pool } = require(path.join(ROOT, 'api/db/pool.js'));
  const server = app.listen(3996, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  try {
    const internalChat = await requestJson('http://127.0.0.1:3996/api/agent/internal/chat', {
      method: 'POST',
      headers: { 'x-internal-key': process.env.INTERNAL_API_KEY },
      body: {
        message: '/health',
        user: {
          userId: 'smoke:openclaw',
          address: '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
          role: 'admin',
          channel: 'smoke-test',
        },
      },
    });
    report.internalChat = {
      ok: internalChat.ok,
      source: internalChat.data.source,
      reply: internalChat.data.reply,
    };

    const channelRestart = await requestJson('http://127.0.0.1:3996/api/agent/internal/channels/restart', {
      method: 'POST',
      headers: { 'x-internal-key': process.env.INTERNAL_API_KEY },
    });
    report.channelRestart = {
      ok: channelRestart.ok,
      channels: channelRestart.data.data?.channels || channelRestart.data,
    };

    const proxy = require(path.join(HUB_BACKEND, 'services/unified-agent-proxy.service.js'));
    const hubChat = await proxy.chat({
      message: '/health',
      userId: 'smoke:hub-chat',
      walletAddress: '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
      agentId: 'openclaw-unified-agent',
      context: { role: 'admin', source: 'openclaw-smoke' },
    });
    report.hubChatProxy = {
      ok: hubChat.success,
      source: hubChat.source,
      reply: hubChat.reply,
    };

    const chatId = process.env.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map(v => v.trim()).filter(Boolean)[0];
    if (chatId) {
      const text = [
        'BeZhas OpenClaw smoke test',
        '',
        'Telegram: OK',
        `Bot: @${report.telegramGetMe.bot}`,
        `Unified Agent: ${report.internalChat.ok ? 'OK' : 'FAIL'}`,
        `Hub chat proxy: ${report.hubChatProxy.ok ? 'OK' : 'FAIL'}`,
        '',
        'Test command: /health',
        `Reply: ${String(report.internalChat.reply || '').replace(/\n/g, ' | ')}`,
      ].join('\n');

      const sent = await requestJson(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        body: {
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        },
      });

      report.telegramMessage = {
        ok: sent.ok && sent.data.ok,
        chat: mask(chatId),
        messageId: sent.data.result?.message_id || null,
      };
    } else {
      report.telegramMessage = { ok: false, skipped: true, reason: 'No allowed chat id configured' };
    }

    console.log(JSON.stringify(report, null, 2));

    const passed = report.telegramGetMe.ok &&
      report.internalChat.ok &&
      report.channelRestart.ok &&
      report.hubChatProxy.ok &&
      report.telegramMessage.ok;

    process.exitCode = passed ? 0 : 1;
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool.end().catch(() => {});
    setImmediate(() => process.exit(process.exitCode || 0));
  }
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exitCode = 1;
});
