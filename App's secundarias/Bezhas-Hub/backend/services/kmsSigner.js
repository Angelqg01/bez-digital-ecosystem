/**
 * kmsSigner.js — ethers v6 Signer backed by Google Cloud KMS (secp256k1).
 *
 * The hot wallet's private key never touches disk or env: KMS holds an
 * EC_SIGN_SECP256K1_SHA256 key version and only signatures leave the HSM.
 *
 *   const signer = new GcpKmsSigner(process.env.HOT_WALLET_KMS_KEY, provider);
 *   await signer.getAddress();                 // derived from the KMS pubkey
 *   await bezContract.connect(signer).transfer(to, amount);
 *
 * HOT_WALLET_KMS_KEY = full key-version resource path:
 *   projects/<p>/locations/<l>/keyRings/<r>/cryptoKeys/<k>/cryptoKeyVersions/<v>
 *
 * bezpay.service prefers this signer when the env var is set and falls back
 * to HOT_WALLET_PRIVATE_KEY otherwise, so rollout is a config change.
 *
 * @google-cloud/kms is loaded lazily: environments without the dependency
 * (or without GCP credentials) keep working on the env-key fallback.
 */

'use strict';

const {
  AbstractSigner, Signature, SigningKey, Transaction, TypedDataEncoder,
  computeAddress, recoverAddress, hashMessage, getBytes, resolveProperties,
} = require('ethers');

// Orden de la curva secp256k1 (para normalizar a low-s, exigido por Ethereum).
const SECP256K1_N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const HALF_N = SECP256K1_N / 2n;

/** Extrae el punto público sin comprimir (0x04||X||Y) de un PEM SPKI. */
function pemToUncompressedPoint(pem) {
  const b64 = String(pem).replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  const der = Buffer.from(b64, 'base64');
  const point = der.subarray(der.length - 65);
  if (point[0] !== 0x04) {
    throw new Error('KMS public key is not an uncompressed secp256k1 point');
  }
  return point;
}

/** Parsea una firma ECDSA DER (SEQUENCE { INTEGER r, INTEGER s }) → {r, s}. */
function derToRS(der) {
  const buf = Buffer.from(der);
  if (buf[0] !== 0x30) throw new Error('Invalid DER signature (no sequence)');
  let offset = 2;                             // 0x30 <len>
  if (buf[1] & 0x80) offset = 2 + (buf[1] & 0x7f); // long-form length
  const readInt = () => {
    if (buf[offset] !== 0x02) throw new Error('Invalid DER signature (no integer)');
    const len = buf[offset + 1];
    let start = offset + 2;
    let end = start + len;
    while (buf[start] === 0x00 && end - start > 32) start += 1; // strip padding
    offset = end;
    return BigInt('0x' + buf.subarray(start, end).toString('hex'));
  };
  const r = readInt();
  const s = readInt();
  return { r, s };
}

class GcpKmsSigner extends AbstractSigner {
  /**
   * @param {string} keyVersionPath  Resource path del cryptoKeyVersion.
   * @param {import('ethers').Provider|null} [provider]
   * @param {{ kmsClient?: object }} [opts]  Cliente inyectable (tests).
   */
  constructor(keyVersionPath, provider = null, opts = {}) {
    super(provider);
    if (!keyVersionPath) throw new Error('GcpKmsSigner requires the KMS key-version resource path');
    this.keyVersionPath = keyVersionPath;
    this._address = null;
    if (opts.kmsClient) {
      this._client = opts.kmsClient;
    } else {
      // Carga perezosa: sin la dependencia instalada el constructor falla con
      // un error claro y bezpay.service cae al fallback de clave en env.
      const { KeyManagementServiceClient } = require('@google-cloud/kms');
      this._client = new KeyManagementServiceClient();
    }
  }

  connect(provider) {
    return new GcpKmsSigner(this.keyVersionPath, provider, { kmsClient: this._client });
  }

  async getAddress() {
    if (this._address) return this._address;
    const [pub] = await this._client.getPublicKey({ name: this.keyVersionPath });
    const point = pemToUncompressedPoint(pub.pem);
    this._address = computeAddress('0x' + point.toString('hex'));
    return this._address;
  }

  /** Firma un digest keccak256 de 32 bytes y devuelve una Signature EIP-2. */
  async _signDigest(digestHex) {
    const digest = Buffer.from(getBytes(digestHex));
    const [res] = await this._client.asymmetricSign({
      name: this.keyVersionPath,
      digest: { sha256: digest },
    });
    let { r, s } = derToRS(res.signature);
    if (s > HALF_N) s = SECP256K1_N - s; // low-s (Homestead)

    const toHex32 = (n) => '0x' + n.toString(16).padStart(64, '0');
    const address = await this.getAddress();
    for (const v of [27, 28]) {
      const sig = Signature.from({ r: toHex32(r), s: toHex32(s), v });
      if (recoverAddress(digestHex, sig).toLowerCase() === address.toLowerCase()) {
        return sig;
      }
    }
    throw new Error('KMS signature does not recover to the key address');
  }

  async signTransaction(tx) {
    const resolved = await resolveProperties(tx);
    delete resolved.from;
    const unsigned = Transaction.from(resolved);
    unsigned.signature = await this._signDigest(unsigned.unsignedHash);
    return unsigned.serialized;
  }

  async signMessage(message) {
    return (await this._signDigest(hashMessage(message))).serialized;
  }

  async signTypedData(domain, types, value) {
    return (await this._signDigest(TypedDataEncoder.hash(domain, types, value))).serialized;
  }
}

module.exports = { GcpKmsSigner, derToRS, pemToUncompressedPoint };
