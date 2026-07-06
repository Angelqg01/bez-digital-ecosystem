/**
 * Tests del wiring 3C: onPaymentCompleted → bezSettlement.settle().
 *
 * Verifica los 4 caminos de la integración (sin red, mockando jest.mock):
 *   1. Flag OFF → comportamiento legacy (no se llama a settle), AEGIS sigue siendo el gate.
 *   2. Flag ON + settle válido → continúa al flujo AEGIS/OpenClaw normal.
 *   3. Flag ON + settle inválido → rechazo con reason `settlement:<motivo>` y emit payment.rejected.
 *   4. Flag ON + alreadySettled → corto-circuito idempotente (no re-provisiona).
 *
 * Mockeamos los servicios externos (AEGIS/OpenClaw/persistence) para aislar el wiring.
 */

// Stubs de dependencias que onPaymentCompleted carga al require:
jest.mock('../services/bezSettlement.service', () => ({
    isEnabled: jest.fn(),
    settle: jest.fn(),
}));
jest.mock('axios', () => ({ post: jest.fn().mockResolvedValue({ data: {} }) }));
jest.mock('../models/openClawClient.model', () => ({
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    countDocuments: jest.fn().mockResolvedValue(0),
}));

const settlement = require('../services/bezSettlement.service');

let bridgeModule;
beforeAll(() => { bridgeModule = require('../services/payment-openclaw-bridge'); });

const ORIG_ENV = { ...process.env };
beforeEach(() => {
    jest.clearAllMocks();
    // Evitamos que AEGIS dispare HTTP real (sólo se llama si pasamos el gate de settlement).
    process.env.NODE_ENV = 'test';
    process.env.AEGIS_API_KEY = '';
});
afterEach(() => { process.env = { ...ORIG_ENV }; });

const baseArgs = {
    walletAddress: '0x' + 'a'.repeat(40),
    type: 'tip',
    txHash: '0x' + 'b'.repeat(64),
    bezAmount: 10,
};

describe('onPaymentCompleted ↔ bezSettlement wiring', () => {
    it('flag OFF → no llama settle, sigue el camino legacy', async () => {
        settlement.isEnabled.mockReturnValue(false);
        const r = await bridgeModule.onPaymentCompleted(baseArgs);
        expect(settlement.settle).not.toHaveBeenCalled();
        expect(r.success).toBe(true);
    });

    it('flag ON + sin txHash → no llama settle (no hay nada que verificar)', async () => {
        settlement.isEnabled.mockReturnValue(true);
        const r = await bridgeModule.onPaymentCompleted({ ...baseArgs, txHash: undefined });
        expect(settlement.settle).not.toHaveBeenCalled();
        expect(r.success).toBe(true);
    });

    it('flag ON + settle válido → continúa el flujo (success:true sin alreadySettled)', async () => {
        settlement.isEnabled.mockReturnValue(true);
        settlement.settle.mockResolvedValue({
            valid: true, alreadySettled: false, amountBez: 10, confirmations: 3,
            txHash: baseArgs.txHash, to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
        });
        const r = await bridgeModule.onPaymentCompleted(baseArgs);
        expect(settlement.settle).toHaveBeenCalledWith(expect.objectContaining({
            txHash: baseArgs.txHash, minAmountBez: 10,
        }));
        expect(r.success).toBe(true);
        expect(r.alreadySettled).toBeUndefined();
    });

    it('flag ON + settle inválido → rechaza con reason "settlement:<motivo>" y emite payment.rejected', async () => {
        settlement.isEnabled.mockReturnValue(true);
        settlement.settle.mockResolvedValue({ valid: false, reason: 'amount-too-low', txHash: baseArgs.txHash });
        const rejected = jest.fn();
        bridgeModule.bridgeEvents.once('payment.rejected', rejected);

        const r = await bridgeModule.onPaymentCompleted(baseArgs);
        expect(r).toEqual({ success: false, reason: 'settlement:amount-too-low' });
        expect(rejected).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'settlement:amount-too-low', txHash: baseArgs.txHash,
        }));
    });

    it('flag ON + alreadySettled → corto-circuito idempotente (no re-provisiona)', async () => {
        settlement.isEnabled.mockReturnValue(true);
        settlement.settle.mockResolvedValue({
            valid: true, alreadySettled: true, amountBez: 10, txHash: baseArgs.txHash,
        });
        const r = await bridgeModule.onPaymentCompleted(baseArgs);
        expect(r).toEqual({ success: true, alreadySettled: true, type: 'tip' });
    });

    it('respeta metadata.expectedTo (override del TREASURY default)', async () => {
        settlement.isEnabled.mockReturnValue(true);
        settlement.settle.mockResolvedValue({ valid: true, alreadySettled: false, amountBez: 10 });
        const custom = '0x' + 'c'.repeat(40);
        await bridgeModule.onPaymentCompleted({ ...baseArgs, metadata: { expectedTo: custom } });
        expect(settlement.settle).toHaveBeenCalledWith(expect.objectContaining({ expectedTo: custom }));
    });
});
