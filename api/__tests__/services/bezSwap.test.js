/**
 * services/bezSwap — compraventa de BEZ en un DEX, sin custodia.
 */
const { ethers } = require('ethers');
const polygon = require('../../services/polygonReader');
const bezSwap = require('../../services/bezSwap');

const ROUTER = '0x' + 'a'.repeat(40);
const WALLET = '0x' + '4'.repeat(40);
const BEZ = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const iface = new ethers.Interface([
    'function approve(address spender, uint256 amount)',
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
]);

describe('bezSwap', () => {
    const envAntes = { ...process.env };
    afterEach(() => {
        process.env = { ...envAntes };
        polygon._setLlamador(null);
    });

    describe('sin pool configurado', () => {
        beforeEach(() => { delete process.env.BEZ_DEX_ROUTER; });

        it('el estado dice que no hay mercado y remite a BEZ-Pay', () => {
            const e = bezSwap.estado();
            expect(e.activo).toBe(false);
            expect(e.dex).toBeNull();
            expect(e.nota).toMatch(/BEZ-Pay/);
        });

        it('cotizar y preparar responden 503 DEX_NOT_CONFIGURED sin tocar la red', async () => {
            const llamador = jest.fn();
            polygon._setLlamador(llamador);
            await expect(bezSwap.cotizar({ lado: 'venta', importe: '10' }))
                .rejects.toMatchObject({ code: 'DEX_NOT_CONFIGURED', status: 503 });
            await expect(bezSwap.prepararSwap({ lado: 'venta', importe: '10', wallet: WALLET }))
                .rejects.toMatchObject({ code: 'DEX_NOT_CONFIGURED' });
            expect(llamador).not.toHaveBeenCalled();
        });
    });

    describe('con router configurado', () => {
        beforeEach(() => { process.env.BEZ_DEX_ROUTER = ROUTER; });

        it('venta: cotiza BEZ→USDC con 18 y 6 decimales', async () => {
            const llamador = jest.fn().mockResolvedValue([ethers.parseEther('1000'), 7_500_000n]);
            polygon._setLlamador(llamador);
            const q = await bezSwap.cotizar({ lado: 'venta', importe: '1000' });
            expect(q.recibes).toEqual({ activo: 'USDC', importe: '7.5' });
            const [dir, , fn, args] = llamador.mock.calls[0];
            expect(dir).toBe(ROUTER);
            expect(fn).toBe('getAmountsOut');
            expect(args[1]).toEqual([BEZ, USDC]);
        });

        it('compra: prepara approve de USDC y swap con mínimo según deslizamiento', async () => {
            polygon._setLlamador(jest.fn().mockResolvedValue([10_000_000n, ethers.parseEther('1333')]));
            const p = await bezSwap.prepararSwap({ lado: 'compra', importe: '10', wallet: WALLET, deslizamientoBps: 100 });

            const [approve, swap] = p.transacciones;
            expect(approve.to).toBe(USDC);
            const a = iface.decodeFunctionData('approve', approve.data);
            expect(a.spender.toLowerCase()).toBe(ROUTER);
            expect(a.amount).toBe(10_000_000n);

            expect(swap.to).toBe(ROUTER);
            const s = iface.decodeFunctionData('swapExactTokensForTokens', swap.data);
            expect(s.amountIn).toBe(10_000_000n);
            expect(s.amountOutMin).toBe(ethers.parseEther('1333') * 9900n / 10000n);
            expect(s.path).toEqual([USDC, BEZ]);
            expect(s.to).toBe(ethers.getAddress(WALLET));
            expect(Number(s.deadline)).toBeGreaterThan(Date.now() / 1000);
            expect(p.recibesMinimo.importe).toBe('1319.67');
        });

        it('sin par o sin reservas: 409 NO_LIQUIDITY', async () => {
            polygon._setLlamador(jest.fn().mockRejectedValue(Object.assign(new Error('execution reverted'), { code: 'CALL_EXCEPTION' })));
            await expect(bezSwap.cotizar({ lado: 'venta', importe: '1' })).rejects.toMatchObject({ code: 'NO_LIQUIDITY', status: 409 });
        });

        it('RPC caído: 503 DEX_UNAVAILABLE', async () => {
            polygon._setLlamador(jest.fn().mockRejectedValue(new Error('RPC sin respuesta')));
            await expect(bezSwap.cotizar({ lado: 'venta', importe: '1' })).rejects.toMatchObject({ code: 'DEX_UNAVAILABLE', status: 503 });
        });

        it('cotización cero: NO_LIQUIDITY', async () => {
            polygon._setLlamador(jest.fn().mockResolvedValue([1n, 0n]));
            await expect(bezSwap.cotizar({ lado: 'venta', importe: '1' })).rejects.toMatchObject({ code: 'NO_LIQUIDITY' });
        });

        it.each([
            [{ lado: 'regalo', importe: '1', wallet: WALLET }, 'INVALID_SIDE'],
            [{ lado: 'venta', importe: '-1', wallet: WALLET }, 'INVALID_AMOUNT'],
            [{ lado: 'compra', importe: '1.1234567', wallet: WALLET }, 'INVALID_AMOUNT'], // USDC: 6 decimales
            [{ lado: 'venta', importe: '0', wallet: WALLET }, 'INVALID_AMOUNT'],
            [{ lado: 'venta', importe: '1', wallet: 'no' }, 'INVALID_WALLET'],
            [{ lado: 'venta', importe: '1', wallet: WALLET, deslizamientoBps: 501 }, 'INVALID_SLIPPAGE'],
            [{ lado: 'venta', importe: '1', wallet: WALLET, plazoMin: 0 }, 'INVALID_DEADLINE'],
        ])('valida la entrada %#', async (entrada, code) => {
            polygon._setLlamador(jest.fn().mockResolvedValue([1n, 1n]));
            await expect(bezSwap.prepararSwap(entrada)).rejects.toMatchObject({ code });
        });
    });
});
