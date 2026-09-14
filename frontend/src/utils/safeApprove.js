/**
 * ============================================================================
 * CAMBIO SEGURO DE ASIGNACIONES ERC-20
 * ============================================================================
 *
 * `approve` sobrescribe la asignación anterior en vez de sumarla, y de ahí sale
 * la carrera clásica del ERC-20: si el titular tiene aprobados N al gastador y
 * firma un `approve(M)`, el gastador puede ver esa transacción en el mempool,
 * gastar los N antes de que entre y gastar los M después. Se lleva N+M cuando
 * el titular solo quiso autorizar M.
 *
 * Hay dos formas de evitarlo, y cuál aplica depende del token que haya delante:
 *
 *   1. `increaseAllowance` / `decreaseAllowance`. Parten del valor que haya en
 *      el momento de ejecutarse, así que no dejan ventana. Es la vía limpia.
 *      OpenZeppelin las eliminó en su versión 5.0; `src/BezhasToken.sol` las
 *      recupera, de modo que los despliegues futuros de BEZ las tendrán.
 *
 *   2. Poner la asignación a cero, esperar a que confirme, y solo entonces
 *      fijar la nueva. Más lenta y cuesta dos transacciones, pero funciona con
 *      cualquier ERC-20.
 *
 * El BEZ ya desplegado (0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8) NO es
 * actualizable —`BezhasToken is ERC20Pausable, AccessControl`, sin proxy—, así
 * que no tiene los ayudantes del punto 1 y le toca el 2.
 *
 * `safeApprove` decide sola: usa los ayudantes si el contrato los expone y cae
 * al patrón de dos pasos si no. Quien llama no necesita saber cuál le tocó.
 */

/**
 * ABI mínimo para cambiar asignaciones sin abrir la carrera.
 *
 * Incluye `allowance` —sin leer el valor actual no se puede decidir la vía— y
 * los dos ayudantes, que `safeApprove` usa solo si el contrato los tiene de
 * verdad. Declararlos en el ABI no obliga a que existan en cadena.
 */
export const ALLOWANCE_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function increaseAllowance(address spender, uint256 addedValue) returns (bool)',
    'function decreaseAllowance(address spender, uint256 subtractedValue) returns (bool)',
];

/**
 * Caché de qué ayudantes soporta cada token, por dirección.
 *
 * La respuesta no cambia nunca para un contrato dado —BEZ no es actualizable—,
 * así que se pregunta una vez por sesión y por token.
 */
const soporteAyudantes = new Map();

/**
 * ¿El contrato DESPLEGADO expone de verdad este ayudante?
 *
 * Ojo: no vale mirar el ABI. `ALLOWANCE_ABI` los declara para poder llamarlos
 * cuando existan, pero declararlos no los crea en cadena — el BEZ desplegado no
 * los tiene. Se comprueba con una llamada de solo lectura: si el selector no
 * existe, no hay función que atienda y la llamada revierte.
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

    // Si el ABI con el que se construyó el contrato ni siquiera la declara, no
    // hay nada que sondear. Pasa con el ABI guardado de BEZ, que refleja el
    // token desplegado.
    if (typeof contract[nombre]?.staticCall === 'function') {
        try {
            // Sondeo inocuo: sumar o restar cero no cambia nada, y al ser
            // `staticCall` ni siquiera se envía una transacción.
            await contract[nombre].staticCall(ZERO_ADDRESS_PROBE, 0n);
            soportado = true;
        } catch {
            // El selector no existe en el contrato desplegado.
            soportado = false;
        }
    }

    soporteAyudantes.set(clave, soportado);
    return soportado;
}

/** Gastador de mentira para el sondeo; nunca se le autoriza nada. */
const ZERO_ADDRESS_PROBE = '0x0000000000000000000000000000000000000001';

/**
 * Fija la asignación de `spender` a `desiredAmount` sin abrir la carrera.
 *
 * @param {import('ethers').Contract} token  Contrato ERC-20 con firmante.
 * @param {string} owner                     Dirección del titular (quien firma).
 * @param {string} spender                   Quién queda autorizado a gastar.
 * @param {bigint} desiredAmount             Asignación final buscada, en wei.
 * @returns {Promise<{ txs: string[], strategy: string, skipped?: boolean }>}
 *          Hashes de las transacciones enviadas y qué vía se usó.
 */
export async function safeApprove(token, owner, spender, desiredAmount) {
    const objetivo = BigInt(desiredAmount);
    const actual = BigInt(await token.allowance(owner, spender));

    // Ya está donde queremos: no se gasta gas en confirmarlo otra vez.
    if (actual === objetivo) {
        return { txs: [], strategy: 'sin-cambios', skipped: true };
    }

    // Desde cero no hay carrera posible: no hay nada viejo que adelantar.
    if (actual === 0n) {
        const tx = await token.approve(spender, objetivo);
        await tx.wait();
        return { txs: [tx.hash], strategy: 'approve-desde-cero' };
    }

    // Con asignación viva, la vía limpia es el incremento/decremento.
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

    // Token sin ayudantes —el BEZ desplegado, por ejemplo—: a cero primero.
    // El `wait()` intermedio no es opcional: si se mandan las dos a la vez, el
    // gastador puede colarse entre ellas y la carrera sigue abierta.
    const txCero = await token.approve(spender, 0n);
    await txCero.wait();

    const txNueva = await token.approve(spender, objetivo);
    await txNueva.wait();

    return { txs: [txCero.hash, txNueva.hash], strategy: 'cero-primero' };
}

export default safeApprove;
