'use strict';

/**
 * Proveedores de clave. Todos cumplen el mismo contrato:
 *
 *     { id, direccion(): Promise<string>, firmarDigest(digestHex): Promise<ethers.Signature> }
 *
 * ── aws-kms ────────────────────────────────────────────────────────────────
 * La clave privada nace y vive en AWS KMS (ECC_SECG_P256K1): nunca sale, ni a
 * este proceso ni a disco. KMS devuelve una firma ECDSA en DER sin `v`; aquí se
 * extraen r y s, se normaliza s a la mitad baja (EIP-2, si no la red la
 * rechaza) y se calcula v probando qué valor recupera la dirección de la clave.
 *
 * ── local-dev ──────────────────────────────────────────────────────────────
 * Clave en variable de entorno. Sólo para desarrollo y tests: en producción se
 * niega a arrancar. Es exactamente el patrón que el documento de seguridad
 * prohíbe (§12) y existe para poder probar el resto sin KMS.
 */

const { ethers } = require('ethers');

const N_SECP256K1 = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const MITAD_N = N_SECP256K1 / 2n;

function error(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
}

/** Lee una longitud DER (forma corta o larga). */
function leerLongitud(buf, pos) {
    const primero = buf[pos];
    if (primero < 0x80) return { longitud: primero, siguiente: pos + 1 };
    const bytes = primero & 0x7f;
    if (bytes === 0 || bytes > 2) throw error('DER_INVALID', 'Longitud DER no soportada.');
    let longitud = 0;
    for (let i = 0; i < bytes; i += 1) longitud = (longitud << 8) | buf[pos + 1 + i];
    return { longitud, siguiente: pos + 1 + bytes };
}

/** DER `SEQUENCE { INTEGER r, INTEGER s }` → { r, s } como BigInt. */
function parsearFirmaDer(der) {
    const buf = Buffer.from(der);
    if (buf[0] !== 0x30) throw error('DER_INVALID', 'La firma no es una SEQUENCE DER.');
    let { siguiente: pos } = leerLongitud(buf, 1);
    const enteros = [];
    for (let i = 0; i < 2; i += 1) {
        if (buf[pos] !== 0x02) throw error('DER_INVALID', 'Se esperaba un INTEGER DER.');
        const { longitud, siguiente } = leerLongitud(buf, pos + 1);
        enteros.push(BigInt(`0x${buf.subarray(siguiente, siguiente + longitud).toString('hex') || '0'}`));
        pos = siguiente + longitud;
    }
    return { r: enteros[0], s: enteros[1] };
}

/** Clave pública SPKI (DER) de secp256k1 → dirección Ethereum. */
function direccionDesdeSpki(spki) {
    const buf = Buffer.from(spki);
    const punto = buf.subarray(buf.length - 65);
    if (punto[0] !== 0x04) throw error('SPKI_INVALID', 'Se esperaba un punto sin comprimir (0x04).');
    return ethers.computeAddress(`0x${punto.toString('hex')}`);
}

const hex32 = (n) => `0x${n.toString(16).padStart(64, '0')}`;

/** r, s de KMS → Signature con s baja y el v que recupera `direccion`. */
function firmaRecuperable(digest, r, s, direccion) {
    const sBaja = s > MITAD_N ? N_SECP256K1 - s : s;
    for (const v of [27, 28]) {
        const firma = ethers.Signature.from({ r: hex32(r), s: hex32(sBaja), v });
        if (ethers.recoverAddress(digest, firma).toLowerCase() === direccion.toLowerCase()) return firma;
    }
    throw error('KMS_SIGNATURE_UNRECOVERABLE', 'La firma de KMS no recupera la dirección de la clave.');
}

function proveedorAwsKms({ keyId, region, cliente, comandos } = {}) {
    if (!keyId) throw error('KEY_CONFIG_INVALID', 'aws-kms necesita keyId.');
    let kms = cliente;
    let cmd = comandos;
    if (!kms || !cmd) {
        let sdk;
        try {
            sdk = require('@aws-sdk/client-kms');
        } catch {
            throw error('KMS_SDK_MISSING', 'Falta @aws-sdk/client-kms (dependencia opcional del firmante).');
        }
        kms = kms || new sdk.KMSClient({ region });
        cmd = cmd || { GetPublicKeyCommand: sdk.GetPublicKeyCommand, SignCommand: sdk.SignCommand };
    }
    let direccionCache = null;
    return {
        id: `aws-kms:${keyId}`,
        async direccion() {
            if (!direccionCache) {
                const r = await kms.send(new cmd.GetPublicKeyCommand({ KeyId: keyId }));
                direccionCache = direccionDesdeSpki(r.PublicKey);
            }
            return direccionCache;
        },
        async firmarDigest(digest) {
            const direccion = await this.direccion();
            const r = await kms.send(new cmd.SignCommand({
                KeyId: keyId,
                Message: ethers.getBytes(digest),
                MessageType: 'DIGEST',
                SigningAlgorithm: 'ECDSA_SHA_256',
            }));
            const { r: rr, s } = parsearFirmaDer(r.Signature);
            return firmaRecuperable(digest, rr, s, direccion);
        },
    };
}

function proveedorLocalDev({ privateKeyEnv }, env = process.env) {
    if (env.NODE_ENV === 'production') {
        throw error('LOCAL_KEY_IN_PRODUCTION', 'local-dev no está permitido en producción: usa aws-kms.');
    }
    const pk = env[privateKeyEnv || 'TX_SIGNER_DEV_KEY'];
    if (!pk) throw error('KEY_CONFIG_INVALID', `Falta la variable ${privateKeyEnv || 'TX_SIGNER_DEV_KEY'}.`);
    const clave = new ethers.SigningKey(pk);
    return {
        id: 'local-dev',
        async direccion() { return ethers.computeAddress(clave.publicKey); },
        async firmarDigest(digest) { return clave.sign(digest); },
    };
}

function crearProveedor(def, env = process.env) {
    if (def?.provider === 'aws-kms') return proveedorAwsKms({ keyId: def.keyId, region: def.region || env.AWS_REGION });
    if (def?.provider === 'local-dev') return proveedorLocalDev(def, env);
    throw error('KEY_CONFIG_INVALID', `Proveedor de clave desconocido: ${def?.provider}`);
}

module.exports = {
    parsearFirmaDer, direccionDesdeSpki, firmaRecuperable,
    proveedorAwsKms, proveedorLocalDev, crearProveedor, N_SECP256K1,
};
