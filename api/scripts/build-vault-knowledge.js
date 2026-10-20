#!/usr/bin/env node
'use strict';

/**
 * Regenera services/knowledge/vault-public.json desde docs/obsidian-vault: las notas con
 * `visibility: public`, sólo su sección «## Para clientes» (ver services/knowledge/vaultPublic.js).
 *
 *   node scripts/build-vault-knowledge.js           escribe el fichero
 *   node scripts/build-vault-knowledge.js --check   falla si está desfasado (CI)
 */
const fs = require('fs');
const path = require('path');
const { exportarVault } = require('../services/knowledge/vaultPublic');
const { VAULT_JSON } = require('../services/knowledge/sources');

const VAULT = path.resolve(__dirname, '..', '..', 'docs', 'obsidian-vault');
const salida = `${JSON.stringify(exportarVault(VAULT), null, 2)}\n`;

if (process.argv.includes('--check')) {
    const actual = fs.existsSync(VAULT_JSON) ? fs.readFileSync(VAULT_JSON, 'utf8') : '';
    if (actual !== salida) {
        console.error('vault-public.json está desfasado: ejecuta node scripts/build-vault-knowledge.js');
        process.exit(1);
    }
    console.log('vault-public.json al día');
} else {
    fs.writeFileSync(VAULT_JSON, salida);
    console.log(`vault-public.json: ${JSON.parse(salida).length} documentos`);
}
