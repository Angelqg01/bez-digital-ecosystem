'use strict';

const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

const queue = require('../../services/webhookRetryQueue');

/** Extrae la primera llamada cuyo SQL contenga `fragment`. */
const callWith = (fragment) =>
    mockQuery.mock.calls.find(([sql]) => sql.includes(fragment));

const JOB = {
    id: 7,
    kind: 'mint',
    event_id: 'evt_1',
    wallet_address: '0xabc',
    amount_usd_cents: '1000',
    attempt: 0,
    max_attempts: 3,
};

beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
});

describe('backoff', () => {
    it('crece exponencialmente con cada intento', () => {
        const delays = [0, 1, 2, 3].map(queue.backoffMs);

        expect(delays[1]).toBe(delays[0] * 2);
        expect(delays[2]).toBe(delays[0] * 4);
        expect(delays[3]).toBe(delays[0] * 8);
    });
});

describe('enqueue', () => {
    it('exige eventId y walletAddress', async () => {
        await expect(queue.enqueue({ walletAddress: '0xabc' })).rejects.toThrow(/eventId/);
        await expect(queue.enqueue({ eventId: 'evt_1' })).rejects.toThrow(/walletAddress/);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('persiste el trabajo con sus datos', async () => {
        mockQuery.mockResolvedValue({ rows: [{ id: 3, attempt: 0, status: 'pending' }] });

        const job = await queue.enqueue({
            eventId: 'evt_1', walletAddress: '0xabc', amountUsdCents: 1000,
        });

        expect(job).toMatchObject({ id: 3, status: 'pending' });
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain('INSERT INTO webhook_retry_jobs');
        expect(params.slice(0, 4)).toEqual(['mint', 'evt_1', '0xabc', '1000']);
    });

    it('es idempotente por evento: un reenvío de Stripe no duplica el trabajo', async () => {
        await queue.enqueue({ eventId: 'evt_1', walletAddress: '0xabc', amountUsdCents: 1 });

        expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT (kind, event_id) DO UPDATE');
    });
});

describe('claimNextDueJob', () => {
    it('reclama con SKIP LOCKED para que dos instancias no cojan el mismo trabajo', async () => {
        mockQuery.mockResolvedValue({ rows: [JOB] });

        await queue.claimNextDueJob();

        const [sql] = mockQuery.mock.calls[0];
        expect(sql).toContain('FOR UPDATE SKIP LOCKED');
        expect(sql).toContain("SET status = 'running'");
    });

    it('devuelve null cuando no hay nada vencido', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await expect(queue.claimNextDueJob()).resolves.toBeNull();
    });

    it('ignora la fila vacía que devuelve el mock de DB en desarrollo', async () => {
        // El fallback de la DB en dev devuelve `{ rows: [{}] }`. Sin este filtro,
        // la cola creería tener un trabajo sin id y giraría en vacío.
        mockQuery.mockResolvedValue({ rows: [{}] });

        await expect(queue.claimNextDueJob()).resolves.toBeNull();
    });
});

describe('processDueJobs', () => {
    /** Primera llamada devuelve el trabajo; el resto, cola vacía. */
    function withOneJob(job = JOB) {
        let claimed = false;
        mockQuery.mockImplementation((sql) => {
            if (sql.includes('FOR UPDATE SKIP LOCKED')) {
                if (claimed) return Promise.resolve({ rows: [] });
                claimed = true;
                return Promise.resolve({ rows: [job] });
            }
            return Promise.resolve({ rows: [] });
        });
    }

    it('no hace nada si la cola está vacía', async () => {
        await expect(queue.processDueJobs()).resolves.toEqual({
            processed: 0, succeeded: 0, retried: 0, exhausted: 0,
        });
    });

    it('ejecuta el handler y marca el trabajo como cumplido', async () => {
        withOneJob();
        const handler = jest.fn().mockResolvedValue({ txHash: '0xdead' });
        queue.registerHandler('mint', handler);

        const summary = await queue.processDueJobs();

        expect(handler).toHaveBeenCalledWith({
            walletAddress: '0xabc', amountUsdCents: 1000, eventId: 'evt_1',
        });
        expect(summary).toMatchObject({ processed: 1, succeeded: 1 });
        expect(callWith("status = 'succeeded'")[1]).toEqual([7, '0xdead']);
    });

    it('reprograma el trabajo cuando el handler falla', async () => {
        withOneJob();
        queue.registerHandler('mint', jest.fn().mockRejectedValue(new Error('RPC caído')));

        const summary = await queue.processDueJobs();

        expect(summary).toMatchObject({ processed: 1, retried: 1, exhausted: 0 });
        const [, params] = callWith('SET attempt = $2');
        expect(params[1]).toBe(1);          // intento incrementado
        expect(params[2]).toBe('pending');  // vuelve a la cola
        expect(params[3]).toContain('RPC caído');
    });

    it('agota el trabajo al alcanzar el máximo de intentos, sin borrarlo', async () => {
        // Un trabajo agotado es un pago cobrado y no entregado: tiene que quedar
        // en la tabla para poder conciliarlo a mano.
        withOneJob({ ...JOB, attempt: 2, max_attempts: 3 });
        queue.registerHandler('mint', jest.fn().mockRejectedValue(new Error('sigue fallando')));

        const summary = await queue.processDueJobs();

        expect(summary).toMatchObject({ exhausted: 1, retried: 0 });
        expect(callWith('SET attempt = $2')[1][2]).toBe('exhausted');
    });

    it('reprograma en lugar de perder el trabajo si no hay handler para su tipo', async () => {
        withOneJob({ ...JOB, kind: 'desconocido' });

        const summary = await queue.processDueJobs();

        expect(summary).toMatchObject({ processed: 1, retried: 1 });
        expect(callWith('SET attempt = $2')[1][3]).toMatch(/Sin handler registrado/);
    });

    it('respeta el límite de trabajos por pasada', async () => {
        mockQuery.mockImplementation((sql) =>
            sql.includes('FOR UPDATE SKIP LOCKED')
                ? Promise.resolve({ rows: [JOB] })
                : Promise.resolve({ rows: [] }));
        queue.registerHandler('mint', jest.fn().mockResolvedValue({ txHash: '0x1' }));

        const summary = await queue.processDueJobs({ limit: 3 });

        expect(summary.processed).toBe(3);
    });
});

describe('ciclo de vida del temporizador', () => {
    afterEach(() => queue.stop());

    it('start es idempotente y stop lo detiene', () => {
        const first = queue.start({ intervalMs: 60000 });

        expect(queue.start({ intervalMs: 60000 })).toBe(first);

        queue.stop();
        expect(queue.start({ intervalMs: 60000 })).not.toBe(first);
    });
});
