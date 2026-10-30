/**
 * services/rwaMarket — consultar activos, transferir fracciones y venta primaria.
 */
const { ethers } = require('ethers');
const polygon = require('../../services/polygonReader');
const rwaMarket = require('../../services/rwaMarket');
const { FABRICAS } = require('../../services/rwaTokenization');

const SALE = '0x' + '5'.repeat(40);
const CREADOR = ethers.getAddress('0x' + 'c'.repeat(40));
const COMPRADOR = '0x' + 'b'.repeat(40);
const BEZ = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const iface = new ethers.Interface([
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
    'function setApprovalForAll(address operator, bool approved)',
    'function list(uint256 assetId, uint256 amount, uint256 pricePerFraction)',
    'function buy(uint256 listingId, uint256 amount, uint256 maxPricePerFraction)',
    'function approve(address spender, uint256 amount)',
]);

const activo = (over = {}) => ({
    name: 'Nave Algeciras', category: 7n, legalDocumentCID: 'QmLegal', imagesCID: '', totalSupply: 1000n,
    valuationUSD: 500000n, pricePerFraction: ethers.parseEther('10'), estimatedYield: 850n, creator: CREADOR,
    location: 'Algeciras', createdAt: 1790000000n, isActive: true, ...over,
});
const oferta = (over = {}) => ({ assetId: 3n, seller: CREADOR, pricePerFraction: ethers.parseEther('10'), remaining: 50n, active: true, ...over });

/** Llamador falso: responde según la función. */
function fake({ asset = activo(), listing = oferta(), verificado = false } = {}) {
    const fn = jest.fn(async (_dir, _abi, f) => {
        if (f === 'getAsset') return asset;
        if (f === 'listings') return listing;
        if (f === 'isVerified') return verificado;
        if (f === 'getCreatorAssets') return [1n, 3n];
        throw new Error(`inesperado ${f}`);
    });
    polygon._setLlamador(fn);
    return fn;
}

describe('rwaMarket', () => {
    const envAntes = { ...process.env };
    afterEach(() => {
        process.env = { ...envAntes };
        polygon._setLlamador(null);
    });

    describe('consultas', () => {
        it('formatea la ficha del activo', async () => {
            fake();
            const a = await rwaMarket.leerActivo({ assetId: 3 });
            expect(a).toMatchObject({
                assetId: '3', categoria: 'objeto', fracciones: '1000', precioFraccionBez: '10.0',
                rendimientoAnualPct: 8.5, creador: CREADOR, activo: true, requiereKyc: false,
                contrato: FABRICAS.activos.direccion,
            });
        });

        it('inmueble marca requiereKyc', async () => {
            fake({ asset: activo({ category: 0n }) });
            expect((await rwaMarket.leerActivo({ assetId: 3 })).requiereKyc).toBe(true);
        });

        it('un id que no existe es 404, no un 500', async () => {
            polygon._setLlamador(jest.fn().mockRejectedValue(Object.assign(new Error('Invalid asset ID'), { code: 'CALL_EXCEPTION' })));
            await expect(rwaMarket.leerActivo({ assetId: 999 })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
        });

        it('fábrica desconocida: 400', async () => {
            await expect(rwaMarket.leerActivo({ fabrica: 'otra', assetId: 1 })).rejects.toMatchObject({ code: 'INVALID_FACTORY' });
        });

        it('lista los activos de un creador', async () => {
            fake();
            expect((await rwaMarket.activosDeCreador({ creador: CREADOR })).assetIds).toEqual(['1', '3']);
        });
    });

    it('prepara la transferencia de fracciones contra la fábrica correcta', () => {
        const r = rwaMarket.prepararTransferencia({ fabrica: 'industrial', assetId: 3, desde: CREADOR, hacia: COMPRADOR, cantidad: 7 });
        const [tx] = r.transacciones;
        expect(tx.to).toBe(FABRICAS.industrial.direccion);
        const d = iface.decodeFunctionData('safeTransferFrom', tx.data);
        expect([d.from, d.id, d.amount]).toEqual([CREADOR, 3n, 7n]);
        expect(() => rwaMarket.prepararTransferencia({ assetId: 3, desde: CREADOR, hacia: CREADOR, cantidad: 1 }))
            .toThrow(/misma wallet/);
    });

    describe('venta primaria', () => {
        it('sin contrato desplegado: 503 SALE_NOT_DEPLOYED', async () => {
            delete process.env.RWA_PRIMARY_SALE_ADDRESS;
            const llamador = fake();
            await expect(rwaMarket.leerOferta({ listingId: 1 })).rejects.toMatchObject({ code: 'SALE_NOT_DEPLOYED', status: 503 });
            await expect(rwaMarket.prepararCompra({ listingId: 1, cantidad: 1, comprador: COMPRADOR }))
                .rejects.toMatchObject({ code: 'SALE_NOT_DEPLOYED' });
            expect(llamador).not.toHaveBeenCalled();
        });

        describe('con contrato', () => {
            beforeEach(() => { process.env.RWA_PRIMARY_SALE_ADDRESS = SALE; });

            it('la oferta la abre sólo el creador', async () => {
                fake();
                await expect(rwaMarket.prepararOferta({ assetId: 3, cantidad: 10, precioFraccionBez: '12', vendedor: COMPRADOR }))
                    .rejects.toMatchObject({ code: 'NOT_CREATOR', status: 403 });
            });

            it('prepara aprobar al contrato de venta y publicar la oferta', async () => {
                fake();
                const r = await rwaMarket.prepararOferta({ assetId: 3, cantidad: 10, precioFraccionBez: '12.5', vendedor: CREADOR });
                const [aprobar, listar] = r.transacciones;
                expect(aprobar.to).toBe(FABRICAS.activos.direccion);
                expect(iface.decodeFunctionData('setApprovalForAll', aprobar.data)).toEqual([ethers.getAddress(SALE), true]);
                expect(listar.to).toBe(SALE);
                expect(iface.decodeFunctionData('list', listar.data)).toEqual([3n, 10n, ethers.parseEther('12.5')]);
            });

            it('la compra cobra el precio de la oferta y fija ese precio como máximo', async () => {
                fake();
                const r = await rwaMarket.prepararCompra({ listingId: 4, cantidad: 3, comprador: COMPRADOR });
                const [aprobar, comprar] = r.transacciones;
                expect(aprobar.to).toBe(BEZ);
                expect(iface.decodeFunctionData('approve', aprobar.data)).toEqual([ethers.getAddress(SALE), ethers.parseEther('30')]);
                expect(iface.decodeFunctionData('buy', comprar.data)).toEqual([4n, 3n, ethers.parseEther('10')]);
                expect(r.compra.totalBez).toBe('30.0');
            });

            it('inmueble sin KYC: 409 KYC_REQUIRED antes de firmar', async () => {
                fake({ asset: activo({ category: 0n }), verificado: false });
                await expect(rwaMarket.prepararCompra({ listingId: 4, cantidad: 1, comprador: COMPRADOR }))
                    .rejects.toMatchObject({ code: 'KYC_REQUIRED', status: 409 });
            });

            it('sin comprobar KYC (MCP) no consulta nada sobre el comprador y avisa', async () => {
                const llamador = fake({ asset: activo({ category: 0n }) });
                const r = await rwaMarket.prepararCompra({ listingId: 4, cantidad: 1, comprador: COMPRADOR, comprobarKyc: false });
                expect(llamador.mock.calls.map((c) => c[2])).not.toContain('isVerified');
                expect(r.aviso).toMatch(/KYC/);
            });

            it.each([
                [oferta({ active: false }), 'LISTING_CLOSED'],
                [oferta({ remaining: 2n }), 'LISTING_CLOSED'],
                [oferta({ seller: ethers.ZeroAddress }), 'NOT_FOUND'],
            ])('rechaza ofertas no comprables %#', async (listing, code) => {
                fake({ listing });
                await expect(rwaMarket.prepararCompra({ listingId: 4, cantidad: 3, comprador: COMPRADOR }))
                    .rejects.toMatchObject({ code });
            });

            it('activo desactivado: ASSET_INACTIVE', async () => {
                fake({ asset: activo({ isActive: false }) });
                await expect(rwaMarket.prepararCompra({ listingId: 4, cantidad: 1, comprador: COMPRADOR }))
                    .rejects.toMatchObject({ code: 'ASSET_INACTIVE' });
            });
        });
    });
});
