/**
 * POST /kyc/session — crea la sesión de Didit para una wallet propia.
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

jest.mock('../../services/kyc/diditAdapter', () => ({
    ...jest.requireActual('../../services/kyc/diditAdapter'),
    createSession: jest.fn(),
}));
const diditAdapter = require('../../services/kyc/diditAdapter');
const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const API_KEY = 'test-gateway-key';
const WALLET = '0x' + 'f'.repeat(40);
const OTHER = '0x' + '1'.repeat(40);
const APP_ROW = {
    id: 7, app_name: 'test-app', scopes: ['wallet'], tier: 'business', is_active: true,
    enterprise_id: null, authorized_addresses: [WALLET], address_access_mode: 'strict',
};
const mockAppAuth = () => mockQuery.mockResolvedValueOnce({ rows: [APP_ROW], rowCount: 1 });

describe('POST /kyc/session', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        diditAdapter.createSession.mockReset();
        process.env = {
            ...OLD_ENV,
            DIDIT_API_KEY: 'k_test',
            DIDIT_WORKFLOW_ID: 'wf-sandbox',
            DIDIT_CALLBACK_URL: 'https://bezhas.com/kyc/done',
        };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    it('devuelve la URL de verificación para la wallet propia', async () => {
        mockAppAuth();
        diditAdapter.createSession.mockResolvedValue({ sessionId: 'sess-9', url: 'https://verify.didit.me/session/x' });
        const res = await request(app)
            .post('/api/gateway/v1/kyc/session')
            .set('x-api-key', API_KEY)
            .send({ walletAddress: WALLET });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, sessionId: 'sess-9', url: 'https://verify.didit.me/session/x' });
        expect(diditAdapter.createSession).toHaveBeenCalledWith({
            walletAddress: WALLET,
            workflowId: 'wf-sandbox',
            callbackUrl: 'https://bezhas.com/kyc/done',
        });
    });

    it('403 si la wallet no pertenece a la app', async () => {
        mockAppAuth();
        const res = await request(app)
            .post('/api/gateway/v1/kyc/session')
            .set('x-api-key', API_KEY)
            .send({ walletAddress: OTHER });
        expect(res.status).toBe(403);
        expect(diditAdapter.createSession).not.toHaveBeenCalled();
    });

    it('503 si falta configuración del proveedor, sin llamar a Didit', async () => {
        mockAppAuth();
        delete process.env.DIDIT_WORKFLOW_ID;
        const res = await request(app)
            .post('/api/gateway/v1/kyc/session')
            .set('x-api-key', API_KEY)
            .send({ walletAddress: WALLET });
        expect(res.status).toBe(503);
        expect(diditAdapter.createSession).not.toHaveBeenCalled();
    });

    it('502 si Didit rechaza la creación', async () => {
        mockAppAuth();
        diditAdapter.createSession.mockRejectedValue(new Error('Didit createSession HTTP 403'));
        const res = await request(app)
            .post('/api/gateway/v1/kyc/session')
            .set('x-api-key', API_KEY)
            .send({ walletAddress: WALLET });
        expect(res.status).toBe(502);
    });
});
