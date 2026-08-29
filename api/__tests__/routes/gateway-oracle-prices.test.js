/**
 * GET /api/gateway/v1/oracle/token-prices — precio público del oráculo.
 *
 * Es el único endpoint de precio sin autenticación: lo consume la portada, cuyo
 * hook no lleva credenciales. Antes solo existía `/token/price`, que exige API
 * key o JWT, así que la landing recibía un 404 y pintaba "Oraculo pendiente".
 *
 * Lo que se protege aquí: que siga siendo público, que devuelva la forma que el
 * consumidor sabe leer, que no reviente sin datos y que no filtre nada más que
 * precio de mercado.
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const PATH = '/api/gateway/v1/oracle/token-prices';
const priceRow = (over = {}) => ({
    symbol: 'BEZ', price_usd: '0.25000000', change_24h: '3.5000',
    updated_at: '2026-08-14T05:00:00.000Z', ...over,
});

// El endpoint memoriza la respuesta unos segundos; sin desactivarlo, un test
// vería el cuerpo servido al anterior.
beforeAll(() => { process.env.ORACLE_PRICE_TTL_MS = '0'; });

describe('Gateway oracle prices (público)', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('responde sin API key ni JWT', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const res = await request(app).get(PATH);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('devuelve la forma que el consumidor sabe leer', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const res = await request(app).get(PATH);
        expect(res.body.tokens.BEZ).toMatchObject({
            symbol: 'BEZ', priceUSD: 0.25, change24h: 3.5,
        });
        // Claves planas: la portada también las acepta como alternativa.
        expect(res.body.bezCoinPriceUSD).toBe(0.25);
        expect(res.body.bezCoinChange24h).toBe(3.5);
    });

    it('expone cada símbolo cacheado por su nombre', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [priceRow(), priceRow({ symbol: 'BEZCoinV2', price_usd: '1.50000000' })],
            rowCount: 2,
        });
        const res = await request(app).get(PATH);
        expect(Object.keys(res.body.tokens).sort()).toEqual(['BEZ', 'BEZCoinV2']);
        expect(res.body.tokens.BEZCoinV2.priceUSD).toBe(1.5);
    });

    it('sin fila en caché cae al precio semilla en vez de romper la portada', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app).get(PATH);
        expect(res.status).toBe(200);
        expect(res.body.tokens.BEZ).toMatchObject({ priceUSD: 0.1, seed: true });
    });

    it('si la consulta falla tampoco devuelve 500', async () => {
        mockQuery.mockRejectedValueOnce(new Error('db down'));
        const res = await request(app).get(PATH);
        expect(res.status).toBe(200);
        expect(res.body.tokens.BEZ.seed).toBe(true);
    });

    it('solo publica dato de mercado, nada por usuario', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const res = await request(app).get(PATH);
        expect(Object.keys(res.body.tokens.BEZ).sort())
            .toEqual(['change24h', 'priceUSD', 'symbol', 'updatedAt']);
        // La consulta no lleva ningún filtro por identidad.
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toMatch(/FROM token_price_cache/i);
        expect(params).toBeUndefined();
    });

    it('deja cachear la respuesta', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const res = await request(app).get(PATH);
        expect(res.headers['cache-control']).toMatch(/public/);
    });

    it('el endpoint autenticado sigue exigiendo credenciales', async () => {
        const res = await request(app).get('/api/gateway/v1/token/price');
        expect(res.status).toBe(401);
    });

    // ── Campos que consume el panel de oráculo de la portada ──────────────
    // Se añadieron sin tocar los de arriba; si alguno desaparece, el panel deja
    // de poder distinguir un precio vigente de uno caducado.

    it('publica la ventana de frescura para que el consumidor marque lo obsoleto', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const res = await request(app).get(PATH);
        expect(typeof res.body.freshnessWindow).toBe('number');
        expect(res.body.freshnessWindow).toBeGreaterThan(0);
    });

    it('la ventana de frescura es configurable por entorno', async () => {
        process.env.ORACLE_FRESHNESS_WINDOW_S = '300';
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const res = await request(app).get(PATH);
        expect(res.body.freshnessWindow).toBe(300);
        delete process.env.ORACLE_FRESHNESS_WINDOW_S;
    });

    it('distingue el precio del oráculo del precio semilla', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const real = await request(app).get(PATH);
        expect(real.body.source).toBe('bezhas-oracle');

        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        const seeded = await request(app).get(PATH);
        expect(seeded.body.source).toBe('seed');
    });

    it('markets es siempre un array, aun sin tabla de mercados', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        mockQuery.mockRejectedValueOnce(new Error('relation "token_market_cache" does not exist'));
        const res = await request(app).get(PATH);
        expect(Array.isArray(res.body.markets)).toBe(true);
        expect(res.body.markets.map((m) => m.chainId).sort((a, b) => a - b)).toEqual([56, 137]);
    });

    it('sin pool declara el par pendiente en vez de inventarse precio', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app).get(PATH);
        for (const m of res.body.markets) {
            expect(m.status).toBe('pending');
            expect(m.price).toBeNull();
            expect(m.liquidityUsd).toBe(0);
        }
    });

    it('refleja el mercado real cuando la tabla lo tiene', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({
            rows: [{
                chain_id: 137, pool: 'QuickSwap V3', price_usd: '0.25000000',
                liquidity_usd: '42000', status: 'active',
            }],
            rowCount: 1,
        });
        const res = await request(app).get(PATH);
        const polygon = res.body.markets.find((m) => m.chainId === 137);
        expect(polygon).toMatchObject({
            pool: 'QuickSwap V3', price: 0.25, liquidityUsd: 42000, status: 'active',
        });
        // La cadena sin fila sigue saliendo, en pendiente: el panel pinta dos tarjetas.
        expect(res.body.markets.find((m) => m.chainId === 56).status).toBe('pending');
    });

    it('los campos nuevos no desplazan a los que ya consumía la portada', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const res = await request(app).get(PATH);
        expect(res.body.tokens.BEZ.priceUSD).toBe(0.25);
        expect(res.body.bezCoinPriceUSD).toBe(0.25);
        expect(res.body.price).toBe(0.25);
    });

    it('el precio semilla no se sella con la hora actual', async () => {
        // Si el semilla llevara `updatedAt: now`, la portada lo pintaría "En
        // vivo": un valor de configuración presentándose como cotización recién
        // leída. Con null no se puede calcular antigüedad y sale obsoleto.
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app).get(PATH);
        expect(res.body.tokens.BEZ.seed).toBe(true);
        expect(res.body.tokens.BEZ.updatedAt).toBeNull();
        expect(res.body.source).toBe('seed');
    });

    it('un estado de mercado desconocido se degrada a pendiente', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({
            rows: [{
                chain_id: 137, pool: 'QuickSwap V3', price_usd: '0.25000000',
                liquidity_usd: '42000', status: 'DROP TABLE users',
            }],
            rowCount: 1,
        });
        const res = await request(app).get(PATH);
        expect(res.body.markets.find((m) => m.chainId === 137).status).toBe('pending');
    });

    it('una fila de una cadena no declarada no entra en la respuesta', async () => {
        // La lista de cadenas la fija el código, no la base: una fila inesperada
        // no puede añadir un mercado a una respuesta pública sin autenticar.
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({
            rows: [{ chain_id: 999, pool: 'Rogue', price_usd: '99', liquidity_usd: '1', status: 'active' }],
            rowCount: 1,
        });
        const res = await request(app).get(PATH);
        expect(res.body.markets.map((m) => m.chainId).sort((a, b) => a - b)).toEqual([56, 137]);
    });

    it('cada mercado publica la direccion del token en su cadena', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        const res = await request(app).get(PATH);
        const byChain = Object.fromEntries(res.body.markets.map((m) => [m.chainId, m.address]));
        expect(byChain[137]).toBe('0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8');
        expect(byChain[56]).toBe('0x8a1e3930fde1f151471c368fdbb39f3f63a65b55');
    });

    it('una liquidez ilegible cuenta como cero, no como NaN', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [priceRow()], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({
            rows: [{ chain_id: 56, pool: 'PancakeSwap V3', price_usd: null, liquidity_usd: null, status: 'pending' }],
            rowCount: 1,
        });
        const res = await request(app).get(PATH);
        const bnb = res.body.markets.find((m) => m.chainId === 56);
        expect(bnb.liquidityUsd).toBe(0);
        expect(bnb.price).toBeNull();
    });
});
