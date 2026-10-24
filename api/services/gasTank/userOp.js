'use strict';

/**
 * gasTank/userOp — formato ERC-4337 v0.7/v0.8 (UserOperation empaquetada) y los hashes del paymaster.
 *
 * Los hashes DEBEN ser idénticos a los de los contratos (BeZhasVerifyingPaymaster.getHash y
 * GasTankVault.getHash): hay vectores de oro fijados a ambos lados (api/__tests__ y smart-contracts/test/gas).
 *
 * Una UserOp llega como JSON con campos hex en el formato empaquetado:
 *   { sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees, paymasterAndData }
 */

const { ethers } = require('ethers');

const coder = ethers.AbiCoder.defaultAbiCoder();

const SEL = {
    execute: ethers.id('execute(address,uint256,bytes)').slice(0, 10),
    executeBatch: ethers.id('executeBatch((address,uint256,bytes)[])').slice(0, 10),
};
const ACCOUNT_IFACE = new ethers.Interface([
    'function execute(address target, uint256 value, bytes data)',
    'function executeBatch((address target, uint256 value, bytes data)[] calls)',
]);

class UserOpError extends Error {
    constructor(code, message) { super(message); this.code = code; this.status = 400; }
}

const big = (v, name) => {
    try { return BigInt(v); } catch { throw new UserOpError('BAD_USEROP', `Campo no numérico: ${name}`); }
};
const hex = (v, name) => {
    if (typeof v !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(v)) throw new UserOpError('BAD_USEROP', `Campo hex no válido: ${name}`);
    return v;
};

/** Normaliza y valida una UserOp empaquetada. */
function normalize(op) {
    if (!op || typeof op !== 'object') throw new UserOpError('BAD_USEROP', 'UserOp ausente');
    if (!ethers.isAddress(op.sender)) throw new UserOpError('BAD_USEROP', 'sender no válido');
    return {
        sender: ethers.getAddress(op.sender),
        nonce: big(op.nonce, 'nonce'),
        initCode: hex(op.initCode ?? '0x', 'initCode'),
        callData: hex(op.callData ?? '0x', 'callData'),
        accountGasLimits: ethers.zeroPadValue(hex(op.accountGasLimits, 'accountGasLimits'), 32),
        preVerificationGas: big(op.preVerificationGas, 'preVerificationGas'),
        gasFees: ethers.zeroPadValue(hex(op.gasFees, 'gasFees'), 32),
        paymasterAndData: hex(op.paymasterAndData ?? '0x', 'paymasterAndData'),
    };
}

const mask128 = (1n << 128n) - 1n;
const hi = (b32) => BigInt(b32) >> 128n;
const lo = (b32) => BigInt(b32) & mask128;

function gasLimits(op) {
    return { verificationGasLimit: hi(op.accountGasLimits), callGasLimit: lo(op.accountGasLimits) };
}
function gasFees(op) {
    return { maxPriorityFeePerGas: hi(op.gasFees), maxFeePerGas: lo(op.gasFees) };
}

/** Gas del paymaster que el cliente declara dentro de paymasterAndData: [20:36] validación, [36:52] postOp. */
function paymasterGas(op) {
    const pd = ethers.getBytes(op.paymasterAndData);
    if (pd.length < 52) throw new UserOpError('BAD_USEROP', 'paymasterAndData sin límites de gas del paymaster');
    return {
        verification: BigInt(ethers.hexlify(pd.slice(20, 36))),
        postOp: BigInt(ethers.hexlify(pd.slice(36, 52))),
    };
}

/** Gas total que el EntryPoint exige cubrir (prefund) y su coste máximo en wei. */
function maxCost(op) {
    const { verificationGasLimit, callGasLimit } = gasLimits(op);
    const pm = paymasterGas(op);
    const requiredGas = op.preVerificationGas + verificationGasLimit + callGasLimit + pm.verification + pm.postOp;
    return { requiredGas, maxFeePerGas: gasFees(op).maxFeePerGas, maxCostWei: requiredGas * gasFees(op).maxFeePerGas };
}

const orgIdBytes32 = (orgUuid) => ethers.keccak256(ethers.toUtf8Bytes(String(orgUuid).toLowerCase()));

/** Hash que firma el servicio de políticas (BeZhasVerifyingPaymaster.getHash). */
function paymasterHash({ op, orgId, validUntil, validAfter, signedMax, chainId, paymaster }) {
    const pd = ethers.getBytes(op.paymasterAndData);
    return ethers.keccak256(coder.encode(
        ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32', 'uint256', 'address', 'bytes32', 'uint48', 'uint48', 'uint256'],
        [op.sender, op.nonce, ethers.keccak256(op.initCode), ethers.keccak256(op.callData), op.accountGasLimits, op.preVerificationGas,
            op.gasFees, ethers.keccak256(pd.slice(20, 52)), chainId, paymaster, orgId, validUntil, validAfter, signedMax]
    ));
}

/** Hash que firma el servicio para una retirada de la bóveda (GasTankVault.getHash). */
function vaultHash({ chainId, vault, orgId, to, target, selector, amount, validUntil, nonce }) {
    return ethers.keccak256(coder.encode(
        ['uint256', 'address', 'bytes32', 'address', 'address', 'bytes4', 'uint256', 'uint48', 'bytes32'],
        [chainId, vault, orgId, to, target, selector, amount, validUntil, nonce]
    ));
}

/** paymasterAndData completo: paymaster | verifGas(16) | postOpGas(16) | abi.encode(org, until, after, max) | firma(65). */
function buildPaymasterAndData({ paymaster, verificationGas, postOpGas, orgId, validUntil, validAfter, signedMax, signature = '0x' + '00'.repeat(65) }) {
    return ethers.concat([
        paymaster,
        ethers.toBeHex(verificationGas, 16),
        ethers.toBeHex(postOpGas, 16),
        coder.encode(['bytes32', 'uint48', 'uint48', 'uint256'], [orgId, validUntil, validAfter, signedMax]),
        signature,
    ]);
}

/** Clave de reserva por UserOp: no depende del hash de la UserOp, que incluye la firma del paymaster (circular). */
function reservationKey({ entryPoint, chainId, sender, nonce }) {
    return ethers.keccak256(coder.encode(['address', 'uint256', 'address', 'uint256'], [entryPoint, chainId, sender, nonce]));
}

/** Descompone callData de SimpleAccount (execute / executeBatch) en llamadas {target, value, data, selector}. */
function decodeCalls(callData) {
    const sel = callData.slice(0, 10).toLowerCase();
    let calls;
    try {
        if (sel === SEL.execute) {
            const [target, value, data] = ACCOUNT_IFACE.decodeFunctionData('execute', callData);
            calls = [{ target, value, data }];
        } else if (sel === SEL.executeBatch) {
            const [list] = ACCOUNT_IFACE.decodeFunctionData('executeBatch', callData);
            calls = list.map((c) => ({ target: c.target, value: c.value, data: c.data }));
        } else {
            throw new UserOpError('CALLDATA_NOT_SUPPORTED', `Función de la cuenta no soportada (${sel}); solo execute y executeBatch`);
        }
    } catch (err) {
        if (err instanceof UserOpError) throw err;
        throw new UserOpError('CALLDATA_NOT_DECODABLE', 'callData no decodificable');
    }
    if (!calls.length || calls.length > 8) throw new UserOpError('BATCH_SIZE', 'El lote debe tener entre 1 y 8 llamadas');
    return calls.map((c) => ({
        target: ethers.getAddress(c.target),
        value: BigInt(c.value),
        data: c.data,
        selector: c.data.length >= 10 ? c.data.slice(0, 10).toLowerCase() : '0x',
    }));
}

module.exports = {
    UserOpError, normalize, gasLimits, gasFees, paymasterGas, maxCost, orgIdBytes32,
    paymasterHash, vaultHash, buildPaymasterAndData, reservationKey, decodeCalls, SEL,
};
