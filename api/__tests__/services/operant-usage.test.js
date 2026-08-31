/**
 * operantUsage — el reparto cuota / pago por uso.
 *
 * Es la función que decide si una tarea sale gratis (ya pagada por la cuota
 * del plan), se factura como excedente, o directamente no se ejecuta. Los tres
 * caminos tienen consecuencias económicas, así que están fijados aquí.
 *
 * La invariante que más importa: NUNCA se ejecuta una tarea que no se pueda
 * cobrar. Fuera de cuota y sin customer al que facturar, la respuesta es 402 —
 * no "adelante y ya veremos".
 */
const { mockQuery } = require('../helpers');
const mockRecordUsage = jest.fn().mockResolvedValue({ credits: 1, reported: true });
jest.mock('../../services/usageBilling', () => ({
    recordUsage: (...args) => mockRecordUsage(...args),
    METER_EVENT_NAME: 'bezhas_api_credits',
}));

const { checkQuota, recordTask } = require('../../services/operantUsage');
const { PLAN_MATRIX } = require('../../config/operant-services');

/** Fila que devuelve currentPeriodUsage(). */
const usageRow = ({ tasks = 0, frontier = 0 } = {}) => ({
    rows: [{
        tasks, frontier_tasks: frontier, payg_tasks: 0,
        credits: 0, payg_credits: 0, payg_eur: '0',
        raw_cost_eur: '0', ai_actions: 0,
    }],
    rowCount: 1,
});

/** Fila de gateway_subscriptions para stripeCustomerOf(). */
const customerRow = (id) => ({ rows: id ? [{ stripe_customer_id: id }] : [], rowCount: id ? 1 : 0 });

describe('checkQuota', () => {
    beforeEach(() => mockQuery.mockReset());

    test('dentro de cuota: la tarea va contra el plan, no genera cargo', async () => {
        mockQuery.mockResolvedValueOnce(usageRow({ tasks: 10 }));
        const q = await checkQuota({ appId: 'a', planId: 'business', department: 'support' });
        expect(q.allowed).toBe(true);
        expect(q.billedAs).toBe('quota');
        expect(q.remaining).toBe(PLAN_MATRIX.business.includedTasks - 10);
    });

    test('Starter siempre es pago por uso: no tiene cuota que gastar', async () => {
        mockQuery.mockResolvedValueOnce(usageRow({ tasks: 0 }));
        const q = await checkQuota({ appId: 'a', planId: 'starter', department: 'sales' });
        expect(q.allowed).toBe(true);
        expect(q.billedAs).toBe('payg');
    });

    test('cuota agotada sin customer: 402, no se ejecuta ni se regala', async () => {
        mockQuery
            .mockResolvedValueOnce(usageRow({ tasks: PLAN_MATRIX.creator_pro.includedTasks }))
            .mockResolvedValueOnce(customerRow(null));
        const q = await checkQuota({ appId: 'a', planId: 'creator_pro', department: 'support' });
        expect(q.allowed).toBe(false);
        expect(q.code).toBe('QUOTA_EXHAUSTED');
        expect(q.activate).toMatch(/starter\/subscribe/);
    });

    test('cuota agotada con customer: sigue funcionando, facturado como excedente', async () => {
        mockQuery
            .mockResolvedValueOnce(usageRow({ tasks: PLAN_MATRIX.creator_pro.includedTasks }))
            .mockResolvedValueOnce(customerRow('cus_123'));
        const q = await checkQuota({ appId: 'a', planId: 'creator_pro', department: 'support' });
        expect(q.allowed).toBe(true);
        expect(q.billedAs).toBe('payg');
        expect(q.customerId).toBe('cus_123');
    });

    test('el tope frontier se agota aparte: una tarea cara no puede comerse la cuota barata', async () => {
        // Quedan tareas de cuota, pero el tope de frontier ya está gastado.
        mockQuery
            .mockResolvedValueOnce(usageRow({ tasks: 100, frontier: PLAN_MATRIX.creator_pro.frontierCap }))
            .mockResolvedValueOnce(customerRow(null));
        const q = await checkQuota({ appId: 'a', planId: 'creator_pro', department: 'sales' }); // frontier
        expect(q.allowed).toBe(false);
        expect(q.reason).toMatch(/frontier/);
    });

    test('con el tope frontier agotado, un departamento mid sigue entrando en cuota', async () => {
        mockQuery.mockResolvedValueOnce(usageRow({ tasks: 100, frontier: PLAN_MATRIX.creator_pro.frontierCap }));
        const q = await checkQuota({ appId: 'a', planId: 'creator_pro', department: 'support' }); // mid
        expect(q.allowed).toBe(true);
        expect(q.billedAs).toBe('quota');
    });

    test('un plan desconocido cae a los límites de Starter, nunca a los del más generoso', async () => {
        mockQuery
            .mockResolvedValueOnce(usageRow({ tasks: 5 }))
            .mockResolvedValueOnce(customerRow(null));
        const q = await checkQuota({ appId: 'a', planId: 'inventado', department: 'support' });
        expect(q.included).toBe(PLAN_MATRIX.starter.includedTasks);
        // Y además se bloquea: un plan que no se reconoce no puede acabar
        // ejecutando gratis por la vía del pago por uso de Starter.
        expect(q.allowed).toBe(false);
    });
});


describe('recordTask — sobre qué número se factura', () => {
    beforeEach(() => {
        mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
        mockRecordUsage.mockClear();
    });

    const base = {
        appId: 'a', tenantId: 't', taskId: 'task-1',
        department: 'support', planId: 'business', billedAs: 'quota',
    };

    test('con tokens atribuibles a la tarea, se factura lo medido', async () => {
        const cost = await recordTask({
            ...base,
            usage: { attribution: 'exact', inputTokens: 90_000, outputTokens: 18_000, specialists: 2 },
        });
        expect(cost.measured).toBe(true);
        expect(cost.inputTokens).toBe(90_000);
        // Muy por encima del perfil estimado (15k/3k): si se ignorase lo medido
        // se estaría facturando seis veces por debajo del coste real.
        expect(cost.rawCostEUR).toBeGreaterThan(estimatedCost().rawCostEUR);
    });

    test("con tokens 'shared' se descarta la medición y se usa el perfil estimado", async () => {
        const cost = await recordTask({
            ...base,
            usage: { attribution: 'shared', inputTokens: 90_000, outputTokens: 18_000, specialists: 2 },
        });
        expect(cost.measured).toBe(false);
        expect(cost.rawCostEUR).toBe(estimatedCost().rawCostEUR);
    });

    test('en modo simulado (tokens a 0) tampoco se factura por debajo del coste', async () => {
        const cost = await recordTask({
            ...base,
            usage: { attribution: 'exact', inputTokens: 0, outputTokens: 0, specialists: 2 },
        });
        expect(cost.measured).toBe(false);
        expect(cost.rawCostEUR).toBe(estimatedCost().rawCostEUR);
    });

    test('sin usage reportado, el perfil estimado es el suelo', async () => {
        const cost = await recordTask({ ...base });
        expect(cost.measured).toBe(false);
        expect(cost.credits).toBeGreaterThanOrEqual(1);
    });

    test('toda tarea entra en el ledger común del Gateway', async () => {
        await recordTask({ ...base });
        expect(mockRecordUsage).toHaveBeenCalledWith('a', expect.objectContaining({
            action: 'operant_task', ref: 'operant:task-1',
        }));
    });

    test('el número de especialistas se respeta aunque los tokens no sean fiables', async () => {
        const cost = await recordTask({
            ...base, taskId: 'task-2',
            usage: { attribution: 'shared', specialists: 5 },
        });
        expect(cost.aiActions).toBe(estimatedCost().aiActions + 3);
    });
});

function estimatedCost() {
    return require('../../config/operant-services').estimateTaskCost('support');
}
