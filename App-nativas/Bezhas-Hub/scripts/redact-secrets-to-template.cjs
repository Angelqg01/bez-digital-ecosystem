#!/usr/bin/env node
/**
 * redact-secrets-to-template.cjs
 *
 * Genera plantillas (*.example.txt) de los documentos de referencia que hoy
 * contienen credenciales reales, sustituyendo SOLO el sufijo secreto de cada
 * token por un placeholder <ROTATE_ME>. Preserva la estructura legible,
 * direcciones de contrato públicas (0x...40), topics de eventos (0x...64) y ABIs.
 *
 * Uso:  node scripts/redact-secrets-to-template.cjs
 *
 * NO modifica los ficheros originales. Solo crea los *.example.txt.
 */
const fs = require('fs');
const path = require('path');

const FILES = [
  'BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt',
  'BEZHAS_API_KEYS_ABIS_WEBHOOKS.txt',
];

// Solo redactamos los patrones de secreto BeZhas inequívocos: el prefijo
// descriptivo se conserva, el sufijo aleatorio/hex (>=20) se reemplaza.
const RULES = [
  // bzh_..._<hex secret>  ->  bzh_..._<ROTATE_ME>
  { re: /\b(bzh_[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*?)_([0-9a-fA-F]{20,})\b/g, repl: '$1_<ROTATE_ME>' },
  // whsec_..._<hex>       ->  whsec_..._<ROTATE_ME>
  { re: /\b(whsec_[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*?)_([0-9a-fA-F]{20,})\b/g, repl: '$1_<ROTATE_ME>' },
  // bzh_cid_<hex>         ->  bzh_cid_<ROTATE_ME>
  { re: /\b(bzh_cid)_([0-9a-fA-F]{16,})\b/g, repl: '$1_<ROTATE_ME>' },
];

const root = path.resolve(__dirname, '..');
let totalRedactions = 0;

for (const f of FILES) {
  const src = path.join(root, f);
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  No existe: ${f} (se omite)`);
    continue;
  }
  let content = fs.readFileSync(src, 'utf8');
  let count = 0;
  for (const { re, repl } of RULES) {
    content = content.replace(re, (...m) => { count++; return repl.replace('$1', m[1]); });
  }
  const banner =
    `# PLANTILLA SIN SECRETOS — generada por scripts/redact-secrets-to-template.cjs\n` +
    `# Los valores <ROTATE_ME> deben rellenarse desde Secret Manager en runtime.\n` +
    `# NO pegar credenciales reales en este fichero. Original (con secretos) está gitignorado.\n\n`;
  const out = path.join(root, f.replace(/\.txt$/, '.example.txt'));
  fs.writeFileSync(out, banner + content, 'utf8');
  totalRedactions += count;
  console.log(`✅ ${path.basename(out)}  (${count} secretos redactados)`);
}

console.log(`\nTotal: ${totalRedactions} tokens redactados en ${FILES.length} ficheros.`);
