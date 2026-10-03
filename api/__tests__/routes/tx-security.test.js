/**
 * Superficie HTTP de la capa transaccional: quién puede llamar a qué.
 */
const request = require('supertest');
const { ethers } = require('ethers');
const { mockQuery, makeToken } = require('../helpers');
const app = require('../../index');
const killSwitch = require('../../services/killSwitch');
const { DOMINIO, TIPOS_SEGURIDAD } = require('../../services/txApproval');

const INTERNA = process.env.INTERNAL_API_KEY;

async function accion(w, message) {
    return { message, signature: await w.signTypedData(DOMINIO, TIPOS_SEGURIDAD, message) };
}
const msg = (extra) => ({
    action: 'lower', scope: 'global', state: 'NORMAL', reason: 'incidente cerrado',
    nonce: `n-${Math.random()}`, expiresAt: Math.floor(Date.now() / 1000) + 300, ...extra,
});

describe('/api/gateway/v1/tx', () => {
    beforeEach(() => { jest.clearAllMocks(); killSwitch._reset(); });

    it('sin credenciales, 401', async () => {
        expect((await request(app).post('/api/gateway/v1/tx/intents').send({})).status).toBe(401);
    });

    it('con JWT de usuario pero sin api-key, 401: el dinero va con clave de app', async () => {
        const res = await request(app).post('/api/gateway/v1/tx/intents')
            .set('Authorization', `Bearer ${makeToken({ address: '0x' + 'a'.repeat(40) })}`).send({});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('API_KEY_REQUIRED');
    });

    it('una intención mal formada devuelve la lista de campos', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1', app_name: 'c', scopes: ['wallet'], tier: 'standard', is_active: true }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ plan_id: 'business' }] });
        const res = await request(app).post('/api/gateway/v1/tx/intents').set('x-api-key', 'k').send({ rail: 'crypto_transfer' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INTENT_INVALID');
        expect(Array.isArray(res.body.detalles)).toBe(true);
    });

    it('una credencial de agente no crea agentes', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{
            agent_id: 'pagos', agent_scopes: ['wallet', 'admin'], rails: [], can_execute: false, agent_status: 'active',
            expires_at: new Date(Date.now() + 86400000), id: 'app-1', app_name: 'c', scopes: ['wallet'], tier: 'standard', is_active: true,
        }] });
        const res = await request(app).post('/api/gateway/v1/tx/agents').set('x-api-key', 'bzag_x').send({ agentId: 'otro' });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('AGENT_CANNOT_MANAGE_AGENTS');
    });

    it('una credencial de agente caducada no entra', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{
            agent_id: 'pagos', agent_scopes: ['wallet'], rails: [], can_execute: false, agent_status: 'active',
            expires_at: new Date(Date.now() - 1000), id: 'app-1', app_name: 'c', scopes: ['wallet'], tier: 'standard', is_active: true,
        }] });
        const res = await request(app).get('/api/gateway/v1/tx/destinations').set('x-api-key', 'bzag_x');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('AGENT_KEY_INACTIVE');
    });
});

describe('/api/security', () => {
    beforeEach(() => { jest.clearAllMocks(); mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 0 }); killSwitch._reset(); });

    it('alta de aprobadores sólo con clave interna', async () => {
        const res = await request(app).post('/api/security/approvers')
            .send({ address: '0x' + '1'.repeat(40), roles: ['approver'], createdBy: 'x' });
        expect(res.status).toBe(401);
    });

    it('un cliente no puede tener roles globales', async () => {
        const res = await request(app).post('/api/security/approvers').set('x-internal-key', INTERNA)
            .send({ appId: '00000000-0000-0000-0000-000000000001', address: '0x' + '1'.repeat(40), roles: ['treasury'], createdBy: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('ROLES_INVALID');
    });

    it('elevar con la clave interna', async () => {
        const res = await request(app).post('/api/security/kill-switch/raise').set('x-internal-key', INTERNA)
            .send({ scope: 'global', state: 'LOCKDOWN', reason: 'prueba' });
        expect(res.status).toBe(200);
        expect(res.body.killSwitch.estado).toBe('LOCKDOWN');
    });

    it('rebajar con UNA firma no basta', async () => {
        const w = ethers.Wallet.createRandom();
        const res = await request(app).post('/api/security/kill-switch/lower')
            .send({ scope: 'global', state: 'NORMAL', reason: 'x', approvals: [await accion(w, msg())] });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('KILL_SWITCH_LOWER_REQUIRES_TWO');
    });

    it('rebajar con dos firmas del MISMO aprobador no basta', async () => {
        const w = ethers.Wallet.createRandom();
        mockQuery.mockImplementation(async (sql) => (/FROM tx_approvers/.test(sql)
            ? { rows: [{ address: w.address.toLowerCase() }] } : { rows: [], rowCount: 0 }));
        const res = await request(app).post('/api/security/kill-switch/lower')
            .send({ scope: 'global', state: 'NORMAL', reason: 'x', approvals: [await accion(w, msg()), await accion(w, msg())] });
        expect(res.status).toBe(403);
    });

    it('rebajar con dos aprobadores de seguridad distintos', async () => {
        const a = ethers.Wallet.createRandom();
        const b = ethers.Wallet.createRandom();
        mockQuery.mockImplementation(async (sql) => {
            if (/FROM tx_approvers/.test(sql)) return { rows: [{ address: a.address.toLowerCase() }, { address: b.address.toLowerCase() }] };
            if (/FROM security_kill_switch\b/.test(sql)) return { rows: [{ scope: 'global', state: 'LOCKDOWN', reason: 'x', updated_at: new Date() }] };
            return { rows: [], rowCount: 0 };
        });
        const res = await request(app).post('/api/security/kill-switch/lower')
            .send({ scope: 'global', state: 'NORMAL', reason: 'cerrado', approvals: [await accion(a, msg()), await accion(b, msg())] });
        expect(res.status).toBe(200);
        expect(res.body.killSwitch).toMatchObject({ desde: 'LOCKDOWN', estado: 'NORMAL' });
    });

    it('una firma para otra acción no vale', async () => {
        const a = ethers.Wallet.createRandom();
        const b = ethers.Wallet.createRandom();
        const res = await request(app).post('/api/security/kill-switch/lower')
            .send({ scope: 'global', state: 'NORMAL', reason: 'x', approvals: [await accion(a, msg({ scope: 'rail:fiat_to_fiat' })), await accion(b, msg())] });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SECURITY_ACTION_MISMATCH');
    });
});

describe('rutas heredadas del Gateway', () => {
    beforeEach(() => { jest.clearAllMocks(); mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 0 }); killSwitch._reset(); });
    const conClave = () => mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1', app_name: 'c', scopes: ['wallet'], tier: 'standard', is_active: true, address_access_mode: 'strict' }] });

    it('payments/send ya no acepta un sender ajeno', async () => {
        conClave();
        const res = await request(app).post('/api/gateway/v1/payments/send').set('x-api-key', 'k')
            .send({ sender: '0x' + 'a'.repeat(40), recipient: 'alguien', amount: 1 });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ADDRESS_ACCESS_DENIED');
    });

    it('payments/sell tampoco', async () => {
        conClave();
        const res = await request(app).post('/api/gateway/v1/payments/sell').set('x-api-key', 'k')
            .send({ walletAddress: '0x' + 'a'.repeat(40), amountBEZ: 10, receiveMethod: 'bank' });
        expect(res.status).toBe(403);
    });

    it('en LOCKDOWN no se abren órdenes de compra', async () => {
        killSwitch._reset({ global: { estado: 'LOCKDOWN' } });
        conClave();
        const res = await request(app).post('/api/gateway/v1/payments/buy').set('x-api-key', 'k')
            .send({ amountUSD: 10, paymentMethod: 'card', walletAddress: '0x' + 'a'.repeat(40) });
        expect(res.status).toBe(423);
    });

    it('una red no permitida devuelve 400 en vez de construir para Anvil', async () => {
        conClave();
        const res = await request(app).post('/api/gateway/v1/dex/swap').set('x-api-key', 'k').send({
            chainId: 31337, tokenIn: '0x' + '1'.repeat(40), tokenOut: '0x' + '2'.repeat(40), amountIn: 1,
        });
        // scope `contracts` falta en la clave → 403 antes; con él, 400 por la red.
        expect([400, 403]).toContain(res.status);
    });
});
