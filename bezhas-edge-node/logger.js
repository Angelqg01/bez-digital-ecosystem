/**
 * logger.js — Structured JSON logger for BeZhas Edge Node.
 * Writes to stdout in JSON format; rotates via external log management (Docker/logrotate).
 */
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? 1;

function log(level, message, meta = {}) {
    if ((LOG_LEVELS[level] ?? 1) < LEVEL) return;
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        service: 'bezhas-edge-node',
        message,
        ...meta,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
}

module.exports = {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
};
