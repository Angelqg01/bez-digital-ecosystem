/**
 * ============================================================================
 * CAMBIO SEGURO DE ASIGNACIONES ERC-20 (backend)
 * ============================================================================
 *
 * Gemelo en CommonJS de `frontend/src/utils/safeApprove.js`. Existen los dos
 * porque el frontend es ESM (`"type": "module"`) y el backend es CommonJS: un
 * único fichero compartido necesitaría un paso de compilación, y el backend no
 * debe depender de `frontend/src`, que no viaja en su imagen de despliegue.
 * Si se toca la lógica de uno, hay que tocar la del otro.
 *
 * EL PROBLEMA
 *
 * `approve` sobrescribe la asignación anterior en vez de sumarla. Si el titular
 * tiene aprobados N al gastador y firma un `approve(M)`, el gastador puede ver
 * esa transacción en el mempool, gastar los N antes de que entre y gastar los M
 * después: se lleva N+M cuando solo se quiso autorizar M.
 *
 * LAS DOS SALIDAS
 *
 *   1. `increaseAllowance`/`decreaseAllowance`: parten del valor que haya en el
 *      momento de ejecutarse, así que no dejan ventana. OpenZeppelin las quitó
 *      en su v5.0; `src/BezhasToken.sol` las recupera, de modo que los
 *      despliegues futuros de BEZ las tendrán.
 *   2. Poner la asignación a cero, esperar confirmación y fijar la nueva.
 *      Cuesta dos transacciones pero funciona con cualquier ERC-20.
 *
 * El BEZ ya desplegado no es actualizable, así que no tiene las del punto 1 y
 * le toca el 2. `safeApprove` lo detecta preguntando a la cadena y elige sola.
 */

/** Gastador de mentira para el sondeo; nunca se le autoriza nada. */
const DIRECCION_SONDEO = '0x0000000000000000000000000000000000000001';

/** Caché por token: la respuesta no cambia, BEZ no es actualizable. */
const soporteAyudantes = new Map();

/**
 * ¿El contrato DESPLEGADO expone de verdad este ayudante?
 *
 * No vale mirar el ABI: declarar una función no la crea en cadena. Se sondea
 * con una llamada de solo lectura; si el selector no existe, revierte.
 */
async function soportaAyudante(contract, nombre) {
    let direccion;
    try {
        direccion = (await contract.getAddress()).toLowerCase();
    } catch {
        direccion = String(contract.target || '').toLowerCase();
    }

    const clave = `${direccion}:${nombre}`;
    if (soporteAyudantes.has(clave)) return soporteAyudantes.get(clave);

    let soportado = false;
    if (typeof contract[nombre]?.staticCall === 'function') {
        try {
            // Sumar o restar cero no cambia nada, y `staticCall` no envía
            // ninguna transacción.
            await contract[nombre].staticCall(DIRECCION_SONDEO, 0n);
            soportado = true;
        } catch {
            soportado = false;
        }
    }

    soporteAyudantes.set(clave, soportado);
    return soportado;
}

/**
 * Fija la asignación de `spender` a `desiredAmount` sin abrir la carrera.
 *
 * @param {import('ethers').Contract} token  Contrato ERC-20 con firmante.
 * @param {string} owner                     Titular (quien firma).
 * @param {string} spender                   Quién queda autorizado a gastar.
 * @param {bigint|string|number} desiredAmount  Asignación final, en wei.
 * @returns {Promise<{ txs: string[], strategy: string, skipped?: boolean }>}
 */
async function safeApprove(token, owner, spender, desiredAmount) {
    const objetivo = BigInt(desiredAmount);
    const actual = BigInt(await token.allowance(owner, spender));

    if (actual === objetivo) {
        return { txs: [], strategy: 'sin-cambios', skipped: true };
    }

    // Desde cero no hay carrera: no hay nada viejo que adelantar.
    if (actual === 0n) {
        const tx = await token.approve(spender, objetivo);
        await tx.wait();
        return { txs: [tx.hash], strategy: 'approve-desde-cero' };
    }

    if (objetivo > actual && (await soportaAyudante(token, 'increaseAllowance'))) {
        const tx = await token.increaseAllowance(spender, objetivo - actual);
        await tx.wait();
        return { txs: [tx.hash], strategy: 'increaseAllowance' };
    }

    if (objetivo < actual && (await soportaAyudante(token, 'decreaseAllowance'))) {
        const tx = await token.decreaseAllowance(spender, actual - objetivo);
        await tx.wait();
        return { txs: [tx.hash], strategy: 'decreaseAllowance' };
    }

    // Sin ayudantes: a cero primero. El `wait()` intermedio no es opcional; si
    // se mandan las dos seguidas, el gastador puede colarse entre ellas.
    const txCero = await token.approve(spender, 0n);
    await txCero.wait();

    const txNueva = await token.approve(spender, objetivo);
    await txNueva.wait();

    return { txs: [txCero.hash, txNueva.hash], strategy: 'cero-primero' };
}

module.exports = { safeApprove, soportaAyudante };
