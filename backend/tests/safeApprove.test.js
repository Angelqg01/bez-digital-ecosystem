/**
 * Pruebas de `backend/utils/safeApprove.js`.
 *
 * Comprueban que el ayudante elige bien la vía sin que quien lo llama sepa qué
 * token tiene delante: usa `increaseAllowance`/`decreaseAllowance` si el
 * contrato desplegado los expone, y cae al patrón de poner a cero primero si
 * no —que es el caso del BEZ ya desplegado, que no es actualizable—.
 *
 * Los contratos se simulan aquí porque lo que se prueba es la lógica de
 * decisión. La misma lógica se prueba contra contratos reales en
 * `test/safeApprove.test.js`, con Hardhat.
 */

const { safeApprove } = require('../utils/safeApprove');

/**
 * Doble de un ERC-20.
 *
 * Funciones planas a propósito, no `jest.fn()`: la configuración del proyecto
 * activa `resetMocks`, que vaciaría la implementación antes de cada prueba.
 *
 * @param {object} opts
 * @param {bigint} opts.allowanceInicial
 * @param {boolean} opts.conAyudantes  Si el "contrato desplegado" los tiene.
 */
function tokenFalso({ allowanceInicial = 0n, conAyudantes = false, direccion = '0xToken' } = {}) {
    const estado = { allowance: allowanceInicial, enviadas: [] };
    let n = 0;
    const recibo = (etiqueta) => {
        const hash = `0x${etiqueta}${++n}`;
        estado.enviadas.push(etiqueta);
        return { hash, wait: async () => ({ hash }) };
    };

    const token = {
        target: direccion,
        getAddress: async () => direccion,
        allowance: async () => estado.allowance,
        approve: async (_spender, amount) => {
            estado.allowance = BigInt(amount);
            return recibo('approve');
        },
        __estado: estado,
    };

    if (conAyudantes) {
        token.increaseAllowance = async (_spender, added) => {
            estado.allowance += BigInt(added);
            return recibo('increase');
        };
        token.increaseAllowance.staticCall = async () => true;

        token.decreaseAllowance = async (_spender, sub) => {
            estado.allowance -= BigInt(sub);
            return recibo('decrease');
        };
        token.decreaseAllowance.staticCall = async () => true;
    }

    return token;
}

/** Token cuyo ABI declara los ayudantes pero el contrato NO los tiene. */
function tokenQueMiente(allowanceInicial) {
    const token = tokenFalso({ allowanceInicial, direccion: '0xMentiroso' });

    const revienta = async () => { throw new Error('call revert exception'); };
    token.increaseAllowance = async () => { throw new Error('no debería llamarse'); };
    token.increaseAllowance.staticCall = revienta;
    token.decreaseAllowance = async () => { throw new Error('no debería llamarse'); };
    token.decreaseAllowance.staticCall = revienta;

    return token;
}

describe('safeApprove (backend)', () => {
    describe('token con los ayudantes en cadena', () => {
        it('sube con increaseAllowance, en una sola transacción', async () => {
            const token = tokenFalso({ allowanceInicial: 100n, conAyudantes: true, direccion: '0xA' });

            const res = await safeApprove(token, '0xOwner', '0xSpender', 150n);

            expect(res.strategy).toBe('increaseAllowance');
            expect(res.txs).toHaveLength(1);
            expect(token.__estado.allowance).toBe(150n);
        });

        it('baja con decreaseAllowance', async () => {
            const token = tokenFalso({ allowanceInicial: 100n, conAyudantes: true, direccion: '0xB' });

            const res = await safeApprove(token, '0xOwner', '0xSpender', 40n);

            expect(res.strategy).toBe('decreaseAllowance');
            expect(token.__estado.allowance).toBe(40n);
        });
    });

    describe('token sin ayudantes (el BEZ ya desplegado)', () => {
        it('cae al patrón de cero primero, en dos transacciones y en ese orden', async () => {
            const token = tokenFalso({ allowanceInicial: 100n, direccion: '0xC' });

            const res = await safeApprove(token, '0xOwner', '0xSpender', 40n);

            expect(res.strategy).toBe('cero-primero');
            expect(res.txs).toHaveLength(2);
            expect(token.__estado.enviadas).toEqual(['approve', 'approve']);
            expect(token.__estado.allowance).toBe(40n);
        });

        it('no se fía del ABI: si el ayudante está declarado pero revierte, usa cero primero', async () => {
            // Es exactamente lo que pasa con el ABI guardado de BEZ si alguien
            // le añade los ayudantes sin redesplegar el contrato.
            const token = tokenQueMiente(100n);

            const res = await safeApprove(token, '0xOwner', '0xSpender', 200n);

            expect(res.strategy).toBe('cero-primero');
            expect(token.__estado.allowance).toBe(200n);
        });
    });

    describe('casos comunes', () => {
        it('desde cero aprueba directo, sin rodeo', async () => {
            const token = tokenFalso({ allowanceInicial: 0n, direccion: '0xD' });

            const res = await safeApprove(token, '0xOwner', '0xSpender', 75n);

            expect(res.strategy).toBe('approve-desde-cero');
            expect(res.txs).toHaveLength(1);
        });

        it('si ya está en el valor pedido, no envía nada', async () => {
            const token = tokenFalso({ allowanceInicial: 50n, conAyudantes: true, direccion: '0xE' });

            const res = await safeApprove(token, '0xOwner', '0xSpender', 50n);

            expect(res.skipped).toBe(true);
            expect(res.txs).toHaveLength(0);
            expect(token.__estado.enviadas).toEqual([]);
        });

        it('acepta la cantidad como cadena o número, no solo bigint', async () => {
            const token = tokenFalso({ allowanceInicial: 0n, direccion: '0xF' });

            await safeApprove(token, '0xOwner', '0xSpender', '1000');
            expect(token.__estado.allowance).toBe(1000n);
        });

        it('bajar a cero funciona sin ayudantes', async () => {
            const token = tokenFalso({ allowanceInicial: 100n, direccion: '0x10' });

            await safeApprove(token, '0xOwner', '0xSpender', 0n);
            expect(token.__estado.allowance).toBe(0n);
        });
    });
});
