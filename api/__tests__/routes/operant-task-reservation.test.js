/**
 * POST /api/operant/tasks reserva la plaza de la cuota antes de despachar y la devuelve si la
 * tarea no llega a ejecutarse. Sin esto, cada fallo dejaría una plaza ocupada (o, sin reserva, N
 * peticiones simultáneas se colarían en la misma plaza).
 */
const request = require('supertest');
const express = require('express');

const mockReserveTask = jest.fn();
const mockRelease = jest.fn(async () => {});
const mockRecordTask = jest.fn();
const mockDispatch = jest.fn();

jest.mock('../../middleware/gateway-auth', () => ({
    authenticateGateway: (req, _res, next) => { req.registeredApp = { id: 'app-1' }; req.subscription = { plan: 'creator_pro' }; next(); },
}));
jest.mock('../../middleware/subapp-entitlement', () => ({ requireSubApp: () => (_req, _res, next) => next() }));
jest.mock('../../middleware/gateway-metering', () => ({ meterUsage: () => (_req, _res, next) => next() }));
jest.mock('../../db/pool', () => ({
    query: jest.fn(async () => ({ rows: [{ tenant_id: 'tenant-1', status: 'active', autonomy: 'assisted', app_id: 'app-1' }] })),
}));
jest.mock('../../services/operantBridge', () => ({ dispatchTask: (...a) => mockDispatch(...a), health: jest.fn() }));
jest.mock('../../services/operantAnchor', () => ({}));
jest.mock('../../services/operantUsage', () => ({
    reserveTask: (...a) => mockReserveTask(...a),
    releaseReservation: (...a) => mockRelease(...a),
    recordTask: (...a) => mockRecordTask(...a),
    checkQuota: jest.fn(),
}));
jest.mock('../../services/apiCredits', () => ({
    reservar: jest.fn(async () => null), liberar: jest.fn(async () => {}),
}));

const router = require('../../routes/operant');

const app = express();
app.use(express.json());
app.use('/api/operant', router);

const cuerpo = { department: 'support', input: 'Resume los tickets de hoy' };
const plaza = { allowed: true, billedAs: 'quota', reservationId: 'reserved:abc', remaining: 5, used: 10, included: 300 };

beforeEach(() => {
    jest.clearAllMocks();
    mockReserveTask.mockResolvedValue(plaza);
    mockDispatch.mockResolvedValue({ taskId: 't-9', status: 'completed', output: 'ok', usage: {} });
    mockRecordTask.mockResolvedValue({ credits: 3, billableEUR: 0.003, aiActions: 1, model: 'm', measured: false });
});

describe('POST /api/operant/tasks: reserva de cuota', () => {
    test('reserva ANTES de despachar y pasa la reserva a recordTask', async () => {
        const res = await request(app).post('/api/operant/tasks').send(cuerpo);
        expect(res.status).toBe(200);
        expect(mockReserveTask).toHaveBeenCalledWith({ appId: 'app-1', tenantId: 'tenant-1', planId: 'creator_pro', department: 'support' });
        expect(mockReserveTask.mock.invocationCallOrder[0]).toBeLessThan(mockDispatch.mock.invocationCallOrder[0]);
        expect(mockRecordTask).toHaveBeenCalledWith(expect.objectContaining({ reservationId: 'reserved:abc', taskId: 't-9' }));
        expect(mockRelease).not.toHaveBeenCalled();
    });

    test('sin plaza en la cuota: 402 y no se despacha nada', async () => {
        mockReserveTask.mockResolvedValue({ allowed: false, code: 'QUOTA_EXHAUSTED', reason: 'Agotadas', used: 300, included: 300 });
        const res = await request(app).post('/api/operant/tasks').send(cuerpo);
        expect(res.status).toBe(402);
        expect(res.body.code).toBe('QUOTA_EXHAUSTED');
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRelease).not.toHaveBeenCalled(); // no había nada reservado
    });

    test('si el despacho falla, la plaza vuelve', async () => {
        mockDispatch.mockRejectedValue(new Error('runtime caido'));
        const res = await request(app).post('/api/operant/tasks').send(cuerpo);
        expect(res.status).toBeGreaterThanOrEqual(500);
        expect(mockRelease).toHaveBeenCalledWith('app-1', 'reserved:abc');
        expect(mockRecordTask).not.toHaveBeenCalled();
    });

    test('si falla la reserva de saldo de una cuenta prepago, la plaza de la cuota vuelve', async () => {
        mockReserveTask.mockResolvedValue({ ...plaza, prepaid: true, estimatedCredits: 100 });
        // apiCredits.reservar devuelve null (sin saldo): 402 y ninguna plaza ocupada.
        const res = await request(app).post('/api/operant/tasks').send(cuerpo);
        expect(res.status).toBe(402);
        expect(res.body.code).toBe('INSUFFICIENT_CREDITS');
        expect(mockRelease).toHaveBeenCalledWith('app-1', 'reserved:abc');
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('un departamento fuera del plan se rechaza ANTES de reservar', async () => {
        const res = await request(app).post('/api/operant/tasks').send({ ...cuerpo, department: 'treasury' });
        expect([400, 403]).toContain(res.status);
        expect(mockReserveTask).not.toHaveBeenCalled();
    });

    test('un fallo al reservar responde 503 sin despachar', async () => {
        mockReserveTask.mockRejectedValue(new Error('db caida'));
        const res = await request(app).post('/api/operant/tasks').send(cuerpo);
        expect(res.status).toBe(503);
        expect(mockDispatch).not.toHaveBeenCalled();
    });
});
