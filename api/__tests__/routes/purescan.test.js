'use strict';

const express = require('express');
const request = require('supertest');

const mockSvc = {
    createScan: jest.fn(),
    getScan: jest.fn(),
    listScans: jest.fn(),
    setScanStatus: jest.fn(),
    completeScan: jest.fn(),
    recordFeedback: jest.fn(),
    createDpp: jest.fn(),
    getDpp: jest.fn(),
    listInventory: jest.fn(),
    upsertInventory: jest.fn(),
    getAnalytics: jest.fn(),
    getNodeDid: jest.fn(),
    ANALYZE_TASK_TYPE: 'purescan.analyze',
};
jest.mock('../../services/pureScanService', () => mockSvc);

const purescanRouter = require('../../routes/purescan');

function appWith({ manager = null, bridge = null } = {}) {
    const app = express();
    app.use(express.json());
    app.use('/api/purescan', purescanRouter(manager, bridge));
    return app;
}

beforeEach(() => {
    Object.values(mockSvc).forEach((fn) => typeof fn === 'function' && fn.mockReset());
});

describe('POST /analyze — contrato de sondeo', () => {
    it('devuelve 202 con la referencia y la URL a sondear', async () => {
        mockSvc.createScan.mockResolvedValue({
            scan_ref: 'SCAN-AAA', status: 'analyzing', taskId: 'task-1',
        });

        const res = await request(appWith({ manager: {} }))
            .post('/api/purescan/analyze')
            .send({ sku: 'SKU-1', product: 'Aguacates', image: 'base64' });

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({
            success: true,
            scanRef: 'SCAN-AAA',
            status: 'analyzing',
            taskId: 'task-1',
            poll: '/api/purescan/scans/SCAN-AAA',
        });
    });

    it('pasa al servicio los campos conocidos y el resto como payload', async () => {
        mockSvc.createScan.mockResolvedValue({ scan_ref: 'SCAN-AAA', status: 'analyzing' });

        await request(appWith({ manager: {} }))
            .post('/api/purescan/analyze')
            .send({ sku: 'SKU-1', batch: 'B-1', image: 'base64', device: 'edge-7' });

        expect(mockSvc.createScan).toHaveBeenCalledWith(
            expect.objectContaining({
                sku: 'SKU-1', batch: 'B-1',
                payload: { image: 'base64', device: 'edge-7' },
            }),
            expect.anything()
        );
    });

    it('devuelve 503 en vez de un análisis inventado si no hay runtime', async () => {
        mockSvc.createScan.mockResolvedValue({ scan_ref: 'SCAN-AAA', status: 'unavailable' });

        const res = await request(appWith()).post('/api/purescan/analyze').send({ sku: 'SKU-1' });

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);
        expect(res.body.status).toBe('unavailable');
    });

    it('devuelve 500 si el servicio revienta, sin colgar la petición', async () => {
        mockSvc.createScan.mockRejectedValue(new Error('DB caída'));

        const res = await request(appWith({ manager: {} }))
            .post('/api/purescan/analyze').send({});

        expect(res.status).toBe(500);
        expect(res.body).toMatchObject({ success: false, error: 'DB caída' });
    });
});

describe('GET /scans/:ref', () => {
    it('devuelve el estado mientras el análisis está en curso', async () => {
        mockSvc.getScan.mockResolvedValue({
            scan_ref: 'SCAN-AAA', status: 'analyzing', analysis: null,
        });

        const res = await request(appWith()).get('/api/purescan/scans/SCAN-AAA');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'analyzing', analysis: null });
    });

    it('devuelve el análisis cuando termina', async () => {
        mockSvc.getScan.mockResolvedValue({
            scan_ref: 'SCAN-AAA', status: 'completed',
            analysis: { product_type: 'Aguacates' }, risk_level: 'LOW',
        });

        const res = await request(appWith()).get('/api/purescan/scans/SCAN-AAA');

        expect(res.body).toMatchObject({
            status: 'completed',
            analysis: { product_type: 'Aguacates' },
            riskLevel: 'LOW',
        });
    });

    it('404 si la referencia no existe', async () => {
        mockSvc.getScan.mockResolvedValue(null);

        const res = await request(appWith()).get('/api/purescan/scans/SCAN-NOPE');

        expect(res.status).toBe(404);
    });
});

describe('POST /scans/:ref/result — escritura del agente', () => {
    const saved = process.env.INTERNAL_API_KEY;
    beforeEach(() => { process.env.INTERNAL_API_KEY = 'clave-interna'; });
    afterEach(() => {
        if (saved === undefined) delete process.env.INTERNAL_API_KEY;
        else process.env.INTERNAL_API_KEY = saved;
    });

    it('rechaza sin la clave interna: decide si un lote de comida es apto', async () => {
        const res = await request(appWith())
            .post('/api/purescan/scans/SCAN-AAA/result')
            .send({ analysis: { risk_level: 'LOW' } });

        expect(res.status).toBe(401);
        expect(mockSvc.completeScan).not.toHaveBeenCalled();
    });

    it('rechaza con una clave equivocada', async () => {
        const res = await request(appWith())
            .post('/api/purescan/scans/SCAN-AAA/result')
            .set('x-internal-key', 'otra')
            .send({ analysis: {} });

        expect(res.status).toBe(401);
    });

    it('guarda el análisis con la clave correcta', async () => {
        mockSvc.completeScan.mockResolvedValue({ status: 'completed', risk_level: 'LOW' });

        const res = await request(appWith())
            .post('/api/purescan/scans/SCAN-AAA/result')
            .set('x-internal-key', 'clave-interna')
            .send({ analysis: { risk_level: 'LOW' } });

        expect(res.status).toBe(200);
        expect(mockSvc.completeScan).toHaveBeenCalledWith('SCAN-AAA', { risk_level: 'LOW' });
    });

    it('registra el fallo cuando el agente reporta error', async () => {
        mockSvc.setScanStatus.mockResolvedValue({ id: 1, status: 'failed' });

        const res = await request(appWith())
            .post('/api/purescan/scans/SCAN-AAA/result')
            .set('x-internal-key', 'clave-interna')
            .send({ error: 'modelo no disponible' });

        expect(res.status).toBe(200);
        expect(mockSvc.setScanStatus).toHaveBeenCalledWith('SCAN-AAA', 'failed', {
            errorMessage: 'modelo no disponible',
        });
    });

    it('400 si no viene ni analysis ni error', async () => {
        const res = await request(appWith())
            .post('/api/purescan/scans/SCAN-AAA/result')
            .set('x-internal-key', 'clave-interna')
            .send({});

        expect(res.status).toBe(400);
    });
});

describe('POST /scans/:ref/feedback', () => {
    it('201 con el feedback guardado', async () => {
        mockSvc.recordFeedback.mockResolvedValue({ id: 5, verdict: 'confirm' });

        const res = await request(appWith())
            .post('/api/purescan/scans/SCAN-AAA/feedback')
            .send({ verdict: 'confirm', comment: 'correcto' });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ feedbackId: 5, verdict: 'confirm' });
    });

    it('400 con un veredicto inválido', async () => {
        mockSvc.recordFeedback.mockRejectedValue(new Error('verdict debe ser uno de: confirm, reject, correct'));

        const res = await request(appWith())
            .post('/api/purescan/scans/SCAN-AAA/feedback').send({ verdict: 'quizá' });

        expect(res.status).toBe(400);
    });

    it('404 si el escaneo no existe', async () => {
        mockSvc.recordFeedback.mockResolvedValue(null);

        const res = await request(appWith())
            .post('/api/purescan/scans/SCAN-NOPE/feedback').send({ verdict: 'confirm' });

        expect(res.status).toBe(404);
    });
});

describe('POST /blockchain/sync — DPP', () => {
    it('201 con la raíz merkle, marcando que aún no está anclado', async () => {
        mockSvc.createDpp.mockResolvedValue({
            dpp_ref: 'DPP-X', status: 'pending',
            leaf_hash: '0xaa', merkle_root: '0xbb',
            anchored: false, reason: 'sin bridge configurado',
        });

        const res = await request(appWith())
            .post('/api/purescan/blockchain/sync')
            .send({ product: 'Aguacates', batch: 'B-1' });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            dppRef: 'DPP-X', status: 'pending', merkleRoot: '0xbb',
            anchored: false, anchorTxHash: null,
        });
    });

    it('400 si el pasaporte va vacío', async () => {
        const res = await request(appWith()).post('/api/purescan/blockchain/sync').send({});

        expect(res.status).toBe(400);
        expect(mockSvc.createDpp).not.toHaveBeenCalled();
    });

    it('502 si el anclaje falló', async () => {
        mockSvc.createDpp.mockResolvedValue({
            dpp_ref: 'DPP-X', status: 'failed', anchored: false, error: 'RPC caído',
        });

        const res = await request(appWith())
            .post('/api/purescan/blockchain/sync').send({ product: 'x' });

        expect(res.status).toBe(502);
        expect(res.body.success).toBe(false);
    });
});

describe('lecturas', () => {
    it('GET /inventory devuelve lo que hay en la base de datos', async () => {
        mockSvc.listInventory.mockResolvedValue([{ sku: 'SKU-1', quantity: 12 }]);

        const res = await request(appWith()).get('/api/purescan/inventory?limit=5');

        expect(res.body.inventory).toEqual([{ sku: 'SKU-1', quantity: 12 }]);
        expect(mockSvc.listInventory).toHaveBeenCalledWith({ limit: '5' });
    });

    it('GET /analytics expone los agregados', async () => {
        mockSvc.getAnalytics.mockResolvedValue({ total_scans: 3, completion_rate: 66.7 });

        const res = await request(appWith()).get('/api/purescan/analytics');

        expect(res.body).toMatchObject({ success: true, total_scans: 3, completion_rate: 66.7 });
    });

    it('GET /profile/did devuelve 503 si el nodo no está configurado', async () => {
        mockSvc.getNodeDid.mockReturnValue({ did: null, verified: false, reason: 'sin configurar' });

        const res = await request(appWith()).get('/api/purescan/profile/did');

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);
    });

    it('GET /profile/did devuelve el DID cuando sí lo está', async () => {
        mockSvc.getNodeDid.mockReturnValue({ did: 'did:bezhas:0xabc', verified: true });

        const res = await request(appWith()).get('/api/purescan/profile/did');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, did: 'did:bezhas:0xabc' });
    });
});
