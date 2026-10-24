'use strict';

/**
 * gasTank/kmsSigner — firmante del paymaster respaldado por Google Cloud KMS (secp256k1).
 *
 * La clave de verificación del paymaster nace y vive en KMS (EC_SIGN_SECP256K1_SHA256): al proceso solo llegan
 * firmas. KMS devuelve ECDSA en DER sin `v`; se extraen r y s, se normaliza s a la mitad baja (EIP-2) y se calcula
 * v probando cuál recupera la dirección de la clave (que se deriva de la clave pública, nunca se configura a mano).
 *
 *   GAS_PAYMASTER_KMS_KEY = projects/<p>/locations/<l>/keyRings/<r>/cryptoKeys/<k>/cryptoKeyVersions/<v>
 *
 * `@google-cloud/kms` se carga bajo demanda: hay que añadirlo a las dependencias del API antes de usar este firmante
 * en producción (si falta, el error lo dice). El cliente se puede inyectar, que es lo que hacen los tests.
 *
 * Interfaz (la que consume paymasterService): { getAddress(): Promise<string>, signMessage(bytes): Promise<string> }
 */

const { ethers } = require('ethers');

const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const HALF_N = N / 2n;

function kmsError(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
}

function readLength(buf, pos) {
    const first = buf[pos];
    if (first < 0x80) return { length: first, next: pos + 1 };
    const n = first & 0x7f;
    if (n === 0 || n > 2) throw kmsError('DER_INVALID', 'Longitud DER no soportada');
    let length = 0;
    for (let i = 0; i < n; i += 1) length = (length << 8) | buf[pos + 1 + i];
    return { length, next: pos + 1 + n };
}

/** DER `SEQUENCE { INTEGER r, INTEGER s }` → { r, s } (BigInt). */
function parseDerSignature(der) {
    const buf = Buffer.from(der);
    if (buf[0] !== 0x30) throw kmsError('DER_INVALID', 'La firma no es una SEQUENCE DER');
    let { next: pos } = readLength(buf, 1);
    const ints = [];
    for (let i = 0; i < 2; i += 1) {
        if (buf[pos] !== 0x02) throw kmsError('DER_INVALID', 'Se esperaba un INTEGER DER');
        const { length, next } = readLength(buf, pos + 1);
        ints.push(BigInt(`0x${buf.subarray(next, next + length).toString('hex') || '0'}`));
        pos = next + length;
    }
    return { r: ints[0], s: ints[1] };
}

/** PEM SPKI de secp256k1 → dirección Ethereum. */
function addressFromPem(pem) {
    const b64 = String(pem).replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
    const der = Buffer.from(b64, 'base64');
    const point = der.subarray(der.length - 65);
    if (point[0] !== 0x04) throw kmsError('SPKI_INVALID', 'La clave pública de KMS no es un punto secp256k1 sin comprimir');
    return ethers.computeAddress(`0x${point.toString('hex')}`);
}

const hex32 = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function recoverableSignature(digest, r, s, address) {
    const low = s > HALF_N ? N - s : s;
    for (const v of [27, 28]) {
        const sig = ethers.Signature.from({ r: hex32(r), s: hex32(low), v });
        if (ethers.recoverAddress(digest, sig).toLowerCase() === address.toLowerCase()) return sig;
    }
    throw kmsError('KMS_SIGNATURE_UNRECOVERABLE', 'La firma de KMS no recupera la dirección de la clave');
}

function createKmsSigner({ keyVersion, client } = {}) {
    if (!keyVersion) throw kmsError('KMS_CONFIG_INVALID', 'Falta GAS_PAYMASTER_KMS_KEY');
    let kms = client;
    if (!kms) {
        let sdk;
        try { sdk = require('@google-cloud/kms'); } catch {
            throw kmsError('KMS_SDK_MISSING', 'Falta la dependencia @google-cloud/kms en el API');
        }
        kms = new sdk.KeyManagementServiceClient();
    }
    let addressPromise = null;
    const getAddress = () => {
        // Se cachea la promesa (no el valor) para que dos primeras llamadas simultáneas no pidan la clave dos veces,
        // y se descarta si falla para poder reintentar.
        if (!addressPromise) {
            addressPromise = kms.getPublicKey({ name: keyVersion }).then(([res]) => addressFromPem(res.pem));
            addressPromise.catch(() => { addressPromise = null; });
        }
        return addressPromise;
    };
    return {
        id: `gcp-kms:${keyVersion}`,
        getAddress,
        /** EIP-191 sobre `bytes` (equivale a wallet.signMessage), firmado en KMS. */
        async signMessage(bytes) {
            const address = await getAddress();
            const digest = ethers.hashMessage(bytes);
            const [res] = await kms.asymmetricSign({ name: keyVersion, digest: { sha256: Buffer.from(ethers.getBytes(digest)) } });
            const { r, s } = parseDerSignature(res.signature);
            return recoverableSignature(digest, r, s, address).serialized;
        },
    };
}

module.exports = { createKmsSigner, parseDerSignature, addressFromPem, recoverableSignature };
