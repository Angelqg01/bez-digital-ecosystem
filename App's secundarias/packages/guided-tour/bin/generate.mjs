#!/usr/bin/env node
// @bezhas/guided-tour — generator CLI
// Reads a SubApp's tour config and writes the self-contained walkthrough HTML.
//
//   node bin/generate.mjs <config.mjs> <output.html>
//
// The config module must `export default { appName, theme?, scenes, ... }`
// (see tour.config.example.mjs). Any relative paths are resolved from CWD.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { renderTourHTML } from '../src/engine.js';

async function main() {
  const [configArg, outArg] = process.argv.slice(2);
  if (!configArg || !outArg) {
    console.error('Uso: node bin/generate.mjs <config.mjs> <output.html>');
    process.exit(1);
  }

  const configPath = resolve(process.cwd(), configArg);
  const outPath = resolve(process.cwd(), outArg);

  let config;
  try {
    const mod = await import(pathToFileURL(configPath).href);
    config = mod.default || mod.config || mod;
  } catch (err) {
    console.error(`No se pudo cargar el config: ${configPath}\n${err.message}`);
    process.exit(1);
  }

  let html;
  try {
    html = renderTourHTML(config);
  } catch (err) {
    console.error(`Error generando el recorrido: ${err.message}`);
    process.exit(1);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  console.log(`✓ Recorrido generado (${config.scenes.length} escenas) → ${outArg}`);
}

main();
