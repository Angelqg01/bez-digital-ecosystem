#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.venv',
  'venv',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'logs',
  'geth-data',
  'pg-data',
  'smart-contracts.worktrees',
  'lib',
  'tmp_babel_install',
]);

const report = [];
let failures = 0;

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  report.push(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` - ${detail}` : ''}`);
}

function walk(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), predicate, results);
    } else if (entry.isFile()) {
      const filePath = path.join(dir, entry.name);
      if (!predicate || predicate(filePath)) results.push(filePath);
    }
  }
  return results;
}

function commandAvailable(cmd, args = ['--version']) {
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  return result.status === 0;
}

function runNodeScript(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 1024 * 1024 * 20,
  });
}

report.push('BeZhas Production Readiness Audit');
report.push(`Root: ${ROOT}`);
report.push('');

// 1. Secrets
const secretScan = runNodeScript(path.join(ROOT, 'scripts/security/scan-secrets.cjs'), ['--json']);
let secretFindings = [];
try {
  secretFindings = JSON.parse(secretScan.stdout || '{"findings":[]}').findings || [];
} catch {
  secretFindings = [{ file: 'unknown', line: 0, type: 'scanner-output-invalid' }];
}
check('No high-risk secrets in repo scan', secretScan.status === 0 && secretFindings.length === 0, `${secretFindings.length} finding(s)`);
for (const finding of secretFindings.slice(0, 10)) {
  report.push(`       ${finding.file}:${finding.line} ${finding.type}`);
}
if (secretFindings.length > 10) report.push(`       ...and ${secretFindings.length - 10} more`);

// 2. Toolchain
check('pnpm available', commandAvailable('pnpm'), 'required by root .npmrc');
check('node available', commandAvailable('node'));
check('forge available for smart-contract tests', commandAvailable('forge'), 'required for smart-contracts');

// 3. Package manager consistency
const lockFiles = walk(ROOT, filePath => ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(path.basename(filePath)));
const nonPnpmLocks = lockFiles.filter(filePath => ['package-lock.json', 'yarn.lock'].includes(path.basename(filePath)));
check('No npm/yarn lockfiles outside ignored dirs', nonPnpmLocks.length === 0, `${nonPnpmLocks.length} mixed lockfile(s)`);
for (const filePath of nonPnpmLocks.slice(0, 20)) report.push(`       ${rel(filePath)}`);

// 4. Canonical BEZ address consistency between README and env example.
const readme = fs.existsSync(path.join(ROOT, 'README.md')) ? fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8') : '';
const envExample = fs.existsSync(path.join(ROOT, '.env.example')) ? fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8') : '';
const envAddressMatch = envExample.match(/^BEZ_TOKEN_ADDRESS=(0x[a-fA-F0-9]{40})/m);
const envAddress = envAddressMatch ? envAddressMatch[1] : null;
const readmePolygon = readme.match(/\| BEZ Token \| Polygon \| `(0x[a-fA-F0-9]{40})` \|/);
const readmeBnb = readme.match(/\| BEZ Token \| BNB Chain \| `(0x[a-fA-F0-9]{40})` \|/);
const envClaimsBsc = /BSC Mainnet|BEZ-Coin v1 on BSC Mainnet/i.test(envExample);
const envMatchesBnb = !!envAddress && !!readmeBnb && envAddress.toLowerCase() === readmeBnb[1].toLowerCase();
const envMatchesPolygon = !!envAddress && !!readmePolygon && envAddress.toLowerCase() === readmePolygon[1].toLowerCase();
check('BEZ token address is documented consistently', envMatchesBnb && !envMatchesPolygon && envClaimsBsc, `env=${envAddress || 'missing'}`);

// 5. ABI/deployment readiness.
const foundryOut = path.join(ROOT, 'smart-contracts', 'out');
const abiDir = path.join(ROOT, 'smart-contracts', 'abi');
const hasOut = fs.existsSync(foundryOut) && fs.readdirSync(foundryOut).length > 0;
const abiCount = fs.existsSync(abiDir) ? fs.readdirSync(abiDir).filter(name => name.endsWith('.json') && name !== 'manifest.json').length : 0;
check('Foundry output exists', hasOut);
check('ABI export coverage exists', abiCount >= 80, `${abiCount} ABI file(s)`);

// 6. Production env examples for subapps: localhost fallbacks must be backed by production env files.
const subappsRoot = path.join(ROOT, "App-nativas");
const appPackageFiles = walk(subappsRoot, filePath => path.basename(filePath) === 'package.json');
const appDirs = [...new Set(appPackageFiles.map(filePath => path.dirname(filePath)))];
let missingProductionEnv = 0;
let localhostDefaults = 0;
function hasProductionEnvTemplate(dir) {
  let current = dir;
  while (current.startsWith(subappsRoot)) {
    const hasTemplate = ['.env.production', '.env.production.local', '.env.production.example', '.env.example']
      .some(name => fs.existsSync(path.join(current, name)));
    if (hasTemplate) return true;
    if (current === subappsRoot) break;
    current = path.dirname(current);
  }
  return false;
}
for (const dir of appDirs) {
  const sourceFiles = walk(dir, filePath => /\.(js|jsx|ts|tsx|mjs)$/.test(filePath));
  const hasLocalhost = sourceFiles.some(filePath => {
    try {
      return /localhost|127\.0\.0\.1/.test(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return false;
    }
  });
  if (!hasLocalhost) continue;
  localhostDefaults += 1;
  const hasProdEnv = hasProductionEnvTemplate(dir);
  if (!hasProdEnv) {
    missingProductionEnv += 1;
    report.push(`       ${rel(dir)} has localhost defaults and no production env template`);
  }
}
check('Subapps with localhost defaults have production env templates', missingProductionEnv === 0, `${missingProductionEnv}/${localhostDefaults} missing`);

// 7. Known generated credentials artifact.
const credentialsFile = path.join(ROOT, 'bezhas_subapp_credentials.txt');
const credentialsText = fs.existsSync(credentialsFile) ? fs.readFileSync(credentialsFile, 'utf8') : '';
const missingAbiMarkers = (credentialsText.match(/ABI de .* no encontrado/g) || []).length;
check('Generated subapp credentials have no missing ABI markers', missingAbiMarkers === 0, `${missingAbiMarkers} missing ABI marker(s)`);

report.push('');
report.push(`Result: ${failures === 0 ? 'READY' : 'NOT READY'} (${failures} failing check(s))`);
console.log(report.join('\n'));
process.exit(failures === 0 ? 0 : 1);
