'use strict';

/**
 * Tests del firmante. Los de paridad cargan el código REAL de la API
 * (normalizador de intenciones, policyHash, datos EIP-712, cliente HMAC): si un
 * lado cambia sin el otro, el firmante rechazaría operaciones legítimas o
 * —peor— aceptaría otras. Aquí se ve antes de desplegar.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ethers } = require('ethers');

process.env.NODE_ENV = 'test';

const canonicalFirmante = require('../src/canonical');
const eipFirmante = require('../src/eip712');
const { construir } = require('../src/config');
const { crearAlmacen } = require('../src/store');
const { verificarSolicitud, verificarHmac, crearRegistroNonces } = require('../src/verify');
const { parsearFirmaDer, proveedorAwsKms, N_SECP256K1 } = require('../src/keys');
const { crearServidor } = require('../src/server');

const API = path.resolve(__dirname, '../../api');
const canonicalApi = require(path.join(API, 'services/txCanonical'));
const txIntent = require(path.join(API, 'services/txIntent'));
const txApproval = require(path.join(API, 'services/txApproval'));
const { calcularPolicyHash, POLICY_VERSION } = require(path.join(API, 'services/txPolicyEngine'));
const { solicitarFirma } = require(path.join(API, 'services/txSignerClient'));

const CLAVE_HMAC = 'k'.repeat(40);
const aprobadores = [ethers.Wallet.createRandom(), ethers.Wallet.createRandom(), ethers.Wallet.createRandom()];
const tesoreria = ethers.Wallet.createRandom();
const DESTINO = ethers.Wallet.createRandom().address;

function configDePrueba({ dataDir, extra = {} } = {}) {
    return construir({
        allowedChainIds: [137],
        minApprovals: 2,
        maxGasLimit: 200000,
        maxFeePerGasGwei: 500,
        approvers: aprobadores.map((w) => ({ address: w.address, roles: ['treasury'] })),
        wallets: [{
            id: 'tesoreria-polygon', address: tesoreria.address, chainIds: [137],
            key: { provider: 'local-dev' },
            limits: { BEZ: { perTx: '1000', daily: '1500' } },
            ...extra,
        }],
    }, { TX_SIGNER_REQUEST_KEY: CLAVE_HMAC, TX_SIGNER_DATA_DIR: dataDir, NODE_ENV: 'test' });
}

/** Intención construida con el normalizador real de la API. */
function intencionReal(importe = '500', ttl = 900) {
    const parseada = txIntent.parsear({
        rail: 'crypto_transfer', asset: 'BEZ', amount: importe, network: 'polygon',
        source: { type: 'bezhas_treasury' },
        destination: { type: 'evm_address', value: DESTINO, name: 'Proveedor SL' },
        purpose: 'supplier_payment', idempotencyKey: `prueba-${crypto.randomUUID()}`,
        counterparty: { legalName: 'Proveedor SL', country: 'ES' }, expiresInSeconds: ttl,
    });
    const intent = txIntent.normalizar(parseada, { appId: 'app-1', env: { NODE_ENV: 'test' } });
    const intentHash = txIntent.hashIntencion(intent);
    const policy = { policyVersion: POLICY_VERSION, decision: 'REQUIRE_APPROVAL', requiredApprovals: 2 };
    policy.policyHash = calcularPolicyHash({ intentHash, ...policy });
    return { intentId: crypto.randomUUID(), intent, intentHash, policy };
}

async function aprobar(base, quienes) {
    const registro = { id: base.intentId, intent: base.intent, intent_hash: base.intentHash, policy_hash: base.policy.policyHash };
    const td = txApproval.datosTipados(registro, 'APPROVE');
    return Promise.all(quienes.map(async (w) => ({ decision: 'APPROVE', signature: await w.signTypedData(td.domain, td.types, td.message) })));
}

function tx(base, extra = {}) {
    const iface = new ethers.Interface(['function transfer(address,uint256)']);
    return {
        chainId: 137, to: base.intent.tokenAddress,
        data: iface.encodeFunctionData('transfer', [DESTINO, BigInt(base.intent.amountMinor)]),
        value: '0', nonce: 7, gasLimit: '80000', maxFeePerGas: '100000000000', maxPriorityFeePerGas: '30000000000',
        ...extra,
    };
}

describe('paridad con la API', () => {
    test('stableStringify y el hash coinciden', () => {
        const v = { b: 1n, a: [1, { z: undefined, y: 'x' }], c: null };
        assert.equal(canonicalFirmante.stableStringify(v), canonicalApi.stableStringify(v));
        assert.equal(canonicalFirmante.hashCanonico(v), canonicalApi.hashCanonico(v));
    });

    test('el mensaje EIP-712 es idéntico', () => {
        const b = intencionReal();
        const r = { id: b.intentId, intent: b.intent, intent_hash: b.intentHash, policy_hash: b.policy.policyHash };
        assert.deepEqual(eipFirmante.mensajeAprobacion(r, 'APPROVE'), txApproval.mensajeAprobacion(r, 'APPROVE'));
        assert.deepEqual(eipFirmante.TIPOS_APROBACION, txApproval.TIPOS_APROBACION);
        assert.deepEqual(eipFirmante.DOMINIO, txApproval.DOMINIO);
    });
});

describe('verificarSolicitud', () => {
    let dir;
    let config;
    let almacen;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signer-'));
        config = configDePrueba({ dataDir: dir });
        almacen = crearAlmacen(dir);
    });

    test('acepta una transferencia aprobada por dos aprobadores', async () => {
        const b = intencionReal();
        const v = verificarSolicitud({ peticion: { ...b, approvals: await aprobar(b, aprobadores.slice(0, 2)), tx: tx(b) }, config, almacen });
        assert.equal(v.cantidad, ethers.parseUnits('500', 18));
        assert.equal(v.aprobadores.length, 2);
    });

    test('una sola aprobación no basta, aunque la API diga que sí', async () => {
        const b = intencionReal();
        b.policy.requiredApprovals = 1;
        b.policy.policyHash = calcularPolicyHash({ intentHash: b.intentHash, ...b.policy });
        await assert.rejects(async () => verificarSolicitud({
            peticion: { ...b, approvals: await aprobar(b, aprobadores.slice(0, 1)), tx: tx(b) }, config, almacen,
        }), { code: 'APPROVALS_INSUFFICIENT' });
    });

    test('el mismo aprobador dos veces cuenta una', async () => {
        const b = intencionReal();
        const [firma] = await aprobar(b, [aprobadores[0]]);
        assert.throws(() => verificarSolicitud({ peticion: { ...b, approvals: [firma, firma], tx: tx(b) }, config, almacen }),
            { code: 'APPROVALS_INSUFFICIENT' });
    });

    test('un aprobador que no está en SU lista no cuenta', async () => {
        const b = intencionReal();
        const intruso = ethers.Wallet.createRandom();
        await assert.rejects(async () => verificarSolicitud({
            peticion: { ...b, approvals: await aprobar(b, [aprobadores[0], intruso]), tx: tx(b) }, config, almacen,
        }), { code: 'APPROVALS_INSUFFICIENT' });
    });

    test('cambiar el importe después de aprobar rompe el hash', async () => {
        const b = intencionReal();
        const approvals = await aprobar(b, aprobadores.slice(0, 2));
        const alterada = { ...b.intent, amountMinor: ethers.parseUnits('999', 18).toString() };
        assert.throws(() => verificarSolicitud({ peticion: { ...b, intent: alterada, approvals, tx: tx(b) }, config, almacen }),
            { code: 'INTENT_HASH_MISMATCH' });
    });

    test('calldata a otro destino se rechaza aunque todo lo demás case', async () => {
        const b = intencionReal();
        const otro = new ethers.Interface(['function transfer(address,uint256)'])
            .encodeFunctionData('transfer', [ethers.Wallet.createRandom().address, BigInt(b.intent.amountMinor)]);
        await assert.rejects(async () => verificarSolicitud({
            peticion: { ...b, approvals: await aprobar(b, aprobadores.slice(0, 2)), tx: tx(b, { data: otro }) }, config, almacen,
        }), { code: 'CALLDATA_MISMATCH' });
    });

    test('un approve disfrazado se rechaza', async () => {
        const b = intencionReal();
        const approve = new ethers.Interface(['function approve(address,uint256)']).encodeFunctionData('approve', [DESTINO, ethers.MaxUint256]);
        await assert.rejects(async () => verificarSolicitud({
            peticion: { ...b, approvals: await aprobar(b, aprobadores.slice(0, 2)), tx: tx(b, { data: approve }) }, config, almacen,
        }), { code: 'CALLDATA_MISMATCH' });
    });

    test('decision ALLOW no se firma desde tesorería', async () => {
        const b = intencionReal();
        b.policy.decision = 'ALLOW';
        b.policy.policyHash = calcularPolicyHash({ intentHash: b.intentHash, ...b.policy });
        await assert.rejects(async () => verificarSolicitud({
            peticion: { ...b, approvals: await aprobar(b, aprobadores.slice(0, 2)), tx: tx(b) }, config, almacen,
        }), { code: 'APPROVAL_REQUIRED' });
    });

    test('topes propios: por operación y diario, persistentes', async () => {
        const grande = intencionReal('1001');
        await assert.rejects(async () => verificarSolicitud({
            peticion: { ...grande, approvals: await aprobar(grande, aprobadores.slice(0, 2)), tx: tx(grande) }, config, almacen,
        }), { code: 'LIMIT_PER_TX' });

        const primera = intencionReal('1000');
        const v = verificarSolicitud({ peticion: { ...primera, approvals: await aprobar(primera, aprobadores.slice(0, 2)), tx: tx(primera) }, config, almacen });
        almacen.registrar({ intentHash: primera.intentHash, nonce: 7, txHash: '0x1', carteraId: v.cartera.id, activo: 'BEZ', cantidad: v.cantidad.toString() });

        // Un reinicio no borra el gasto del día.
        const tras = crearAlmacen(dir);
        const segunda = intencionReal('600');
        await assert.rejects(async () => verificarSolicitud({
            peticion: { ...segunda, approvals: await aprobar(segunda, aprobadores.slice(0, 2)), tx: tx(segunda, { nonce: 8 }) }, config, almacen: tras,
        }), { code: 'LIMIT_DAILY' });
    });

    test('una intención firmada no se vuelve a firmar con otro nonce', async () => {
        const b = intencionReal();
        const approvals = await aprobar(b, aprobadores.slice(0, 2));
        const v = verificarSolicitud({ peticion: { ...b, approvals, tx: tx(b) }, config, almacen });
        almacen.registrar({ intentHash: b.intentHash, nonce: 7, txHash: '0x1', carteraId: v.cartera.id, activo: 'BEZ', cantidad: v.cantidad.toString() });
        assert.throws(() => verificarSolicitud({ peticion: { ...b, approvals, tx: tx(b, { nonce: 9 }) }, config, almacen }),
            { code: 'INTENT_ALREADY_SIGNED' });
        // Mismo nonce = reintento de difusión: se permite y no suma gasto.
        assert.ok(verificarSolicitud({ peticion: { ...b, approvals, tx: tx(b) }, config, almacen }));
    });

    test('gas fuera de tope y LOCKDOWN', async () => {
        const b = intencionReal();
        const approvals = await aprobar(b, aprobadores.slice(0, 2));
        assert.throws(() => verificarSolicitud({ peticion: { ...b, approvals, tx: tx(b, { gasLimit: '5000000' }) }, config, almacen }),
            { code: 'GAS_LIMIT_EXCEEDED' });
        fs.writeFileSync(path.join(dir, 'LOCKDOWN'), '');
        assert.throws(() => verificarSolicitud({ peticion: { ...b, approvals, tx: tx(b) }, config, almacen }), { code: 'LOCKDOWN' });
    });
});

describe('registro de activos del firmante', () => {
    test('BEZ sólo en Polygon, como en la API', () => {
        const { ACTIVOS_BASE } = require('../src/config');
        const { activoCripto } = require(path.join(API, 'config/tx-rails'));
        assert.equal(ACTIVOS_BASE[56].BEZ, undefined);
        assert.equal(activoCripto('BEZ', 56), null);
        for (const [chainId, mapa] of Object.entries(ACTIVOS_BASE)) {
            for (const [simbolo, def] of Object.entries(mapa)) {
                // Mismo contrato y decimales en los dos registros: si divergen, el
                // firmante rechaza lo que la API aprueba (o al revés).
                const api = activoCripto(simbolo, Number(chainId));
                assert.equal(api.address, def.address, `${simbolo}@${chainId}`);
                assert.equal(api.decimales, def.decimals, `${simbolo}@${chainId}`);
            }
        }
    });
});

describe('HMAC de la petición', () => {
    test('rechaza firma incorrecta, fuera de ventana y repetida', () => {
        const nonces = crearRegistroNonces();
        const cuerpo = '{"a":1}';
        const ts = String(Math.floor(Date.now() / 1000));
        const hash = crypto.createHash('sha256').update(cuerpo).digest('hex');
        const firma = crypto.createHmac('sha256', CLAVE_HMAC).update(`${ts}.n1.${hash}`).digest('hex');
        const h = { 'x-bezhas-timestamp': ts, 'x-bezhas-nonce': 'n1', 'x-bezhas-signature': firma };
        verificarHmac({ headers: h, cuerpo, clave: CLAVE_HMAC, nonces });
        assert.throws(() => verificarHmac({ headers: h, cuerpo, clave: CLAVE_HMAC, nonces }), { code: 'REQUEST_REPLAYED' });
        assert.throws(() => verificarHmac({ headers: { ...h, 'x-bezhas-nonce': 'n2' }, cuerpo, clave: CLAVE_HMAC, nonces }), { code: 'REQUEST_SIGNATURE_INVALID' });
        assert.throws(() => verificarHmac({ headers: { ...h, 'x-bezhas-timestamp': String(Number(ts) - 300) }, cuerpo, clave: CLAVE_HMAC, nonces }), { code: 'REQUEST_STALE' });
    });
});

describe('AWS KMS', () => {
    /** KMS simulado: firma con una clave local y responde en DER, como KMS. */
    function kmsFalso(clave, { sAlta = false } = {}) {
        const der = (n) => { let h = n.toString(16); if (h.length % 2) h = `0${h}`; let b = Buffer.from(h, 'hex'); if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return Buffer.concat([Buffer.from([0x02, b.length]), b]); };
        const spkiPrefijo = Buffer.from('3056301006072a8648ce3d020106052b8104000a034200', 'hex');
        return {
            async send(cmd) {
                if (cmd.tipo === 'pub') return { PublicKey: Buffer.concat([spkiPrefijo, Buffer.from(clave.publicKey.slice(2), 'hex')]) };
                const sig = clave.sign(ethers.hexlify(cmd.input.Message));
                let s = BigInt(sig.s);
                if (sAlta) s = N_SECP256K1 - s; // KMS puede devolver s alta
                const cuerpo = Buffer.concat([der(BigInt(sig.r)), der(s)]);
                return { Signature: Buffer.concat([Buffer.from([0x30, cuerpo.length]), cuerpo]) };
            },
        };
    }
    const comandos = {
        GetPublicKeyCommand: function GetPublicKeyCommand(input) { this.tipo = 'pub'; this.input = input; },
        SignCommand: function SignCommand(input) { this.tipo = 'sign'; this.input = input; },
    };

    for (const sAlta of [false, true]) {
        test(`convierte DER→(r,s,v) recuperable${sAlta ? ' con s alta normalizada' : ''}`, async () => {
            const clave = new ethers.SigningKey(ethers.Wallet.createRandom().privateKey);
            const p = proveedorAwsKms({ keyId: 'k', cliente: kmsFalso(clave, { sAlta }), comandos });
            assert.equal(await p.direccion(), ethers.computeAddress(clave.publicKey));
            const digest = ethers.keccak256(ethers.toUtf8Bytes('hola'));
            const firma = await p.firmarDigest(digest);
            assert.ok(BigInt(firma.s) <= N_SECP256K1 / 2n);
            assert.equal(ethers.recoverAddress(digest, firma), ethers.computeAddress(clave.publicKey));
        });
    }

    test('parsearFirmaDer rechaza basura', () => {
        assert.throws(() => parsearFirmaDer(Buffer.from('0102', 'hex')), { code: 'DER_INVALID' });
    });
});

describe('extremo a extremo: cliente de la API → servidor del firmante', () => {
    test('firma lo aprobado y la firma es de la tesorería', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signer-'));
        const config = configDePrueba({ dataDir: dir });
        const clave = new ethers.SigningKey(tesoreria.privateKey);
        const proveedores = new Map([['tesoreria-polygon', {
            async direccion() { return tesoreria.address; },
            async firmarDigest(d) { return clave.sign(d); },
        }]]);
        const servidor = await crearServidor({ config, almacen: crearAlmacen(dir), proveedores });
        await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
        const env = { TX_SIGNER_URL: `http://127.0.0.1:${servidor.address().port}`, TX_SIGNER_REQUEST_KEY: CLAVE_HMAC };
        try {
            const b = intencionReal();
            const r = await solicitarFirma({ ...b, approvals: await aprobar(b, aprobadores.slice(0, 2)), tx: tx(b) }, { env });
            const firmada = ethers.Transaction.from(r.signedTx);
            assert.equal(firmada.from, tesoreria.address);
            assert.equal(firmada.to.toLowerCase(), b.intent.tokenAddress.toLowerCase());
            assert.equal(firmada.hash, r.txHash);

            // Con la clave HMAC equivocada, el firmante ni mira la petición.
            await assert.rejects(solicitarFirma({ ...b, approvals: [], tx: tx(b) }, { env: { ...env, TX_SIGNER_REQUEST_KEY: 'x'.repeat(40) } }),
                { code: 'REQUEST_SIGNATURE_INVALID' });
        } finally {
            servidor.close();
        }
    });

    test('no arranca si la clave no es la de la cartera declarada', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signer-'));
        const otra = ethers.Wallet.createRandom();
        const proveedores = new Map([['tesoreria-polygon', { async direccion() { return otra.address; }, async firmarDigest() { throw new Error('no'); } }]]);
        await assert.rejects(crearServidor({ config: configDePrueba({ dataDir: dir }), almacen: crearAlmacen(dir), proveedores }),
            { code: 'WALLET_KEY_MISMATCH' });
    });
});
