const assert = require('node:assert/strict');
const test = require('node:test');

const PaymentsManager = require('../payments');
const { GatewayClient } = require('../gateway-client');
const sdk = require('../index');

function createPaymentsWithMock(routes) {
    const payments = new PaymentsManager({ apiUrl: 'http://unit.test', apiKey: 'test_key' });
    const calls = [];
    payments.axios = {
        async post(path, body) {
            calls.push({ method: 'POST', path, body });
            const handler = routes[`POST ${path}`];
            if (!handler) throw new Error(`Unexpected POST ${path}`);
            return { data: handler(body) };
        },
        async get(path) {
            calls.push({ method: 'GET', path });
            const handler = routes[`GET ${path}`];
            if (!handler) throw new Error(`Unexpected GET ${path}`);
            return { data: handler() };
        },
    };
    return { payments, calls };
}

test('PaymentsManager exposes real payment configs through the SDK', () => {
    assert.equal(sdk.BANK_TRANSFER_DETAILS.iban, 'ES77 1465 0100 91 1766376210');
    assert.equal(sdk.BANK_TRANSFER_DETAILS.bic, 'INGDESMMXXX');
    assert.equal(sdk.getStripePaymentLink('token_purchase').url, 'https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806');
});

test('PaymentsManager crypto quote and direct crypto payment call the crypto backend', async () => {
    const { payments, calls } = createPaymentsWithMock({
        'POST /api/crypto/quote': (body) => {
            assert.deepEqual(body, { amount: 25, currency: 'USDT' });
            return { quote: { fromAmount: 25, fromCurrency: 'USDT', toAmount: 50 } };
        },
        'POST /api/crypto/initiate': (body) => {
            assert.deepEqual(body, {
                walletAddress: '0x1111111111111111111111111111111111111111',
                amount: 25,
                currency: 'USDT',
            });
            return {
                tokenAmount: 50,
                instructions: { network: 'polygon' },
                requiresApproval: true,
                approvalData: { spender: '0x2222222222222222222222222222222222222222' },
            };
        },
        'GET /api/crypto/status/0xabc': () => ({
            status: 'confirmed',
            blockNumber: 123,
            transactionHash: '0xabc',
        }),
    });

    const quote = await payments.getQuote(25, 'USDT');
    assert.equal(quote.success, true);
    assert.equal(quote.quote.toAmount, 50);

    const initiated = await payments.initiateCryptoPayment(
        '0x1111111111111111111111111111111111111111',
        25,
        'USDT'
    );
    assert.equal(initiated.success, true);
    assert.equal(initiated.paymentType, 'crypto');
    assert.equal(initiated.requiresApproval, true);

    const status = await payments.checkTransactionStatus('0xabc');
    assert.equal(status.success, true);
    assert.equal(status.status, 'confirmed');
    assert.equal(calls.length, 3);
});

test('PaymentsManager gateway crypto payment uses BeZhas Gateway paymentMethod crypto', async () => {
    const { payments, calls } = createPaymentsWithMock({
        'POST /api/gateway/v1/payments/buy': (body) => {
            assert.deepEqual(body, {
                walletAddress: '0x3333333333333333333333333333333333333333',
                amountUSD: 100,
                paymentMethod: 'crypto',
            });
            return {
                paymentId: 'pay_crypto_1',
                status: 'pending',
                provider: 'crypto',
                nextAction: 'complete_crypto_transfer',
            };
        },
    });

    const result = await payments.initiateGatewayCryptoPayment({
        walletAddress: '0x3333333333333333333333333333333333333333',
        amountUSD: 100,
    });

    assert.equal(result.success, true);
    assert.equal(result.paymentId, 'pay_crypto_1');
    assert.equal(result.provider, 'crypto');
    assert.equal(calls[0].body.paymentMethod, 'crypto');
});

test('GatewayClient payments.buyBEZ supports crypto payment method', async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push({ url, options });
        return {
            ok: true,
            status: 200,
            async json() {
                return { success: true, paymentId: 'pay_gateway_crypto', provider: 'crypto' };
            },
        };
    };

    try {
        const client = new GatewayClient({
            gatewayUrl: 'https://api.bezhas.test/api/gateway/v1',
            apiKey: 'bzk_test',
            accessToken: 'jwt_test',
        });
        const result = await client.payments.buyBEZ({
            walletAddress: '0x4444444444444444444444444444444444444444',
            amountUSD: 75,
            paymentMethod: 'crypto',
        });

        assert.equal(result.success, true);
        assert.equal(calls[0].url, 'https://api.bezhas.test/api/gateway/v1/payments/buy');
        assert.equal(calls[0].options.method, 'POST');
        assert.equal(calls[0].options.headers['x-api-key'], 'bzk_test');
        assert.equal(calls[0].options.headers.Authorization, 'Bearer jwt_test');
        assert.equal(JSON.parse(calls[0].options.body).paymentMethod, 'crypto');
    } finally {
        global.fetch = originalFetch;
    }
});

test('PaymentsManager exposes M-TFC engine endpoints for SubApps', async () => {
    const { payments, calls } = createPaymentsWithMock({
        'GET /api/mtfc/manifest': () => ({
            data: { name: 'M-TFC Core', billingFeature: 'MTFC_ENGINE' },
        }),
        'POST /api/mtfc/evaluate': (body) => {
            assert.deepEqual(body, {
                fidelidadMax: 1,
                tensionEstatica: 0.2,
                tensionDinamica: 0.3,
                tauBase: 10,
            });
            return { data: { colapso: false, radicando: 0.5, tiempoPropio: 7.071 } };
        },
        'POST /api/mtfc/batch': (body) => {
            assert.equal(body.samples.length, 2);
            return { data: { summary: { total: 2, stable: 1, collapses: 1 } } };
        },
        'POST /api/mtfc/estimate': (body) => {
            assert.deepEqual(body, { operations: 1000, priority: 'realtime' });
            return { data: { feature: 'MTFC_ENGINE', chargedBez: 0.06 } };
        },
    });

    const manifest = await payments.getMTFCManifest();
    assert.equal(manifest.success, true);
    assert.equal(manifest.data.billingFeature, 'MTFC_ENGINE');

    const evaluated = await payments.evaluateMTFC({
        fidelidadMax: 1,
        tensionEstatica: 0.2,
        tensionDinamica: 0.3,
        tauBase: 10,
    });
    assert.equal(evaluated.data.colapso, false);

    const batch = await payments.evaluateMTFCBatch([
        { fidelidadMax: 1, tensionEstatica: 0.1, tensionDinamica: 0.2 },
        { fidelidadMax: 1, tensionEstatica: 0.8, tensionDinamica: 0.8 },
    ]);
    assert.equal(batch.data.summary.collapses, 1);

    const estimate = await payments.estimateMTFCCompute({ operations: 1000, priority: 'realtime' });
    assert.equal(estimate.data.feature, 'MTFC_ENGINE');
    assert.equal(calls.length, 4);
});
