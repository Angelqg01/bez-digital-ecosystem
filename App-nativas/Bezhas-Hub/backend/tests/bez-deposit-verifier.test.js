/**
 * Verificador de depósitos BEZ (sin base de datos ni red: el proveedor es un doble). Es la barrera que decide si se
 * acredita saldo publicitario, así que se ejecuta en el CI. Los casos con Postgres están en tests/integration/ad-balance-pg.test.js.
 */
const { ethers } = require('ethers');
const { verifyBezDeposit, TRANSFER_TOPIC } = require('../services/bezDepositVerifier');

const TOKEN = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const DEPOSITO = '0x1111111111111111111111111111111111111111';
const ANA = '0x2222222222222222222222222222222222222222';
const BETO = '0x3333333333333333333333333333333333333333';
const ENV = { BEZ_ADS_DEPOSIT_ADDRESS: DEPOSITO, BEZ_DEPOSIT_CONFIRMATIONS: '20' };
const TX = `0x${'ab'.repeat(32)}`;

const recibo = (transfers, { status = 1, blockNumber = 100 } = {}) => ({
    status, blockNumber,
    logs: transfers.map(({ from, to, value, token = TOKEN, topics }) => ({
        address: token,
        topics: topics || [TRANSFER_TOPIC, ethers.zeroPadValue(from, 32), ethers.zeroPadValue(to, 32)],
        data: ethers.toBeHex(ethers.parseUnits(String(value), 18), 32),
    })),
});
const verifica = (rec, extra = {}) => verifyBezDeposit({
    txHash: TX, fromWallet: ANA, env: ENV, provider: { getTransactionReceipt: async () => rec, getBlockNumber: async () => extra.head || 200 }, ...extra,
});

test('acepta una transferencia confirmada de la wallet del usuario al depósito y devuelve lo que dice la cadena', async () => {
    expect(await verifica(recibo([{ from: ANA, to: DEPOSITO, value: '123.5' }]))).toMatchObject({ ok: true, amountBez: 123.5 });
});

test('suma varias transferencias de la misma transacción', async () => {
    expect(await verifica(recibo([{ from: ANA, to: DEPOSITO, value: 100 }, { from: ANA, to: DEPOSITO, value: 40 }]))).toMatchObject({ ok: true, amountBez: 140 });
});

test.each([
    ['destinatario distinto', recibo([{ from: ANA, to: BETO, value: 500 }]), 'NO_MATCHING_TRANSFER'],
    ['la transacción es de otra wallet', recibo([{ from: BETO, to: DEPOSITO, value: 500 }]), 'NO_MATCHING_TRANSFER'],
    ['otro token', recibo([{ from: ANA, to: DEPOSITO, value: 500, token: '0x4444444444444444444444444444444444444444' }]), 'NO_MATCHING_TRANSFER'],
    ['un log que no es Transfer', recibo([{ from: ANA, to: DEPOSITO, value: 500, topics: [ethers.id('Approval(address,address,uint256)'), ethers.zeroPadValue(ANA, 32), ethers.zeroPadValue(DEPOSITO, 32)] }]), 'NO_MATCHING_TRANSFER'],
    ['transacción fallida en cadena', recibo([{ from: ANA, to: DEPOSITO, value: 500 }], { status: 0 }), 'TX_FAILED'],
    ['transacción inexistente', null, 'TX_NOT_FOUND'],
])('rechaza: %s', async (_, rec, code) => {
    expect(await verifica(rec)).toMatchObject({ ok: false, code });
});

test('exige confirmaciones: 10 bloques no bastan, 20 sí', async () => {
    const rec = recibo([{ from: ANA, to: DEPOSITO, value: 500 }], { blockNumber: 100 });
    expect(await verifica(rec, { head: 109 })).toMatchObject({ ok: false, code: 'NOT_CONFIRMED' });
    expect(await verifica(rec, { head: 119 })).toMatchObject({ ok: true });
});

test('falla cerrado: sin dirección de depósito, con hash inválido, sin wallet o con el RPC caído', async () => {
    expect(await verifica(recibo([]), { env: {} })).toMatchObject({ ok: false, code: 'NOT_CONFIGURED' });
    expect(await verifica(recibo([]), { txHash: '0x123' })).toMatchObject({ ok: false, code: 'BAD_TX_HASH' });
    expect(await verifica(recibo([]), { fromWallet: null })).toMatchObject({ ok: false, code: 'WALLET_REQUIRED' });
    const roto = { getTransactionReceipt: async () => { throw new Error('timeout'); }, getBlockNumber: async () => 1 };
    expect(await verifica(null, { provider: roto })).toMatchObject({ ok: false, code: 'RPC_ERROR' });
});
