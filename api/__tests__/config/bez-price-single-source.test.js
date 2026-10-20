/**
 * El precio de BEZ con el que se cobra y se entrega sale SÓLO de config/bez-price.js.
 *
 * token_price_cache tenía la semilla de 0,10 USD de la 006 y la liquidación, el
 * vigilante on-chain y la cotización de pedidos la leían antes que la
 * configuración (0,0075): una compra de 25 USD entregaba 250 BEZ en vez de 3.333.
 */
const fs = require('fs');
const path = require('path');
const { bezPublicado, precioUsd } = require('../../config/bez-price');

const RUTAS_DE_DINERO = [
    'services/paymentSettlement.js',
    'services/bezSettlementWatcher.js',
    'services/bezPayOrders.js',
    'services/aiBillingService.js',
];

describe('precio de BEZ: una sola fuente', () => {
    it.each(RUTAS_DE_DINERO)('%s no lee token_price_cache', (archivo) => {
        const codigo = fs.readFileSync(path.join(__dirname, '..', '..', archivo), 'utf8');
        expect(codigo).not.toMatch(/FROM\s+token_price_cache/i);
        expect(codigo).toMatch(/precioUsd\(\)/);
    });

    it('lo publicado es siempre el precio configurado, aunque la tabla diga otra cosa', () => {
        const env = { BEZ_PRICE_USD: '0.0075' };
        const viejo = bezPublicado({ price_usd: '0.10', change_24h: '5', updated_at: '2026-09-26T00:00:00Z' }, env);
        expect(viejo).toEqual({ priceUSD: 0.0075, change24h: 0, updatedAt: null, seed: true });

        const alineado = bezPublicado({ price_usd: '0.0075', change_24h: '1.5', updated_at: '2026-10-16T11:29:22Z' }, env);
        expect(alineado).toEqual({ priceUSD: 0.0075, change24h: 1.5, updatedAt: '2026-10-16T11:29:22Z', seed: false });

        expect(bezPublicado(undefined, env)).toMatchObject({ priceUSD: 0.0075, seed: true });
    });

    it('sin BEZ_PRICE_USD el precio es el de la fase semilla', () => {
        expect(precioUsd({})).toBe(0.0075);
    });
});
