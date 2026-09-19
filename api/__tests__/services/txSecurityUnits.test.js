/**
 * Piezas sueltas de la capa transaccional: red, intención, riesgo, política,
 * quórum de RPC, auditoría encadenada y vault de wallets.
 */
require('../helpers');
const crypto = require('crypto');
const { ethers } = require('ethers');

const cadenas = require('../../config/chain-policy');
const txIntent = require('../../services/txIntent');
const { evaluarRiesgo } = require('../../services/txRiskEngine');
const { evaluarPolitica } = require('../../services/txPolicyEngine');
const { Quorum } = require('../../services/rpcQuorum');
const auditoria = require('../../services/securityAudit');
const { getEntitlements } = require('../../config/plan-entitlements');

describe('chain-policy', () => {
    it('en producción sólo redes principales y la L2 por defecto', () => {
        const env = { NODE_ENV: 'production' };
        expect([...cadenas.cadenasPermitidas(env)].sort((a, b) => a - b)).toEqual([56, 137, 2708]);
        expect(cadenas.resolverCadena(undefined, env)).toMatchObject({ ok: true, chainId: 2708 });
        expect(cadenas.resolverCadena('31337', env)).toMatchObject({ ok: false, code: 'CHAIN_NOT_ALLOWED' });
        expect(cadenas.resolverCadena('97', env)).toMatchObject({ ok: false, code: 'CHAIN_NOT_ALLOWED' });
    });
    it('una testnet en producción sólo con ALLOWED_CHAIN_IDS explícito', () => {
        expect(cadenas.resolverCadena('97', { NODE_ENV: 'production', ALLOWED_CHAIN_IDS: '56,97' })).toMatchObject({ ok: true, entorno: 'testnet' });
    });
    it('rechaza basura y arrays de query', () => {
        expect(cadenas.resolverCadena('abc', {}).code).toBe('CHAIN_INVALID');
        expect(cadenas.resolverCadena(['1', '2'], {}).code).toBe('CHAIN_INVALID');
    });
});

describe('txIntent', () => {
    const base = (extra = {}) => ({
        rail: 'crypto_transfer', asset: 'USDC', amount: '12.5', network: 'polygon',
        source: { type: 'evm_address', value: ethers.Wallet.createRandom().address },
        destination: { type: 'evm_address', value: ethers.Wallet.createRandom().address },
        purpose: 'invoice_payment', idempotencyKey: 'clave-12345678', ...extra,
    });
    const norm = (e) => txIntent.normalizar(txIntent.parsear(e), { appId: 'a', env: { NODE_ENV: 'production' } });

    it('importes en unidades mínimas, sin coma flotante', () => {
        expect(norm(base()).amountMinor).toBe('12500000');
        expect(txIntent.aUnidadesMinimas('0.000000000000000001', 18)).toBe('1');
        expect(txIntent.desdeUnidadesMinimas('1050', 2)).toBe('10.5');
        expect(() => norm(base({ amount: '1.1234567' }))).toThrow(expect.objectContaining({ code: 'AMOUNT_PRECISION' }));
    });
    it('checksum incorrecto, dirección cero y el propio token se rechazan', () => {
        const a = ethers.Wallet.createRandom().address;
        const mal = a.slice(0, 2) + a.slice(2).split('').map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('');
        expect(() => norm(base({ destination: { type: 'evm_address', value: mal } }))).toThrow(expect.objectContaining({ code: 'ADDRESS_INVALID' }));
        expect(() => norm(base({ destination: { type: 'evm_address', value: ethers.ZeroAddress } }))).toThrow(expect.objectContaining({ code: 'ADDRESS_INVALID' }));
        expect(() => norm(base({ destination: { type: 'evm_address', value: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' } }))).toThrow(expect.objectContaining({ code: 'ADDRESS_INVALID' }));
    });
    it('BEZ sólo existe en Polygon: pedirlo en BSC se rechaza, no se «envía» a una dirección sin código', () => {
        // Verificado on-chain (2026-09-18): en BSC no hay contrato BEZ en ninguna de
        // las direcciones que citaban CLAUDE.md o deployments/56.json. Un transfer a
        // una dirección sin código no revierte: saldría como éxito sin mover nada.
        const { activoCripto } = require('../../config/tx-rails');
        expect(activoCripto('BEZ', 137).address).toBe('0xecba873b534c54de2b62acde232adca4369f11a8');
        expect(activoCripto('BEZ', 56)).toBeNull();
        expect(() => norm(base({ asset: 'BEZ', network: 'bsc', amount: '10' }))).toThrow(expect.objectContaining({ code: 'ASSET_NOT_SUPPORTED' }));
        expect(activoCripto('USDC', 56)).not.toBeNull();
    });
    it('sin red no hay intención cripto, y una red de pruebas no pasa en producción', () => {
        expect(() => norm(base({ network: undefined }))).toThrow(expect.objectContaining({ code: 'NETWORK_REQUIRED' }));
        expect(() => norm(base({ network: 'bsc-testnet' }))).toThrow(expect.objectContaining({ code: 'CHAIN_NOT_ALLOWED' }));
    });
    it('IBAN: módulo 97, longitud por país y SEPA', () => {
        expect(txIntent.validarIban('DE89 3704 0044 0532 0130 00')).toMatchObject({ valido: true, pais: 'DE', sepa: true });
        expect(txIntent.validarIban('ES91 2100 0418 4502 0005 1332')).toMatchObject({ valido: true, pais: 'ES' });
        expect(txIntent.validarIban('ES91 2100 0418 4502 0005 1333')).toMatchObject({ valido: false, motivo: 'digito_control' });
        expect(txIntent.validarIban('DE89 3704 0044 0532 0130')).toMatchObject({ valido: false, motivo: 'longitud' });
    });
    it('carril y activo tienen que casar', () => {
        expect(() => norm(base({ rail: 'fiat_to_fiat' }))).toThrow(expect.objectContaining({ code: 'INTENT_INCONSISTENT' }));
        expect(() => txIntent.parsear({ ...base(), inventado: 1 })).toThrow(expect.objectContaining({ code: 'INTENT_INVALID' }));
    });
    it('dos intenciones idénticas tienen hashes distintos (nonce)', () => {
        const e = base();
        expect(txIntent.hashIntencion(norm(e))).not.toBe(txIntent.hashIntencion(norm(e)));
    });
});

describe('txRiskEngine', () => {
    const intent = (dest = {}) => ({ destination: { type: 'iban', sepa: true, ...dest }, counterparty: null });
    it('jurisdicción bloqueada fuerza CRITICAL sin importar el resto', () => {
        expect(evaluarRiesgo(intent({ ibanCountry: 'IR' }), { destinoConocido: true, importeEur: 10 }).nivel).toBe('CRITICAL');
    });
    it('simulación que no casa fuerza CRITICAL; fallida, HIGH', () => {
        expect(evaluarRiesgo(intent(), { destinoConocido: true, importeEur: 1, simulacion: { ok: false, discrepancia: true } }).nivel).toBe('CRITICAL');
        expect(evaluarRiesgo(intent(), { destinoConocido: true, importeEur: 1, simulacion: { ok: false } }).nivel).toBe('HIGH');
    });
    it('fraccionamiento + destino nuevo suben a HIGH', () => {
        expect(evaluarRiesgo(intent(), { destinoConocido: false, importeEur: 900, cercaDeUmbral24h: 3 }).nivel).toBe('HIGH');
    });
    it('operación normal a destino conocido: LOW', () => {
        expect(evaluarRiesgo(intent(), { destinoConocido: true, destinoRecienteHoras: 500, importeEur: 100 }).nivel).toBe('LOW');
    });
});

describe('txPolicyEngine', () => {
    const intent = {
        rail: 'crypto_transfer', custody: 'self', source: { type: 'evm_address' },
        destination: { type: 'evm_address', value: '0x1' }, counterparty: null,
    };
    const ctx = (extra = {}) => ({
        intent, intentHash: `0x${'1'.repeat(64)}`, app: { scopes: ['wallet'] }, agente: null,
        operaciones: getEntitlements('business').operaciones, kycNivel: 1,
        uso: { diaEur: 0, mesEur: 0, agenteDiaEur: 0 }, importeEur: 100,
        destino: { estado: 'active' }, proveedor: null, riesgo: { nivel: 'LOW' }, killSwitch: { estado: 'NORMAL' }, ...extra,
    });
    it('el límite del agente manda si es más estricto', () => {
        const r = evaluarPolitica(ctx({ agente: { agentId: 'a', rails: ['crypto_transfer'], porOperacionEur: 50 } }));
        expect(r.decision).toBe('DENY');
        expect(r.motivos.map((m) => m.code)).toContain('LIMIT_PER_TX');
        expect(r.limites.porOperacionEur).toBe(50);
    });
    it('sin precio fiable: aprobación doble, nunca automático', () => {
        const r = evaluarPolitica(ctx({ importeEur: null }));
        expect(r).toMatchObject({ decision: 'REQUIRE_APPROVAL', requiredApprovals: 2 });
    });
    it('SUSPICIOUS añade una aprobación; el límite diario acumula', () => {
        expect(evaluarPolitica(ctx({ killSwitch: { estado: 'SUSPICIOUS' } })).requiredApprovals).toBe(2);
        expect(evaluarPolitica(ctx({ uso: { diaEur: 49950, mesEur: 0 } })).motivos.map((m) => m.code)).toContain('LIMIT_DAILY');
    });
    it('el policyHash cambia si cambia la decisión', () => {
        const a = evaluarPolitica(ctx());
        const b = evaluarPolitica(ctx({ riesgo: { nivel: 'MEDIUM' } }));
        expect(a.decision).toBe('ALLOW');
        expect(b.decision).toBe('REQUIRE_APPROVAL');
        expect(a.policyHash).not.toBe(b.policyHash);
    });
    it('starter no mueve dinero', () => {
        expect(evaluarPolitica(ctx({ operaciones: getEntitlements('starter').operaciones })).motivos.map((m) => m.code)).toContain('RAIL_NOT_IN_PLAN');
    });
});

describe('rpcQuorum', () => {
    const q = (respuestas) => new Quorum({
        chainId: 137, urls: respuestas.map((_, i) => `rpc${i}`),
        crearProveedor: (url) => ({ send: async () => respuestas[Number(url.slice(3))]() }),
    });
    it('mayoría coincide → valor', async () => {
        await expect(q([async () => '0x89', async () => '0x89', async () => '0x1']).comprobarCadena()).resolves.toBe(137);
    });
    it('discrepancia → RPC_INCONSISTENT; cadena equivocada → RPC_WRONG_CHAIN', async () => {
        await expect(q([async () => '0x89', async () => '0x1']).comprobarCadena()).rejects.toMatchObject({ code: 'RPC_INCONSISTENT' });
        await expect(q([async () => '0x1', async () => '0x1']).comprobarCadena()).rejects.toMatchObject({ code: 'RPC_WRONG_CHAIN' });
    });
    it('un solo RPC no es redundante', () => {
        expect(q([async () => '0x89']).redundante).toBe(false);
    });
});

describe('securityAudit', () => {
    function cadena(n) {
        const filas = [];
        let prev = auditoria.GENESIS;
        for (let i = 1; i <= n; i += 1) {
            const r = { seq: String(i), prevHash: prev, occurredAt: new Date(2026, 8, i).toISOString(), appId: 'a', agentId: null, actor: 'x', eventType: 'e', intentId: null, payload: { i } };
            const hash = auditoria.hashRegistro(r);
            filas.push({ seq: r.seq, prev_hash: prev, hash, occurred_at: r.occurredAt, app_id: 'a', agent_id: null, actor: 'x', event_type: 'e', intent_id: null, payload: { i } });
            prev = hash;
        }
        return filas;
    }
    it('detecta un registro reescrito', () => {
        const filas = cadena(4);
        expect(auditoria.verificarCadena(filas)).toEqual({ ok: true, n: 4 });
        filas[2].payload = { i: 999 };
        expect(auditoria.verificarCadena(filas)).toMatchObject({ ok: false, rotoEn: '3' });
    });
    it('redacta secretos aunque se pasen por descuido', () => {
        expect(auditoria.redactar({ privateKey: 'x', nested: { apiKey: 'y', ok: 1 }, tokenAddress: '0x1' }))
            .toEqual({ privateKey: '[redactado]', nested: { apiKey: '[redactado]', ok: 1 }, tokenAddress: '0x1' });
    });
});

describe('walletVaultService', () => {
    const vault = require('../../services/walletVaultService');
    const SECRETO = 's'.repeat(40);
    const w = ethers.Wallet.createRandom();
    const env = { NODE_ENV: 'production', WALLET_VAULT_SECRET: SECRETO, JWT_SECRET: 'j'.repeat(40) };

    it('cifra ligado a la dirección: copiarlo a otra fila no descifra', () => {
        const c = vault.encryptPrivateKey(w.privateKey, { address: w.address, env });
        expect(c.startsWith('v2:')).toBe(true);
        expect(vault.decryptPrivateKey(c, { address: w.address, env })).toBe(w.privateKey);
        expect(() => vault.decryptPrivateKey(c, { address: ethers.Wallet.createRandom().address, env })).toThrow();
    });
    it('en producción no acepta JWT_SECRET como clave del vault, ni ausencia de clave', () => {
        expect(() => vault.comprobarConfiguracion({ NODE_ENV: 'production', JWT_SECRET: SECRETO })).toThrow(expect.objectContaining({ code: 'VAULT_NOT_CONFIGURED' }));
        expect(() => vault.comprobarConfiguracion({ NODE_ENV: 'production', WALLET_VAULT_SECRET: SECRETO, JWT_SECRET: SECRETO })).toThrow(expect.objectContaining({ code: 'VAULT_SECRET_REUSED' }));
        expect(() => vault.comprobarConfiguracion({ NODE_ENV: 'production', WALLET_VAULT_SECRET: 'corto' })).toThrow(expect.objectContaining({ code: 'VAULT_SECRET_WEAK' }));
    });
    it('lee los registros v1 existentes y rota a la versión nueva', () => {
        // v1: sha256(secreto), sin AAD — el formato que ya hay en la base.
        const clave = crypto.createHash('sha256').update(env.JWT_SECRET).digest();
        const iv = crypto.randomBytes(12);
        const ci = crypto.createCipheriv('aes-256-gcm', clave, iv);
        const ct = Buffer.concat([ci.update(w.privateKey, 'utf8'), ci.final()]);
        const v1 = ['v1', iv.toString('base64url'), ci.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':');
        // Sin declarar el secreto antiguo: se prueba JWT_SECRET aunque ya exista WALLET_VAULT_SECRET.
        expect(vault.decryptPrivateKey(v1, { address: w.address, env })).toBe(w.privateKey);
        const envLegacy = { ...env, WALLET_VAULT_LEGACY_SECRET: env.JWT_SECRET };
        expect(vault.decryptPrivateKey(v1, { address: w.address, env: envLegacy })).toBe(w.privateKey);
        expect(() => vault.decryptPrivateKey(v1, { address: w.address, env: { NODE_ENV: 'production', WALLET_VAULT_SECRET: SECRETO } }))
            .toThrow(expect.objectContaining({ code: 'VAULT_DECRYPT_FAILED' }));

        const envRotado = { ...envLegacy, WALLET_VAULT_KEYS: `3:${'n'.repeat(40)},2:${SECRETO}` };
        const v2 = vault.encryptPrivateKey(w.privateKey, { address: w.address, env });
        expect(vault.decryptPrivateKey(v2, { address: w.address, env: envRotado })).toBe(w.privateKey);
        expect(vault.encryptPrivateKey(w.privateKey, { address: w.address, env: envRotado }).startsWith('v3:')).toBe(true);
    });
    it('la firma con wallets custodiadas está apagada por defecto', async () => {
        await expect(vault.getManagedSigner(1, null)).rejects.toMatchObject({ code: 'MANAGED_CUSTODY_DISABLED' });
    });
});
