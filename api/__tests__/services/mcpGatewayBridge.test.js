'use strict';

jest.mock('../../db/pool', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../services/contractService', () => ({
    getContractAddress: jest.fn(),
    getContract: jest.fn(),
    getTokenInfo: jest.fn(),
    getDEXPool: jest.fn(),
}));

const contractService = require('../../services/contractService');
const bridge = require('../../services/mcpGatewayBridge');

const BEZ = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

beforeEach(() => jest.resetAllMocks());

describe('MCP bridge: cadena por defecto y BEZ', () => {
    test('token_info usa Polygon y BEZCoin, no 31337/BEZCoinV2', async () => {
        contractService.getTokenInfo.mockResolvedValue({ name: 'BEZ', totalSupply: '3000000000' });
        const info = await bridge.tokenInfo({});
        expect(contractService.getTokenInfo).toHaveBeenCalledWith('BEZCoin', 137);
        expect(info.source).toBe('onchain');
    });

    test('token_info sin nodo devuelve lo que no depende de él, sin inventar supply', async () => {
        contractService.getTokenInfo.mockRejectedValue(new Error('rpc down'));
        contractService.getContractAddress.mockResolvedValue(BEZ);
        const info = await bridge.tokenInfo({});
        expect(info).toMatchObject({ source: 'unavailable', address: BEZ, totalSupply: null });
    });
});

describe('MCP bridge: DEX', () => {
    test('sin DEX desplegado la cotización es un estado explícito, no un error', async () => {
        contractService.getContractAddress.mockResolvedValue(null);
        const r = await bridge.dexQuote({ from: 'BEZ', to: 'USDT', amount: '100' });
        expect(r).toMatchObject({ disponible: false, motivo: 'dex_no_desplegado', chainId: 137 });
        expect(contractService.getContract).not.toHaveBeenCalled();
    });

    test('mismo token de origen y destino', async () => {
        const r = await bridge.dexQuote({ from: 'BEZ', to: 'BEZ', amount: '1' });
        expect(r.motivo).toBe('mismo_token');
    });

    test('con DEX, traduce símbolos a direcciones y respeta los 6 decimales de USDT', async () => {
        contractService.getContractAddress.mockResolvedValue(BEZ);
        const quoteSwap = jest.fn().mockResolvedValue(75_000_000n); // 75 USDT con 6 decimales
        contractService.getContract.mockResolvedValue({
            quoteSwap,
            getPool: jest.fn().mockResolvedValue({ exists: true, reserve0: 1n, reserve1: 1n }),
        });
        const r = await bridge.dexQuote({ from: 'BEZ', to: 'USDT', amount: '10000' });
        const [tin, tout, amountIn] = quoteSwap.mock.calls[0];
        expect(tin).toBe(BEZ);
        expect(tout).toBe('0xc2132D05D31c914a87C6611C10748AEb04B58e8F');
        expect(amountIn).toBe(10000n * 10n ** 18n);
        expect(r).toMatchObject({ disponible: true, amountOut: '75.0' });
    });

    test('BNB no existe en Polygon', async () => {
        contractService.getContractAddress.mockResolvedValue(BEZ);
        const r = await bridge.dexQuote({ from: 'BEZ', to: 'BNB', amount: '1' });
        expect(r).toMatchObject({ disponible: false, motivo: 'token_no_disponible_en_cadena', token: 'BNB' });
    });

    test('par sin pool: pool_inexistente, sin llamar a quoteSwap', async () => {
        contractService.getContractAddress.mockResolvedValue(BEZ);
        const quoteSwap = jest.fn();
        contractService.getContract.mockResolvedValue({ quoteSwap, getPool: jest.fn().mockResolvedValue({ exists: false }) });
        const r = await bridge.dexQuote({ from: 'BEZ', to: 'USDT', amount: '1' });
        expect(r).toMatchObject({ disponible: false, motivo: 'pool_inexistente', par: 'BEZ/USDT' });
        expect(quoteSwap).not.toHaveBeenCalled();
    });

    test('pool creada sin liquidez: pool_sin_liquidez', async () => {
        contractService.getContractAddress.mockResolvedValue(BEZ);
        contractService.getContract.mockResolvedValue({ quoteSwap: jest.fn(), getPool: jest.fn().mockResolvedValue({ exists: true, reserve0: 0n, reserve1: 0n }) });
        const r = await bridge.dexQuote({ from: 'BEZ', to: 'USDC', amount: '1' });
        expect(r.motivo).toBe('pool_sin_liquidez');
    });
});
