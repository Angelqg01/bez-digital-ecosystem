'use strict';
/** /api/purescan en el punto de entrada real (index.js): montado, con sesión y con la excepción del agente. */
const request = require('supertest');
const { makeToken } = require('../helpers');

const mockSvc = {
    createScan: jest.fn(), getScan: jest.fn(), listScans: jest.fn(), setScanStatus: jest.fn(), completeScan: jest.fn(),
    recordFeedback: jest.fn(), createDpp: jest.fn(), getDpp: jest.fn(), listInventory: jest.fn().mockResolvedValue([]),
    upsertInventory: jest.fn(), getAnalytics: jest.fn().mockResolvedValue({}), getNodeDid: jest.fn(), ANALYZE_TASK_TYPE: 'purescan.analyze',
};
jest.mock('../../services/pureScanService', () => mockSvc);

const app = require('../../index');

describe('/api/purescan montado en index.js', () => {
    it('ya no da 404 y exige sesión', async () => {
        const res = await request(app).get('/api/purescan/inventory');
        expect(res.status).toBe(401);
    });

    it('con sesión sirve el inventario', async () => {
        const res = await request(app).get('/api/purescan/inventory').set('Authorization', `Bearer ${makeToken()}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('/inference responde 503 honesto con sesión', async () => {
        const res = await request(app).post('/api/purescan/inference').set('Authorization', `Bearer ${makeToken()}`).send({});
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('INFERENCE_UNAVAILABLE');
    });

    it('sin runtime de agentes /analyze responde 503 (no inventa un análisis)', async () => {
        mockSvc.createScan.mockResolvedValue({ scan_ref: 'SCAN-X', status: 'unavailable' });
        const res = await request(app).post('/api/purescan/analyze').set('Authorization', `Bearer ${makeToken()}`).send({ sku: 'S' });
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/agente/);
    });

    it('la escritura del resultado NO pide JWT: usa la clave interna', async () => {
        const res = await request(app).post('/api/purescan/scans/SCAN-X/result').send({ analysis: {} });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized'); // el del router (clave interna), no el de authenticateToken
    });
});
