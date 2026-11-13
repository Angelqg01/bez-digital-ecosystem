'use strict';

/**
 * dexKeeper — mantiene viva la observación TWAP de BeZhasDEX.
 *
 * El oráculo de precios del Hub lee `consultTwap`, que mide el precio medio desde la última
 * observación. Si nadie llama a `updateObservation` (la puede llamar cualquiera, como mucho una
 * vez cada TWAP_PERIOD = 30 min), en 24 h el oráculo descarta la pool interna y cae a QuickSwap
 * o al precio de reserva. Este módulo es lo que la llama.
 *
 * Seguridad:
 *   - La transacción no mueve fondos ni exige permisos: su único coste es el gas. Por eso la
 *     clave es DEDICADA (DEX_KEEPER_KEY), con saldo mínimo. Se rechaza si controla una dirección
 *     protegida (Treasury DAO, Hot Wallet) o si el RPC responde de otra cadena.
 *   - Sólo envía cuando toca: si la observación es reciente, o la pool no tiene liquidez, no
 *     gasta gas. Con el gas por encima del tope se salta la pasada y lo reintenta la siguiente.
 *   - Dos keepers a la vez no se estorban: si otro llega antes, el contrato revierte con
 *     ObservationTooRecent y aquí cuenta como «no toca», no como fallo.
 */

const { ethers } = require('ethers');

const ABI = [
    'function TWAP_PERIOD() view returns (uint32)',
    'function pairId(address tokenA, address tokenB) pure returns (bytes32)',
    'function observations(bytes32 pairId) view returns (uint256 price0Cumulative, uint256 price1Cumulative, uint32 timestamp)',
    'function getPool(address tokenA, address tokenB) view returns (tuple(address token0, address token1, uint112 reserve0, uint112 reserve1, uint32 lastBlockTimestamp, uint256 totalLiquidity, address lpToken, bool exists) pool)',
    'function updateObservation(address tokenA, address tokenB)',
];

class KeeperError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}

const ESTADOS = Object.freeze({
    ACTUALIZADA: 'actualizada',
    SIMULADA: 'simulada',
    NO_TOCA: 'no_toca',
    SIN_LIQUIDEZ: 'sin_liquidez',
    GAS_ALTO: 'gas_alto',
});

/**
 * Una pasada del keeper.
 * @param {object} o
 * @param {import('ethers').Provider} o.provider
 * @param {import('ethers').Signer} o.signer — firmante conectado al provider
 * @param {string} o.dexAddress
 * @param {string} o.tokenA
 * @param {string} o.tokenB
 * @param {number} o.expectedChainId
 * @param {number} [o.maxGwei=300] — tope de maxFeePerGas
 * @param {bigint} [o.minBalanceWei] — saldo mínimo de la clave
 * @param {boolean} [o.dryRun=false] — simula sin enviar
 * @param {number} [o.confirmations=2]
 * @param {number} [o.waitTimeoutMs=120000] — espera máxima de las confirmaciones
 * @param {() => number} [o.ahora] — segundos Unix. Por defecto, el reloj de la CADENA (último bloque)
 * @param {(address: string, abi: any, runner: any) => any} [o.crearContrato]
 * @param {(address: string) => boolean} [o.esProtegida]
 * @param {(msg: string) => void} [o.log]
 */
async function ejecutar(o) {
    const {
        provider, signer, dexAddress, tokenA, tokenB, expectedChainId,
        maxGwei = 300,
        minBalanceWei = ethers.parseEther('0.02'),
        dryRun = false,
        confirmations = 2,
        waitTimeoutMs = 120_000,
        ahora = null,
        crearContrato = (address, abi, runner) => new ethers.Contract(address, abi, runner),
        esProtegida = require('./hotKeyGuard').esDireccionProtegida,
        log = () => {},
    } = o;

    if (!dexAddress || !ethers.isAddress(dexAddress)) throw new KeeperError('CONFIG', 'BEZHAS_DEX_ADDRESS no está configurada o no es una dirección');

    const direccion = await signer.getAddress();
    if (esProtegida(direccion)) {
        throw new KeeperError('PROTECTED_KEY', `La clave del keeper controla una dirección protegida (${direccion}): usa una wallet dedicada`);
    }

    const { chainId } = await provider.getNetwork();
    if (Number(chainId) !== Number(expectedChainId)) {
        throw new KeeperError('CHAIN_MISMATCH', `El RPC responde la cadena ${chainId} y se esperaba la ${expectedChainId}: no se envía nada`);
    }

    const dex = crearContrato(dexAddress, ABI, signer);
    const [periodo, id, pool] = await Promise.all([
        dex.TWAP_PERIOD(), dex.pairId(tokenA, tokenB), dex.getPool(tokenA, tokenB),
    ]);

    if (!pool.exists || BigInt(pool.reserve0) === 0n || BigInt(pool.reserve1) === 0n) {
        log('La pool no tiene liquidez: no hay nada que observar');
        return { estado: ESTADOS.SIN_LIQUIDEZ, direccion };
    }

    const obs = await dex.observations(id);
    const ultima = Number(obs.timestamp);
    // El reloj es el de la cadena, no el de esta máquina: el contrato compara con block.timestamp.
    // Con el reloj local, una máquina con la hora mal puesta enviaría transacciones que revierten
    // o se saltaría pasadas para siempre.
    const ahoraSeg = ahora ? ahora() : Number((await provider.getBlock('latest')).timestamp);
    const edad = ultima === 0 ? null : ahoraSeg - ultima;
    if (edad !== null && edad < Number(periodo)) {
        const faltan = Number(periodo) - edad;
        log(`Observación de hace ${edad}s: faltan ${faltan}s para la siguiente`);
        return { estado: ESTADOS.NO_TOCA, edadSegundos: edad, proximaEnSegundos: faltan, direccion };
    }

    const fee = await provider.getFeeData();
    const maxFee = fee.maxFeePerGas ?? fee.gasPrice;
    if (maxFee != null && maxFee > ethers.parseUnits(String(maxGwei), 'gwei')) {
        log(`Gas a ${ethers.formatUnits(maxFee, 'gwei')} gwei, por encima del tope de ${maxGwei}: se salta esta pasada`);
        return { estado: ESTADOS.GAS_ALTO, gwei: Number(ethers.formatUnits(maxFee, 'gwei')), direccion };
    }

    const saldo = await provider.getBalance(direccion);
    if (saldo < BigInt(minBalanceWei)) {
        throw new KeeperError('BALANCE_LOW', `La clave del keeper (${direccion}) tiene ${ethers.formatEther(saldo)} y necesita al menos ${ethers.formatEther(minBalanceWei)} para pagar gas`);
    }

    if (dryRun) {
        await dex.updateObservation.staticCall(tokenA, tokenB);
        log('Simulación correcta: la transacción se enviaría');
        return { estado: ESTADOS.SIMULADA, edadSegundos: edad, direccion };
    }

    try {
        const tx = await dex.updateObservation(tokenA, tokenB);
        // Con timeout: en una cadena que sólo mina cuando hay transacciones (anvil) o con el RPC
        // colgado, esperar sin límite dejaría el trabajo programado colgado para siempre.
        let recibo;
        try {
            recibo = await tx.wait(confirmations, waitTimeoutMs);
        } catch (err) {
            if (err && (err.code === 'TIMEOUT' || /timeout/i.test(err.message || ''))) {
                throw new KeeperError('WAIT_TIMEOUT', `La transacción ${tx.hash} se envió pero no alcanzó ${confirmations} confirmaciones en ${Math.round(waitTimeoutMs / 1000)}s: revisa su estado antes de reintentar`);
            }
            throw err;
        }
        log(`Observación actualizada en ${tx.hash}`);
        return { estado: ESTADOS.ACTUALIZADA, txHash: tx.hash, bloque: recibo?.blockNumber ?? null, edadSegundos: edad, direccion };
    } catch (err) {
        // Otro keeper llegó antes entre la lectura y el envío.
        if (/ObservationTooRecent/.test(`${err.shortMessage || ''} ${err.message || ''} ${err.reason || ''} ${err.revert?.name || ''}`)) {
            log('Otro keeper actualizó la observación antes: no toca');
            return { estado: ESTADOS.NO_TOCA, direccion };
        }
        throw err;
    }
}

module.exports = { ejecutar, KeeperError, ESTADOS, ABI };
