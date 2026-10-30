const { ethers } = require('ethers');

const mockService = {
    chainConfig: jest.fn(),
    checkSponsorship: jest.fn(),
    sponsorUserOp: jest.fn(),
};
jest.mock('../../services/gasTank/paymasterService', () => mockService);

const erc = require('../../services/gasTank/erc7677');
const u = require('../../services/gasTank/userOp');

const PM = '0x' + '44'.repeat(20);
const EP = ethers.getAddress('0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108');
const chain = { chainId: 137, entryPoint: EP, paymaster: PM, vault: null, bez: '0x' + '22'.repeat(20) };
const SENDER = '0x000000000000000000000000000000000000bEEF';
const ORG = '7b0c6f53-1c1e-4d0d-8d3c-0f6b8c2a9a11';

const raw = {
    sender: SENDER, nonce: '0x7', factory: null, callData: '0xdeadbeef',
    callGasLimit: '0x30d40', verificationGasLimit: '0x30d40', preVerificationGas: '0xea60',
    maxFeePerGas: '0x77359400', maxPriorityFeePerGas: '0x3b9aca00',
};

beforeEach(() => { Object.values(mockService).forEach((f) => f.mockReset()); mockService.chainConfig.mockReturnValue(chain); });

describe('pack', () => {
    test('empaqueta la UserOp desempaquetada y u.normalize/maxCost la entienden', () => {
        const { packed, pmVerif, pmPostOp } = erc.pack(raw, PM);
        expect(packed.accountGasLimits).toBe('0x' + '00'.repeat(13) + '030d40' + '00'.repeat(13) + '030d40');
        expect(packed.gasFees).toBe('0x' + '00'.repeat(12) + '3b9aca00' + '00'.repeat(12) + '77359400');
        expect(packed.initCode).toBe('0x');
        const op = u.normalize(packed);
        const m = u.maxCost(op);
        expect(m.maxFeePerGas).toBe(0x77359400n);
        expect(m.requiredGas).toBe(0x30d40n + 0x30d40n + 0xea60n + pmVerif + pmPostOp);
    });

    test('factory + factoryData forman el initCode; los gas del paymaster declarados por la wallet se respetan', () => {
        const F = '0x' + '55'.repeat(20);
        const { packed, pmVerif, pmPostOp } = erc.pack({ ...raw, factory: F, factoryData: '0xaabb', paymasterVerificationGasLimit: '0x1', paymasterPostOpGasLimit: '0x2' }, PM);
        expect(packed.initCode).toBe(F + 'aabb');
        expect([pmVerif, pmPostOp]).toEqual([1n, 2n]);
    });

    test('campos inválidos dan -32602', () => {
        expect(() => erc.pack({ ...raw, nonce: undefined }, PM)).toThrow(/nonce/);
        expect(() => erc.pack({ ...raw, callGasLimit: 'xyz' }, PM)).toThrow(/callGasLimit/);
        try { erc.pack(null, PM); } catch (e) { expect(e.rpcCode).toBe(-32602); }
    });
});

describe('pm_getPaymasterStubData', () => {
    test('valida política sin reservar y devuelve relleno con isFinal=false', async () => {
        mockService.checkSponsorship.mockResolvedValue({ ok: true, chain });
        const out = await erc.getPaymasterStubData({ orgId: ORG, appId: 'a1', params: [raw, EP, '0x89'] }, { chain, now: () => 1_800_000_000 });
        expect(mockService.checkSponsorship).toHaveBeenCalledTimes(1);
        expect(mockService.sponsorUserOp).not.toHaveBeenCalled();
        expect(out).toMatchObject({ paymaster: PM, isFinal: false, sponsor: { name: 'BeZhas Gas Tank' } });
        // paymasterData = abi.encode(org, until, after, max) (128 bytes) + 65 de firma de relleno
        expect(ethers.getBytes(out.paymasterData).length).toBe(128 + 65);
        const [org, until, after, max] = ethers.AbiCoder.defaultAbiCoder().decode(['bytes32', 'uint48', 'uint48', 'uint256'], ethers.dataSlice(out.paymasterData, 0, 128));
        expect(org).toBe(u.orgIdBytes32(ORG));
        expect(until).toBe(1_800_000_600n);
        expect(after).toBe(0n);
        expect(max).toBe(5n * 10n ** 16n);
    });

    test('EntryPoint o cadena distintos de los configurados se rechazan', async () => {
        await expect(erc.getPaymasterStubData({ orgId: ORG, appId: 'a', params: [raw, '0x' + '99'.repeat(20), '0x89'] }, { chain })).rejects.toMatchObject({ rpcCode: -32602 });
        await expect(erc.getPaymasterStubData({ orgId: ORG, appId: 'a', params: [raw, EP, '0x1'] }, { chain })).rejects.toMatchObject({ rpcCode: -32602 });
    });
});

describe('pm_getPaymasterData', () => {
    test('devuelve paymasterData sin el prefijo del paymaster ni los gas, y los límites que usó', async () => {
        const pd = u.buildPaymasterAndData({ paymaster: PM, verificationGas: 150000n, postOpGas: 80000n, orgId: u.orgIdBytes32(ORG), validUntil: 1800000600, validAfter: 0, signedMax: 123n, signature: '0x' + 'ab'.repeat(65) });
        mockService.sponsorUserOp.mockResolvedValue({ paymasterAndData: pd });
        const out = await erc.getPaymasterData({ orgId: ORG, appId: 'a1', params: [raw, EP, 137] }, { chain });
        expect(mockService.sponsorUserOp.mock.calls[0][0].userOp.paymasterAndData).toBe(PM + ethers.toBeHex(150000n, 16).slice(2) + ethers.toBeHex(80000n, 16).slice(2));
        expect(PM + ethers.toBeHex(150000n, 16).slice(2) + ethers.toBeHex(80000n, 16).slice(2) + out.paymasterData.slice(2)).toBe(pd);
        expect(out).toMatchObject({ paymaster: PM, paymasterVerificationGasLimit: '0x249f0', paymasterPostOpGasLimit: '0x13880' });
        expect(out.isFinal).toBeUndefined();
    });
});

test('toRpcError traduce estados del servicio a códigos JSON-RPC y no filtra errores internos', () => {
    const mk = (status, code, message) => Object.assign(new Error(message), { status, code });
    expect(erc.toRpcError(mk(400, 'BAD_USEROP', 'x'))).toMatchObject({ code: -32602 });
    for (const s of [402, 403, 409]) expect(erc.toRpcError(mk(s, 'C', 'x')).code).toBe(-32001);
    expect(erc.toRpcError(mk(503, 'NOT_CONFIGURED', 'Falta GAS_PAYMASTER_SIGNER_KEY'))).toEqual({ code: -32000, message: 'Patrocinio no disponible', data: { code: 'NOT_CONFIGURED' } });
    expect(erc.toRpcError(new Error('connection to db:5432 refused'))).toEqual({ code: -32603, message: 'Error interno' });
    expect(erc.toRpcError(new erc.RpcError(-32602, 'm')).code).toBe(-32602);
});
