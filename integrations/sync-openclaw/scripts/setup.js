#!/usr/bin/env node
/**
 * setup.js
 * Inicializa y valida la configuración unificada OpenClaw
 *
 * Uso:
 *   node scripts/setup.js                 # Configuración interactiva
 *   node scripts/setup.js --token <JWT>   # No-interactivo con token
 *   node scripts/setup.js --check         # Solo verificar estado
 *   node scripts/setup.js --reset         # Resetear a defaults
 */

'use strict';

const readline  = require('readline');
const os        = require('os');
const path      = require('path');
const fs        = require('fs');
const config    = require('../lib/ConfigManager');
const token     = require('../lib/TokenManager');
const skills    = require('../lib/SkillRegistry');
const client    = require('../lib/OpenClawClient');

const CYAN    = '\x1b[36m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const RESET   = '\x1b[0m';

const args = process.argv.slice(2);

// ─── Entry point ──────────────────────────────────────────────────────────────
(async () => {
  printBanner();

  if (args.includes('--check')) {
    await runCheck();
    return;
  }

  if (args.includes('--reset')) {
    await runReset();
    return;
  }

  const tokenArg = args[args.indexOf('--token') + 1];
  if (tokenArg) {
    await runSetupWithToken(tokenArg);
    return;
  }

  await runInteractiveSetup();
})();

// ─── Modos ─────────────────────────────────────────────────────────────────────

async function runInteractiveSetup() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  log('\n📋 Configuración unificada OpenClaw — BeZhas\n');

  // Cargar config existente como defaults
  let existing = {};
  try { existing = await config.load(); } catch { /* primera vez */ }

  const apiUrl = await ask(
    `${CYAN}API URL del backend BeZhas_Blockchain${RESET} ${DIM}[${existing.apiUrl || 'http://localhost:3001'}]${RESET}: `
  ) || existing.apiUrl || 'http://localhost:3001';

  const web3Url = await ask(
    `${CYAN}API URL BeZhas_web3${RESET} ${DIM}[${existing.platforms?.web3?.baseUrl || 'http://localhost:3002'}]${RESET}: `
  ) || existing.platforms?.web3?.baseUrl || 'http://localhost:3002';

  log(`\n${YELLOW}El adminToken es el JWT Manager compartido por ambas plataformas.${RESET}`);
  log(`${DIM}Puedes obtenerlo desde POST ${apiUrl}/auth/login o el panel de administración.${RESET}\n`);

  let adminToken = await ask(
    `${CYAN}adminToken (JWT Manager)${RESET} ${DIM}[Enter = mantener actual]${RESET}: `
  );
  if (!adminToken && existing.adminToken) {
    adminToken = existing.adminToken;
    log(`${DIM}Usando token existente.${RESET}`);
  }

  const sector = await ask(
    `${CYAN}Sector por defecto para bezhas-growth${RESET} ${DIM}[${existing.skills?.entries?.['bezhas-growth']?.config?.defaultSector || 'logistics'}]${RESET}: `
  ) || existing.skills?.entries?.['bezhas-growth']?.config?.defaultSector || 'logistics';

  rl.close();

  await applyConfig({ apiUrl, web3Url, adminToken, defaultSector: sector });
}

async function runSetupWithToken(adminToken) {
  log('\n⚡ Configuración no-interactiva con token proporcionado\n');

  const apiUrl  = process.env.OPENCLAW_API_URL  || 'http://localhost:3001';
  const web3Url = process.env.OPENCLAW_WEB3_URL || 'http://localhost:3002';
  const sector  = process.env.OPENCLAW_DEFAULT_SECTOR || 'logistics';

  await applyConfig({ apiUrl, web3Url, adminToken, defaultSector: sector });
}

async function runCheck() {
  log('\n🔍 Verificando estado de configuración OpenClaw...\n');

  let cfg;
  try {
    cfg = await config.load();
  } catch (err) {
    logError('No se pudo cargar la configuración: ' + err.message);
    process.exit(1);
  }

  // Config
  logSection('Configuración');
  logItem('apiUrl',         cfg.apiUrl);
  logItem('web3 baseUrl',   cfg.platforms?.web3?.baseUrl);
  logItem('adminToken',     cfg.adminToken ? `${cfg.adminToken.slice(0,12)}… [presente]` : '❌ No configurado');
  logItem('Skills activos', Object.keys(cfg.skills?.entries || {}).filter(k => cfg.skills.entries[k].enabled).join(', '));

  // Token
  logSection('Token JWT');
  const tokenStatus = token.getStatus();
  logItem('Presente',    tokenStatus.hasToken ? '✓' : '✗');
  logItem('Expira en',   tokenStatus.expiresIn || 'N/A');
  logItem('Necesita refresh', tokenStatus.needsRefresh ? '⚠ Sí' : '✓ No');

  // Conectividad
  logSection('Conectividad');
  const healthResult = await client.healthAll();

  for (const [platform, result] of Object.entries(healthResult)) {
    if (result.error) {
      logItem(`${platform}`, `✗ ${result.error}`, 'error');
    } else {
      logItem(`${platform}`, `✓ HTTP ${result.status}`, 'success');
    }
  }

  // Skills
  logSection('Skills');
  await skills.load();
  const enabledSkills = skills.getEnabled();
  if (enabledSkills.length === 0) {
    logItem('Estado', '⚠ Sin skills cargados');
  }
  for (const s of enabledSkills) {
    logItem(s.name, `v${s.version || '?'} — ${s._stub ? '⚠ stub (sin archivos)' : '✓ cargado'}`);
  }

  log('');
}

async function runReset() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ok = await new Promise(r => rl.question(
    `${RED}¿Resetear toda la configuración OpenClaw? (escribe "CONFIRMAR"): ${RESET}`,
    r,
  ));
  rl.close();

  if (ok.trim() !== 'CONFIRMAR') {
    log('Operación cancelada.');
    return;
  }

  const canonical = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  await fs.promises.unlink(canonical).catch(() => {});
  logSuccess('Configuración reseteada. Ejecuta setup.js de nuevo para configurar.');
}

// ─── Aplicar configuración ────────────────────────────────────────────────────

async function applyConfig({ apiUrl, web3Url, adminToken, defaultSector }) {
  logSection('Aplicando configuración');

  // Cargar y modificar config
  await config.load(true);

  config.set('apiUrl',                                             apiUrl,  false);
  config.set('platforms.blockchain.baseUrl',                       apiUrl,  false);
  config.set('platforms.web3.baseUrl',                             web3Url, false);
  if (adminToken) config.set('adminToken',                         adminToken, false);
  config.set('skills.entries.bezhas-growth.config.apiUrl',         apiUrl,  false);
  config.set('skills.entries.bezhas-growth.config.defaultSector',  defaultSector, false);

  // Normalizar todos los skills al mismo apiUrl
  const entries = config.get('skills.entries', {});
  for (const name of Object.keys(entries)) {
    config.set(`skills.entries.${name}.config.apiUrl`, apiUrl, false);
  }

  // Persistir
  await config.save();
  logSuccess('Configuración guardada en ~/.openclaw/openclaw.json');

  // Verificar token
  if (adminToken) {
    log(`\n${YELLOW}Verificando token...${RESET}`);
    const status = await token.verifyToken(adminToken);
    if (status.valid) {
      logSuccess(`Token válido — expira en ${Math.round((status.expiresIn || 0) / 1000)}s`);
      if (status.roles?.length) logItem('Roles', status.roles.join(', '));
    } else {
      logWarn(`Token no pudo verificarse: ${status.reason} — puede ser que el backend no esté corriendo`);
    }
  }

  // Cargar y sincronizar skills
  log(`\n${YELLOW}Sincronizando skills...${RESET}`);
  try {
    await skills.load();
    const enabled = skills.getEnabled();
    logSuccess(`${enabled.length} skills sincronizados`);
    enabled.forEach(s => logItem(s.name, s._stub ? '⚠ stub' : '✓'));
  } catch (err) {
    logWarn('Skills sync: ' + err.message);
  }

  // Test de conectividad
  log(`\n${YELLOW}Probando conectividad...${RESET}`);
  const health = await client.healthAll();
  for (const [platform, result] of Object.entries(health)) {
    if (result.error) {
      logWarn(`${platform}: ${result.error} (¿backend corriendo?)`);
    } else {
      logSuccess(`${platform}: HTTP ${result.status}`);
    }
  }

  logSection('Resumen');
  log(`${GREEN}${BOLD}✓ OpenClaw configurado con cuenta Manager unificada${RESET}`);
  log(`${DIM}  Ambas plataformas (blockchain + web3) apuntan a: ${apiUrl}${RESET}`);
  log(`${DIM}  Config: ~/.openclaw/openclaw.json${RESET}`);
  log(`\n${CYAN}Próximos pasos:${RESET}`);
  log(`  1. Importa ConfigManager en tus apps: require('./lib/ConfigManager')`);
  log(`  2. Arranca el sync daemon: node sync/sync-daemon.js --watch`);
  log(`  3. Comprueba el estado: node scripts/setup.js --check\n`);
}

// ─── Helpers de consola ───────────────────────────────────────────────────────

function printBanner() {
  console.log(`
${CYAN}${BOLD}  ⬡ BeZhas OpenClaw — Configuración Unificada v2.0${RESET}
${DIM}  Una sola cuenta Manager · BNB Chain + Polygon${RESET}
`);
}

function log(msg)    { console.log(msg); }
function logSection(title) {
  console.log(`\n${BOLD}${CYAN}── ${title} ${'─'.repeat(40 - title.length)}${RESET}`);
}
function logItem(key, val, type) {
  const color = type === 'error' ? RED : type === 'success' ? GREEN : '';
  console.log(`  ${DIM}${key.padEnd(20)}${RESET} ${color}${val}${RESET}`);
}
function logSuccess(msg) { console.log(`${GREEN}  ✓ ${msg}${RESET}`); }
function logWarn(msg)    { console.log(`${YELLOW}  ⚠ ${msg}${RESET}`); }
function logError(msg)   { console.log(`${RED}  ✗ ${msg}${RESET}`); }
