/**
 * index.js
 * Punto de entrada de la librería OpenClaw Unificada
 *
 * Uso en BeZhas_Blockchain:
 *   const openclaw = require('@bezhas/openclaw-unified');
 *   await openclaw.init();
 *
 * Uso en BeZhas_web3:
 *   const openclaw = require('@bezhas/openclaw-unified');
 *   await openclaw.init();
 *
 * Ambas plataformas comparten la misma instancia de configuración
 * a través del archivo canónico ~/.openclaw/openclaw.json
 */

'use strict';

const config = require('./lib/ConfigManager');
const token = require('./lib/TokenManager');
const skills = require('./lib/SkillRegistry');
const client = require('./lib/OpenClawClient');
const auth = require('./middleware/openclawAuth');

let _initialized = false;

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Inicializa OpenClaw: carga config, valida token y sincroniza skills.
 * Seguro llamar múltiples veces — idempotente.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.watchConfig]  - Activar hot-reload del archivo de config
 * @param {boolean} [opts.watchSkills]  - Activar hot-reload de la carpeta de skills
 * @param {boolean} [opts.skipSkills]   - No cargar skills (útil en modo lightweight)
 * @param {boolean} [opts.skipHealth]   - No hacer health check inicial
 */
async function init(opts = {}) {
  if (_initialized) return getStatus();

  // 1. Cargar configuración
  await config.load();

  // 2. Activar watch si se pide
  if (opts.watchConfig) {
    config.watchFile((event, data) => {
      if (event === 'reload') {
        console.log('[OpenClaw] ♻ Config recargada automáticamente');
      }
    });
  }

  // 3. Validar/cargar token
  try {
    await token.getToken();
  } catch (err) {
    console.warn(`[OpenClaw] ⚠ Token no disponible: ${err.message}`);
    console.warn('[OpenClaw] Ejecuta: node scripts/setup.js --token <JWT>');
  }

  // 4. Cargar skills
  if (!opts.skipSkills) {
    await skills.load();
    if (opts.watchSkills) skills.watchSkills();
  }

  // 5. Health check inicial (no-bloqueante)
  if (!opts.skipHealth) {
    client.healthAll().then(result => {
      for (const [platform, res] of Object.entries(result)) {
        if (res.error) {
          console.warn(`[OpenClaw] ⚠ ${platform} no responde: ${res.error}`);
        } else {
          console.log(`[OpenClaw] ✓ ${platform} OK (HTTP ${res.status})`);
        }
      }
    }).catch(() => { });
  }

  _initialized = true;
  return getStatus();
}

/** Devuelve el estado actual del sistema OpenClaw */
function getStatus() {
  return {
    initialized: _initialized,
    config: config.getSafe(),
    token: token.getStatus(),
    skills: {
      total: Object.keys(skills.getAll()).length,
      enabled: skills.getEnabled().length,
      list: skills.getEnabled().map(s => s.name),
    },
  };
}

/**
 * Genera el bloque `skills` listo para inyectar en openclaw.json
 * con el apiUrl unificado y el estado de cada skill.
 */
function generateSkillsConfig() {
  return skills.toOpenClawConfig();
}

/**
 * Invoca un skill por nombre en la plataforma especificada
 * @param {string}  skillName
 * @param {Object}  payload
 * @param {string}  [platform] - 'blockchain' | 'web3' | 'both'
 */
async function invokeSkill(skillName, payload, platform = 'blockchain') {
  if (!skills.has(skillName)) throw new Error(`Skill no registrado: ${skillName}`);

  const skill = skills.get(skillName);
  if (!skill.enabled) throw new Error(`Skill deshabilitado: ${skillName}`);

  if (platform === 'both') {
    return client.both(c => c.invokeSkill(skillName, payload));
  }

  return client[platform].invokeSkill(skillName, payload);
}

/** Cierra watchers y limpia recursos */
function shutdown() {
  config.stopWatch();
  skills.stopWatch();
  _initialized = false;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

const discovery = require('./lib/PlatformDiscovery');

module.exports = {
  // Lifecycle
  init,
  shutdown,
  getStatus,

  // Platform Discovery (NEW in v2.1)
  discover: discovery.discover,
  discoverSummary: discovery.summary,

  // Módulos individuales (para uso avanzado)
  config,
  token,
  skills,
  client,

  // Express middleware
  middleware: auth,

  // Helpers
  generateSkillsConfig,
  invokeSkill,

  // Clientes directos
  blockchainClient: client.blockchain,
  web3Client: client.web3,
};
