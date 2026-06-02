#!/usr/bin/env node
/**
 * BeZhas Universal Sync Daemon v2.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Propaga cambios desde BeZhas Blockchain (SOURCE OF TRUTH) hacia TODOS
 * los proyectos sincronizados del ecosistema:
 *   - bezhas-web3 (frontend + backend)
 *   - [futuro] bezhas-mobile
 *   - [futuro] bezhas-subapps
 *
 * Compatible con Foundry (out/**\/Contract.sol/Contract.json)
 * Compatible con Hardhat (artifacts/contracts/**\/Contract.json)
 *
 * Uso:
 *   node sync-daemon.js --watch      # Modo desarrollo (watch)
 *   node sync-daemon.js --once       # Sincronización única
 *   node sync-daemon.js --force      # Forzar resync completo
 *   node sync-daemon.js --dry-run    # Validar sin copiar
 *   node sync-daemon.js --status     # Ver estado actual
 *   node sync-daemon.js --setup      # Crear carpetas de destino
 */

const fs       = require('fs-extra');
const path     = require('path');
const crypto   = require('crypto');
const chokidar = require('chokidar');
const glob     = require('glob');
const chalk    = require('chalk');

// ═══════════════════════════════════════════════════════════════════════════════
// RUTAS — Ajustadas a la estructura real del ecosistema BeZhas
// ═══════════════════════════════════════════════════════════════════════════════

// Raíz del ecosistema
// Este archivo vive en: BeZhas Blockchain/Sincronizar forma de pago/sync-daemon.js
// ROOT → D:\Documentos D\Documentos Yoe\BeZhas\
const ROOT = path.resolve(__dirname, '../..');

const BLOCKCHAIN_ROOT = path.join(ROOT, 'BeZhas Blockchain');
const WEB3_ROOT       = path.join(ROOT, 'BeZhas Web', 'bezhas-web3');

const CONFIG = {
  blockchain: {
    root:        BLOCKCHAIN_ROOT,
    // Foundry: out/ContractName.sol/ContractName.json
    foundryOut:  path.join(BLOCKCHAIN_ROOT, 'smart-contracts', 'out'),
    // Hardhat (por si se añade en el futuro)
    hardhatArt:  path.join(BLOCKCHAIN_ROOT, 'smart-contracts', 'artifacts', 'contracts'),
    deployments: path.join(BLOCKCHAIN_ROOT, 'smart-contracts', 'deployments'),
    contracts:   path.join(BLOCKCHAIN_ROOT, 'smart-contracts', 'src'),
    sdk:         path.join(BLOCKCHAIN_ROOT, 'sdk'),
    sdkArtifacts:path.join(BLOCKCHAIN_ROOT, 'sdk', 'artifacts'),
  },

  // Múltiples targets (web3 frontend + backend)
  targets: [
    {
      id:        'web3-frontend',
      name:      'BeZhas Web3 (Frontend)',
      root:      path.join(WEB3_ROOT, 'frontend'),
      abis:      path.join(WEB3_ROOT, 'frontend', 'src', 'abis'),
      contracts: path.join(WEB3_ROOT, 'frontend', 'src', 'contracts'),
      hooks:     path.join(WEB3_ROOT, 'frontend', 'src', 'hooks'),
      types:     path.join(WEB3_ROOT, 'frontend', 'src', 'types', 'contracts'),
    },
    {
      id:        'web3-backend',
      name:      'BeZhas Web3 (Backend)',
      root:      path.join(WEB3_ROOT, 'backend'),
      abis:      path.join(WEB3_ROOT, 'backend', 'abis'),
      contracts: path.join(WEB3_ROOT, 'backend', 'contracts'),
      hooks:     null,  // backend no tiene hooks React
      types:     null,
    },
    // FUTURO: Añadir targets aquí
    // {
    //   id:        'mobile',
    //   name:      'BeZhas Mobile',
    //   root:      path.join(ROOT, 'BeZhas Mobile'),
    //   abis:      path.join(ROOT, 'BeZhas Mobile', 'src', 'abis'),
    //   contracts: path.join(ROOT, 'BeZhas Mobile', 'src', 'contracts'),
    //   hooks:     path.join(ROOT, 'BeZhas Mobile', 'src', 'hooks'),
    //   types:     null,
    // },
  ],

  lockFile: path.join(BLOCKCHAIN_ROOT, 'Sincronizar forma de pago', '.sync.lock'),
  logFile:  path.join(BLOCKCHAIN_ROOT, 'Sincronizar forma de pago', 'sync.log'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRATOS REGISTRADOS (nombre Foundry → hook template)
// Actualizar esta lista cada vez que se añada un contrato nuevo
// ═══════════════════════════════════════════════════════════════════════════════
const REGISTERED_CONTRACTS = [
  // Core tokens
  { name: 'BEZCoinV2',              hookTemplate: 'useTokenBalance',   priority: 'CRITICAL' },
  // Core logic
  { name: 'BeZhasPayment',          hookTemplate: 'useBeZhasPayment',  priority: 'CRITICAL' },
  { name: 'StakingPool',            hookTemplate: 'useStaking',        priority: 'HIGH'     },
  { name: 'LiquidityFarming',       hookTemplate: 'useFarming',        priority: 'HIGH'     },
  { name: 'GovernanceSystem',       hookTemplate: 'useDAO',            priority: 'HIGH'     },
  { name: 'BeZhasBridgeL2',         hookTemplate: 'useBridge',         priority: 'HIGH'     },
  { name: 'QualityEscrow',          hookTemplate: 'useEscrow',         priority: 'MEDIUM'   },
  { name: 'BeZhasLogisticsNFT',     hookTemplate: 'useLogisticsNFT',   priority: 'MEDIUM'   },
  { name: 'EdgeNodeRewards',        hookTemplate: 'useEdgeRewards',    priority: 'MEDIUM'   },
  { name: 'SequencerRotation',      hookTemplate: 'useSequencer',      priority: 'LOW'      },
  { name: 'ValidatorRegistry',      hookTemplate: 'useValidator',      priority: 'LOW'      },
  { name: 'SlashingManager',        hookTemplate: 'useSlashing',       priority: 'LOW'      },
  // Wallet system
  { name: 'SmartWallet',            hookTemplate: 'useSmartWallet',    priority: 'HIGH'     },
  { name: 'SmartWalletFactory',     hookTemplate: 'useWalletFactory',  priority: 'HIGH'     },
  { name: 'MultiSigWallet',         hookTemplate: 'useMultiSig',       priority: 'HIGH'     },
  { name: 'Paymaster',              hookTemplate: 'usePaymaster',      priority: 'MEDIUM'   },
  { name: 'SecurityModule',         hookTemplate: 'useSecurityModule', priority: 'HIGH'     },
];

// Redes soportadas
const CHAIN_NAMES = {
  1:     'mainnet',
  31337: 'local',
  56:    'bsc',
  97:    'bscTestnet',
  137:   'polygon',
  80001: 'mumbai',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLI ARGS
// ═══════════════════════════════════════════════════════════════════════════════
const args      = process.argv.slice(2);
const isWatch   = args.includes('--watch');
const isOnce    = args.includes('--once');
const isForce   = args.includes('--force');
const isDryRun  = args.includes('--dry-run');
const isStatus  = args.includes('--status');
const isSetup   = args.includes('--setup');

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════════
let logBuffer = [];

function log(level, message, data = '') {
  const ts    = new Date().toISOString();
  const entry = `[${ts}] [${level.toUpperCase()}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
  logBuffer.push(entry);

  const colors = { info: chalk.cyan, success: chalk.green, warn: chalk.yellow, error: chalk.red, debug: chalk.gray };
  const icons  = { info: 'ℹ', success: '✓', warn: '⚠', error: '✗', debug: '·' };
  const color  = colors[level] || chalk.white;
  const icon   = icons[level]  || '·';
  console.log(color(`  ${icon}  ${message}`), data ? chalk.gray(typeof data === 'string' ? data : JSON.stringify(data)) : '');
}

async function flushLog() {
  if (logBuffer.length === 0) return;
  try {
    await fs.ensureDir(path.dirname(CONFIG.logFile));
    const existing = await fs.readFile(CONFIG.logFile, 'utf8').catch(() => '');
    await fs.writeFile(CONFIG.logFile, existing + logBuffer.join('\n') + '\n');
    logBuffer = [];
  } catch (e) {
    console.error('Error escribiendo log:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCK FILE
// ═══════════════════════════════════════════════════════════════════════════════
function readLock() {
  try { return JSON.parse(fs.readFileSync(CONFIG.lockFile, 'utf8')); }
  catch { return { abis: {}, lastSync: null }; }
}

async function writeLock(lock) {
  lock.lastSync = new Date().toISOString();
  await fs.ensureDir(path.dirname(CONFIG.lockFile));
  await fs.writeFile(CONFIG.lockFile, JSON.stringify(lock, null, 2));
}

function md5(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP — Crear carpetas de destino si no existen
// ═══════════════════════════════════════════════════════════════════════════════
async function setupFolders() {
  console.log(chalk.magenta('\n⬡ BeZhas Sync — Setup de carpetas\n'));
  for (const target of CONFIG.targets) {
    const dirs = [target.abis, target.contracts, target.hooks, target.types].filter(Boolean);
    for (const dir of dirs) {
      const existed = await fs.pathExists(dir);
      if (!existed) {
        if (!isDryRun) {
          await fs.ensureDir(dir);
          log('success', `Creada: ${path.relative(ROOT, dir)}`);
        } else {
          log('warn', `[DRY-RUN] Crearía: ${path.relative(ROOT, dir)}`);
        }
      } else {
        log('debug', `Ya existe: ${path.relative(ROOT, dir)}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 1 — DETECTAR Y LEER ABIs (Foundry + Hardhat)
// ═══════════════════════════════════════════════════════════════════════════════
async function collectABIs() {
  const abis = {}; // contractName → { abi, source }

  // 1a. Foundry: out/ContractName.sol/ContractName.json
  const foundryExists = await fs.pathExists(CONFIG.blockchain.foundryOut);
  if (foundryExists) {
    const files = glob.sync('**/*.json', {
      cwd:    CONFIG.blockchain.foundryOut,
      ignore: ['**/*.t.sol/**', '**/test/**', '**/*.s.sol/**', '**/script/**', '**/*.dbg.json'],
    });

    for (const file of files) {
      const fullPath = path.join(CONFIG.blockchain.foundryOut, file);
      const artifact = await fs.readJson(fullPath).catch(() => null);
      if (!artifact || !artifact.abi || artifact.abi.length === 0) continue;

      // Foundry path: ContractName.sol/ContractName.json → contractName = ContractName
      const contractName = path.basename(file, '.json');
      if (!abis[contractName]) {
        abis[contractName] = { abi: artifact.abi, source: 'foundry', file };
      }
    }
    log('info', `Foundry: ${Object.keys(abis).length} ABIs encontrados`);
  }

  // 1b. SDK Artifacts (alternativa si no hay Foundry)
  const sdkArtExists = await fs.pathExists(CONFIG.blockchain.sdkArtifacts);
  if (sdkArtExists) {
    const files = glob.sync('**/*.json', { cwd: CONFIG.blockchain.sdkArtifacts });
    for (const file of files) {
      const fullPath = path.join(CONFIG.blockchain.sdkArtifacts, file);
      const artifact = await fs.readJson(fullPath).catch(() => null);
      if (!artifact) continue;

      // El SDK puede tener { abi: [...] } o directamente [...]
      const abi = Array.isArray(artifact) ? artifact : artifact.abi;
      if (!abi || abi.length === 0) continue;

      const contractName = path.basename(file, '.json');
      // Solo añadir si no vino de Foundry (Foundry tiene prioridad)
      if (!abis[contractName]) {
        abis[contractName] = { abi, source: 'sdk', file };
      }
    }
  }

  return abis;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 2 — SINCRONIZAR ABIs A TODOS LOS TARGETS
// ═══════════════════════════════════════════════════════════════════════════════
async function syncABIsToTargets(force = false) {
  const abis      = await collectABIs();
  const lock      = readLock();
  const synced    = [];
  const allErrors = [];

  if (!lock.abis) lock.abis = {};

  for (const target of CONFIG.targets) {
    if (!await fs.pathExists(target.abis)) {
      await fs.ensureDir(target.abis);
      log('info', `Creando carpeta abis: ${path.relative(ROOT, target.abis)}`);
    }

    let targetSynced = 0;

    for (const [contractName, { abi, source }] of Object.entries(abis)) {
      const destName    = `${contractName}.abi.json`;
      const destPath    = path.join(target.abis, destName);
      const abiContent  = JSON.stringify(abi, null, 2);
      const abiHash     = md5(abiContent);
      const lockKey     = `${target.id}:${destName}`;

      if (!force && lock.abis[lockKey] === abiHash) continue;

      if (isDryRun) {
        log('warn', `[DRY-RUN] Copiaría ${source}:${contractName} → ${target.id}`);
        continue;
      }

      // Backup del anterior
      if (await fs.pathExists(destPath)) {
        await fs.copy(destPath, `${destPath}.bak`).catch(() => {});
      }

      await fs.writeFile(destPath, abiContent);
      lock.abis[lockKey] = abiHash;
      targetSynced++;
      synced.push(`${target.id}/${contractName}`);
      log('success', `ABI [${source}] → ${target.id}: ${contractName}`);
    }

    if (targetSynced > 0) {
      await regenerateABIIndex(target);
    } else if (force) {
      await regenerateABIIndex(target);
    }
  }

  if (!isDryRun && synced.length > 0) {
    await writeLock(lock);
  }

  return { synced, errors: allErrors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGENERAR ÍNDICE DE ABIs
// ═══════════════════════════════════════════════════════════════════════════════
async function regenerateABIIndex(target) {
  if (isDryRun) return;

  const abiFiles  = (await fs.readdir(target.abis).catch(() => []))
    .filter(f => f.endsWith('.abi.json'));

  if (abiFiles.length === 0) return;

  // Generar index.js (ES Modules)
  const imports = abiFiles.map(f => {
    const name   = f.replace('.abi.json', '');
    const varName = name.charAt(0).toLowerCase() + name.slice(1) + 'ABI';
    return `export { default as ${varName} } from './${f}';`;
  });

  const indexJS = `// AUTO-GENERADO por BeZhas Universal Sync Daemon v2.0
// Última sincronización: ${new Date().toISOString()}
// NO EDITAR MANUALMENTE

${imports.join('\n')}

export const BEZHAS_ABIS = {
${abiFiles.map(f => {
    const name   = f.replace('.abi.json', '');
    const varName = name.charAt(0).toLowerCase() + name.slice(1) + 'ABI';
    return `  '${name}': ${varName},`;
  }).join('\n')}
};

export default BEZHAS_ABIS;
`;

  await fs.writeFile(path.join(target.abis, 'index.js'), indexJS);

  // Generar index.ts si el target tiene soporte TypeScript
  if (target.types) {
    await fs.ensureDir(target.types);
  }

  log('success', `Índice regenerado: ${target.id}/abis/index.js (${abiFiles.length} ABIs)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 3 — SINCRONIZAR ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════════
async function syncAddresses() {
  const depDir = CONFIG.blockchain.deployments;
  if (!await fs.pathExists(depDir)) {
    log('warn', 'No existe carpeta deployments — saltando sync de addresses');
    return {};
  }

  const allAddresses = {};
  const files = glob.sync('**/*.json', { cwd: depDir });

  for (const file of files) {
    const fullPath = path.join(depDir, file);
    const data     = await fs.readJson(fullPath).catch(() => null);
    if (!data) continue;

    const chainId = data.chainId || extractChainId(file);
    const network = CHAIN_NAMES[chainId] || `chain_${chainId}`;

    if (!allAddresses[network]) allAddresses[network] = { chainId };

    // Formato flat: { contractName: address }
    if (data.address && data.contractName) {
      allAddresses[network][data.contractName] = data.address;
    }

    // Formato BeZhas: { core: { BEZCoinV2: "0x..." }, sectors: { ... } }
    if (data.core) {
      Object.assign(allAddresses[network], data.core);
    }
    if (data.sectors) {
      for (const sector of Object.values(data.sectors)) {
        Object.assign(allAddresses[network], sector);
      }
    }

    // Formato Foundry broadcast
    if (data.transactions) {
      for (const tx of data.transactions) {
        if (tx.contractAddress && tx.contractName) {
          allAddresses[network][tx.contractName] = tx.contractAddress;
        }
      }
    }
  }

  if (isDryRun) {
    log('warn', '[DRY-RUN] Addresses detectadas:', Object.keys(allAddresses));
    return allAddresses;
  }

  // Escribir addresses en cada target
  for (const target of CONFIG.targets) {
    if (!target.contracts) continue;
    await fs.ensureDir(target.contracts);

    const tsContent = generateAddressesTS(allAddresses);
    const jsContent = generateAddressesJS(allAddresses);

    await fs.writeFile(path.join(target.contracts, 'addresses.ts'), tsContent);
    await fs.writeFile(path.join(target.contracts, 'addresses.js'), jsContent);
    log('success', `Addresses → ${target.id}: ${Object.keys(allAddresses).map(n => `${n}(${Object.keys(allAddresses[n]).length - 1})`).join(', ')}`);
  }

  return allAddresses;
}

function extractChainId(filePath) {
  const parts = filePath.split(/[/\\]/);
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (!isNaN(n) && CHAIN_NAMES[n]) return n;
  }
  // Intentar extraer del nombre del archivo: 31337.json
  const basename = path.basename(filePath, '.json');
  const n = parseInt(basename, 10);
  if (!isNaN(n)) return n;
  return 0;
}

function generateAddressesTS(addresses) {
  const networks = Object.entries(addresses);
  const networkTypes = networks.map(([n]) => `'${n}'`).join(' | ');

  return `// AUTO-GENERADO por BeZhas Universal Sync Daemon v2.0
// Última sincronización: ${new Date().toISOString()}
// NO EDITAR MANUALMENTE

export type NetworkName = ${networkTypes || "'local'"};

export interface ContractAddresses {
  chainId: number;
${REGISTERED_CONTRACTS.map(c => `  ${c.name}?: string;`).join('\n')}
  // Contratos sectoriales (generados dinámicamente)
  [contractName: string]: string | number | undefined;
}

export const BEZHAS_ADDRESSES: Record<NetworkName, ContractAddresses> = {
${networks.map(([network, contracts]) =>
  `  ${network}: ${JSON.stringify(contracts, null, 4)},`
).join('\n')}
};

/** Obtener addresses para una red por chainId */
export function getAddresses(chainId: number): ContractAddresses | null {
  return Object.values(BEZHAS_ADDRESSES).find(a => a.chainId === chainId) ?? null;
}

/** Obtener la address de un contrato específico */
export function getContractAddress(
  chainId: number,
  contractName: string
): string | null {
  const addr = getAddresses(chainId);
  return addr ? (addr[contractName] as string ?? null) : null;
}

export default BEZHAS_ADDRESSES;
`;
}

function generateAddressesJS(addresses) {
  return `// AUTO-GENERADO por BeZhas Universal Sync Daemon v2.0
// NO EDITAR MANUALMENTE

const BEZHAS_ADDRESSES = ${JSON.stringify(addresses, null, 2)};

function getAddresses(chainId) {
  return Object.values(BEZHAS_ADDRESSES).find(a => a.chainId === chainId) ?? null;
}

function getContractAddress(chainId, contractName) {
  const addr = getAddresses(chainId);
  return addr ? (addr[contractName] ?? null) : null;
}

module.exports = { BEZHAS_ADDRESSES, getAddresses, getContractAddress };
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 4 — VALIDAR COHERENCIA ABIs ↔ ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════════
async function validateSync() {
  log('info', 'Validando coherencia ABIs ↔ Addresses...');
  let allValid = true;
  const report = [];

  for (const target of CONFIG.targets) {
    if (!await fs.pathExists(target.abis)) continue;

    const abiFiles = (await fs.readdir(target.abis))
      .filter(f => f.endsWith('.abi.json'))
      .map(f => f.replace('.abi.json', ''));

    const addressFile = path.join(target.contracts, 'addresses.js');
    let addresses = {};
    try {
      const mod = require(addressFile);
      const allNets = Object.values(mod.BEZHAS_ADDRESSES || {});
      for (const net of allNets) {
        Object.assign(addresses, net);
      }
    } catch { /* ok */ }

    for (const contractName of abiFiles) {
      const registered = REGISTERED_CONTRACTS.find(c => c.name === contractName);
      if (!registered) continue; // No registrado → skip

      const hasAddress = !!addresses[contractName];
      const status     = hasAddress ? '✓' : '⚠';
      if (!hasAddress) {
        log('warn', `[${target.id}] ABI sin address: ${contractName}`);
        if (registered.priority === 'CRITICAL') allValid = false;
      }
      report.push({ target: target.id, contract: contractName, hasABI: true, hasAddress, status });
    }
  }

  if (allValid) {
    log('success', 'Validación OK — todos los contratos críticos tienen ABI + address');
  } else {
    log('warn', 'Validación incompleta — algunos contratos críticos sin address (ver arriba)');
  }

  return { valid: allValid, report };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 5 — GENERAR HOOKS TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureHooks() {
  for (const target of CONFIG.targets) {
    if (!target.hooks) continue;
    await fs.ensureDir(target.hooks);

    const abiFiles = (await fs.readdir(target.abis).catch(() => []))
      .filter(f => f.endsWith('.abi.json'))
      .map(f => f.replace('.abi.json', ''));

    for (const contractName of abiFiles) {
      const registered = REGISTERED_CONTRACTS.find(c => c.name === contractName);
      if (!registered) continue;

      const hookPath = path.join(target.hooks, `${registered.hookTemplate}.js`);
      if (await fs.pathExists(hookPath)) continue;

      if (isDryRun) {
        log('warn', `[DRY-RUN] Crearía hook: ${registered.hookTemplate}.js`);
        continue;
      }

      const hookContent = generateHookTemplate(contractName, registered.hookTemplate);
      await fs.writeFile(hookPath, hookContent);
      log('success', `Hook creado: ${target.id}/hooks/${registered.hookTemplate}.js`);
    }
  }
}

function generateHookTemplate(contractName, hookName) {
  const varName = contractName.charAt(0).toLowerCase() + contractName.slice(1) + 'ABI';
  return `// AUTO-GENERADO por BeZhas Universal Sync Daemon v2.0
// Contrato: ${contractName}
// Generado: ${new Date().toISOString()}
// Edita este archivo para añadir la lógica específica del contrato.

import { useState, useCallback } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { getContract } from 'viem';
import { getContractAddress } from '../contracts/addresses';

// ABI sincronizado desde BeZhas Blockchain
let ${varName};
try {
  ${varName} = require('../abis/${contractName}.abi.json');
} catch {
  console.warn('ABI no encontrado: ${contractName}.abi.json — ejecuta sync-daemon.js');
  ${varName} = [];
}

/**
 * Hook para interactuar con el contrato ${contractName}
 * Red soportada: BSC (56/97) + Polygon (137/80001) + Local (31337)
 */
export function ${hookName}() {
  const { address: walletAddress } = useAccount();
  const chainId                    = useChainId();
  const publicClient               = usePublicClient();
  const { data: walletClient }     = useWalletClient();

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [txHash,  setTxHash]  = useState(null);

  const contractAddress = getContractAddress(chainId, '${contractName}');

  const getContractInstance = useCallback(() => {
    if (!contractAddress || !publicClient) return null;
    return getContract({
      address: contractAddress,
      abi:     ${varName},
      client:  { public: publicClient, wallet: walletClient },
    });
  }, [contractAddress, publicClient, walletClient]);

  // ── Añade aquí las funciones específicas del contrato ──────────────────────
  // Ejemplo de lectura:
  // const getSomeData = useCallback(async () => {
  //   setLoading(true);
  //   try {
  //     const contract = getContractInstance();
  //     if (!contract) throw new Error('Contrato no disponible en chainId ' + chainId);
  //     const result = await contract.read.someReadFunction();
  //     return result;
  //   } catch (e) {
  //     setError(e.message);
  //     throw e;
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [getContractInstance, chainId]);

  // Ejemplo de escritura:
  // const doSomething = useCallback(async (param) => {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const contract = getContractInstance();
  //     if (!contract) throw new Error('Wallet no conectada');
  //     const hash = await contract.write.someWriteFunction([param]);
  //     setTxHash(hash);
  //     return hash;
  //   } catch (e) {
  //     setError(e.shortMessage || e.message);
  //     throw e;
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [getContractInstance]);

  return {
    contractAddress,
    chainId,
    walletAddress,
    loading,
    error,
    txHash,
    getContractInstance,
    isAvailable: !!contractAddress && !!publicClient,
    isConnected: !!contractAddress && !!walletAddress,
  };
}

export default ${hookName};
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC COMPLETO
// ═══════════════════════════════════════════════════════════════════════════════
async function fullSync(force = false) {
  console.log(chalk.magenta('\n  ⬡  BeZhas Universal Sync Daemon v2.0\n'));
  const start = Date.now();

  log('info', `Iniciando sync${force ? ' FORZADO' : ''} → ${CONFIG.targets.length} targets`);

  // Setup de carpetas primero
  await setupFolders();

  // Sync ABIs
  const { synced, errors } = await syncABIsToTargets(force);

  // Sync Addresses
  await syncAddresses();

  // Generar hooks faltantes
  await ensureHooks();

  // Validar coherencia
  const { valid } = await validateSync();

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const statusIcon = valid ? chalk.green('✓') : chalk.yellow('⚠');

  console.log('');
  console.log(chalk.magenta('  ─────────────────────────────────────────'));
  console.log(`  ${statusIcon}  Sync completado en ${elapsed}s`);
  console.log(`  ℹ  ABIs propagados: ${synced.length}`);
  console.log(`  ℹ  Targets actualizados: ${CONFIG.targets.length}`);
  if (errors.length > 0) {
    console.log(`  ⚠  Errores: ${errors.length}`);
  }
  console.log(chalk.magenta('  ─────────────────────────────────────────\n'));

  await flushLog();
  return { synced, valid };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODO WATCH
// ═══════════════════════════════════════════════════════════════════════════════
function startWatch() {
  const watchPaths = [
    path.join(CONFIG.blockchain.foundryOut,   '**/*.json'),
    path.join(CONFIG.blockchain.deployments,  '**/*.json'),
    path.join(CONFIG.blockchain.sdkArtifacts, '**/*.json'),
  ].filter(p => !p.includes('undefined'));

  log('info', 'Modo watch activo — observando cambios en BeZhas Blockchain...');
  log('info', `Carpetas observadas: ${watchPaths.length}`);

  const watcher = chokidar.watch(watchPaths, {
    ignored:       /(node_modules|\.bak$)/,
    persistent:    true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 },
  });

  let timer;
  const debouncedSync = (filePath) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      log('info', `Cambio detectado: ${path.relative(BLOCKCHAIN_ROOT, filePath)}`);
      await fullSync(false);
    }, 1500);
  };

  watcher.on('add',    debouncedSync);
  watcher.on('change', debouncedSync);
  watcher.on('error',  err => log('error', 'Error en watcher:', err.message));

  process.on('SIGINT', async () => {
    log('info', 'Deteniendo watch...');
    await watcher.close();
    await flushLog();
    process.exit(0);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════════════
async function showStatus() {
  const lock = readLock();
  console.log(chalk.magenta('\n  ⬡  BeZhas Sync Status\n'));

  if (lock.lastSync) {
    console.log(`  Último sync: ${chalk.cyan(lock.lastSync)}`);
  } else {
    console.log(`  ${chalk.yellow('⚠')} Nunca sincronizado`);
  }

  console.log('');
  for (const target of CONFIG.targets) {
    const exists    = await fs.pathExists(target.abis);
    const abiFiles  = exists ? (await fs.readdir(target.abis)).filter(f => f.endsWith('.abi.json')) : [];
    console.log(`  ${chalk.cyan(target.name)}: ${abiFiles.length} ABIs`);
    abiFiles.forEach(f => {
      const key  = `${target.id}:${f}`;
      const hash = lock.abis?.[key] || 'sin sync';
      console.log(`    · ${f} [${hash.slice(0, 8)}...]`);
    });
  }

  const missingContracts = REGISTERED_CONTRACTS.filter(c => c.priority === 'CRITICAL')
    .filter(c => {
      const abiPath = path.join(CONFIG.targets[0]?.abis || '', `${c.name}.abi.json`);
      return !fs.pathExistsSync(abiPath);
    });

  if (missingContracts.length > 0) {
    console.log('');
    console.log(`  ${chalk.red('✗')} Contratos CRÍTICOS sin ABI:`);
    missingContracts.forEach(c => console.log(`    · ${chalk.red(c.name)}`));
  }
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════
(async () => {
  try {
    if (isStatus) {
      await showStatus();
    } else if (isSetup) {
      await setupFolders();
      log('success', 'Setup completado');
    } else if (isWatch) {
      await fullSync(isForce);
      startWatch();
    } else if (isOnce || isForce || isDryRun) {
      await fullSync(isForce);
    } else {
      console.log(chalk.yellow('\nUso: node sync-daemon.js [--watch|--once|--force|--dry-run|--status|--setup]\n'));
      console.log('Opciones:');
      console.log('  --watch    Modo desarrollo: observa cambios automáticamente');
      console.log('  --once     Sincronización única');
      console.log('  --force    Forzar resync completo (ignora cache MD5)');
      console.log('  --dry-run  Validar sin hacer cambios');
      console.log('  --status   Ver estado del último sync');
      console.log('  --setup    Crear las carpetas de destino\n');
    }
  } catch (err) {
    console.error(chalk.red('\n✗ Error fatal en sync-daemon:'), err.message);
    await flushLog();
    process.exit(1);
  }
})();
