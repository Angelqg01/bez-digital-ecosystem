/**
 * Keeper del TWAP de BeZhasDEX: sólo envía cuando toca, y se niega en los casos peligrosos.
 */
const { ethers } = require('ethers');
const { ejecutar, KeeperError, ESTADOS } = require('../../services/dexKeeper');

const DEX = '0x00000000000000000000000000000000000d3001';
const A = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const B = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const KEEPER = '0x1111111111111111111111111111111111111111';
const AHORA = 1_800_000_000;
const PERIODO = 1800;

function entorno({ chainId = 137, saldo = ethers.parseEther('1'), gasGwei = 40, observadoHace = 3600, pool = {}, txError = null } = {}) {
    const tx = { hash: '0xabc', wait: jest.fn(async () => ({ blockNumber: 99 })) };
    const update = jest.fn(async () => { if (txError) throw txError; return tx; });
    update.staticCall = jest.fn(async () => undefined);
    const dex = {
        TWAP_PERIOD: jest.fn(async () => PERIODO),
        pairId: jest.fn(async () => '0x' + '22'.repeat(32)),
        getPool: jest.fn(async () => ({ exists: true, reserve0: 5n, reserve1: 7n, ...pool })),
        observations: jest.fn(async () => ({ timestamp: observadoHace === null ? 0 : AHORA - observadoHace })),
        updateObservation: update,
    };
    return {
        dex, update, tx,
        base: {
            provider: {
                getNetwork: jest.fn(async () => ({ chainId: BigInt(chainId) })),
                getFeeData: jest.fn(async () => ({ maxFeePerGas: ethers.parseUnits(String(gasGwei), 'gwei') })),
                getBalance: jest.fn(async () => saldo),
            },
            signer: { getAddress: jest.fn(async () => KEEPER) },
            dexAddress: DEX, tokenA: A, tokenB: B, expectedChainId: 137,
            ahora: () => AHORA,
            crearContrato: () => dex,
            esProtegida: () => false,
        },
    };
}

describe('dexKeeper', () => {
    test('observación vieja: envía updateObservation y espera confirmaciones', async () => {
        const { base, update, tx } = entorno({ observadoHace: 3600 });
        const r = await ejecutar(base);
        expect(r).toMatchObject({ estado: ESTADOS.ACTUALIZADA, txHash: '0xabc', bloque: 99 });
        expect(update).toHaveBeenCalledWith(A, B);
        expect(tx.wait).toHaveBeenCalledWith(2, 120000);
    });

    test('nunca observada (timestamp 0): envía', async () => {
        const { base, update } = entorno({ observadoHace: null });
        expect((await ejecutar(base)).estado).toBe(ESTADOS.ACTUALIZADA);
        expect(update).toHaveBeenCalledTimes(1);
    });

    test('por defecto mide la edad con el reloj de la cadena, no con el de la máquina', async () => {
        const { base, update } = entorno({ observadoHace: 3600 });
        const { ahora, ...sinReloj } = base;
        // Reloj de la cadena = AHORA: la observación tiene 1 h y toca, aunque la máquina diga otra hora.
        sinReloj.provider.getBlock = jest.fn(async () => ({ timestamp: AHORA }));
        expect((await ejecutar(sinReloj)).estado).toBe(ESTADOS.ACTUALIZADA);
        expect(sinReloj.provider.getBlock).toHaveBeenCalledWith('latest');
        expect(update).toHaveBeenCalledTimes(1);
    });

    test('observación reciente: no gasta gas y dice cuánto falta', async () => {
        const { base, update } = entorno({ observadoHace: 600 });
        const r = await ejecutar(base);
        expect(r).toMatchObject({ estado: ESTADOS.NO_TOCA, edadSegundos: 600, proximaEnSegundos: PERIODO - 600 });
        expect(update).not.toHaveBeenCalled();
    });

    test('justo en el límite del periodo ya toca', async () => {
        const { base } = entorno({ observadoHace: PERIODO });
        expect((await ejecutar(base)).estado).toBe(ESTADOS.ACTUALIZADA);
    });

    test('pool sin liquidez o inexistente: no envía', async () => {
        for (const pool of [{ reserve0: 0n }, { reserve1: 0n }, { exists: false }]) {
            const { base, update } = entorno({ pool });
            expect((await ejecutar(base)).estado).toBe(ESTADOS.SIN_LIQUIDEZ);
            expect(update).not.toHaveBeenCalled();
        }
    });

    test('gas por encima del tope: se salta la pasada sin error', async () => {
        const { base, update } = entorno({ gasGwei: 500 });
        const r = await ejecutar({ ...base, maxGwei: 300 });
        expect(r).toMatchObject({ estado: ESTADOS.GAS_ALTO, gwei: 500 });
        expect(update).not.toHaveBeenCalled();
    });

    test('RPC de otra cadena: se niega a enviar', async () => {
        const { base, update } = entorno({ chainId: 1 });
        await expect(ejecutar(base)).rejects.toMatchObject({ code: 'CHAIN_MISMATCH' });
        expect(update).not.toHaveBeenCalled();
    });

    test('clave de una dirección protegida (tesorería, Hot Wallet): se niega', async () => {
        const { base, update } = entorno();
        await expect(ejecutar({ ...base, esProtegida: () => true })).rejects.toMatchObject({ code: 'PROTECTED_KEY' });
        expect(update).not.toHaveBeenCalled();
    });

    test('la guarda real reconoce la Hot Wallet y la Treasury DAO', () => {
        const { esDireccionProtegida } = require('../../services/hotKeyGuard');
        expect(esDireccionProtegida('0x52Df82920CBAE522880dD7657e43d1A754eD044E')).toBe(true);
        expect(esDireccionProtegida('0x89c23890c742d710265dD61be789C71dC8999b12')).toBe(true);
        expect(esDireccionProtegida(KEEPER)).toBe(false);
    });

    test('clave sin saldo para el gas: falla en voz alta (para que salte la alerta)', async () => {
        const { base, update } = entorno({ saldo: ethers.parseEther('0.001') });
        await expect(ejecutar(base)).rejects.toMatchObject({ code: 'BALANCE_LOW' });
        expect(update).not.toHaveBeenCalled();
    });

    test('dry-run simula y no envía', async () => {
        const { base, update } = entorno();
        const r = await ejecutar({ ...base, dryRun: true });
        expect(r.estado).toBe(ESTADOS.SIMULADA);
        expect(update.staticCall).toHaveBeenCalledWith(A, B);
        expect(update).not.toHaveBeenCalled();
    });

    test('si otro keeper llega antes (ObservationTooRecent) cuenta como «no toca», no como fallo', async () => {
        const { base } = entorno({ txError: Object.assign(new Error('execution reverted'), { revert: { name: 'ObservationTooRecent' } }) });
        expect((await ejecutar(base)).estado).toBe(ESTADOS.NO_TOCA);
    });

    test('si las confirmaciones no llegan a tiempo falla con WAIT_TIMEOUT y el hash para revisarla', async () => {
        const { base, tx } = entorno();
        tx.wait = jest.fn(async () => { throw Object.assign(new Error('timeout exceeded'), { code: 'TIMEOUT' }); });
        await expect(ejecutar({ ...base, waitTimeoutMs: 5000 })).rejects.toMatchObject({ code: 'WAIT_TIMEOUT', message: expect.stringContaining('0xabc') });
        expect(tx.wait).toHaveBeenCalledWith(2, 5000);
    });

    test('cualquier otro fallo del envío se propaga', async () => {
        const { base } = entorno({ txError: new Error('nonce too low') });
        await expect(ejecutar(base)).rejects.toThrow('nonce too low');
    });

    test('sin dirección del DEX configurada: error de configuración', async () => {
        const { base } = entorno();
        await expect(ejecutar({ ...base, dexAddress: '' })).rejects.toBeInstanceOf(KeeperError);
        await expect(ejecutar({ ...base, dexAddress: 'no-es-una-direccion' })).rejects.toMatchObject({ code: 'CONFIG' });
    });
});
