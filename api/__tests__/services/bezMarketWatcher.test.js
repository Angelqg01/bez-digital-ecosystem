const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...a) => mockQuery(...a) }));

const { computeMarket, refreshOnce } = require('../../services/bezMarketWatcher');

const USDC = (n) => BigInt(Math.round(n * 1e6));            // 6 decimales
const BEZ = (n) => BigInt(Math.round(n * 1e6)) * 10n ** 12n; // 18 decimales, sin perder precisión

describe('computeMarket', () => {
    it('con liquidez suficiente publica el precio del pool', () => {
        // 30.000 USDC contra 4.000.000 BEZ → 0,0075 USD por BEZ; liquidez 60.000 USD
        const m = computeMarket({ usdcReserve: USDC(30_000), bezReserve: BEZ(4_000_000) });
        expect(m.status).toBe('active');
        expect(m.priceUsd).toBeCloseTo(0.0075, 8);
        expect(m.liquidityUsd).toBe(60_000);
    });

    it('un pool de polvo (el real a 2026-10-26) no publica precio: 1 unidad mínima de USDC', () => {
        const m = computeMarket({ usdcReserve: 1n, bezReserve: 36_514_837_168n });
        expect(m.status).toBe('pending');
        expect(m.priceUsd).toBeNull();
        expect(m.liquidityUsd).toBeLessThan(0.01);
    });

    it('por debajo del mínimo configurado queda pending, con la liquidez real', () => {
        const m = computeMarket({ usdcReserve: USDC(100), bezReserve: BEZ(13_333) }, 5_000);
        expect(m).toEqual({ priceUsd: null, liquidityUsd: 200, status: 'pending' });
    });

    it('sin BEZ en el pool no divide por cero', () => {
        expect(computeMarket({ usdcReserve: USDC(50_000), bezReserve: 0n }).status).toBe('pending');
    });
});

describe('refreshOnce', () => {
    const pairAbiFor = (usdcIsToken0, reserves) => ({
        getPair: async () => '0x4edc77DE01f2A2c87611c2F8e9249Be43dF745A9',
        token0: async () => (usdcIsToken0 ? '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' : '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'),
        getReserves: async () => reserves,
    });

    beforeEach(() => mockQuery.mockReset().mockResolvedValue({ rows: [] }));

    // makeContract falso: el mismo objeto responde a las llamadas del factory y del par.
    const run = (contract) => refreshOnce({}, () => contract);

    it('escribe pending y sin precio cuando el pool es polvo, con el USDC en token0', async () => {
        const out = await run(pairAbiFor(true, [1n, 36_514_837_168n, 1779392369]));
        expect(out.status).toBe('pending');
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toMatch(/ON CONFLICT \(chain_id\)/);
        expect(params[0]).toBe(137);
        expect(params[3]).toBeNull();      // price_usd
        expect(params[5]).toBe('pending'); // status
    });

    it('interpreta bien las reservas cuando el USDC es token1 y publica precio real', async () => {
        const out = await run(pairAbiFor(false, [BEZ(4_000_000), USDC(30_000), 1]));
        expect(out.status).toBe('active');
        expect(mockQuery.mock.calls[0][1][3]).toBeCloseTo(0.0075, 8);
    });
});
