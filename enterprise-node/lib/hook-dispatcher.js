'use strict';

const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { query } = require('./db');

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0
    );
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return true;
}

async function validateHookUrl(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Hook URL must be http or https.');
  }

  if (['localhost', 'localhost.localdomain'].includes(parsed.hostname.toLowerCase())) {
    throw new Error('Hook URL host is not allowed.');
  }

  const directIp = net.isIP(parsed.hostname);
  const addresses = directIp
    ? [{ address: parsed.hostname }]
    : await dns.lookup(parsed.hostname, { all: true, verbatim: false });

  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error('Hook URL resolves to a private or reserved address.');
  }

  return parsed;
}

function sanitizeEventType(value) {
  return String(value || '*').replace(/[^a-zA-Z0-9.*:_-]/g, '').slice(0, 80) || '*';
}

async function listHooks() {
  const { rows } = await query(
    `SELECT id, name, url, event_type, active, created_at, last_status, last_error, last_delivered_at
     FROM integration_hooks
     ORDER BY id ASC`
  );
  return rows;
}

async function createHook({ name, url, event_type = '*', secret = null, active = true }) {
  const parsed = await validateHookUrl(url);

  const { rows } = await query(
    `INSERT INTO integration_hooks (name, url, event_type, secret, active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, url, event_type, active, created_at`,
    [
      String(name || parsed.hostname).slice(0, 120),
      parsed.toString(),
      sanitizeEventType(event_type),
      secret ? String(secret) : null,
      Boolean(active),
    ]
  );
  return rows[0];
}

async function deleteHook(id) {
  const { rowCount } = await query('DELETE FROM integration_hooks WHERE id = $1', [parseInt(id, 10)]);
  return rowCount > 0;
}

function matches(hookType, eventType) {
  return hookType === '*' || hookType === eventType || (hookType.endsWith('*') && eventType.startsWith(hookType.slice(0, -1)));
}

function signPayload(secret, body) {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function dispatch(eventType, payload) {
  const safeType = sanitizeEventType(eventType);
  const { rows: hooks } = await query(
    'SELECT id, name, url, event_type, secret FROM integration_hooks WHERE active = TRUE'
  );

  const targets = hooks.filter((hook) => matches(hook.event_type, safeType));
  const deliveries = [];

  for (const hook of targets) {
    const body = JSON.stringify({
      type: safeType,
      delivered_at: new Date().toISOString(),
      payload,
    });
    const signature = signPayload(hook.secret, body);

    try {
      await validateHookUrl(hook.url);
      const resp = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BeZhas-Enterprise-Node/1.0',
          ...(signature ? { 'X-BeZhas-Signature': signature } : {}),
        },
        body,
        signal: AbortSignal.timeout(parseInt(process.env.HOOK_TIMEOUT_MS || '8000', 10)),
      });

      await query(
        `UPDATE integration_hooks
         SET last_status = $1, last_error = NULL, last_delivered_at = NOW()
         WHERE id = $2`,
        [resp.status, hook.id]
      );
      deliveries.push({ hook_id: hook.id, status: resp.status, ok: resp.ok });
    } catch (err) {
      await query(
        `UPDATE integration_hooks
         SET last_status = NULL, last_error = $1, last_delivered_at = NOW()
         WHERE id = $2`,
        [err.message.slice(0, 500), hook.id]
      );
      deliveries.push({ hook_id: hook.id, ok: false, error: err.message });
    }
  }

  return { event_type: safeType, matched: targets.length, deliveries };
}

module.exports = {
  listHooks,
  createHook,
  deleteHook,
  dispatch,
};
