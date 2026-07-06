'use strict';

/**
 * controlSecurity — signs outbound SCADA control commands (Phase 5).
 *
 * Reverse direction of telemetrySecurity: the BACKEND holds a private key and
 * signs every dispatched command so the Edge Node can prove the command came
 * from the authorized controller (and was not altered in flight) before moving
 * any hardware. Same algorithm/canonicalization (ECDSA P-256 / SHA-256), so an
 * Edge verifies with signer.verify(cmd, backendPublicKeyPem).
 *
 * Key source (in priority): VPP_CONTROL_KEY_PEM env → VPP_CONTROL_KEY_FILE →
 * an ephemeral dev key (regenerated per process; fine for local/testing).
 */

const crypto = require('crypto');
const fs = require('fs');
const { signingMessage } = require('./telemetrySecurity');
const logger = require('../utils/logger');

let _privateKey = null;
let _publicKeyPem = null;
let _keyId = process.env.VPP_CONTROL_KEY_ID || 'backend-control-1';

function _load() {
  if (_privateKey) return;
  let pem = process.env.VPP_CONTROL_KEY_PEM;
  if (!pem && process.env.VPP_CONTROL_KEY_FILE && fs.existsSync(process.env.VPP_CONTROL_KEY_FILE)) {
    pem = fs.readFileSync(process.env.VPP_CONTROL_KEY_FILE, 'utf8');
  }
  if (pem) {
    _privateKey = crypto.createPrivateKey(pem);
  } else {
    // Ephemeral dev key — edges must fetch the matching public key after boot.
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    _privateKey = privateKey;
    logger.warn('[VPP][CTRL] using EPHEMERAL control key (set VPP_CONTROL_KEY_PEM/FILE in prod)');
  }
  _publicKeyPem = crypto.createPublicKey(_privateKey).export({ type: 'spki', format: 'pem' });
}

/** Sign a command payload → returns it with keyId + base64 sig added. */
function signCommand(command) {
  _load();
  const full = { ...command, keyId: _keyId };
  full.sig = crypto.sign('sha256', signingMessage(full), _privateKey).toString('base64');
  return full;
}

/** Public key (PEM) edges use to verify commands. Exposed via the API. */
function getPublicKeyPem() { _load(); return _publicKeyPem; }
function getKeyId() { return _keyId; }

/** Test helper — inject a known key so an edge verifier can be set up. */
function __setKeyForTests(privateKeyPem, keyId = 'backend-control-1') {
  _privateKey = crypto.createPrivateKey(privateKeyPem);
  _publicKeyPem = crypto.createPublicKey(_privateKey).export({ type: 'spki', format: 'pem' });
  _keyId = keyId;
}

module.exports = { signCommand, getPublicKeyPem, getKeyId, __setKeyForTests };
