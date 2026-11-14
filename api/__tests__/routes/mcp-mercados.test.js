/**
 * Herramientas MCP de mercado: swap de BEZ y venta primaria RWA.
 */
const polygon = require('../../services/polygonReader');
const rwaMarket = require('../../services/rwaMarket');
const rwaRent = require('../../services/rwaRent');
const { getTool } = require('../../config/mcp-tools');

describe('MCP: mercados de BEZ y RWA', () => {
    const envAntes = { ...process.env };
    afterEach(() => {
        process.env = { ...envAntes };
        polygon._setLlamador(null);
        jest.restoreAllMocks();
    });

    it.each([
        ['bezhas_bez_swap_quote', 0, undefined],
        ['bezhas_bez_swap_prepare', 1, true],
        ['bezhas_rwa_asset', 0, undefined],
        ['bezhas_rwa_sale_listing', 0, undefined],
        ['bezhas_rwa_sale_list_prepare', 1, true],
        ['bezhas_rwa_sale_buy_prepare', 1, true],
        ['bezhas_rwa_rent_distribution', 0, undefined],
        ['bezhas_rwa_rent_distributions', 0, undefined],
        ['bezhas_rwa_rent_distribute_prepare', 1, true],
        ['bezhas_rwa_rent_claim_prepare', 1, true],
    ])('%s existe con nivel %i y scope contracts', (nombre, nivel, destinatario) => {
        const t = getTool(nombre);
        expect(t).toBeTruthy();
        expect(t.nivelRiesgo || 0).toBe(nivel);
        expect(t.recibeDestinatario).toBe(destinatario);
        expect(t.scope).toBe('contracts');
    });

    it('el swap sin pool devuelve DEX_NOT_CONFIGURED', async () => {
        delete process.env.BEZ_DEX_ROUTER;
        await expect(getTool('bezhas_bez_swap_quote').handler({ args: { lado: 'venta', importe: '1' } }))
            .rejects.toMatchObject({ name: 'SwapError', code: 'DEX_NOT_CONFIGURED' });
    });

    it('la compra de fracciones por MCP no consulta el KYC del comprador', async () => {
        const spy = jest.spyOn(rwaMarket, 'prepararCompra').mockResolvedValue({ ok: true });
        await getTool('bezhas_rwa_sale_buy_prepare').handler({
            args: { listing_id: 1, cantidad: 2, destino: '0x' + 'b'.repeat(40) },
        });
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ comprobarKyc: false, comprador: '0x' + 'b'.repeat(40) }));
    });

    it('el cobro de rentas por MCP no consulta el KYC de la wallet', async () => {
        const spy = jest.spyOn(rwaRent, 'prepararReclamo').mockResolvedValue({ ok: true });
        await getTool('bezhas_rwa_rent_claim_prepare').handler({
            args: { distribution_id: 4, destino: '0x' + 'b'.repeat(40) },
        });
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            comprobarKyc: false, cuenta: '0x' + 'b'.repeat(40), distributionId: 4,
        }));
    });

    it('preparar un reparto traduce los argumentos MCP al servicio', async () => {
        const spy = jest.spyOn(rwaRent, 'prepararReparto').mockResolvedValue({ ok: true });
        await getTool('bezhas_rwa_rent_distribute_prepare').handler({
            args: { asset_id: 3, importe: '900', token: 'usdc', plazo_dias: 45, detalles_cid: 'QmJustificanteX1', origen: '0x' + 'c'.repeat(40) },
        });
        expect(spy).toHaveBeenCalledWith({
            fabrica: 'activos', assetId: 3, emisor: '0x' + 'c'.repeat(40), token: 'usdc',
            importe: '900', plazoDias: 45, detallesCID: 'QmJustificanteX1',
        });
    });

    it('sin contrato de reparto, leer un reparto devuelve DISTRIBUTOR_NOT_DEPLOYED', async () => {
        delete process.env.RWA_RENT_DISTRIBUTOR_ADDRESS;
        await expect(getTool('bezhas_rwa_rent_distribution').handler({ args: { distribution_id: 1 } }))
            .rejects.toMatchObject({ name: 'RwaRentError', code: 'DISTRIBUTOR_NOT_DEPLOYED' });
    });
});
