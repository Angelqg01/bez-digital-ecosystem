/**
 * POST /api/webhooks/kyc/didit — firma, subida de nivel y no bajada.
 */
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

jest.mock('../../services/complianceGate', () => ({
    getKycLevel: jest.fn(),
    setKycLevel: jest.fn(),
}));
const complianceGate = require('../../services/complianceGate');
const kycWebhookRoutes = require('../../routes/kycWebhooks');
const didit = require('../../services/kyc/diditAdapter');

const SECRET = 'didit_route_secret';
const WALLET = '0x' + 'c'.repeat(40);

const app = express();
app.use('/api/webhooks/kyc', kycWebhookRoutes);

// La firma cubre el cuerpo entero, incluido `timestamp`; por eso se firma el
// evento ya completo. String, no Buffer: superagent serializaría un Buffer.
function signedRequest(event, { secret = SECRET } = {}) {
    const sig = crypto.createHmac('sha256', secret).update(didit.canonicalJson(event)).digest('hex');
    return request(app)
        .post('/api/webhooks/kyc/didit')
        .set('content-type', 'application/json')
        .set('x-signature-v2', sig)
        .send(JSON.stringify(event));
}

const now = () => Math.floor(Date.now() / 1000);

const APPROVED = {
    event_id: 'evt-1',
    session_id: 'sess-1',
    status: 'Approved',
    webhook_type: 'status.updated',
    timestamp: now(),
    vendor_data: WALLET,
    workflow_id: 'wf-level1',
};

describe('POST /api/webhooks/kyc/didit', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...OLD_ENV, DIDIT_WEBHOOK_SECRET: SECRET, DIDIT_LEVEL2_WORKFLOW_ID: 'wf-aml' };
        complianceGate.getKycLevel.mockResolvedValue({ level: 0, provider: null, verifiedAt: null });
        complianceGate.setKycLevel.mockImplementation(async ({ walletAddress, level }) => ({ wallet_address: walletAddress, level }));
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    it('503 si el secreto no está configurado', async () => {
        delete process.env.DIDIT_WEBHOOK_SECRET;
        const res = await signedRequest(APPROVED);
        expect(res.status).toBe(503);
        expect(complianceGate.setKycLevel).not.toHaveBeenCalled();
    });

    it('401 con firma de otro secreto, sin tocar el nivel', async () => {
        const res = await signedRequest(APPROVED, { secret: 'otro' });
        expect(res.status).toBe(401);
        expect(complianceGate.setKycLevel).not.toHaveBeenCalled();
    });

    it('401 con timestamp del cuerpo caducado', async () => {
        const res = await signedRequest({ ...APPROVED, timestamp: now() - 3600 });
        expect(res.status).toBe(401);
    });

    it('400 con cuerpo que no es JSON válido', async () => {
        const res = await request(app)
            .post('/api/webhooks/kyc/didit')
            .set('content-type', 'application/json')
            .send('{no-json');
        expect(res.status).toBe(400);
    });

    it('Approved sube la wallet a nivel 1 con el provider didit', async () => {
        const res = await signedRequest(APPROVED);
        expect(res.status).toBe(200);
        expect(complianceGate.setKycLevel).toHaveBeenCalledWith({
            walletAddress: WALLET,
            level: 1,
            provider: 'didit',
            reference: 'sess-1',
        });
    });

    it('Approved del workflow de nivel 2 sube a nivel 2', async () => {
        await signedRequest({ ...APPROVED, workflow_id: 'wf-aml' });
        expect(complianceGate.setKycLevel).toHaveBeenCalledWith(expect.objectContaining({ level: 2 }));
    });

    it('no baja el nivel si un evento tardío repite un nivel inferior', async () => {
        complianceGate.getKycLevel.mockResolvedValue({ level: 2, provider: 'didit', verifiedAt: 'x' });
        const res = await signedRequest(APPROVED);
        expect(res.body).toEqual({ success: true, unchanged: true });
        expect(complianceGate.setKycLevel).not.toHaveBeenCalled();
    });

    it('Declined / In Review se reconocen sin cambiar el nivel', async () => {
        const res = await signedRequest({ ...APPROVED, status: 'Declined' });
        expect(res.body).toEqual({ success: true, ignored: true });
        expect(complianceGate.setKycLevel).not.toHaveBeenCalled();
    });

    it('sin wallet válida en vendor_data se acusa recibo sin cambios', async () => {
        const res = await signedRequest({ ...APPROVED, vendor_data: 'usuario-42' });
        expect(res.body.ignored).toBe(true);
        expect(complianceGate.setKycLevel).not.toHaveBeenCalled();
    });

    it('500 si la base de datos falla, para que Didit reintente', async () => {
        complianceGate.setKycLevel.mockRejectedValue(new Error('db down'));
        const res = await signedRequest(APPROVED);
        expect(res.status).toBe(500);
    });
});
