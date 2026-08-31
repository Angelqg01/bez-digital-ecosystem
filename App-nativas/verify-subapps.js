/**
 * verify-subapps.js – Auditoría arquitectural completa del ecosistema BeZhas.
 * Ejecutar desde: D:\BeZhas-Blockchain\App-nativas\
 * Comando: node verify-subapps.js
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠️  WARN\x1b[0m';
const OK   = '\x1b[32m✅\x1b[0m';
const KO   = '\x1b[31m❌\x1b[0m';

// ── Definición de sub-apps ──────────────────────────────────────────────────
const SUBAPPS = [
  { name: 'BeZhas Wallet',        folder: 'bez-wallet',            srcDir: 'src',           port: 3010, ssoFolder: 'src', sector: 'wallet'   },
  { name: 'Gas Tank Manager',     folder: 'gas-tank-manager',      srcDir: 'src',           port: 3011, ssoFolder: 'src', sector: 'gas'      },
  { name: 'Edge Node Manager',    folder: 'edge-node-manager',     srcDir: 'src',           port: 3012, ssoFolder: 'src', sector: 'edge'     },
  { name: 'Vision Scan',          folder: 'bez-vision-scan',       srcDir: 'frontend/src',  port: 3013, ssoFolder: 'frontend/src', sector: 'vision'  },
  { name: 'BZ Capital (DeFi)',    folder: 'BZ Capital',            srcDir: 'frontend',      port: 3014, ssoFolder: 'frontend', sector: 'capital' },
  { name: 'BZ Prestige (Retail)', folder: 'BZ Prestige',           srcDir: 'src',           port: 3015, ssoFolder: 'src', sector: 'prestige' },
  { name: 'BZ CargoLink',         folder: 'BZ CargoLink',          srcDir: 'src',           port: 3016, ssoFolder: 'src', sector: 'cargo'    },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function exists(p) { return fs.existsSync(p); }

function searchInDir(dir, patterns) {
  if (!exists(dir)) return false;
  const files = fs.readdirSync(dir, { recursive: true });
  for (const file of files) {
    const full = path.join(dir, file);
    if (!fs.statSync(full).isFile()) continue;
    if (!['.js','.jsx','.ts','.tsx'].includes(path.extname(file))) continue;
    try {
      const content = fs.readFileSync(full, 'utf8');
      if (patterns.every(p => content.includes(p))) return true;
    } catch {}
  }
  return false;
}

function checkPort(pkgPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const devScript = pkg?.scripts?.dev || '';
    // Match: --port 3013 | -p 3013 | vite --port 3013 | next dev -p 3013
    const match = devScript.match(/(?:--port|-p)\s+(\d{4})/);
    if (match) return match[1];
    // Fallback: any 4-digit number
    const fallback = devScript.match(/\b(\d{4})\b/);
    return fallback ? fallback[1] : null;
  } catch { return null; }
}

// ── Auditoría ────────────────────────────────────────────────────────────────
let totalPass = 0, totalFail = 0, totalWarn = 0;
const results = [];

console.log('\n\x1b[36m════════════════════════════════════════════════════════\x1b[0m');
console.log('\x1b[36m  AUDITORÍA ARQUITECTURAL COMPLETA – BEZHAS ECOSYSTEM\x1b[0m');
console.log('\x1b[36m════════════════════════════════════════════════════════\x1b[0m\n');

for (const app of SUBAPPS) {
  const appPath    = path.join(ROOT, app.folder);
  const pkgPath    = path.join(appPath, 'package.json');
  const altPkgPath = path.join(appPath, 'frontend', 'package.json');
  const srcPath    = path.join(appPath, app.srcDir);
  const ssoPath    = path.join(appPath, app.ssoFolder);
  const compPath1  = path.join(appPath, 'src', 'components');
  const compPath2  = path.join(appPath, 'frontend', 'src', 'components');
  const readmePath = path.join(appPath, 'README.md');

  const checks = {};

  // 1. Directorio existe
  checks.dir = exists(appPath);

  // 2. package.json
  checks.pkg = exists(pkgPath) || exists(altPkgPath);

  // 3. Directorio fuente
  checks.src = exists(srcPath);

  // 4. SSO / JWT
  checks.sso = searchInDir(ssoPath, ['token']) &&
               (searchInDir(ssoPath, ['localStorage']) ||
                searchInDir(ssoPath, ['jwt']) ||
                searchInDir(ssoPath, ['URLSearchParams']) ||
                searchInDir(ssoPath, ['bezhas-jwt']));

  // 5. EcosystemBar
  checks.ecobar = exists(path.join(compPath1, 'EcosystemBar.jsx')) ||
                  exists(path.join(compPath2, 'EcosystemBar.jsx'));

  // 6. DevHubPanel
  checks.devhub = exists(path.join(compPath1, 'DevHubPanel.jsx')) ||
                  exists(path.join(compPath2, 'DevHubPanel.jsx'));

  // 7. README
  checks.readme = exists(readmePath);

  // 8. Puerto configurado
  let detectedPort = checkPort(pkgPath);
  if (!detectedPort && exists(altPkgPath)) {
    detectedPort = checkPort(altPkgPath);
  }
  checks.port = detectedPort ? `${detectedPort}` : '???';
  checks.portOk = detectedPort == app.port;

  // Resultado global
  const criticals = [checks.dir, checks.pkg, checks.src, checks.sso];
  const extras    = [checks.ecobar, checks.devhub, checks.readme, checks.portOk];
  const allCritical = criticals.every(Boolean);
  const allExtras   = extras.every(Boolean);

  let status;
  if (allCritical && allExtras) { status = 'PASS'; totalPass++; }
  else if (allCritical)         { status = 'WARN'; totalWarn++; }
  else                          { status = 'FAIL'; totalFail++; }

  results.push({ app: app.name, port: app.port, status, checks, detectedPort });

  const statusLabel = status === 'PASS' ? PASS : (status === 'WARN' ? WARN : FAIL);
  console.log(`▶ [${app.name}] :${app.port}  →  ${statusLabel}`);
  console.log(`   DIR       : ${checks.dir    ? OK : KO}  |  package.json : ${checks.pkg  ? OK : KO}`);
  console.log(`   src/      : ${checks.src    ? OK : KO}  |  SSO/JWT      : ${checks.sso  ? OK : KO}`);
  console.log(`   EcoBar    : ${checks.ecobar ? OK : KO}  |  DevHubPanel  : ${checks.devhub ? OK : KO}`);
  console.log(`   README    : ${checks.readme ? OK : KO}  |  Puerto       : ${checks.portOk ? OK : KO} (detectado: ${checks.port || '?'}, esperado: ${app.port})`);
  console.log('');
}

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log('\x1b[36m════════════════════════════════════════════════════════\x1b[0m');
console.log(`\x1b[32m  PASS: ${totalPass}\x1b[0m  |  \x1b[33mWARN: ${totalWarn}\x1b[0m  |  \x1b[31mFAIL: ${totalFail}\x1b[0m`);
console.log('\x1b[36m════════════════════════════════════════════════════════\x1b[0m\n');

// Acciones recomendadas
if (totalFail > 0 || totalWarn > 0) {
  console.log('\x1b[33m📋 ACCIONES RECOMENDADAS:\x1b[0m');
  for (const r of results) {
    if (r.status === 'PASS') continue;
    const c = r.checks;
    if (!c.sso)    console.log(`   → [${r.app}] Implementar lectura del JWT del Hub (SSO).`);
    if (!c.ecobar) console.log(`   → [${r.app}] Copiar EcosystemBar.jsx a src/components/.`);
    if (!c.devhub) console.log(`   → [${r.app}] Copiar DevHubPanel.jsx a src/components/.`);
    if (!c.readme) console.log(`   → [${r.app}] Crear README.md con descripción del módulo.`);
    if (!c.portOk) console.log(`   → [${r.app}] Corregir puerto en package.json (esperado: ${r.port}, detectado: ${r.detectedPort}).`);
  }
  console.log('');
}

if (totalFail === 0 && totalWarn === 0) {
  console.log('\x1b[32m🚀 ECOSISTEMA 100% VALIDADO. Todas las apps están listas para staging.\x1b[0m\n');
}
