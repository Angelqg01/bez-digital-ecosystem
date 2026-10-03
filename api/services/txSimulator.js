'use strict';

/**
 * txSimulator — qué va a pasar ANTES de firmar.
 *
 * Nunca se firma una operación de valor sin conocer su efecto (§11). Para cada
 * intención cripto se construye la transacción que el backend —no el agente—
 * enviaría y se comprueba:
 *
 *   1. que llama a un contrato del registro (tx-rails) y con el método esperado;
 *   2. que no concede aprobaciones ilimitadas;
 *   3. que el origen tiene saldo, contra el quórum de RPC;
 *   4. que la llamada no revierte y cuánto gas cuesta;
 *   5. opcionalmente, ejecutándola de verdad en un fork (Anvil) y leyendo los
 *      eventos: si el destino recibe menos de lo pedido —token con comisión por
 *      transferencia, honeypot, contrato alterado— la simulación DISCREPA y la
 *      operación se bloquea como riesgo crítico.
 *
 * Para FIAT no hay cadena que simular: se calcula el efecto (débito, crédito,
 * comisión, tipo de cambio) y se pide al proveedor la verificación del
 * beneficiario.
 */

const { ethers } = require('ethers');
const { activoCripto } = require('../config/tx-rails');

const ERC20 = new ethers.Interface([
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);

/** Por encima de esto una aprobación es «ilimitada» a efectos prácticos. */
const UMBRAL_APROBACION_ILIMITADA = 2n ** 255n;

/** La transacción que corresponde a una intención cripto. Sólo transferencias ERC-20. */
function construirTransferencia(intent) {
    if (!intent.tokenAddress || !intent.chainId) {
        const e = new Error('La intención no tiene parte cripto que construir.'); e.code = 'NOT_A_CRYPTO_INTENT'; throw e;
    }
    return {
        chainId: intent.chainId,
        to: intent.tokenAddress,
        data: ERC20.encodeFunctionData('transfer', [intent.destination.value, BigInt(intent.amountMinor)]),
        value: 0n,
    };
}

/**
 * Decodifica una llamada contra el registro de contratos permitidos.
 * @returns {{permitido:boolean, activo?:string, metodo?:string, args?:object, aprobacionIlimitada:boolean}}
 */
function decodificarLlamada(tx, chainId) {
    const destino = String(tx.to || '').toLowerCase();
    let activo = null;
    for (const simbolo of ['BEZ', 'USDC', 'USDT']) {
        const a = activoCripto(simbolo, chainId);
        if (a && a.address === destino) { activo = simbolo; break; }
    }
    if (!activo) return { permitido: false, aprobacionIlimitada: false };
    if (BigInt(tx.value || 0) !== 0n) return { permitido: false, activo, aprobacionIlimitada: false };

    let parsed;
    try {
        parsed = ERC20.parseTransaction({ data: tx.data });
    } catch {
        return { permitido: false, activo, aprobacionIlimitada: false };
    }
    if (!parsed || !['transfer', 'approve'].includes(parsed.name)) {
        return { permitido: false, activo, metodo: parsed?.name, aprobacionIlimitada: false };
    }
    const cantidad = BigInt(parsed.args[1]);
    return {
        permitido: parsed.name === 'transfer',
        activo,
        metodo: parsed.name,
        args: { destino: parsed.args[0], cantidad: cantidad.toString() },
        aprobacionIlimitada: parsed.name === 'approve' && cantidad >= UMBRAL_APROBACION_ILIMITADA,
    };
}

/**
 * Ejecuta la transferencia en un fork (Anvil) suplantando al origen, lee los
 * eventos y deshace. No toca la red real.
 */
async function simularEnFork({ forkUrl, tx, desde, destino, cantidad, crearProveedor }) {
    const p = crearProveedor ? crearProveedor(forkUrl) : new ethers.JsonRpcProvider(forkUrl);
    const snapshot = await p.send('evm_snapshot', []);
    try {
        await p.send('anvil_impersonateAccount', [desde]);
        await p.send('anvil_setBalance', [desde, '0xde0b6b3a7640000']); // 1 unidad nativa para gas
        const leerSaldo = async (quien) => BigInt(ERC20.decodeFunctionResult('balanceOf',
            await p.call({ to: tx.to, data: ERC20.encodeFunctionData('balanceOf', [quien]) }))[0]);

        const antes = await leerSaldo(destino);
        const hash = await p.send('eth_sendTransaction', [{
            from: desde, to: tx.to, data: tx.data, value: '0x0', gas: '0x7a120',
        }]);
        const recibo = await p.waitForTransaction(hash, 1, 15000);
        const despues = await leerSaldo(destino);

        const transferencias = (recibo?.logs || [])
            .filter((l) => l.address.toLowerCase() === tx.to.toLowerCase())
            .map((l) => { try { return ERC20.parseLog(l); } catch { return null; } })
            .filter((l) => l && l.name === 'Transfer')
            .map((l) => ({ desde: l.args[0], hacia: l.args[1], cantidad: BigInt(l.args[2]).toString() }));

        const recibido = despues - antes;
        const discrepancia = recibo?.status !== 1 || recibido !== BigInt(cantidad);
        return {
            estado: recibo?.status === 1 ? 'ok' : 'revert',
            recibidoPorDestino: recibido.toString(),
            transferencias,
            discrepancia,
        };
    } finally {
        await p.send('anvil_stopImpersonatingAccount', [desde]).catch(() => {});
        await p.send('evm_revert', [snapshot]).catch(() => {});
        // Un proveedor propio que no se destruye sigue sondeando y mantiene vivo
        // el proceso (y en los tests, jest no termina).
        if (!crearProveedor) p.destroy();
    }
}

/**
 * Simula una intención cripto.
 * @param {object} p { intent, desde, quorum, forkUrl?, crearProveedorFork? }
 */
async function simularCripto({ intent, desde, quorum, forkUrl, crearProveedorFork }) {
    const tx = construirTransferencia(intent);
    const llamada = decodificarLlamada(tx, intent.chainId);
    if (!llamada.permitido) {
        return { ok: false, motivo: 'CONTRACT_NOT_ALLOWED', llamada, aprobacionIlimitada: llamada.aprobacionIlimitada };
    }
    const cantidad = BigInt(intent.amountMinor);
    try {
        await quorum.comprobarCadena();
        const saldo = BigInt(ERC20.decodeFunctionResult('balanceOf',
            await quorum.llamar({ to: tx.to, data: ERC20.encodeFunctionData('balanceOf', [desde]) }))[0]);
        if (saldo < cantidad) {
            return { ok: false, motivo: 'INSUFFICIENT_BALANCE', llamada, saldoAntes: saldo.toString() };
        }
        const retorno = await quorum.llamar({ from: desde, to: tx.to, data: tx.data });
        // Tokens antiguos no devuelven bool: retorno vacío cuenta como éxito si no revierte.
        if (retorno && retorno !== '0x' && !ERC20.decodeFunctionResult('transfer', retorno)[0]) {
            return { ok: false, motivo: 'TRANSFER_RETURNED_FALSE', llamada };
        }
        const gas = await quorum.estimarGas({ from: desde, to: tx.to, data: tx.data });

        let fork = null;
        if (forkUrl) {
            fork = await simularEnFork({
                forkUrl, tx, desde, destino: intent.destination.value, cantidad, crearProveedor: crearProveedorFork,
            });
        }
        return {
            ok: !fork || !fork.discrepancia,
            motivo: fork?.discrepancia ? 'SIMULATION_MISMATCH' : undefined,
            discrepancia: Boolean(fork?.discrepancia),
            aprobacionIlimitada: false,
            llamada,
            gasEstimado: gas.toString(),
            saldoAntes: saldo.toString(),
            saldoDespues: (saldo - cantidad).toString(),
            efectos: [{ tipo: 'token_transfer', activo: intent.asset, desde, hacia: intent.destination.value, cantidad: cantidad.toString() }],
            fork,
            txSinFirmar: { chainId: tx.chainId, to: tx.to, data: tx.data, value: '0' },
        };
    } catch (err) {
        return { ok: false, motivo: err.code || 'SIMULATION_ERROR', detalle: err.message, llamada };
    }
}

/** Efecto de una operación FIAT, sin red que simular. */
async function simularFiat({ intent, adaptador, fx }) {
    const verificacion = intent.destination.type === 'iban' && adaptador?.verificarBeneficiario
        ? await adaptador.verificarBeneficiario({ iban: intent.destination.value, nombre: intent.destination.name })
            .catch(() => ({ resultado: 'unavailable' }))
        : { resultado: null };
    const cotizacion = adaptador?.cotizar ? await adaptador.cotizar(intent).catch(() => null) : null;
    return {
        ok: true,
        verificacionBeneficiario: verificacion.resultado,
        efectos: [
            { tipo: 'debito', activo: intent.asset, cantidad: intent.amount, origen: intent.source.type },
            { tipo: 'credito', activo: intent.targetAsset || intent.asset, destino: `${intent.destination.type}:${intent.destination.value}` },
        ],
        comision: cotizacion?.comision ?? null,
        tipoCambio: fx || null,
    };
}

module.exports = {
    ERC20, UMBRAL_APROBACION_ILIMITADA,
    construirTransferencia, decodificarLlamada, simularEnFork, simularCripto, simularFiat,
};
