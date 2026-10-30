const { ethers } = require('ethers');
const u = require('../../services/gasTank/userOp');

const PM = '0x' + '44'.repeat(20);
const ORG = u.orgIdBytes32('acme');

test('orgIdBytes32 = keccak256(uuid en minúsculas)', () => {
    expect(ORG).toBe('0xe29dae06ef4c3e336b7538b6d4f52ca1ecec009b1df6fb501320e11b223aeeaf');
    expect(u.orgIdBytes32('ACME')).toBe(ORG);
});

// Los mismos literales están fijados en smart-contracts/test/gas/GoldenVectors.t.sol contra los contratos reales.
test('vector de oro: hash de la bóveda', () => {
    expect(u.vaultHash({
        chainId: 137, vault: '0x' + '11'.repeat(20), orgId: ORG, to: '0x' + '22'.repeat(20), target: '0x' + '33'.repeat(20),
        selector: '0x12345678', amount: 100n * 10n ** 18n, validUntil: 1800000600, nonce: ethers.id('n'),
    })).toBe('0x951dd9f0b37ea2d3cb163768bc161f3f2eb64f085423954f4cfb9bff480b2ad0');
});

test('vector de oro: hash del paymaster', () => {
    const op = u.normalize({
        sender: '0x000000000000000000000000000000000000bEEF', nonce: '0x7', initCode: '0x', callData: '0x01020304',
        accountGasLimits: '0x00000000000000000000000000030d4000000000000000000000000000030d40', preVerificationGas: '0xea60',
        gasFees: '0x0000000000000000000000000000000100000000000000000000000000000002',
        paymasterAndData: u.buildPaymasterAndData({ paymaster: PM, verificationGas: 150000n, postOpGas: 80000n, orgId: ORG, validUntil: 1800000600, validAfter: 0, signedMax: 5n * 10n ** 17n }),
    });
    expect(u.paymasterHash({ op, orgId: ORG, validUntil: 1800000600, validAfter: 0, signedMax: 5n * 10n ** 17n, chainId: 137, paymaster: PM }))
        .toBe('0x34b1ec86b74072a8416fe1c83f73b1dfb620bd16cd5e92de6e9aa0f64e16d3f1');
});

test('la firma no entra en el hash del paymaster, pero sí los límites de gas del paymaster', () => {
    const base = { sender: '0x000000000000000000000000000000000000bEEF', nonce: '0x1', callData: '0x00', accountGasLimits: '0x' + '00'.repeat(31) + '01', preVerificationGas: '0x1', gasFees: '0x' + '00'.repeat(31) + '01' };
    const mk = (vg, sig) => u.normalize({ ...base, paymasterAndData: u.buildPaymasterAndData({ paymaster: PM, verificationGas: vg, postOpGas: 1n, orgId: ORG, validUntil: 1, validAfter: 0, signedMax: 1n, signature: sig }) });
    const args = { orgId: ORG, validUntil: 1, validAfter: 0, signedMax: 1n, chainId: 137, paymaster: PM };
    const a = u.paymasterHash({ op: mk(100n, '0x' + '00'.repeat(65)), ...args });
    expect(u.paymasterHash({ op: mk(100n, '0x' + '11'.repeat(65)), ...args })).toBe(a);
    expect(u.paymasterHash({ op: mk(101n, '0x' + '00'.repeat(65)), ...args })).not.toBe(a);
});

test('maxCost suma todos los gas y multiplica por maxFeePerGas', () => {
    const op = u.normalize({
        sender: '0x000000000000000000000000000000000000bEEF', nonce: '0x0', callData: '0x',
        accountGasLimits: '0x00000000000000000000000000030d4000000000000000000000000000030d40', // 200k | 200k
        preVerificationGas: '0xea60', // 60k
        gasFees: '0x0000000000000000000000000000000100000000000000000000000000000002', // prio 1 | max 2
        paymasterAndData: u.buildPaymasterAndData({ paymaster: PM, verificationGas: 150000n, postOpGas: 80000n, orgId: ORG, validUntil: 1, validAfter: 0, signedMax: 1n }),
    });
    const m = u.maxCost(op);
    expect(m.requiredGas).toBe(200000n + 200000n + 60000n + 150000n + 80000n);
    expect(m.maxCostWei).toBe(m.requiredGas * 2n);
});

test('decodeCalls: execute, executeBatch, y rechaza lo desconocido o lotes vacíos/enormes', () => {
    const iface = new ethers.Interface([
        'function execute(address,uint256,bytes)', 'function executeBatch((address target,uint256 value,bytes data)[])', 'function other()',
    ]);
    const T = '0x' + '33'.repeat(20);
    const one = u.decodeCalls(iface.encodeFunctionData('execute', [T, 0, '0xa9059cbb00']));
    expect(one).toEqual([{ target: ethers.getAddress(T), value: 0n, data: '0xa9059cbb00', selector: '0xa9059cbb' }]);
    const batch = u.decodeCalls(iface.encodeFunctionData('executeBatch', [[[T, 0, '0x12345678'], [T, 1, '0x']]]));
    expect(batch.map((c) => c.selector)).toEqual(['0x12345678', '0x']);
    expect(() => u.decodeCalls(iface.encodeFunctionData('other', []))).toThrow(/no soportada/);
    expect(() => u.decodeCalls(iface.encodeFunctionData('executeBatch', [[]]))).toThrow(/entre 1 y 8/);
    expect(() => u.decodeCalls(iface.encodeFunctionData('executeBatch', [Array(9).fill([T, 0, '0x'])]))).toThrow(/entre 1 y 8/);
    expect(() => u.decodeCalls('0xb61d27f6deadbeef')).toThrow(/decodificable/);
});

test('normalize rechaza campos mal formados', () => {
    expect(() => u.normalize({})).toThrow();
    expect(() => u.normalize({ sender: 'no' })).toThrow(/sender/);
});

test('reservationKey depende de entryPoint, cadena, cuenta y nonce', () => {
    const base = { entryPoint: PM, chainId: 137, sender: '0x000000000000000000000000000000000000bEEF', nonce: 1n };
    const k = u.reservationKey(base);
    expect(u.reservationKey({ ...base })).toBe(k);
    for (const o of [{ chainId: 138 }, { nonce: 2n }, { entryPoint: '0x' + '55'.repeat(20) }]) expect(u.reservationKey({ ...base, ...o })).not.toBe(k);
});
