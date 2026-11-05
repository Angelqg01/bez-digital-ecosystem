/**
 * Hot Wallet de BeZhas en /admin/profile: sólo SuperAdmin, sobre el orquestador de tesorería.
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { mockQuery } = require('../helpers');
const { JWT_SECRET } = require('../../config/secrets');

const mockOrq = { crearIntencion: jest.fn(), obtener: jest.fn(), aprobar: jest.fn(), ejecutar: jest.fn(), cancelar: jest.fn() };
jest.mock('../../services/txOrchestrator', () => ({ orquestador: () => mockOrq }));
jest.mock('../../services/killSwitch', () => ({ estadoEfectivo: jest.fn().mockResolvedValue({ estado: 'NORMAL' }) }));

const rutas = require('../../routes/admin-hot-wallet');
const app = express();
app.use(express.json());
app.use('/api/admin-hot-wallet', rutas);

const TREASURY_APP = '77777777-7777-4777-8777-777777777777';
const INTENT = '88888888-8888-4888-8888-888888888888';
const DESTINO = '0x' + '4'.repeat(40);
const token = () => jwt.sign({ role: 'SUPER_ADMIN', sub: 'yoel' }, JWT_SECRET, { expiresIn: '1h', issuer: 'bezhas-admin-auth' });
const admin = (r) => r.set('Authorization', `Bearer ${token()}`);

describe('Hot Wallet (SuperAdmin)', () => {
    beforeEach(() => {
        process.env.BEZPAY_TREASURY_APP_ID = TREASURY_APP;
        delete process.env.POLYGON_RPC_URL;
        delete process.env.TX_TREASURY_ADDRESS_137;
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        Object.values(mockOrq).forEach((f) => f.mockReset());
    });

    it('401 sin sesión SuperAdmin; un JWT de usuario no vale', async () => {
        expect((await request(app).get('/api/admin-hot-wallet')).status).toBe(401);
        const usuario = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        expect((await request(app).get('/api/admin-hot-wallet').set('Authorization', `Bearer ${usuario}`)).status).toBe(401);
    });

    it('resumen: Hot Wallet registrada, aprobadores de tesorería y si hay quórum', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { address: '0x' + '1'.repeat(40), label: 'MetaMask Yoel', status: 'active', expires_at: null },
                { address: '0x' + '2'.repeat(40), label: 'MetaMask 2', status: 'active', expires_at: null },
                { address: '0x' + '3'.repeat(40), label: 'MetaMask 3', status: 'revoked', expires_at: null },
            ],
        });
        const res = await admin(request(app).get('/api/admin-hot-wallet'));
        expect(res.status).toBe(200);
        expect(res.body.hotWallet.address).toBe('0x52Df82920CBAE522880dD7657e43d1A754eD044E');
        expect(res.body.hotWallet.configured).toBe(false);
        expect(res.body.approvers).toHaveLength(3);
        expect(res.body.policy).toEqual({ minApprovals: 2, activeApprovers: 2, ready: true });
        expect(JSON.stringify(res.body)).not.toMatch(/private|secret/i);
        const sql = String(mockQuery.mock.calls[0][0]);
        expect(sql).toContain('app_id IS NULL');
        expect(sql).toContain("'treasury' = ANY(roles)");
    });

    it('avisa si la dirección desplegada no es la registrada', async () => {
        process.env.TX_TREASURY_ADDRESS_137 = '0x' + '9'.repeat(40);
        const res = await admin(request(app).get('/api/admin-hot-wallet'));
        expect(res.body.hotWallet.matchesRegistered).toBe(false);
    });

    it('proponer: crypto_transfer desde bezhas_treasury con la app de tesorería', async () => {
        mockOrq.crearIntencion.mockResolvedValue({ id: INTENT, estado: 'awaiting_approval', aprobacionesRequeridas: 2 });
        const res = await admin(request(app).post('/api/admin-hot-wallet/intents'))
            .send({ asset: 'BEZ', amount: '1500', destination: DESTINO, destinationName: 'Proveedor SL' });
        expect(res.status).toBe(201);
        const { entrada, app: a, canal } = mockOrq.crearIntencion.mock.calls[0][0];
        expect(entrada).toEqual(expect.objectContaining({
            rail: 'crypto_transfer', asset: 'BEZ', amount: '1500', source: { type: 'bezhas_treasury' }, purpose: 'treasury',
        }));
        expect(entrada.destination.value).toBe(DESTINO);
        expect(a.id).toBe(TREASURY_APP);
        expect(canal).toBe('admin-hot-wallet');
    });

    it.each([
        ['activo no admitido', { asset: 'ETH', amount: '1', destination: DESTINO }],
        ['destino no es dirección', { asset: 'BEZ', amount: '1', destination: 'ES77 1465' }],
    ])('400 si %s', async (_c, body) => {
        const res = await admin(request(app).post('/api/admin-hot-wallet/intents')).send(body);
        expect(res.status).toBe(400);
        expect(mockOrq.crearIntencion).not.toHaveBeenCalled();
    });

    it('la firma de MetaMask pasa tal cual al orquestador, que es quien decide', async () => {
        mockOrq.aprobar.mockResolvedValue({ id: INTENT, estado: 'approved' });
        const firma = '0x' + 'ab'.repeat(65);
        const res = await admin(request(app).post(`/api/admin-hot-wallet/intents/${INTENT}/approvals`)).send({ signature: firma });
        expect(res.status).toBe(200);
        expect(mockOrq.aprobar).toHaveBeenCalledWith(expect.objectContaining({ id: INTENT, firma, decision: 'APPROVE' }));
    });

    it('un aprobador no registrado lo rechaza el orquestador (403)', async () => {
        mockOrq.aprobar.mockRejectedValue(Object.assign(new Error('No es aprobador.'), { code: 'APPROVER_NOT_AUTHORIZED', status: 403 }));
        const res = await admin(request(app).post(`/api/admin-hot-wallet/intents/${INTENT}/approvals`)).send({ signature: '0x' + 'ab'.repeat(65) });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('APPROVER_NOT_AUTHORIZED');
    });

    it('503 si no hay app de tesorería configurada', async () => {
        delete process.env.BEZPAY_TREASURY_APP_ID;
        const res = await admin(request(app).get('/api/admin-hot-wallet/intents'));
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('TREASURY_APP_NOT_CONFIGURED');
    });
});
