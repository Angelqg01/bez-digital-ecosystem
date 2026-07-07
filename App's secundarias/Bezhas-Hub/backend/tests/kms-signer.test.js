/**
 * GcpKmsSigner (services/kmsSigner.js) — firma del hot wallet vía GCP KMS.
 *
 * Sin red ni GCP: el cliente KMS se simula con una SigningKey local que
 * produce firmas DER como haría el HSM (incluida s alta, que el signer debe
 * normalizar a low-s). Verifica que dirección, mensajes y transacciones
 * recuperan exactamente la identidad de la clave.
 */

const {
  Wallet, SigningKey, Transaction, verifyMessage, getBytes,
} = require('ethers');
const { GcpKmsSigner, derToRS } = require('../services/kmsSigner');

const PRIV = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const wallet = new Wallet(PRIV);
const signingKey = new SigningKey(PRIV);
const KEY_PATH = 'projects/p/locations/eu/keyRings/r/cryptoKeys/k/cryptoKeyVersions/1';

// SPKI DER prefix para EC secp256k1 + punto sin comprimir (como devuelve KMS).
const SPKI_PREFIX = Buffer.from('3056301006072a8648ce3d020106052b8104000a034200', 'hex');

function toPem() {
  const point = Buffer.from(getBytes(SigningKey.computePublicKey(PRIV, false)));
  const der = Buffer.concat([SPKI_PREFIX, point]);
  return `-----BEGIN PUBLIC KEY-----\n${der.toString('base64')}\n-----END PUBLIC KEY-----\n`;
}

/** Codifica {r,s} en DER, con padding 0x00 cuando el byte alto está a 1. */
function rsToDer(rHex, sHex) {
  const int = (hex) => {
    let b = Buffer.from(hex.replace('0x', ''), 'hex');
    while (b.length > 1 && b[0] === 0x00) b = b.subarray(1);
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
    return Buffer.concat([Buffer.from([0x02, b.length]), b]);
  };
  const body = Buffer.concat([int(rHex), int(sHex)]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

// Cliente KMS simulado: firma el digest con la clave local y responde en DER.
const fakeKms = {
  getPublicKey: async ({ name }) => {
    expect(name).toBe(KEY_PATH);
    return [{ pem: toPem() }];
  },
  asymmetricSign: async ({ name, digest }) => {
    expect(name).toBe(KEY_PATH);
    const sig = signingKey.sign(digest.sha256);
    return [{ signature: rsToDer(sig.r, sig.s) }];
  },
};

describe('GcpKmsSigner', () => {
  const signer = new GcpKmsSigner(KEY_PATH, null, { kmsClient: fakeKms });

  it('deriva la dirección desde la clave pública del KMS', async () => {
    await expect(signer.getAddress()).resolves.toBe(wallet.address);
  });

  it('firma mensajes que verifyMessage recupera a la misma dirección', async () => {
    const sig = await signer.signMessage('BeZhas hot wallet via KMS');
    expect(verifyMessage('BeZhas hot wallet via KMS', sig)).toBe(wallet.address);
  });

  it('firma transacciones EIP-1559 cuyo from es la dirección KMS', async () => {
    const raw = await signer.signTransaction({
      to: '0x' + 'a'.repeat(40),
      value: 1n,
      chainId: 137,
      nonce: 0,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
    });
    expect(Transaction.from(raw).from).toBe(wallet.address);
  });

  it('derToRS parsea enteros DER con padding y rechaza basura', () => {
    const { r, s } = derToRS(rsToDer(
      '0x' + '9'.repeat(63) + 'a', // r alto → padding 0x00 en DER
      '0x' + '1'.repeat(64),
    ));
    expect(r.toString(16).length).toBeGreaterThan(60);
    expect(s).toBe(BigInt('0x' + '1'.repeat(64)));
    expect(() => derToRS(Buffer.from([0x99, 0x01, 0x00]))).toThrow(/DER/);
  });

  it('exige la ruta del cryptoKeyVersion', () => {
    expect(() => new GcpKmsSigner('', null, { kmsClient: fakeKms })).toThrow(/resource path/);
  });
});
