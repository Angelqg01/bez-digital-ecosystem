/**
 * @jest-environment node
 */

/**
 * El motor de pagos es un singleton con estado y un temporizador que simula el
 * webhook de confirmación. Cada test recarga el módulo para partir de un motor
 * limpio y usa temporizadores falsos para no esperar los 2,5 s reales.
 */
type PayEngine = typeof import('@/lib/sdk/bezhas-pay-engine').ENG;

const WALLET = '0x52Df82920CBAE522880dD7657e43d1A754eD044E';
const HEX64 = /^0x[0-9a-f]{64}$/;

let engine: PayEngine;
let logSilenciado: jest.SpyInstance;

beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    logSilenciado = jest.spyOn(console, 'log').mockImplementation(() => {});
    engine = (await import('@/lib/sdk/bezhas-pay-engine')).ENG;
});

afterEach(() => {
    jest.useRealTimers();
    logSilenciado.mockRestore();
});

describe('processPayment (cripto)', () => {
    it('devuelve un hash de transacción con forma de hash', async () => {
        const res = await engine.processPayment({ amount: 10 });

        expect(res.success).toBe(true);
        expect(res.txHash).toMatch(HEX64);
    });

    it('no reutiliza el mismo hash entre pagos', async () => {
        const uno = await engine.processPayment({ amount: 10 });
        const dos = await engine.processPayment({ amount: 10 });

        expect(uno.txHash).not.toBe(dos.txHash);
    });
});

describe('initiateFiatPayment', () => {
    it('abre la sesión en estado pendiente con los datos recibidos', async () => {
        const session = await engine.initiateFiatPayment({
            amount: 100,
            currency: 'EUR',
            provider: 'stripe',
            walletAddress: WALLET,
        });

        expect(session).toMatchObject({
            provider: 'stripe',
            amount: 100,
            currency: 'EUR',
            walletAddress: WALLET,
            status: 'pending',
        });
        expect(session.sessionId).toMatch(/^sess_\d+_[0-9a-f]{8}$/);
    });

    it('con Stripe entrega clientSecret y ninguna redirección', async () => {
        const session = await engine.initiateFiatPayment({
            amount: 100,
            currency: 'EUR',
            provider: 'stripe',
            walletAddress: WALLET,
        });

        expect(session.clientSecret).toMatch(/^pi_[0-9a-f]{24}_secret_[0-9a-f]{16}$/);
        expect(session.redirectUrl).toBeNull();
    });

    it('con PayPal entrega redirección y ningún clientSecret', async () => {
        const session = await engine.initiateFiatPayment({
            amount: 100,
            currency: 'EUR',
            provider: 'paypal',
            walletAddress: WALLET,
        });

        expect(session.redirectUrl).toMatch(
            /^https:\/\/www\.paypal\.com\/checkoutnow\?token=EC-[0-9a-f]{17}$/,
        );
        expect(session.clientSecret).toBeNull();
    });

    it('un proveedor desconocido no recibe ni secreto ni redirección', async () => {
        const session = await engine.initiateFiatPayment({
            amount: 100,
            currency: 'EUR',
            provider: 'bizum',
            walletAddress: WALLET,
        });

        expect(session.clientSecret).toBeNull();
        expect(session.redirectUrl).toBeNull();
    });

    it('la sesión queda consultable por su id', async () => {
        const session = await engine.initiateFiatPayment({
            amount: 50,
            currency: 'USD',
            provider: 'stripe',
            walletAddress: WALLET,
        });

        expect(engine.getFiatSession(session.sessionId)).toBe(session);
    });

    it('devuelve undefined para una sesión que no existe', () => {
        expect(engine.getFiatSession('sess_inventada')).toBeUndefined();
    });

    it('no genera ids de sesión repetidos', async () => {
        const params = {
            amount: 10,
            currency: 'EUR',
            provider: 'stripe',
            walletAddress: WALLET,
        };
        const uno = await engine.initiateFiatPayment(params);
        const dos = await engine.initiateFiatPayment(params);

        expect(uno.sessionId).not.toBe(dos.sessionId);
    });
});

describe('confirmación del pago fiat', () => {
    async function pagar(amount: number, currency: string, provider = 'stripe') {
        const session = await engine.initiateFiatPayment({
            amount,
            currency,
            provider,
            walletAddress: WALLET,
        });
        jest.advanceTimersByTime(2500);
        return session;
    }

    it('no se confirma antes de tiempo', async () => {
        const session = await engine.initiateFiatPayment({
            amount: 100,
            currency: 'EUR',
            provider: 'stripe',
            walletAddress: WALLET,
        });

        jest.advanceTimersByTime(2499);

        expect(session.status).toBe('pending');
        expect(engine.txHistory).toHaveLength(0);
    });

    it('pasa a completada y registra la transacción', async () => {
        const session = await pagar(100, 'EUR');

        expect(session.status).toBe('completed');
        expect(engine.txHistory).toHaveLength(1);
        expect(engine.txHistory[0]).toMatchObject({
            id: `fiat_${session.sessionId}`,
            type: 'token_purchase',
            payWith: 'EUR',
            amount: 100,
            status: 'completed',
            walletAddress: WALLET,
            provider: 'stripe',
        });
    });

    it.each<[string, number, number]>([
        ['EUR', 100, 87.9032],
        ['USD', 100, 80.6452],
        ['EUR', 12.5, 10.9879],
    ])('convierte %s %d a %d BEZ al precio vigente', async (currency, amount, esperado) => {
        await pagar(amount, currency);

        expect(engine.txHistory[0].bezAmount).toBe(esperado);
    });

    it('calcula el equivalente en USD según la divisa pagada', async () => {
        await pagar(100, 'EUR');
        expect(engine.txHistory[0].usdValue).toBeCloseTo(109, 5);

        await pagar(100, 'USD');
        expect(engine.txHistory[0].usdValue).toBeCloseTo(100, 5);
    });

    it('apunta el explorador de Polygon con el hash de la transacción', async () => {
        await pagar(100, 'EUR');
        const tx = engine.txHistory[0];

        expect(tx.txHash).toMatch(HEX64);
        expect(tx.explorerUrl).toMatch(/^https:\/\/polygonscan\.com\/tx\/0x[0-9a-f]{64}$/);
        expect(tx.blockNumber).toBeGreaterThanOrEqual(12000000);
        expect(tx.blockNumber).toBeLessThanOrEqual(13000000);
    });

    it('pone la transacción más reciente al principio del historial', async () => {
        const primera = await pagar(10, 'EUR');
        const segunda = await pagar(20, 'EUR');

        expect(engine.txHistory.map((tx) => tx.id)).toEqual([
            `fiat_${segunda.sessionId}`,
            `fiat_${primera.sessionId}`,
        ]);
    });

    it('abona los BEZ en la wallet cuando hay una conectada', async () => {
        engine.wallet = { balances: { BEZ: 10 } };

        await pagar(100, 'EUR');

        expect(engine.wallet.balances.BEZ).toBeCloseTo(97.9032, 4);
    });

    it('inicializa los saldos si la wallet aún no los tiene', async () => {
        engine.wallet = {};

        await pagar(100, 'EUR');

        expect(engine.wallet.balances.BEZ).toBeCloseTo(87.9032, 4);
    });

    it('no falla si no hay wallet conectada', async () => {
        engine.wallet = null;

        await expect(pagar(100, 'EUR')).resolves.toBeDefined();
        expect(engine.txHistory).toHaveLength(1);
    });

    it('avisa a los suscriptores con el evento de pago completado', async () => {
        const escucha = jest.fn();
        engine.onEvent(escucha);

        await pagar(100, 'EUR');

        expect(escucha).toHaveBeenCalledWith(
            expect.stringContaining('87.9032 BEZ'),
            'payment_completed',
        );
    });

    it('no confirma dos veces la misma sesión', async () => {
        await pagar(100, 'EUR');

        jest.advanceTimersByTime(5000);

        expect(engine.txHistory).toHaveLength(1);
    });
});
