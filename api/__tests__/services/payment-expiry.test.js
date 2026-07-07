/**
 * Expiración de órdenes (services/paymentSettlement.js — expireStaleOrders)
 * y guard contra liquidar órdenes expiradas.
 */
const { mockQuery } = require('../helpers');

const { settlePayment, expireStaleOrders } = require('../../services/paymentSettlement');

beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('expireStaleOrders', () => {
    it('marca expired las pendientes vencidas y encola payment.expired por app', async () => {
        // UPDATE ... RETURNING (2 órdenes, una sin app)
        mockQuery.mockResolvedValueOnce({
            rows: [
                { id: 1, wallet_address: '0xabc', amount_usd: '103', payment_method: 'crypto', app_id: 7 },
                { id: 2, wallet_address: '0xdef', amount_usd: '50', payment_method: 'qr', app_id: null },
            ],
        });
        // emit(app 7): lookup de webhooks suscritos
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 11, events: ['payment.expired'] }] });

        const n = await expireStaleOrders();
        expect(n).toBe(2);

        const update = mockQuery.mock.calls[0];
        expect(String(update[0])).toContain("SET status = 'expired'");
        expect(String(update[0])).toContain('expires_at < NOW()');

        // Solo la orden con app_id genera entrega
        const inserts = mockQuery.mock.calls.filter(c => String(c[0]).includes('INSERT INTO payment_webhook_deliveries'));
        expect(inserts).toHaveLength(1);
        expect(JSON.parse(inserts[0][1][2]).event).toBe('payment.expired');
    });

    it('devuelve 0 sin órdenes vencidas', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        await expect(expireStaleOrders()).resolves.toBe(0);
    });
});

describe('settlePayment sobre orden expirada', () => {
    it('rechaza con code EXPIRED', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 5, status: 'expired', amount_usd: '103', platform_fee_usd: '3', note: null, app_id: null }],
        });
        await expect(settlePayment({ paymentId: 5 })).rejects.toMatchObject({ code: 'EXPIRED' });
    });
});
