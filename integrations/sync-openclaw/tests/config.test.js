/**
 * tests/config.test.js
 * Tests básicos — sin dependencias externas (Node built-ins únicamente)
 */
'use strict';

const assert = require('assert');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

// Redirigir el HOME para no tocar el real durante tests
const TEST_HOME = path.join(os.tmpdir(), `bezhas-test-${Date.now()}`);
process.env.HOME    = TEST_HOME;
process.env.USERPROFILE = TEST_HOME;   // Windows

// Limpiar módulos cacheados para que lean el nuevo HOME
Object.keys(require.cache).forEach(k => delete require.cache[k]);

const { ConfigManager } = require('../lib/ConfigManager');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${'\x1b[32m'}✓${'\x1b[0m'} ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ${'\x1b[31m'}✗${'\x1b[0m'} ${name}`);
    console.log(`    ${'\x1b[2m'}${err.message}${'\x1b[0m'}`);
    failed++;
  }
}

(async () => {
  console.log('\n\x1b[36m── ConfigManager Tests ──────────────────────────\x1b[0m\n');

  await test('Carga defaults cuando no hay archivo', async () => {
    const mgr = new ConfigManager();
    const cfg = await mgr.load();
    assert.ok(cfg.apiUrl, 'apiUrl debe existir');
    assert.ok(cfg.skills, 'skills debe existir');
  });

  await test('ENV vars sobreescriben defaults', async () => {
    process.env.OPENCLAW_API_URL = 'http://test-env:9999';
    const mgr = new ConfigManager();
    const cfg = await mgr.load();
    assert.strictEqual(cfg.apiUrl, 'http://test-env:9999');
    delete process.env.OPENCLAW_API_URL;
  });

  await test('set() actualiza valor en memoria', async () => {
    const mgr = new ConfigManager();
    await mgr.load();
    mgr.set('apiUrl', 'http://updated:1234', false);
    assert.strictEqual(mgr.get('apiUrl'), 'http://updated:1234');
  });

  await test('get() con keyPath anidado', async () => {
    const mgr = new ConfigManager();
    await mgr.load();
    const val = mgr.get('skills.entries.bezhas-growth.enabled');
    assert.strictEqual(val, true);
  });

  await test('get() devuelve fallback si no existe', async () => {
    const mgr = new ConfigManager();
    await mgr.load();
    const val = mgr.get('key.inexistente.profunda', 'DEFAULT');
    assert.strictEqual(val, 'DEFAULT');
  });

  await test('getSafe() enmascara adminToken', async () => {
    const mgr = new ConfigManager();
    await mgr.load();
    mgr.set('adminToken', 'eyJsecrettoken12345678', false);
    const safe = mgr.getSafe();
    assert.ok(!safe.adminToken.includes('secrettoken'), 'Token debe estar enmascarado');
    assert.ok(safe.adminToken.includes('REDACTED'), 'Debe incluir [REDACTED]');
  });

  await test('deepMerge no borra claves cuando value es vacío', async () => {
    const mgr = new ConfigManager();
    const result = mgr._deepMerge(
      { a: 'original', b: { c: 1 } },
      { a: '',         b: { d: 2 } },   // a vacío no debe sobreescribir
    );
    assert.strictEqual(result.a, 'original');
    assert.strictEqual(result.b.c, 1);
    assert.strictEqual(result.b.d, 2);
  });

  await test('normalizeSkillUrls propaga apiUrl a skills sin url propia', async () => {
    const mgr = new ConfigManager();
    const cfg = await mgr.load();
    mgr.set('apiUrl', 'http://central:5000', false);
    mgr._normalizeSkillUrls(mgr.getAll());
    // todos los skills sin apiUrl propio deben heredar el central
    for (const [, skill] of Object.entries(cfg.skills.entries)) {
      if (skill.config) {
        assert.ok(skill.config.apiUrl, `Skill debe tener apiUrl`);
      }
    }
  });

  await test('save() y reload() son consistentes', async () => {
    const mgr = new ConfigManager();
    await mgr.load();
    mgr.set('apiUrl', 'http://persisted:7777', false);
    await mgr.save();

    const mgr2 = new ConfigManager();
    const reloaded = await mgr2.load();
    assert.strictEqual(reloaded.apiUrl, 'http://persisted:7777');
  });

  // Limpiar
  fs.rmSync(TEST_HOME, { recursive: true, force: true });

  console.log(`\n  ${passed} pasados · ${failed} fallidos\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
