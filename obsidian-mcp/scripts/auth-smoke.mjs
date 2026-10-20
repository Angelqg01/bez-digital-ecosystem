// Smoke test de autenticación: arranca el Brain con BRAIN_API_KEY y comprueba
// que sólo /health queda abierto. También que en producción no arranca sin clave.
// Uso: node scripts/auth-smoke.mjs
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PORT = 41708;
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = crypto.randomBytes(24).toString('hex');
const cwd = path.resolve(import.meta.dirname, '..');
const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'bezhas-vault-auth-'));

const baseEnv = {
  ...process.env,
  MCP_PORT: String(PORT),
  OBSIDIAN_VAULT_PATH: vault,
  MCP_HOST: '127.0.0.1',
  OLLAMA_HOST: 'http://127.0.0.1:1',
  BRAIN_AUTOPILOT: '0',
};
delete baseEnv.BRAIN_API_KEY;

// 1. Producción sin clave: el proceso debe salir con error, sin escuchar.
{
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd, env: { ...baseEnv, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (c) => { err += c; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.notEqual(code, 0, 'en producción sin BRAIN_API_KEY no debe arrancar');
  assert.match(err, /BRAIN_API_KEY/);
}

// 2. Con clave.
const server = spawn(process.execPath, ['src/index.js'], {
  cwd, env: { ...baseEnv, NODE_ENV: 'production', BRAIN_API_KEY: KEY, ALLOW_TEST_SHUTDOWN: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (c) => { log += c; });
server.stderr.on('data', (c) => { log += c; });

async function waitForHealth(retries = 50) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return res;
    } catch { /* aún no */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`El Brain no arrancó.\n${log}`);
}

const post = (route, body, headers = {}) => fetch(`${BASE}${route}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

let failed = false;
try {
  await waitForHealth();

  const event = { source: 'test', target: 'API-Backend', fn: 'GET /x' };
  assert.equal((await post('/telemetry/usage', event)).status, 401, 'telemetría sin clave');
  assert.equal((await post('/telemetry/usage', event, { 'x-brain-key': 'mala' })).status, 401, 'clave incorrecta');
  assert.equal((await post('/tools/get_tags', {})).status, 401, 'herramientas sin clave');
  assert.equal((await fetch(`${BASE}/telemetry/summary`)).status, 401, 'resumen sin clave');
  assert.equal((await fetch(`${BASE}/tools`)).status, 401, 'catálogo sin clave');
  assert.equal((await fetch(`${BASE}/`)).status, 401, 'UI sin clave');

  assert.equal((await post('/telemetry/usage', event, { 'x-brain-key': KEY })).status, 200, 'x-brain-key válida');
  const summary = await fetch(`${BASE}/telemetry/summary`, { headers: { authorization: `Bearer ${KEY}` } });
  assert.equal(summary.status, 200, 'Bearer válido');
  assert.equal((await summary.json()).totals.calls, 1);

  assert.equal((await fetch(`${BASE}/`, { headers: { 'x-brain-key': KEY } })).status, 404, 'UI integrada desactivada con clave');

  const cors = await fetch(`${BASE}/health`, { headers: { origin: 'https://evil.example' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), null, 'sin CORS abierto');

  console.log('✅ auth-smoke: OK');
} catch (error) {
  failed = true;
  console.error('❌ auth-smoke:', error.message);
} finally {
  await post('/shutdown', {}, { 'x-brain-key': KEY }).catch(() => server.kill());
  await fs.rm(vault, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
