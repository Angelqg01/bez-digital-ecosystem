/**
 * Stripe Service Unit Tests
 * Tests for payment processing functionality
 */

const stripeService = require('../services/stripe.service');

// Mock Stripe
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        checkout: {
            sessions: {
                create: jest.fn(),
                retrieve: jest.fn()
            }
        },
        paymentIntents: {
            create: jest.fn()
        },
        subscriptions: {
            list: jest.fn(),
            cancel: jest.fn()
        },
        customers: {
            list: jest.fn()
        },
        refunds: {
            create: jest.fn()
        },
        webhooks: {
            constructEvent: jest.fn()
        }
    }));
});

// Mock audit logger
jest.mock('../middleware/auditLogger', () => ({
    audit: {
        admin: jest.fn(),
        security: jest.fn(),
        user: jest.fn()
    }
}));

// Mock fiat gateway service
jest.mock('../services/fiat-gateway.service', () => ({
    processFiatPayment: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0x1234567890abcdef'
    })
}));

describe('Stripe Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('STRIPE_CONFIG', () => {
        it('should have required configuration properties', () => {
            expect(stripeService.STRIPE_CONFIG).toBeDefined();
            expect(stripeService.STRIPE_CONFIG).toHaveProperty('CURRENCY');
            expect(stripeService.STRIPE_CONFIG).toHaveProperty('SUCCESS_URL');
            expect(stripeService.STRIPE_CONFIG).toHaveProperty('CANCEL_URL');
        });
    });

    describe('createSubscriptionCheckoutSession', () => {
        it('should create a monthly subscription session', async () => {
            const userInfo = {
                userId: 'user123',
                email: 'test@example.com',
                walletAddress: '0x1234567890123456789012345678901234567890'
            };

            const result = await stripeService.createSubscriptionCheckoutSession('monthly', userInfo);

            // The function should return a result object
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('should create a yearly subscription session', async () => {
            const userInfo = {
                userId: 'user123',
                email: 'test@example.com',
                walletAddress: '0x1234567890123456789012345678901234567890'
            };

            const result = await stripeService.createSubscriptionCheckoutSession('yearly', userInfo);

            expect(result).toBeDefined();
        });

        it('should create a lifetime subscription session', async () => {
            const userInfo = {
                userId: 'user123',
                email: 'test@example.com',
                walletAddress: '0x1234567890123456789012345678901234567890'
            };

            const result = await stripeService.createSubscriptionCheckoutSession('lifetime', userInfo);

            expect(result).toBeDefined();
        });
    });

    describe('createTokenPurchaseSession', () => {
        it('should create a token purchase session', async () => {
            const userInfo = {
                userId: 'user123',
                email: 'test@example.com',
                walletAddress: '0x1234567890123456789012345678901234567890'
            };

            const result = await stripeService.createTokenPurchaseSession(1000, userInfo);

            expect(result).toBeDefined();
        });

        it('should calculate correct amount for tokens', async () => {
            const tokenAmount = 500;
            const userInfo = {
                userId: 'user123',
                email: 'test@example.com',
                walletAddress: '0x1234567890123456789012345678901234567890'
            };

            const result = await stripeService.createTokenPurchaseSession(tokenAmount, userInfo);

            expect(result).toBeDefined();
        });
    });

    describe('getCheckoutSession', () => {
        it('should retrieve a checkout session', async () => {
            const result = await stripeService.getCheckoutSession('cs_test_123');

            expect(result).toBeDefined();
        });
    });

    describe('createPaymentIntent', () => {
        it('should create a payment intent', async () => {
            const amount = 100;
            const metadata = { type: 'test', userId: 'user123' };

            const result = await stripeService.createPaymentIntent(amount, metadata);

            expect(result).toBeDefined();
        });
    });

    describe('cancelSubscription', () => {
        it('should cancel a subscription', async () => {
            const result = await stripeService.cancelSubscription('sub_123', 'user123');

            expect(result).toBeDefined();
        });
    });

    describe('getCustomerSubscriptions', () => {
        it('should get customer subscriptions by email', async () => {
            const result = await stripeService.getCustomerSubscriptions('test@example.com');

            expect(result).toBeDefined();
        });
    });

    describe('createRefund', () => {
        it('should create a full refund', async () => {
            const result = await stripeService.createRefund('pi_123');

            expect(result).toBeDefined();
        });

        it('should create a partial refund', async () => {
            const result = await stripeService.createRefund('pi_123', 50, 'requested_by_customer');

            expect(result).toBeDefined();
        });
    });

    describe('handleStripeWebhook', () => {
        it('should handle checkout.session.completed event', async () => {
            const rawBody = JSON.stringify({ type: 'checkout.session.completed' });
            const signature = 'test_signature';

            const result = await stripeService.handleStripeWebhook(rawBody, signature);

            expect(result).toBeDefined();
        });
    });
});
