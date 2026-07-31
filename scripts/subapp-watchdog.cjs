#!/usr/bin/env node
/**
 * subapp-watchdog.cjs — Pings every BeZhas SubApp and alerts on downtime.
 *
 * Reads the canonical registry at scripts/config/subapps.json and, for each
 * SubApp, tries a lightweight `/health` endpoint first and falls back to `/`
 * (HEAD request) when the app hasn't been redeployed with the health route
 * yet (see scripts/deploy-subapp.sh nginx.conf template).
 *
 * Anti-flap: an app is only reported DOWN after N consecutive failed checks
 * (default 2), and only reported RECOVERED after 1 success following a DOWN
 * alert — so a single dropped request never pages anyone.
 *
 * State persists in scripts/status/watchdog-state.json across runs, so
 * `--once` invocations (e.g. from a scheduled task / cron) don't re-alert on
 * every tick. A full status snapshot is written to
 * scripts/status/subapp-status.json after every check cycle.
 *
 * Usage:
 *   node scripts/subapp-watchdog.cjs              — loop forever (interval below)
 *   node scripts/subapp-watchdog.cjs --once        — single pass, exit 1 if any DOWN
 *   node scripts/subapp-watchdog.cjs --interval=60000
 *
 * Env:
 *   WATCHDOG_INTERVAL_MS          default 120000 (2 min)
 *   WATCHDOG_TIMEOUT_MS           default 8000
 *   WATCHDOG_FAILURE_THRESHOLD    default 2 (consecutive failures before alert)
 *   WATCHDOG_DISCORD_WEBHOOK_URL  (falls back to DISCORD_WEBHOOK_URL)
 *   WATCHDOG_TELEGRAM_BOT_TOKEN   (falls back to TELEGRAM_BOT_TOKEN)
 *   WATCHDOG_TELEGRAM_CHAT_ID     (falls back to TELEGRAM_CHAT_ID)
 *
 * Alerting is best-effort and optional: with no webhook/token configured the
 * watchdog still runs and logs to stdout/stderr + the status snapshot.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'config', 'subapps.json');
const STATUS_DIR = path.join(__dirname, 'status');
const STATE_PATH = path.join(STATUS_DIR, 'watchdog-state.json');
const SNAPSHOT_PATH = path.join(STATUS_DIR, 'subapp-status.json');

const INTERVAL_MS = Number(process.env.WATCHDOG_INTERVAL_MS) || 120_000;
const TIMEOUT_MS = Number(process.env.WATCHDOG_TIMEOUT_MS) || 8_000;
const FAILURE_THRESHOLD = Number(process.env.WATCHDOG_FAILURE_THRESHOLD) || 2;

const DISCORD_WEBHOOK_URL = process.env.WATCHDOG_DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.WATCHDOG_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.WATCHDOG_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';

function log(icon, msg) {
    console.log(`[watchdog] ${icon}  ${msg}`);
}

function loadConfig() {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (!Array.isArray(raw.apps) || raw.apps.length === 0) {
        throw new Error(`No apps defined in ${CONFIG_PATH}`);
    }
    return raw.apps;
}

function loadState() {
    if (!fs.existsSync(STATE_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    } catch {
        return {};
    }
}

function saveState(state) {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

function saveSnapshot(snapshot) {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
}

/** Single HTTP probe with timeout. Returns { ok, status, latencyMs, error } */
async function probe(url, method) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const started = Date.now();
    try {
        const res = await fetch(url, { method, redirect: 'follow', signal: controller.signal });
        const latencyMs = Date.now() - started;
        return { ok: res.status < 500, status: res.status, latencyMs, error: null };
    } catch (err) {
        return { ok: false, status: null, latencyMs: Date.now() - started, error: err.name === 'AbortError' ? 'timeout' : err.message };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Checks one SubApp: prefers app.healthPath if set, otherwise tries
 * `/health` then falls back to `/` (HEAD) so apps without the lightweight
 * endpoint yet are still covered.
 */
async function checkApp(app) {
    const origin = new URL(app.url).origin;
    const candidates = app.healthPath ? [app.healthPath] : ['/health', '/'];

    let last = null;
    for (const candidatePath of candidates) {
        const target = origin + candidatePath;
        const method = candidatePath === '/' ? 'HEAD' : 'GET';
        // eslint-disable-next-line no-await-in-loop
        last = await probe(target, method);
        last.target = target;
        if (last.ok) return last;
    }
    return last;
}

async function sendDiscordAlert(text) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: text }),
        });
    } catch (err) {
        log('⚠️', `Discord alert failed: ${err.message}`);
    }
}

async function sendTelegramAlert(text) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
        });
    } catch (err) {
        log('⚠️', `Telegram alert failed: ${err.message}`);
    }
}

async function alert(text) {
    log('🚨', text.replace(/\n/g, ' | '));
    await Promise.all([sendDiscordAlert(text), sendTelegramAlert(text)]);
}

async function runCycle(apps, state) {
    const results = await Promise.allSettled(apps.map((app) => checkApp(app)));
    const now = new Date().toISOString();
    const alerts = [];

    const appStatuses = apps.map((app, i) => {
        const settled = results[i];
        const probeResult = settled.status === 'fulfilled'
            ? settled.value
            : { ok: false, status: null, latencyMs: null, error: settled.reason?.message || 'probe_failed' };

        const prev = state[app.name] || { consecutiveFailures: 0, consecutiveSuccesses: 0, downAlertSent: false, lastStatus: 'unknown' };

        let consecutiveFailures = prev.consecutiveFailures;
        let consecutiveSuccesses = prev.consecutiveSuccesses;
        let downAlertSent = prev.downAlertSent;

        if (probeResult.ok) {
            consecutiveSuccesses += 1;
            consecutiveFailures = 0;
            if (downAlertSent) {
                alerts.push(`✅ **${app.name}** recuperado — ${probeResult.target} respondió ${probeResult.status} (${probeResult.latencyMs}ms)`);
                downAlertSent = false;
            }
        } else {
            consecutiveFailures += 1;
            consecutiveSuccesses = 0;
            if (consecutiveFailures >= FAILURE_THRESHOLD && !downAlertSent) {
                alerts.push(`🔴 **${app.name}** CAÍDO — ${probeResult.target || app.url} (${probeResult.error || `HTTP ${probeResult.status}`}) tras ${consecutiveFailures} intentos`);
                downAlertSent = true;
            }
        }

        const status = probeResult.ok ? 'up' : (consecutiveFailures >= FAILURE_THRESHOLD ? 'down' : 'flaky');

        state[app.name] = { consecutiveFailures, consecutiveSuccesses, downAlertSent, lastStatus: status };

        return {
            name: app.name,
            url: app.url,
            status,
            httpStatus: probeResult.status,
            latencyMs: probeResult.latencyMs,
            error: probeResult.error,
            consecutiveFailures,
            checkedAt: now,
        };
    });

    for (const text of alerts) {
        // eslint-disable-next-line no-await-in-loop
        await alert(text);
    }

    saveState(state);

    const snapshot = {
        timestamp: now,
        intervalMs: INTERVAL_MS,
        failureThreshold: FAILURE_THRESHOLD,
        summary: {
            total: appStatuses.length,
            up: appStatuses.filter((a) => a.status === 'up').length,
            down: appStatuses.filter((a) => a.status === 'down').length,
            flaky: appStatuses.filter((a) => a.status === 'flaky').length,
        },
        apps: appStatuses,
    };
    saveSnapshot(snapshot);

    for (const a of appStatuses) {
        const icon = a.status === 'up' ? '✅' : a.status === 'down' ? '🔴' : '⚠️';
        log(icon, `${a.name.padEnd(20)} ${a.status.toUpperCase().padEnd(6)} ${a.httpStatus ?? '-'} ${a.latencyMs != null ? `${a.latencyMs}ms` : ''} ${a.error || ''}`.trim());
    }
    log('📄', `${snapshot.summary.up}/${snapshot.summary.total} up — snapshot: ${path.relative(ROOT, SNAPSHOT_PATH)}`);

    return snapshot;
}

async function main() {
    const args = process.argv.slice(2);
    const isOnce = args.includes('--once');
    const intervalArg = args.find((a) => a.startsWith('--interval='));
    const interval = intervalArg ? Number(intervalArg.split('=')[1]) : INTERVAL_MS;

    const apps = loadConfig();
    const state = loadState();

    log('👁️', `Watching ${apps.length} SubApps every ${interval / 1000}s (fail threshold: ${FAILURE_THRESHOLD})`);
    if (!DISCORD_WEBHOOK_URL && !TELEGRAM_BOT_TOKEN) {
        log('ℹ️', 'No alert channel configured (WATCHDOG_DISCORD_WEBHOOK_URL / WATCHDOG_TELEGRAM_BOT_TOKEN) — logging only.');
    }

    const snapshot = await runCycle(apps, state);

    if (isOnce) {
        process.exit(snapshot.summary.down > 0 ? 1 : 0);
    }

    setInterval(() => {
        runCycle(apps, state).catch((err) => log('❌', `Cycle failed: ${err.message}`));
    }, interval);
}

main().catch((err) => {
    console.error('[watchdog] Fatal error:', err);
    process.exit(1);
});
