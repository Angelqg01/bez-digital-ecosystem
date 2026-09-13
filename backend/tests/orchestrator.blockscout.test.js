/**
 * Paginación de Blockscout.
 *
 * La API v2 no acepta `limit` como parámetro de query en estas rutas: pagina
 * con `next_page_params` y responde 422 ante el parámetro. Eso es lo que
 * mantenía en rojo `holder_analysis` en el humo E2E. El recorte se hace en
 * cliente, así que `limit` sigue significando lo mismo para quien llama.
 */
jest.mock('axios');
const axios = require('axios');
const { executeTool } = require('../services/orchestrator.service');

const holders = (n) => ({
    data: {
        items: Array.from({ length: n }, (_, i) => ({
            address: { hash: `0x${String(i).padStart(40, '0')}` },
            value: `${1000 - i}`,
            percentage: 1,
        })),
    },
});

beforeEach(() => jest.resetAllMocks());

describe('blockscout: holder_analysis', () => {
    test('no manda `limit` en la query — es lo que devolvía 422', async () => {
        axios.get.mockResolvedValue(holders(3));
        await executeTool('blockscout_explorer', { action: 'holder_analysis', limit: 2 });

        const url = axios.get.mock.calls[0][0];
        expect(url).toContain('/holders');
        expect(url).not.toContain('limit=');
        expect(url).not.toContain('?');
    });

    test('recorta en cliente al número pedido', async () => {
        axios.get.mockResolvedValue(holders(50));
        const r = await executeTool('blockscout_explorer', { action: 'holder_analysis', limit: 5 });

        expect(r.status).toBe('SUCCESS');
        expect(r.data.topHolders).toHaveLength(5);
        expect(r.data.totalHolders).toBe(5);
    });

    test('si llegan menos de los pedidos, devuelve los que hay', async () => {
        axios.get.mockResolvedValue(holders(2));
        const r = await executeTool('blockscout_explorer', { action: 'holder_analysis', limit: 10 });

        expect(r.data.topHolders).toHaveLength(2);
    });

    test('un 422 sigue siendo fallo nuestro y no se disfraza de ajeno', async () => {
        axios.get.mockRejectedValue({ response: { status: 422 }, message: 'Request failed with status code 422' });
        const r = await executeTool('blockscout_explorer', { action: 'holder_analysis', limit: 5 });

        expect(r.status).toBe('FAILED');
        expect(r.upstream).toBe(false);
        expect(r.httpStatus).toBe(422);
    });
});

describe('blockscout: transaction_history', () => {
    test('tampoco manda `limit` en la query y recorta en cliente', async () => {
        axios.get.mockResolvedValue({
            data: { items: Array.from({ length: 20 }, (_, i) => ({ hash: `0x${i}`, from: {}, to: {} })) },
        });
        const r = await executeTool('blockscout_explorer', { action: 'transaction_history', limit: 4 });

        expect(axios.get.mock.calls[0][0]).not.toContain('limit=');
        expect(r.data.transactions).toHaveLength(4);
    });
});
