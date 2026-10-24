'use strict';

/**
 * gasTank/erc7677 — adaptador ERC-7677 (paymaster web service) sobre el servicio de patrocinio.
 *
 *   pm_getPaymasterStubData(userOp, entryPoint, chainId, context)  → campos de relleno para estimar gas (no reserva saldo)
 *   pm_getPaymasterData(userOp, entryPoint, chainId, context)      → campos finales firmados (reserva saldo)
 *
 * La UserOp llega DESEMPAQUETADA (formato v0.7/v0.8 de los bundlers: factory, callGasLimit, maxFeePerGas…); se
 * empaqueta para el servicio y el resultado se devuelve repartido en paymasterData y límites de gas del paymaster.
 */

const { ethers } = require('ethers');
const userOp = require('./userOp');
const service = require('./paymasterService');

// Gas por defecto del paymaster mientras la wallet no ha declarado los suyos (validación + postOp).
const DEFAULT_PM_VERIFICATION_GAS = 150_000n;
const DEFAULT_PM_POSTOP_GAS = 80_000n;
const DEFAULT_STUB_MAX_COST_WEI = 5n * 10n ** 16n; // 0,05 POL: por debajo del tope duro del contrato

class RpcError extends Error {
    constructor(code, message, data) { super(message); this.rpcCode = code; this.data = data; }
}

const q = (v, name, { required = false } = {}) => {
    if (v === undefined || v === null || v === '0x') { if (required) throw new RpcError(-32602, `Falta ${name}`); return 0n; }
    try { return BigInt(v); } catch { throw new RpcError(-32602, `${name} no es una cantidad válida`); }
};
const hexq = (n) => '0x' + n.toString(16);

/** UserOp desempaquetada → empaquetada (la que entiende userOp.normalize). */
function pack(raw, paymaster) {
    if (!raw || typeof raw !== 'object') throw new RpcError(-32602, 'UserOp ausente');
    const pmVerif = q(raw.paymasterVerificationGasLimit, 'paymasterVerificationGasLimit') || DEFAULT_PM_VERIFICATION_GAS;
    const pmPostOp = q(raw.paymasterPostOpGasLimit, 'paymasterPostOpGasLimit') || DEFAULT_PM_POSTOP_GAS;
    const initCode = raw.factory && raw.factory !== '0x' ? ethers.concat([raw.factory, raw.factoryData || '0x']) : '0x';
    return {
        pmVerif, pmPostOp,
        packed: {
            sender: raw.sender,
            nonce: hexq(q(raw.nonce, 'nonce', { required: true })),
            initCode,
            callData: raw.callData || '0x',
            accountGasLimits: ethers.concat([ethers.toBeHex(q(raw.verificationGasLimit, 'verificationGasLimit'), 16), ethers.toBeHex(q(raw.callGasLimit, 'callGasLimit'), 16)]),
            preVerificationGas: hexq(q(raw.preVerificationGas, 'preVerificationGas')),
            gasFees: ethers.concat([ethers.toBeHex(q(raw.maxPriorityFeePerGas, 'maxPriorityFeePerGas'), 16), ethers.toBeHex(q(raw.maxFeePerGas, 'maxFeePerGas'), 16)]),
            paymasterAndData: ethers.concat([paymaster, ethers.toBeHex(pmVerif, 16), ethers.toBeHex(pmPostOp, 16)]),
        },
    };
}

function checkChain(chain, entryPoint, chainId) {
    if (!entryPoint || ethers.getAddress(entryPoint) !== chain.entryPoint) throw new RpcError(-32602, 'EntryPoint no soportado');
    if (q(chainId, 'chainId', { required: true }) !== BigInt(chain.chainId)) throw new RpcError(-32602, 'chainId no soportado');
}

const split = (paymasterAndData) => '0x' + paymasterAndData.slice(2 + 52 * 2);

async function getPaymasterStubData({ orgId, appId, params }, deps = {}) {
    const [raw, entryPoint, chainId] = params;
    const chain = deps.chain || service.chainConfig();
    checkChain(chain, entryPoint, chainId);
    const { pmVerif, pmPostOp, packed } = pack(raw, chain.paymaster);
    // Valida política y saldo YA (la wallet se entera antes de estimar), pero sin reservar nada.
    await service.checkSponsorship({ orgId, appId, userOp: packed }, deps);
    const until = (deps.now ? deps.now() : Math.floor(Date.now() / 1000)) + 600;
    const stub = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'uint48', 'uint48', 'uint256'], [userOp.orgIdBytes32(orgId), until, 0, DEFAULT_STUB_MAX_COST_WEI]
    ) + '00'.repeat(65);
    return {
        sponsor: { name: 'BeZhas Gas Tank' },
        paymaster: chain.paymaster,
        paymasterData: stub,
        paymasterVerificationGasLimit: hexq(pmVerif),
        paymasterPostOpGasLimit: hexq(pmPostOp),
        isFinal: false,
    };
}

async function getPaymasterData({ orgId, appId, params }, deps = {}) {
    const [raw, entryPoint, chainId] = params;
    const chain = deps.chain || service.chainConfig();
    checkChain(chain, entryPoint, chainId);
    const { pmVerif, pmPostOp, packed } = pack(raw, chain.paymaster);
    const out = await service.sponsorUserOp({ orgId, appId, userOp: packed }, deps);
    return {
        sponsor: { name: 'BeZhas Gas Tank' },
        paymaster: chain.paymaster,
        paymasterData: split(out.paymasterAndData),
        paymasterVerificationGasLimit: hexq(pmVerif),
        paymasterPostOpGasLimit: hexq(pmPostOp),
    };
}

const METHODS = { pm_getPaymasterStubData: getPaymasterStubData, pm_getPaymasterData: getPaymasterData };

/** Traduce un error del servicio a un error JSON-RPC: -32602 parámetros, -32001 denegado/sin saldo, -32000 resto. */
function toRpcError(err) {
    if (err instanceof RpcError) return { code: err.rpcCode, message: err.message, ...(err.data ? { data: err.data } : {}) };
    const status = Number.isInteger(err.status) ? err.status : 500;
    if (status === 400) return { code: -32602, message: err.message, data: { code: err.code } };
    if (status === 402 || status === 403 || status === 409) return { code: -32001, message: err.message, data: { code: err.code } };
    if (status === 503) return { code: -32000, message: 'Patrocinio no disponible', data: { code: err.code } };
    return { code: -32603, message: 'Error interno' };
}

module.exports = { METHODS, pack, split, toRpcError, RpcError, getPaymasterStubData, getPaymasterData };
