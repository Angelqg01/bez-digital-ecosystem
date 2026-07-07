/**
 * Watcher de conciliación on-chain (services/bezSettlementWatcher.js).
 *
 * Verifica el escaneo con un provider falso (sin red):
 *  - Casa un Transfer BEZ→Treasury con la orden pendiente del sender y liquida.
 *  - Salta txs ya usadas (idempotencia) y transferencias insuficientes.
 *  - Persiste el cursor de bloques tras cada pasada.
 * settlePayment se mockea: aquí se prueba el matching, no la liquidación.
 */
const { mockQuery } = require('../helpers');

jest.mock('../../services/paymentSettlement', () => ({
    settlePayment: jest.fn().mockResolvedValue({ payment: { id: 1 }, nextAction: 'settlement_recorded' }),
    SettlementError: class extends Error {},
}));

const { settlePayment } = require('../../services/paymentSettlement');
const watcher = require('../../services/bezSettlementWatcher');

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TREASURY = watcher.TREASURY;
const BEZ_POLYGON = watcher.CHAINS[137].bez;
const BUYER = '0x' + 'a'.repeat(40);

const pad32 = (addr) => '0x' + addr.toLowerCase().replace('0x', '').padStart(64, '0');

function transferLog({ from = BUYER, bez = 1000, txHash = '0x' + '1'.repeat(64) } = {}) {
    return {
        address: BEZ_POLYGON,
        topics: [TRANSFER_TOPIC, pad32(from), pad32(TREASURY)],
        data: '0x' + (BigInt(Math.round(bez * 1e6)) * 10n ** 12n).toString(16),
        transactionHash: txHash,
    };
}

function fakeProvider(logs, head = 5000) {
    return {
        getBlockNumber: jest.fn().mockResolvedValue(head),
        getLogs: jest.fn().mockResolvedValue(logs),
    };
}

// Estado simulado de la DB, enrutado por SQL.
let usedTxs, pendingOrders, cursorRow, cursorWrites;

beforeEach(() => {
    settlePayment.mockClear();
    settlePayment.mockResolvedValue({ payment: { id: 1 }, nextAction: 'settlement_recorded' });
    usedTxs = new Set();
    // Orden pendiente: 103 USD gross − 3 USD fee = 100 USD netos → a 0.10 USD/BEZ = 1000 BEZ esperados
    pendingOrders = [{ id: 55, amount_usd: '103.00', platform_fee_usd: '3.00' }];
    cursorRow = [];
    cursorWrites = [];
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql, params = []) => {
        if (sql.includes('token_price_cache')) return { rows: [{ price_usd: '0.10' }] };
        if (sql.includes('tx_hash = $1')) return { rows: usedTxs.has(params[0]) ? [{}] : [] };
        if (sql.includes("payment_method IN ('crypto', 'qr')")) {
            return { rows: params[0] === BUYER.toLowerCase() ? pendingOrders : [] };
        }
        if (sql.includes('SELECT last_block FROM settlement_watcher_cursor')) return { rows: cursorRow };
        if (sql.includes('INSERT INTO settlement_watcher_cursor')) { cursorWrites.push(params); return { rows: [] }; }
        return { rows: [] };
    });
});

describe('bezSettlementWatcher.scanOnce', () => {
    it('liquida la orden pendiente cuando llega el Transfer BEZ→Treasury del sender', async () => {
        const provider = fakeProvider([transferLog({ bez: 1000 })]);
        const out = await watcher.scanOnce(137, provider);

        expect(out.settled).toBe(1);
        expect(settlePayment).toHaveBeenCalledWith(expect.objectContaining({
            paymentId: 55,
            status: 'completed',
            providerReference: 'onchain-watcher:137',
            txHash: '0x' + '1'.repeat(64),
        }));
        // Filtro del provider: token BEZ + topic destinatario = Treasury
        const filter = provider.getLogs.mock.calls[0][0];
        expect(filter.address).toBe(BEZ_POLYGON);
        expect(filter.topics[2]).toBe(pad32(TREASURY));
    });

    it('acepta con tolerancia (10%) pero rechaza transferencias insuficientes', async () => {
        // 920 BEZ ≥ 1000×0.9 → liquida; 800 BEZ < 900 → no
        let out = await watcher.scanOnce(137, fakeProvider([transferLog({ bez: 920 })]));
        expect(out.settled).toBe(1);

        settlePayment.mockClear();
        out = await watcher.scanOnce(137, fakeProvider([transferLog({ bez: 800, txHash: '0x' + '2'.repeat(64) })]));
        expect(out.settled).toBe(0);
        expect(out.skipped).toBe(1);
        expect(settlePayment).not.toHaveBeenCalled();
    });

    it('salta txs ya registradas en otra orden (idempotencia)', async () => {
        usedTxs.add('0x' + '1'.repeat(64));
        const out = await watcher.scanOnce(137, fakeProvider([transferLog({ bez: 1000 })]));
        expect(out.settled).toBe(0);
        expect(out.skipped).toBe(1);
        expect(settlePayment).not.toHaveBeenCalled();
    });

    it('ignora senders sin órdenes pendientes', async () => {
        const stranger = '0x' + 'b'.repeat(40);
        const out = await watcher.scanOnce(137, fakeProvider([transferLog({ from: stranger, bez: 5000 })]));
        expect(out.settled).toBe(0);
        expect(settlePayment).not.toHaveBeenCalled();
    });

    it('persiste el cursor y arranca desde él en la siguiente pasada', async () => {
        await watcher.scanOnce(137, fakeProvider([], 5000));
        expect(cursorWrites).toHaveLength(1);
        const [, lastBlock] = cursorWrites[0];
        expect(lastBlock).toBe(5000 - 3); // head − confirmaciones

        cursorRow = [{ last_block: String(lastBlock) }];
        const provider = fakeProvider([], 5100);
        const out = await watcher.scanOnce(137, provider);
        expect(out.scanned[0]).toBe(lastBlock + 1);
        expect(provider.getLogs.mock.calls[0][0].fromBlock).toBe(lastBlock + 1);
    });
});
