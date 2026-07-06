#!/usr/bin/env node
'use strict';

/**
 * keygen.js — provision a per-node ECDSA P-256 telemetry signing key (dev).
 *
 * Writes the private key PEM to disk (gateway side) and prints the public key
 * PEM + a ready-to-paste backend registration line (nodeId/keyId → public key).
 * In PRODUCTION the private key never leaves an ATECC608A / TPM — this script is
 * only for development and bench testing.
 *
 * Usage:
 *   node scripts/keygen.js --keyId edge-key-1 --out ./keys/edge-key-1.pem
 */

const fs = require('fs');
const path = require('path');
const { generateKeyPair } = require('../src/security/signer');

function parseArgs(argv) {
  const a = { keyId: 'edge-key-1', out: './keys/edge-key-1.pem' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--keyId') a.keyId = argv[++i];
    else if (argv[i] === '--out') a.out = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const { publicKeyPem, privateKeyPem } = generateKeyPair();

const outPath = path.resolve(args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, privateKeyPem, { mode: 0o600 });
const pubPath = outPath.replace(/\.pem$/, '') + '.pub.pem';
fs.writeFileSync(pubPath, publicKeyPem);

console.log(`\n✅ Node signing key provisioned (ECDSA P-256 / secp256r1)`);
console.log(`   keyId:       ${args.keyId}`);
console.log(`   private key: ${outPath}  (chmod 600 — keep secret, gateway only)`);
console.log(`   public key:  ${pubPath}`);
console.log(`\n→ config.security: { "keyId": "${args.keyId}", "privateKeyFile": "${args.out}" }`);
console.log(`\n→ Register the PUBLIC key on the backend (api: bezhas:energy:keys) as:`);
console.log(`   ${args.keyId} =>\n${publicKeyPem.trim()}\n`);
