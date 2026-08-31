import fs from 'node:fs';
import path from 'node:path';

const workspace = process.cwd();

const apps = [
  { id: 'hub', dir: 'Bezhas-Hub', packageName: 'bezhas-hub', critical: true },
  { id: 'wallet', dir: 'bez-wallet', packageName: 'bez-wallet', critical: true, url: 'http://localhost:3010' },
  { id: 'gas', dir: 'gas-tank-manager', packageName: 'gas-tank-manager', critical: true, url: 'http://localhost:3011' },
  { id: 'nodes', dir: 'edge-node-manager', packageName: 'edge-node-manager', critical: true, url: 'http://localhost:3012' },
  { id: 'vision', dir: 'bez-vision-scan', packageName: 'bezhas-vision-scan-workspace', critical: true, url: 'http://localhost:3013' },
  { id: 'capital', dir: 'BZ Capital', packagePath: 'frontend/package.json', packageName: 'bezhas-defi-frontend', critical: true, url: 'http://localhost:3014' },
  { id: 'pay', dir: 'bezhas-pay-manager', packageName: 'bezhas-pay-manager', critical: false, url: 'http://localhost:3019' },
  { id: 'cargo', dir: 'BZ CargoLink', packageName: 'bz-cargolink', critical: false, url: 'http://localhost:3016' },
  { id: 'prestige', dir: 'BZ Prestige', packageName: 'bz-prestige', critical: false, url: 'http://localhost:3015' },
  { id: 'purescan', dir: 'BZ PureScan', packageName: 'bz-purescan', critical: false, url: 'http://localhost:3018' },
];

const sharedFiles = [
  'packages/api-gateway/src/server.js',
  'packages/platform-sdk/package.json',
  'hub-control-plane-migration/01-inventory/OWNERSHIP_MATRIX.yaml',
  'hub-control-plane-migration/02-architecture/TARGET_CONNECTIONS.yaml',
  'hub-control-plane-migration/03-integration/INTEGRATION_CONTRACT.json',
];

let failures = 0;
let warnings = 0;

function log(status, message) {
  console.log(`[${status}] ${message}`);
}

function fail(message) {
  failures += 1;
  log('FAIL', message);
}

function warn(message) {
  warnings += 1;
  log('WARN', message);
}

function pass(message) {
  log('PASS', message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

async function checkHttp(url, label) {
  try {
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(2500) });
    if (response.ok || response.status < 500) pass(`${label} reachable (${response.status})`);
    else warn(`${label} responded with ${response.status}`);
  } catch (error) {
    warn(`${label} not reachable: ${error.message}`);
  }
}

async function checkRpc(rpcUrl) {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    if (body.result) pass(`blockchain RPC reachable; eth_chainId=${body.result}`);
    else fail(`blockchain RPC response missing result: ${JSON.stringify(body)}`);
  } catch (error) {
    fail(`blockchain RPC check failed: ${error.message}`);
  }
}

console.log('==============================================');
console.log('BeZhas Ecosystem - Control Plane Smoke Test');
console.log('==============================================');

for (const rel of sharedFiles) {
  const full = path.join(workspace, rel);
  if (fs.existsSync(full)) pass(`shared file ${rel}`);
  else fail(`missing shared file ${rel}`);
}

for (const app of apps) {
  const dir = path.join(workspace, app.dir);
  const pkgFile = path.join(dir, app.packagePath || 'package.json');
  if (!fs.existsSync(dir)) {
    (app.critical ? fail : warn)(`missing app dir ${app.dir}`);
    continue;
  }
  pass(`app dir ${app.dir}`);
  if (!fs.existsSync(pkgFile)) {
    (app.critical ? fail : warn)(`missing ${app.packagePath || 'package.json'} in ${app.dir}`);
    continue;
  }
  const pkg = readJson(pkgFile);
  if (pkg.name !== app.packageName) warn(`${app.dir} package name is ${pkg.name}; expected ${app.packageName}`);
  else pass(`${app.dir} package identity`);
  if (pkg.scripts?.dev) pass(`${app.dir} dev script`);
  else warn(`${app.dir} missing dev script`);
  if (pkg.scripts?.build) pass(`${app.dir} build script`);
  else warn(`${app.dir} missing build script`);
}

const env = { ...parseEnv(path.join(workspace, '.env.shared')), ...process.env };
const rpcUrl = env.POLYGON_RPC_URL || env.RPC_URL || env.NEXT_PUBLIC_RPC_URL || env.AMOY_RPC_URL;
if (rpcUrl) await checkRpc(rpcUrl);
else warn('no blockchain RPC env found; set POLYGON_RPC_URL, RPC_URL, NEXT_PUBLIC_RPC_URL or AMOY_RPC_URL to test live chain connectivity');

if (process.env.RUN_LIVE_CONNECTIONS === '1') {
  await checkHttp('http://localhost:3001/health', 'Hub/API gateway health');
  for (const app of apps.filter((item) => item.url)) {
    await checkHttp(app.url, `${app.id} app`);
  }
} else {
  warn('live app URL checks skipped; run with RUN_LIVE_CONNECTIONS=1 when dev servers are running');
}

console.log('----------------------------------------------');
console.log(`Failures: ${failures}`);
console.log(`Warnings: ${warnings}`);

if (failures > 0) process.exit(1);
