'use strict';

const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

const ledger = require('../../services/providerPaymentLedger');

beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
});

describe('recordCompletedPurchase', () => {
    const compra = {
        eventId: 'evt_1',
        chargeId: 'pi_1',
        walletAddress: '0xabc',
        amountUsd: '10.00',
        amountBez: '142.857',
        txHash: '0xdead',
    };

    it('exige eventId y walletAddress antes de tocar la base de datos', async () => {
        await expect(ledger.recordCompletedPurchase({ walletAddress: '0xabc' })).rejects.toThrow();
        await expect(ledger.recordCompletedPurchase({ eventId: 'evt_1' })).rejects.toThrow();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('crea la orden como compra completada con los datos del proveedor', async () => {
        mockQuery.mockResolvedValue({ rows: [{ id: 42, status: 'completed' }] });

        const row = await ledger.recordCompletedPurchase(compra);

        expect(row).toMatchObject({ id: 42, status: 'completed' });
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain("'buy', 'completed'");
        expect(params).toEqual([
            '0xabc', '10.00', '142.857', 'stripe', null, '0xdead', 'evt_1', 'pi_1',
        ]);
    });

    it('es idempotente por evento del proveedor', async () => {
        // Stripe reenvía el mismo evento hasta recibir un 2xx, y el guard en
        // memoria de webhooks.js no sobrevive a un redespliegue: la garantía
        // tiene que estar en la base de datos.
        await ledger.recordCompletedPurchase(compra);

        expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT (provider, provider_event_id)');
    });

    it('devuelve null con la fila vacía del mock de DB en desarrollo', async () => {
        mockQuery.mockResolvedValue({ rows: [{}] });

        await expect(ledger.recordCompletedPurchase(compra)).resolves.toBeNull();
    });
});

describe('recordFailedPurchase', () => {
    it('deja la orden en estado failed con el motivo del rechazo', async () => {
        mockQuery.mockResolvedValue({ rows: [{ id: 43, status: 'failed' }] });

        const row = await ledger.recordFailedPurchase({
            eventId: 'evt_2',
            chargeId: 'pi_2',
            walletAddress: '0xabc',
            amountUsd: '10.00',
            reason: 'card_declined',
        });

        expect(row).toMatchObject({ status: 'failed' });
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain("'buy', 'failed'");
        expect(JSON.parse(params[3]).failure).toMatchObject({ reason: 'card_declined' });
    });

    it('registra el fallo aunque no venga wallet, para no perder el rastro', async () => {
        await ledger.recordFailedPurchase({ eventId: 'evt_3', reason: 'expired_card' });

        expect(mockQuery.mock.calls[0][1][0]).toBe('unknown');
    });

    it('exige eventId', async () => {
        await expect(ledger.recordFailedPurchase({ reason: 'x' })).rejects.toThrow(/eventId/);
    });
});

describe('findByChargeId', () => {
    it('resuelve el cargo del proveedor a la orden del libro mayor', async () => {
        mockQuery.mockResolvedValue({ rows: [{ id: 42, wallet_address: '0xabc', status: 'completed' }] });

        await expect(ledger.findByChargeId('pi_1')).resolves.toMatchObject({ id: 42 });
        expect(mockQuery.mock.calls[0][1]).toEqual(['stripe', 'pi_1']);
    });

    it('no consulta nada si no hay cargo', async () => {
        await expect(ledger.findByChargeId(null)).resolves.toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('devuelve null cuando el cargo no corresponde a ninguna orden', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await expect(ledger.findByChargeId('pi_desconocido')).resolves.toBeNull();
    });
});

describe('notifyWalletOwner', () => {
    it('inserta la notificación resolviendo la wallet a su usuario', async () => {
        mockQuery.mockResolvedValue({ rows: [{ id: 'uuid-1' }] });

        const entregada = await ledger.notifyWalletOwner({
            walletAddress: '0xABC',
            type: 'transaction',
            title: 'Compra completada',
            message: 'Se han acreditado 100 BEZ.',
            metadata: { txHash: '0xdead' },
        });

        expect(entregada).toBe(true);
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain('INSERT INTO notifications');
        expect(sql).toContain('LOWER(u.wallet_address) = LOWER($1)');
        expect(JSON.parse(params[4])).toEqual({ txHash: '0xdead' });
    });

    it('devuelve false sin lanzar si la wallet no tiene cuenta', async () => {
        // Se puede pagar desde una wallet que aún no está registrada; eso no debe
        // tumbar el procesamiento del webhook.
        mockQuery.mockResolvedValue({ rows: [] });

        await expect(ledger.notifyWalletOwner({
            walletAddress: '0xsinusuario', type: 'alert', title: 't', message: 'm',
        })).resolves.toBe(false);
    });

    it('no consulta nada sin wallet', async () => {
        await expect(ledger.notifyWalletOwner({ type: 'alert', title: 't', message: 'm' }))
            .resolves.toBe(false);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});
