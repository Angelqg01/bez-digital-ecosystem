const { ethers } = require('ethers');
const { createKmsSigner, parseDerSignature, addressFromPem, recoverableSignature } = require('../../services/gasTank/kmsSigner');

const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// ── Doble de Google Cloud KMS: guarda una clave en memoria y firma el DIGEST que recibe, igual que EC_SIGN_SECP256K1_SHA256 ──
function derInt(n) {
    let h = n.toString(16);
    if (h.length % 2) h = '0' + h;
    let b = Buffer.from(h, 'hex');
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); // INTEGER con signo: relleno si el bit alto está a 1
    return Buffer.concat([Buffer.from([0x02, b.length]), b]);
}
const derSig = (r, s) => { const body = Buffer.concat([derInt(r), derInt(s)]); return Buffer.concat([Buffer.from([0x30, body.length]), body]); };

function fakeKms({ flipS = false } = {}) {
    const key = new ethers.SigningKey(ethers.Wallet.createRandom().privateKey);
    const point = Buffer.from(key.publicKey.slice(2), 'hex'); // 04 || X || Y
    const spki = Buffer.concat([Buffer.from('3056301006072a8648ce3d020106052b8104000a034200', 'hex'), point]);
    const pem = `-----BEGIN PUBLIC KEY-----\n${spki.toString('base64')}\n-----END PUBLIC KEY-----\n`;
    const calls = { getPublicKey: 0, asymmetricSign: [] };
    return {
        address: ethers.computeAddress(key.publicKey),
        calls,
        client: {
            getPublicKey: async () => { calls.getPublicKey += 1; return [{ pem }]; },
            asymmetricSign: async (req) => {
                calls.asymmetricSign.push(req);
                const sig = key.sign(ethers.hexlify(req.digest.sha256));
                let s = BigInt(sig.s);
                if (flipS) s = N - s; // KMS puede devolver la s alta; hay que normalizarla
                return [{ signature: derSig(BigInt(sig.r), s) }];
            },
        },
    };
}

const KEY = 'projects/p/locations/europe-west1/keyRings/r/cryptoKeys/paymaster/cryptoKeyVersions/1';

test('la dirección sale de la clave pública de KMS y se cachea', async () => {
    const k = fakeKms();
    const signer = createKmsSigner({ keyVersion: KEY, client: k.client });
    expect(await signer.getAddress()).toBe(k.address);
    await signer.getAddress();
    expect(k.calls.getPublicKey).toBe(1);
});

test('signMessage produce una firma EIP-191 verificable que recupera la dirección de la clave', async () => {
    const k = fakeKms();
    const signer = createKmsSigner({ keyVersion: KEY, client: k.client });
    const msg = ethers.getBytes(ethers.id('hash del paymaster'));
    const sig = await signer.signMessage(msg);
    expect(ethers.verifyMessage(msg, sig)).toBe(k.address);
    // KMS firmó el digest EIP-191 de los bytes, no los bytes
    expect(ethers.hexlify(k.calls.asymmetricSign[0].digest.sha256)).toBe(ethers.hashMessage(msg));
    expect(k.calls.asymmetricSign[0].name).toBe(KEY);
});

test('una s alta devuelta por KMS se normaliza a s baja y la firma sigue siendo válida', async () => {
    const k = fakeKms({ flipS: true });
    const signer = createKmsSigner({ keyVersion: KEY, client: k.client });
    const msg = ethers.getBytes(ethers.id('x'));
    const sig = await signer.signMessage(msg);
    expect(BigInt(ethers.Signature.from(sig).s)).toBeLessThanOrEqual(N / 2n);
    expect(ethers.verifyMessage(msg, sig)).toBe(k.address);
});

test('varias firmas distintas (r/s con y sin relleno DER) recuperan siempre la misma dirección', async () => {
    const k = fakeKms();
    const signer = createKmsSigner({ keyVersion: KEY, client: k.client });
    for (let i = 0; i < 25; i += 1) {
        const msg = ethers.getBytes(ethers.id(`m${i}`));
        expect(ethers.verifyMessage(msg, await signer.signMessage(msg))).toBe(k.address);
    }
});

test('un fallo al pedir la clave pública no queda cacheado (se reintenta)', async () => {
    const k = fakeKms();
    let first = true;
    const client = { ...k.client, getPublicKey: async (r) => { if (first) { first = false; throw new Error('unavailable'); } return k.client.getPublicKey(r); } };
    const signer = createKmsSigner({ keyVersion: KEY, client });
    await expect(signer.getAddress()).rejects.toThrow('unavailable');
    expect(await signer.getAddress()).toBe(k.address);
});

test('configuración inválida y utilidades DER/PEM', () => {
    expect(() => createKmsSigner({})).toThrow(/GAS_PAYMASTER_KMS_KEY/);
    expect(() => parseDerSignature(Buffer.from('0102', 'hex'))).toThrow(/DER/);
    expect(() => addressFromPem('-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----')).toThrow();
    const k = fakeKms();
    expect(() => recoverableSignature(ethers.id('d'), 1n, 1n, k.address)).toThrow(/no recupera/);
});

describe('firmante por defecto del servicio (defaultSigner)', () => {
    const svc = require('../../services/gasTank/paymasterService');
    const PK = ethers.Wallet.createRandom().privateKey;

    test('sin ninguna clave configurada: 503 NOT_CONFIGURED', () => {
        expect(() => svc.defaultSigner({})).toThrow(/no está configurado/);
    });

    test('con clave en el entorno funciona en desarrollo y firma como una wallet', async () => {
        const signer = svc.defaultSigner({ GAS_PAYMASTER_SIGNER_KEY: PK });
        const w = new ethers.Wallet(PK);
        expect(await signer.getAddress()).toBe(w.address);
        const msg = ethers.getBytes(ethers.id('a'));
        expect(await signer.signMessage(msg)).toBe(await w.signMessage(msg));
    });

    test('en producción la clave del entorno se rechaza salvo aceptación explícita', () => {
        expect(() => svc.defaultSigner({ NODE_ENV: 'production', GAS_PAYMASTER_SIGNER_KEY: PK })).toThrow(/KMS/);
        expect(() => svc.defaultSigner({ NODE_ENV: 'production', GAS_PAYMASTER_SIGNER_KEY: PK, GAS_PAYMASTER_ALLOW_ENV_KEY: 'true' })).not.toThrow();
    });

    test('GAS_PAYMASTER_KMS_KEY tiene prioridad y, sin el SDK, falla con un 503 que lo explica', () => {
        let err;
        try { svc.defaultSigner({ GAS_PAYMASTER_KMS_KEY: KEY, GAS_PAYMASTER_SIGNER_KEY: PK }); } catch (e) { err = e; }
        // Sin @google-cloud/kms instalado en el API (hoy): 503 con el motivo; si algún día se instala, devuelve el firmante KMS.
        if (err) { expect(err.status).toBe(503); expect(err.message).toMatch(/KMS/); }
    });
});
