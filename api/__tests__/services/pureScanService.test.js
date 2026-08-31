'use strict';

const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

const svc = require('../../services/pureScanService');

const callWith = (fragment) => mockQuery.mock.calls.find(([sql]) => sql.includes(fragment));

/** Responde con `rows` a la primera consulta que contenga `fragment`. */
function respond(map, fallback = { rows: [] }) {
    mockQuery.mockImplementation((sql) => {
        for (const [fragment, result] of map) {
            if (sql.includes(fragment)) return Promise.resolve(result);
        }
        return Promise.resolve(fallback);
    });
}

beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
});

describe('createScan', () => {
    const scanRow = { id: 1, scan_ref: 'SCAN-AAA', status: 'pending' };

    it('persiste el escaneo y encarga el análisis al runtime de agentes', async () => {
        respond([['INSERT INTO purescan_scans', { rows: [scanRow] }]]);
        const manager = { dispatch: jest.fn().mockResolvedValue('task-99') };

        const scan = await svc.createScan(
            { sku: 'SKU-1', product: 'Aguacates', batch: 'B-1', payload: { image: 'x' } },
            manager
        );

        expect(manager.dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: svc.ANALYZE_TASK_TYPE,
            source: 'purescan',
            payload: expect.objectContaining({ sku: 'SKU-1', batch: 'B-1' }),
        }));
        expect(scan.status).toBe('analyzing');
        expect(scan.taskId).toBe('task-99');
        expect(callWith("SET status = 'analyzing'")).toBeTruthy();
    });

    it('genera una referencia distinta por escaneo', async () => {
        respond([['INSERT INTO purescan_scans', { rows: [scanRow] }]]);
        const manager = { dispatch: jest.fn().mockResolvedValue('t') };

        await svc.createScan({ payload: {} }, manager);
        await svc.createScan({ payload: {} }, manager);

        const refs = mockQuery.mock.calls
            .filter(([sql]) => sql.includes('INSERT INTO purescan_scans'))
            .map(([, params]) => params[0]);
        expect(refs[0]).not.toBe(refs[1]);
        expect(refs[0]).toMatch(/^SCAN-[0-9A-F]{16}$/);
    });

    it('marca el escaneo como no disponible en lugar de inventar un análisis', async () => {
        // En trazabilidad alimentaria un dato falso es peor que ninguno: sin
        // runtime de agentes el escaneo queda 'unavailable', no "EXCELLENT".
        respond([['INSERT INTO purescan_scans', { rows: [scanRow] }]]);

        const scan = await svc.createScan({ payload: {} }, null);

        expect(scan.status).toBe('unavailable');
        expect(scan.taskId).toBeNull();
        expect(callWith('SET status = $2')[1][1]).toBe('unavailable');
    });

    it('trata un manager sin dispatch como ausencia de runtime', async () => {
        respond([['INSERT INTO purescan_scans', { rows: [scanRow] }]]);

        const scan = await svc.createScan({ payload: {} }, { listAgents: () => [] });

        expect(scan.status).toBe('unavailable');
    });

    it('deja el escaneo en failed si el dispatch revienta', async () => {
        respond([['INSERT INTO purescan_scans', { rows: [scanRow] }]]);
        const manager = { dispatch: jest.fn().mockRejectedValue(new Error('cola llena')) };

        const scan = await svc.createScan({ payload: {} }, manager);

        expect(scan.status).toBe('failed');
        expect(scan.error).toBe('cola llena');
    });
});

describe('completeScan', () => {
    it('guarda el análisis y extrae el nivel de riesgo', async () => {
        respond([['UPDATE purescan_scans', { rows: [{ id: 1, status: 'completed', risk_level: 'HIGH' }] }]]);

        const updated = await svc.completeScan('SCAN-AAA', {
            product_type: 'Aguacates', risk_level: 'HIGH',
        });

        expect(updated).toMatchObject({ status: 'completed', risk_level: 'HIGH' });
        const [, params] = callWith('UPDATE purescan_scans');
        expect(params[1]).toBe('completed');
        expect(JSON.parse(params[3]).risk_level).toBe('HIGH');
        expect(params[4]).toBe('HIGH');
    });

    it('acepta riskLevel en camelCase', async () => {
        respond([['UPDATE purescan_scans', { rows: [{ id: 1, status: 'completed' }] }]]);

        await svc.completeScan('SCAN-AAA', { riskLevel: 'LOW' });

        expect(callWith('UPDATE purescan_scans')[1][4]).toBe('LOW');
    });

    it('rechaza un análisis que no sea un objeto', async () => {
        await expect(svc.completeScan('SCAN-AAA', null)).rejects.toThrow(/análisis/);
        await expect(svc.completeScan('SCAN-AAA', 'ok')).rejects.toThrow(/análisis/);
    });
});

describe('listScans', () => {
    it('acota el límite al rango permitido', async () => {
        await svc.listScans({ limit: 5000 });
        expect(mockQuery.mock.calls[0][1][1]).toBe(100);

        mockQuery.mockClear();
        await svc.listScans({ limit: -3 });
        expect(mockQuery.mock.calls[0][1][1]).toBe(1);
    });

    it('descarta las filas vacías del mock de DB', async () => {
        mockQuery.mockResolvedValue({ rows: [{}, { scan_ref: 'SCAN-A' }] });

        await expect(svc.listScans()).resolves.toEqual([{ scan_ref: 'SCAN-A' }]);
    });
});

describe('recordFeedback', () => {
    it.each(['confirm', 'reject', 'correct'])('acepta el veredicto %s', async (verdict) => {
        respond([['INSERT INTO purescan_feedback', { rows: [{ id: 5, verdict }] }]]);

        await expect(svc.recordFeedback('SCAN-AAA', { verdict })).resolves.toMatchObject({ verdict });
    });

    it('rechaza un veredicto desconocido sin tocar la base de datos', async () => {
        await expect(svc.recordFeedback('SCAN-AAA', { verdict: 'quizá' })).rejects.toThrow(/verdict/);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('devuelve null si el escaneo no existe', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await expect(svc.recordFeedback('SCAN-NOPE', { verdict: 'confirm' })).resolves.toBeNull();
    });
});

describe('createDpp', () => {
    const payload = { product: 'Aguacates', batch: 'B-1', origin: 'ES' };

    it('calcula la hoja y la raíz merkle y guarda el DPP pendiente', async () => {
        respond([['INSERT INTO purescan_dpp', { rows: [{ id: 9, dpp_ref: 'DPP-X', status: 'pending' }] }]]);

        const dpp = await svc.createDpp({ payload });

        const [, params] = callWith('INSERT INTO purescan_dpp');
        expect(params[3]).toMatch(/^0x[0-9a-f]{64}$/);  // leaf
        expect(params[4]).toMatch(/^0x[0-9a-f]{64}$/);  // root
        expect(dpp.anchored).toBe(false);
        expect(dpp.reason).toMatch(/sin bridge/);
    });

    it('el hash del DPP es estable para el mismo contenido', async () => {
        // Es la propiedad que hace útil el pasaporte: el mock devolvía un hash
        // distinto en cada llamada para los mismos datos.
        respond([['INSERT INTO purescan_dpp', { rows: [{ id: 9, dpp_ref: 'DPP-X', status: 'pending' }] }]]);

        await svc.createDpp({ payload });
        const primero = callWith('INSERT INTO purescan_dpp')[1][3];

        mockQuery.mockClear();
        respond([['INSERT INTO purescan_dpp', { rows: [{ id: 10, dpp_ref: 'DPP-Y', status: 'pending' }] }]]);
        await svc.createDpp({ payload: { ...payload } });

        expect(callWith('INSERT INTO purescan_dpp')[1][3]).toBe(primero);
    });

    it('ancla la raíz cuando hay bridge y marca el DPP como anclado', async () => {
        respond([
            ['INSERT INTO purescan_dpp', { rows: [{ id: 9, dpp_ref: 'DPP-X', status: 'pending' }] }],
            ["SET status = 'anchored'", { rows: [{ id: 9, dpp_ref: 'DPP-X', status: 'anchored' }] }],
        ]);
        const bridge = { anchor: jest.fn().mockResolvedValue('0xtx') };

        const dpp = await svc.createDpp({ payload }, bridge);

        expect(bridge.anchor).toHaveBeenCalledWith(expect.stringMatching(/^0x[0-9a-f]{64}$/), null);
        expect(dpp).toMatchObject({ status: 'anchored', anchored: true, txHash: '0xtx' });
    });

    it('marca el DPP como fallido si el anclaje revienta', async () => {
        respond([['INSERT INTO purescan_dpp', { rows: [{ id: 9, dpp_ref: 'DPP-X', status: 'pending' }] }]]);
        const bridge = { anchor: jest.fn().mockRejectedValue(new Error('RPC caído')) };

        const dpp = await svc.createDpp({ payload }, bridge);

        expect(dpp).toMatchObject({ status: 'failed', anchored: false, error: 'RPC caído' });
        expect(callWith("SET status = 'failed'")).toBeTruthy();
    });

    it('exige payload', async () => {
        await expect(svc.createDpp({ payload: null })).rejects.toThrow(/payload/);
    });

    it('resuelve el escaneo asociado cuando se indica', async () => {
        respond([
            ['SELECT id FROM purescan_scans', { rows: [{ id: 33 }] }],
            ['INSERT INTO purescan_dpp', { rows: [{ id: 9, dpp_ref: 'DPP-X', status: 'pending' }] }],
        ]);

        await svc.createDpp({ scanRef: 'SCAN-AAA', payload });

        expect(callWith('INSERT INTO purescan_dpp')[1][1]).toBe(33);
    });
});

describe('getAnalytics', () => {
    it('deriva las cifras de la base de datos en vez de devolverlas fijas', async () => {
        respond([
            ['COUNT(*) FILTER (WHERE status = \'completed\')', {
                rows: [{ total_scans: 10, completed_scans: 8, pending_review: 1, failed_scans: 1, risk_detected: 2 }],
            }],
            ['GROUP BY DATE(created_at)', { rows: [{ date: '2026-08-10', count: 4 }] }],
            ['FROM purescan_dpp', { rows: [{ anchored_dpp: 3, total_dpp: 5 }] }],
        ]);

        const a = await svc.getAnalytics();

        expect(a).toMatchObject({
            total_scans: 10, completed_scans: 8, risk_detected: 2,
            completion_rate: 80, anchored_dpp: 3, total_dpp: 5,
        });
        expect(a.daily_scans).toEqual([{ date: '2026-08-10', count: 4 }]);
    });

    it('no divide por cero cuando no hay escaneos', async () => {
        mockQuery.mockResolvedValue({ rows: [{}] });

        await expect(svc.getAnalytics()).resolves.toMatchObject({
            total_scans: 0, completion_rate: 0,
        });
    });
});

describe('getNodeDid', () => {
    const saved = { ...process.env };
    afterEach(() => {
        process.env.PURESCAN_NODE_WALLET = saved.PURESCAN_NODE_WALLET;
        process.env.BEZ_TOKEN_ADDRESS = saved.BEZ_TOKEN_ADDRESS;
        if (saved.PURESCAN_NODE_WALLET === undefined) delete process.env.PURESCAN_NODE_WALLET;
        if (saved.BEZ_TOKEN_ADDRESS === undefined) delete process.env.BEZ_TOKEN_ADDRESS;
    });

    it('deriva el DID de la wallet configurada', () => {
        process.env.PURESCAN_NODE_WALLET = '0xAbCdEf0000000000000000000000000000000001';

        expect(svc.getNodeDid()).toMatchObject({
            did: 'did:bezhas:0xabcdef0000000000000000000000000000000001',
            verified: true,
        });
    });

    it('admite no estar configurado en vez de fingir un DID verificado', () => {
        delete process.env.PURESCAN_NODE_WALLET;
        delete process.env.BEZ_TOKEN_ADDRESS;

        expect(svc.getNodeDid()).toMatchObject({ did: null, verified: false });
    });
});
