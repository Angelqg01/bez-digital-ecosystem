/**
 * Herramientas MCP de mercado: swap de BEZ y venta primaria RWA.
 */
const polygon = require('../../services/polygonReader');
const rwaMarket = require('../../services/rwaMarket');
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
});
