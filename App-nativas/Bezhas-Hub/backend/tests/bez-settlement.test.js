/**
 * Tests del BEZ Settlement Service (Fase 3C) con provider MOCK (sin red).
 * Verifica: parseo del Transfer on-chain, importe/destinatario, degradaciones
 * (tx no encontrada, fallida, importe bajo, sin transfer) e IDEMPOTENCIA.
 */
const { ethers } = require('ethers');
const settlement = require('../services/bezSettlement.service');

const BEZ = settlement.BEZ_ADDRESS;
const TO = '0x52Df82920CBAE522880dD7657e43d1A754eD044E';   // hot wallet
const FROM = '0x1111111111111111111111111111111111111111';
const TX = '0x' + 'a'.repeat(64);
const IFACE = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);

// Construye un log Transfer del contrato BEZ por `amount` BEZ hacia `to`.
function transferLog({ to = TO, amountBez = 50, address = BEZ } = {}) {
    const enc = IFACE.encodeEventLog('Transfer', [FROM, to, ethers.parseUnits(String(amountBez), 18)]);
    return { address, topics: enc.topics, data: enc.data };
}

// Provider mock con un recibo configurable.
function mockProvider(receipt, currentBlock = 1000) {
    return {
        getTransactionReceipt: async () => receipt,
        getBlockNumber: async () => currentBlock,
    };
}

describe('verifyBezSettlement', () => {
    it('valida un Transfer BEZ correcto al destinatario por el importe esperado', async () => {
        const provider = mockProvider({ status: 1, blockNumber: 990, logs: [transferLog({ amountBez: 50 })] });
        const r = await settlement.verifyBezSettlement({ txHash: TX, expectedTo: TO, minAmountBez: 25, provider });
        expect(r.valid).toBe(true);
        expect(r.amountBez).toBe(50);
        expect(r.to.toLowerCase()).toBe(TO.toLowerCase());
        expect(r.confirmations).toBe(11); // 1000-990+1
    });

    it('rechaza txHash mal formado', async () => {
        const r = await settlement.verifyBezSettlement({ txHash: 'nope', provider: mockProvider(null) });
        expect(r).toMatchObject({ valid: false, reason: 'invalid-txhash' });
    });

    it('tx no encontrada → tx-not-found', async () => {
        const r = await settlement.verifyBezSettlement({ txHash: TX, provider: mockProvider(null) });
        expect(r).toMatchObject({ valid: false, reason: 'tx-not-found' });
    });

    it('tx revertida (status 0) → tx-failed', async () => {
        const r = await settlement.verifyBezSettlement({ txHash: TX, provider: mockProvider({ status: 0, logs: [] }) });
        expect(r).toMatchObject({ valid: false, reason: 'tx-failed' });
    });

    it('importe por debajo del mínimo → amount-too-low', async () => {
        const provider = mockProvider({ status: 1, blockNumber: 999, logs: [transferLog({ amountBez: 5 })] });
        const r = await settlement.verifyBezSettlement({ txHash: TX, expectedTo: TO, minAmountBez: 100, provider });
        expect(r).toMatchObject({ valid: false, reason: 'amount-too-low', amountBez: 5 });
    });

    it('Transfer a OTRO destinatario → no-transfer-to-recipient', async () => {
        const provider = mockProvider({ status: 1, blockNumber: 999, logs: [transferLog({ to: FROM, amountBez: 50 })] });
        const r = await settlement.verifyBezSettlement({ txHash: TX, expectedTo: TO, minAmountBez: 1, provider });
        expect(r).toMatchObject({ valid: false, reason: 'no-transfer-to-recipient' });
    });

    it('ignora Transfers de OTRO token (address distinta)', async () => {
        const otherToken = '0x' + '9'.repeat(40);
        const provider = mockProvider({ status: 1, blockNumber: 999, logs: [transferLog({ address: otherToken, amountBez: 99 })] });
        const r = await settlement.verifyBezSettlement({ txHash: TX, expectedTo: TO, minAmountBez: 1, provider });
        expect(r).toMatchObject({ valid: false, reason: 'no-transfer-to-recipient' });
    });

    it('suma múltiples Transfers BEZ al mismo destinatario', async () => {
        const provider = mockProvider({ status: 1, blockNumber: 1000, logs: [transferLog({ amountBez: 30 }), transferLog({ amountBez: 20 })] });
        const r = await settlement.verifyBezSettlement({ txHash: TX, expectedTo: TO, minAmountBez: 50, provider });
        expect(r.valid).toBe(true);
        expect(r.amountBez).toBe(50);
    });
});

describe('settle (idempotencia)', () => {
    it('primera vez acredita; segunda vez devuelve alreadySettled sin re-verificar', async () => {
        const ledger = settlement.createMemoryLedger();
        let calls = 0;
        const provider = {
            getTransactionReceipt: async () => { calls++; return { status: 1, blockNumber: 999, logs: [transferLog({ amountBez: 40 })] }; },
            getBlockNumber: async () => 1000,
        };
        const args = { txHash: TX, expectedTo: TO, minAmountBez: 10, provider };

        const first = await settlement.settle(args, { ledger });
        expect(first.valid).toBe(true);
        expect(first.alreadySettled).toBe(false);

        const second = await settlement.settle(args, { ledger });
        expect(second.alreadySettled).toBe(true);
        expect(second.amountBez).toBe(40);
        expect(calls).toBe(1); // no se volvió a consultar la cadena
    });

    it('un settlement inválido NO se registra (se puede reintentar)', async () => {
        const ledger = settlement.createMemoryLedger();
        const provider = mockProvider(null);
        const r = await settlement.settle({ txHash: TX, expectedTo: TO, provider }, { ledger });
        expect(r.valid).toBe(false);
        expect(await ledger.get(TX)).toBeNull();
    });
});

describe('isEnabled (feature-flag)', () => {
    const ORIG = process.env.FEATURE_BEZ_SETTLEMENT;
    afterEach(() => { process.env.FEATURE_BEZ_SETTLEMENT = ORIG; });
    it('off por defecto, on con flag', () => {
        delete process.env.FEATURE_BEZ_SETTLEMENT;
        expect(settlement.isEnabled()).toBe(false);
        process.env.FEATURE_BEZ_SETTLEMENT = 'true';
        expect(settlement.isEnabled()).toBe(true);
    });
});
