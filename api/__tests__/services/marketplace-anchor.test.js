/**
 * Anclaje de recibos del marketplace (paso 4): lotes, anclaje multi-red y prueba de inclusión.
 */
const crypto = require('crypto');

const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();
jest.mock('../../db/pool', () => ({
    query: (...a) => mockQuery(...a),
    getClient: async () => ({ query: (...a) => mockClientQuery(...a), release: mockRelease }),
}));

const anchor = require('../../services/marketplace/anchor');

const LISTING = '22222222-2222-4222-8222-222222222222';
const BATCH = '55555555-5555-4555-8555-555555555555';
const POLY = '0x' + '1'.repeat(40);
const fila = (i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    listing_id: LISTING, consumer_app_id: '33333333-3333-4333-8333-333333333333',
    at: new Date(Date.UTC(2026, 10, 5, 10, 0, i)), http_status: 200,
    req_hash: 'a'.repeat(64), resp_hash: crypto.createHash('sha256').update(String(i)).digest('hex'),
    amount_cents: 0, fee_cents: 0, slug: 'tarifas-aduana', currency: 'eur',
});
const FILAS = [1, 2, 3, 4, 5].map(fila);

// Espejo de TelemetryAnchor.verify(): sha256 con pares ordenados.
function verificar(leafHex, proofHex, rootHex) {
    let acc = Buffer.from(leafHex.slice(2), 'hex');
    for (const p of proofHex) {
        const b = Buffer.from(p.slice(2), 'hex');
        acc = crypto.createHash('sha256').update(Buffer.compare(acc, b) <= 0 ? Buffer.concat([acc, b]) : Buffer.concat([b, acc])).digest();
    }
    return `0x${acc.toString('hex')}` === rootHex;
}

describe('marketplace anchor — lotes', () => {
    beforeEach(() => { mockQuery.mockReset(); mockClientQuery.mockReset(); mockRelease.mockReset(); });

    it('cierra un lote en una transacción con FOR UPDATE SKIP LOCKED', async () => {
        mockClientQuery.mockImplementation(async (sql) => {
            if (sql.includes('FOR UPDATE')) return { rows: FILAS };
            if (sql.includes('INSERT INTO marketplace_receipt_batches')) return { rows: [{ id: BATCH }] };
            return { rows: [] };
        });
        const lote = await anchor.cerrarLoteDe(LISTING);
        expect(lote.id).toBe(BATCH);
        const sqls = mockClientQuery.mock.calls.map((c) => c[0]);
        expect(sqls[0]).toBe('BEGIN');
        expect(sqls.at(-1)).toBe('COMMIT');
        expect(sqls[1]).toContain('SKIP LOCKED');
        const insert = mockClientQuery.mock.calls.find((c) => c[0].includes('INSERT INTO marketplace_receipt_batches'));
        expect(insert[1][2]).toBe(`mkt:${LISTING}`);
        expect(insert[1][3]).toBe(5);
        const upd = mockClientQuery.mock.calls.find((c) => c[0].includes('UPDATE marketplace_calls'));
        expect(upd[1][1]).toEqual(FILAS.map((f) => f.id));
        expect(mockRelease).toHaveBeenCalled();
    });

    it('sin llamadas pendientes no crea lote', async () => {
        mockClientQuery.mockResolvedValue({ rows: [] });
        expect(await anchor.cerrarLoteDe(LISTING)).toBeNull();
        expect(mockClientQuery.mock.calls.map((c) => c[0])).toContain('ROLLBACK');
    });
});

describe('marketplace anchor — redes', () => {
    const env = { ...process.env };
    afterEach(() => { process.env = { ...env }; });

    it('sin RPC ni dirección no hay redes activas', () => {
        delete process.env.POLYGON_RPC_URL;
        delete process.env.BEZHAS_L2_RPC_URL;
        expect(anchor.redesActivas()).toEqual([]);
    });

    it('Polygon se activa con RPC y dirección; la L2 sigue fuera sin nodo', () => {
        process.env.POLYGON_RPC_URL = 'https://polygon.example';
        process.env.MARKETPLACE_ANCHOR_POLYGON_ADDRESS = POLY;
        delete process.env.BEZHAS_L2_RPC_URL;
        expect(anchor.redesActivas()).toEqual([{ red: 'polygon', chainId: 137, direccion: POLY }]);
    });
});

describe('marketplace anchor — anclaje', () => {
    const env = { ...process.env };
    const LOTE = { id: BATCH, listing_id: LISTING, merkle_root: '0x' + 'c'.repeat(64), anchor_key: `mkt:${LISTING}`, leaf_count: 5, from_ts: FILAS[0].at, to_ts: FILAS[4].at };
    let contrato;

    beforeEach(() => {
        process.env.POLYGON_RPC_URL = 'https://polygon.example';
        process.env.MARKETPLACE_ANCHOR_POLYGON_ADDRESS = POLY;
        delete process.env.BEZHAS_L2_RPC_URL;
        mockQuery.mockReset();
        const tx = { hash: '0x' + 'd'.repeat(64), wait: jest.fn().mockResolvedValue({ status: 1, hash: '0x' + 'd'.repeat(64), blockNumber: 77, logs: [{}] }) };
        contrato = {
            anchorBatch: jest.fn().mockResolvedValue(tx),
            runner: { provider: { getNetwork: jest.fn().mockResolvedValue({ chainId: 137n }), getTransactionReceipt: jest.fn() } },
            interface: { parseLog: () => ({ name: 'BatchAnchored', args: { index: 3n } }) },
        };
        anchor._setFabricaContrato(() => contrato);
    });
    afterEach(() => { process.env = { ...env }; });

    it('ancla en Polygon, guarda la tx antes de esperar y el índice del evento', async () => {
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes('FROM marketplace_receipt_batches b')) return { rows: [LOTE] };
            if (sql.includes('INSERT INTO marketplace_batch_anchors')) return { rows: [{ status: 'pending', tx_hash: null, attempts: 0 }] };
            return { rows: [] };
        });
        const r = await anchor.anclarPendientes();
        expect(r.anclas).toEqual([expect.objectContaining({ red: 'polygon', status: 'confirmed', anchorIndex: 3 })]);
        expect(contrato.anchorBatch).toHaveBeenCalledWith(`mkt:${LISTING}`, LOTE.merkle_root, expect.any(Number), expect.any(Number), 5);
        const sqls = mockQuery.mock.calls.map((c) => c[0]);
        const iSent = sqls.findIndex((s) => s.includes("SET status = 'sent'"));
        const iConf = sqls.findIndex((s) => s.includes("SET status = 'confirmed'"));
        expect(iSent).toBeGreaterThan(-1);
        expect(iConf).toBeGreaterThan(iSent);
    });

    it('si la tx ya se envió, consulta el recibo en vez de reenviar', async () => {
        contrato.runner.provider.getTransactionReceipt.mockResolvedValue({ status: 1, hash: '0x' + 'e'.repeat(64), blockNumber: 9, logs: [{}] });
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes('FROM marketplace_receipt_batches b')) return { rows: [LOTE] };
            if (sql.includes('INSERT INTO marketplace_batch_anchors')) return { rows: [{ status: 'sent', tx_hash: '0x' + 'e'.repeat(64), attempts: 1 }] };
            return { rows: [] };
        });
        const r = await anchor.anclarPendientes();
        expect(contrato.anchorBatch).not.toHaveBeenCalled();
        expect(r.anclas[0].status).toBe('confirmed');
    });

    it('no ancla si el RPC es de otra cadena', async () => {
        contrato.runner.provider.getNetwork.mockResolvedValue({ chainId: 1n });
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes('FROM marketplace_receipt_batches b')) return { rows: [LOTE] };
            if (sql.includes('INSERT INTO marketplace_batch_anchors')) return { rows: [{ status: 'pending', tx_hash: null, attempts: 0 }] };
            return { rows: [] };
        });
        const r = await anchor.anclarPendientes();
        expect(r.anclas[0].status).toBe('failed');
        expect(contrato.anchorBatch).not.toHaveBeenCalled();
    });
});

describe('marketplace anchor — prueba de inclusión', () => {
    beforeEach(() => mockQuery.mockReset());

    function preparar(filasLote) {
        const hojas = FILAS.map(anchor.hojaDe);
        const { merkleRoot } = require('../../services/operantAnchor');
        const raiz = `0x${merkleRoot(hojas).toString('hex')}`;
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes('FROM marketplace_receipt_batches WHERE id')) return { rows: [{ id: BATCH, merkle_root: raiz, anchor_key: `mkt:${LISTING}`, leaf_count: 5 }] };
            if (sql.includes('WHERE c.batch_id = $1')) return { rows: filasLote };
            if (sql.includes('FROM marketplace_batch_anchors')) {
                return { rows: [{ network: 'polygon', chain_id: 137, contract_address: POLY, status: 'confirmed', tx_hash: '0x' + 'd'.repeat(64), block_number: '77', anchor_index: '3', anchored_at: 'now' }] };
            }
            return { rows: [] };
        });
        return raiz;
    }

    it('devuelve una prueba que verifica contra la raíz, con enlace a Polygonscan y la L2 pendiente', async () => {
        const raiz = preparar(FILAS);
        const p = await anchor.pruebaDe(BATCH, FILAS[2].id);
        expect(p.valid).toBe(true);
        expect(verificar(p.leaf, p.proof, raiz)).toBe(true);
        expect(p.networks.polygon).toEqual(expect.objectContaining({ status: 'confirmed', anchorIndex: 3, chainId: 137 }));
        expect(p.networks.polygon.explorer).toBe(`https://polygonscan.com/tx/0x${'d'.repeat(64)}`);
        expect(p.networks.l2).toBeNull();
    });

    it('si una fila del lote se alteró, no da prueba', async () => {
        preparar(FILAS.map((f, i) => (i === 0 ? { ...f, http_status: 201 } : f)));
        const p = await anchor.pruebaDe(BATCH, FILAS[2].id);
        expect(p.valid).toBe(false);
        expect(p.proof).toBeUndefined();
    });
});
