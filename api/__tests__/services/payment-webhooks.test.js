/**
 * Webhooks salientes de pagos (services/paymentWebhooks.js).
 *
 * Verifica sin red:
 *  - emit encola solo para webhooks activos suscritos al evento.
 *  - La entrega firma con X-BeZhas-Signature en el formato que valida el SDK
 *    (@bezhas/connect webhooks.verify: sha256=<hex hmac del raw body>).
 *  - Fallo → reintento con backoff exponencial; agotado → dead-letter.
 */
const crypto = require('crypto');
const { mockQuery } = require('../helpers');
const hooks = require('../../services/paymentWebhooks');

const SECRET = 'whsec_test';

function delivery(overrides = {}) {
    return {
        id: 9,
        webhook_id: 1,
        event_name: 'payment.settled',
        payload: { event: 'payment.settled', data: { paymentId: 42 }, createdAt: '2026-07-07T00:00:00Z' },
        attempts: 0,
        max_attempts: 8,
        ...overrides,
    };
}

beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('emit', () => {
    it('encola una entrega por webhook suscrito y salta los no suscritos', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { id: 1, events: ['payment.settled'] },
                { id: 2, events: ['payment.failed'] },
                { id: 3, events: ['*'] },
            ],
        });
        const n = await hooks.emit(7, 'payment.settled', { paymentId: 42 });
        expect(n).toBe(2); // id 1 (evento exacto) + id 3 (wildcard)
        const inserts = mockQuery.mock.calls.filter(c => String(c[0]).includes('INSERT INTO payment_webhook_deliveries'));
        expect(inserts).toHaveLength(2);
        expect(inserts.map(c => c[1][0]).sort()).toEqual([1, 3]);
    });

    it('devuelve 0 sin webhooks activos (no lanza)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        await expect(hooks.emit(7, 'payment.settled', {})).resolves.toBe(0);
    });
});

describe('attemptDelivery', () => {
    it('firma el body con el formato del SDK y marca delivered en 2xx', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });
        const d = delivery();
        const out = await hooks.attemptDelivery(d, { url: 'https://client.example/hook', secret: SECRET }, fetchImpl);

        expect(out).toBe('delivered');
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://client.example/hook');
        // Firma verificable exactamente como hace @bezhas/connect webhooks.verify
        const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(init.body).digest('hex');
        expect(init.headers['X-BeZhas-Signature']).toBe(expected);
        expect(init.headers['X-BeZhas-Event']).toBe('payment.settled');
        expect(JSON.parse(init.body).deliveryId).toBe(9);

        const update = mockQuery.mock.calls.find(c => String(c[0]).includes("status = 'delivered'"));
        expect(update[1]).toEqual([200, 9]);
    });

    it('en fallo programa reintento con backoff exponencial', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });
        const out = await hooks.attemptDelivery(delivery({ attempts: 2 }), { url: 'https://x', secret: SECRET }, fetchImpl);

        expect(out).toBe('retry');
        const update = mockQuery.mock.calls.find(c => String(c[0]).includes('next_attempt_at'));
        const [status, attempts, httpStatus, error, backoff] = update[1];
        expect(status).toBe('pending');
        expect(attempts).toBe(3);
        expect(httpStatus).toBe(500);
        expect(error).toBe('HTTP 500');
        expect(Number(backoff)).toBe(hooks.backoffMs(3)); // 30s × 2^3
    });

    it('dead-letter al agotar max_attempts (incluye errores de red)', async () => {
        const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
        const out = await hooks.attemptDelivery(delivery({ attempts: 7, max_attempts: 8 }), { url: 'https://x', secret: SECRET }, fetchImpl);

        expect(out).toBe('dead');
        const update = mockQuery.mock.calls.find(c => String(c[0]).includes('next_attempt_at'));
        expect(update[1][0]).toBe('dead');
        expect(update[1][3]).toBe('ECONNREFUSED');
    });
});

describe('processQueue', () => {
    it('procesa las entregas vencidas y devuelve contadores', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { ...delivery({ id: 1 }), url: 'https://ok', secret: SECRET },
                { ...delivery({ id: 2, attempts: 7 }), url: 'https://down', secret: SECRET },
            ],
        });
        const fetchImpl = jest.fn()
            .mockResolvedValueOnce({ ok: true, status: 200 })
            .mockResolvedValueOnce({ ok: false, status: 503 });
        const counters = await hooks.processQueue(fetchImpl);
        expect(counters).toEqual({ delivered: 1, retry: 0, dead: 1 });
    });
});

describe('backoffMs', () => {
    it('es exponencial con tope', () => {
        expect(hooks.backoffMs(0)).toBe(30_000);
        expect(hooks.backoffMs(1)).toBe(60_000);
        expect(hooks.backoffMs(5)).toBe(960_000);
        expect(hooks.backoffMs(20)).toBe(3_600_000); // cap 1h
    });
});
