'use strict';

/**
 * buffer.js — store-and-forward buffer for telemetry.
 *
 * When the MQTT link is down, payloads are queued (in-memory + optional NDJSON
 * file persistence) and flushed on reconnect, so a network outage backfills
 * instead of losing data. Dependency-free.
 *
 * The file is append-only NDJSON; on drain() the in-memory queue is handed to
 * the caller and the file is truncated only after a successful flush.
 */

const fs = require('fs');
const path = require('path');

function createBuffer(opts = {}) {
  const enabled = opts.enabled !== false;
  const maxRecords = opts.maxRecords || 5000;
  const file = opts.file ? path.resolve(opts.file) : null;

  /** @type {Array<{topic:string, payload:object}>} */
  let queue = [];

  // Rehydrate from disk on startup (recover an outage that spanned a restart).
  if (enabled && file && fs.existsSync(file)) {
    try {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try { queue.push(JSON.parse(line)); } catch { /* skip corrupt line */ }
      }
      if (queue.length > maxRecords) queue = queue.slice(-maxRecords);
    } catch { /* unreadable buffer → start empty */ }
  }

  function push(topic, payload) {
    if (!enabled) return;
    const record = { topic, payload };
    queue.push(record);
    if (queue.length > maxRecords) queue.shift(); // drop oldest (cap memory)
    if (file) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, JSON.stringify(record) + '\n');
      } catch { /* persistence best-effort */ }
    }
  }

  /** Return all buffered records and clear the buffer (memory + file). */
  function drain() {
    const records = queue;
    queue = [];
    if (file) {
      try { fs.writeFileSync(file, ''); } catch { /* ignore */ }
    }
    return records;
  }

  return { push, drain, size: () => queue.length, isEnabled: () => enabled };
}

module.exports = { createBuffer };
