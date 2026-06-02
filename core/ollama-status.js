#!/usr/bin/env node
/**
 * BeZhas — Verificador de estado de Ollama
 * Ejecutar: node scripts/ollama-status.js
 */

import 'dotenv/config';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

const REQUIRED_MODELS = [
  { name: 'gemma4:27b',        role: 'Agentes departamentales (marketing, legal, finanzas)',       critical: true  },
  { name: 'qwen3.6:35b-a3b',   role: 'Trading algorithms, Solidity, código MoE',                  critical: true  },
  { name: 'nomic-embed-text',  role: 'Embeddings RAG para Obsidian Knowledge Base',               critical: true  },
  { name: 'kimi-k2',           role: 'Orquestación compleja, contexto 128k, director-agent',      critical: false },
  { name: 'qwen3.6:27b',       role: 'Fallback de qwen3.6:35b-a3b',                              critical: false },
  { name: 'qwen3.6:8b',        role: 'DevOps monitoring, tareas rápidas',                         critical: false },
  { name: 'gemma4:12b',        role: 'Fallback rápido de gemma4',                                 critical: false },
];

const COLORS = {
  green:  '\x1b[32m', yellow: '\x1b[33m', red:  '\x1b[31m',
  cyan:   '\x1b[36m', white:  '\x1b[37m', reset: '\x1b[0m', bold: '\x1b[1m'
};
const c = (color, text) => `${COLORS[color]}${text}${COLORS.reset}`;

async function main() {
  console.log(c('bold', '\n╔══════════════════════════════════════════════════════╗'));
  console.log(c('bold', '║    BeZhas — Estado Ollama + Modelos                  ║'));
  console.log(c('bold', '╚══════════════════════════════════════════════════════╝'));

  // 1. Verificar Ollama
  console.log(c('cyan', '\n[1] Conexión Ollama'));
  let version, installedModels = [];
  try {
    const vRes = await fetch(`${OLLAMA_HOST}/api/version`);
    const vData = await vRes.json();
    version = vData.version;
    console.log(`    ${c('green', '✅')} Ollama ${version} en ${OLLAMA_HOST}`);
  } catch (err) {
    console.log(`    ${c('red', '❌')} Ollama no disponible en ${OLLAMA_HOST}`);
    console.log(`    ${c('yellow', '→')} Asegúrate de que Ollama está corriendo`);
    console.log(`    ${c('yellow', '→')} Windows: busca Ollama en la bandeja del sistema`);
    console.log(`    ${c('yellow', '→')} O ejecuta: ollama serve`);
    process.exit(1);
  }

  // 2. Listar modelos instalados
  console.log(c('cyan', '\n[2] Modelos instalados'));
  try {
    const mRes = await fetch(`${OLLAMA_HOST}/api/tags`);
    const mData = await mRes.json();
    installedModels = (mData.models || []).map(m => ({
      name: m.name,
      sizeGB: +(m.size / 1e9).toFixed(1)
    }));

    if (installedModels.length === 0) {
      console.log(`    ${c('yellow', '⚠️')}  No hay modelos instalados`);
    } else {
      installedModels.forEach(m => {
        console.log(`    ${c('green', '✓')} ${m.name.padEnd(30)} ${c('white', m.sizeGB + 'GB')}`);
      });
    }
  } catch (err) {
    console.log(`    ${c('red', '❌')} Error listando modelos: ${err.message}`);
  }

  // 3. Verificar modelos requeridos por BeZhas
  console.log(c('cyan', '\n[3] Modelos BeZhas requeridos'));
  const missing = [], ok = [], optional = [];

  for (const req of REQUIRED_MODELS) {
    const baseName = req.name.split(':')[0];
    const installed = installedModels.find(m => m.name === req.name || m.name.startsWith(baseName + ':'));

    if (installed) {
      console.log(`    ${c('green', '✅')} ${req.name.padEnd(28)} — ${req.role}`);
      ok.push(req.name);
    } else {
      const icon = req.critical ? c('red', '❌') : c('yellow', '⚠️');
      const label = req.critical ? 'REQUERIDO' : 'opcional';
      console.log(`    ${icon} ${req.name.padEnd(28)} [${label}] — ${req.role}`);
      if (req.critical) missing.push(req.name);
      else optional.push(req.name);
    }
  }

  // 4. Generar comandos de instalación
  if (missing.length > 0 || optional.length > 0) {
    console.log(c('cyan', '\n[4] Comandos para instalar modelos faltantes'));

    if (missing.length > 0) {
      console.log(c('red', '\n    🔴 CRÍTICOS (necesarios para arrancar BeZhas):'));
      missing.forEach(m => console.log(`    ollama pull ${m}`));
    }
    if (optional.length > 0) {
      console.log(c('yellow', '\n    🟡 OPCIONALES (mejoran el rendimiento):'));
      optional.forEach(m => console.log(`    ollama pull ${m}`));
    }
  }

  // 5. Verificar integración OpenCode
  console.log(c('cyan', '\n[5] Integraciones Ollama'));
  const opencodeConfig = process.env.USERPROFILE
    ? `${process.env.USERPROFILE}\\.opencode\\config.json`
    : '~/.opencode/config.json';
  console.log(`    → OpenCode config:  ${opencodeConfig}`);
  console.log(`    → Lanzar OpenCode:  ${c('white', 'ollama launch opencode --model qwen3.6')}`);
  console.log(`    → Lanzar OpenClaw:  ${c('white', 'ollama launch openclaw --yes')}`);
  console.log(`    → Lanzar Kimi CLI:  ${c('white', 'ollama launch kimi')}`);

  // 6. Resumen
  console.log(c('cyan', '\n[6] Resumen'));
  const total    = REQUIRED_MODELS.length;
  const okCount  = ok.length;
  const readyPct = Math.round((okCount / total) * 100);
  const statusIcon = missing.length === 0 ? c('green', '✅ LISTO') : c('red', '❌ FALTAN MODELOS CRÍTICOS');

  console.log(`    Estado: ${statusIcon}`);
  console.log(`    Modelos OK: ${okCount}/${total} (${readyPct}%)`);
  console.log(`    Total VRAM modelos instalados: ~${installedModels.reduce((s,m) => s + m.sizeGB, 0).toFixed(0)}GB en disco`);

  if (missing.length === 0) {
    console.log(c('green', '\n    ✅ BeZhas Blockchain puede arrancar con todos los modelos disponibles'));
    console.log(c('white', '    Ejecuta: npm run start'));
  } else {
    console.log(c('yellow', `\n    ⚠️  Instala los ${missing.length} modelo(s) crítico(s) antes de arrancar`));
  }

  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
