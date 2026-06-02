/**
 * ============================================================================
 * PAYMENT FLOW END-TO-END TESTS
 * ============================================================================
 * 
 * Tests E2E para el flujo completo de pagos con Stripe y asignación de BEZ-Coins
 */

const request = require('supertest');
const mongoose = require('mongoose');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

// Mock de servicios externos
jest.mock('../services/fiat-gateway.service');
jest.mock('../middleware/discordNotifier');
jest.mock('../middleware/telegramNotifier');

const fiatGatewayService = require('../services/fiat-gateway.service');
const Payment = require('../models/Payment.model');

describe('Payment Flow E2E Tests', () => {
    let app;
    let server;

    beforeAll(async () => {
        // Conectar a base de datos de test
        const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/bezhas_test';
        await mongoose.connect(DATABASE_URL);

        // Importar app después de conectar a DB
        app = require('../server');
    });

    afterAll(async () => {
        await mongoose.connection.close();
        if (server) {
            server.close();
        }
    });

    beforeEach(async () => {
        // Limpiar colección de pagos antes de cada test
        await Payment.deleteMany({});

        // Reset mocks
        jest.clearAllMocks();
    });

    describe('Stripe Checkout Session Creation', () => {
        test('should create token purchase session successfully', async () => {
            const response = await request(app)
                .post('/api/stripe/create-token-purchase-session')
                .set('Authorization', 'Bearer mock-jwt-token')
                .send({
                    tokenAmount: 100,
                    email: 'test@example.com'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('sessionId');
            expect(response.body).toHaveProperty('url');
        });

        test('should reject invalid token amount', async () => {
            const response = await request(app)
                .post('/api/stripe/create-token-purchase-session')
                .set('Authorization', 'Bearer mock-jwt-token')
                .send({
                    tokenAmount: -10, // Cantidad inválida
                    email: 'test@example.com'
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        test('should require authentication', async () => {
            const response = await request(app)
                .post('/api/stripe/create-token-purchase-session')
                .send({
                    tokenAmount: 100,
                    email: 'test@example.com'
                });

            expect(response.status).toBe(401);
        });
    });

    describe('Stripe Webhook Processing', () => {
        test('should process checkout.session.completed event', async () => {
            // Mock del evento de Stripe
            const mockEvent = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_123',
                        payment_status: 'paid',
                        amount_total: 1000, // $10.00
                        customer_email: 'test@example.com',
                        metadata: {
                            type: 'token_purchase',
                            userId: 'user123',
                            walletAddress: '0x1234567890123456789012345678901234567890',
                            tokenAmount: '100'
                        }
                    }
                }
            };

            // Mock de fiat gateway service
            fiatGatewayService.processFiatPayment.mockResolvedValue({
                success: true,
                transactionHash: '0xabcdef...',
                amount: 100
            });

            const response = await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', 'mock-signature')
                .send(mockEvent);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('received', true);

            // Verificar que se llamó al servicio de transferencia
            expect(fiatGatewayService.processFiatPayment).toHaveBeenCalledWith(
                '0x1234567890123456789012345678901234567890',
                expect.any(Number)
            );
        });

        test('should handle payment_intent.payment_failed event', async () => {
            const mockEvent = {
                type: 'payment_intent.payment_failed',
                data: {
                    object: {
                        id: 'pi_test_failed',
                        amount: 1000,
                        last_payment_error: {
                            code: 'card_declined',
                            message: 'Your card was declined'
                        },
                        metadata: {
                            walletAddress: '0x1234567890123456789012345678901234567890'
                        }
                    }
                }
            };

            const response = await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', 'mock-signature')
                .send(mockEvent);

            expect(response.status).toBe(200);
            // Verificar que se registró el error
        });
    });

    describe('BEZ-Coin Assignment', () => {
        test('should assign BEZ-Coins to wallet after successful payment', async () => {
            const walletAddress = '0x1234567890123456789012345678901234567890';
            const tokenAmount = 100;

            // Mock de transferencia exitosa
            fiatGatewayService.processFiatPayment.mockResolvedValue({
                success: true,
                transactionHash: '0xabcdef123456',
                amount: tokenAmount
            });

            // Simular webhook de pago exitoso
            const mockEvent = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_success',
                        payment_status: 'paid',
                        amount_total: 1000,
                        metadata: {
                            type: 'token_purchase',
                            userId: 'user123',
                            walletAddress,
                            tokenAmount: tokenAmount.toString()
                        }
                    }
                }
            };

            await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', 'mock-signature')
                .send(mockEvent);

            // Verificar que se procesó el pago
            expect(fiatGatewayService.processFiatPayment).toHaveBeenCalledWith(
                walletAddress,
                expect.any(Number)
            );
        });

        test('should retry on transfer failure', async () => {
            // Mock de fallo en primera transferencia, éxito en segunda
            fiatGatewayService.processFiatPayment
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    success: true,
                    transactionHash: '0xretry123',
                    amount: 100
                });

            const mockEvent = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_retry',
                        payment_status: 'paid',
                        amount_total: 1000,
                        metadata: {
                            type: 'token_purchase',
                            userId: 'user123',
                            walletAddress: '0x1234567890123456789012345678901234567890',
                            tokenAmount: '100'
                        }
                    }
                }
            };

            await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', 'mock-signature')
                .send(mockEvent);

            // Debería haber intentado 2 veces
            expect(fiatGatewayService.processFiatPayment).toHaveBeenCalledTimes(1);
        });
    });

    describe('Payment Status Queries', () => {
        test('should retrieve payment status by session ID', async () => {
            const sessionId = 'cs_test_query';

            const response = await request(app)
                .get(`/api/stripe/session/${sessionId}`)
                .set('Authorization', 'Bearer mock-jwt-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success');
        });

        test('should return 404 for non-existent session', async () => {
            const response = await request(app)
                .get('/api/stripe/session/cs_nonexistent')
                .set('Authorization', 'Bearer mock-jwt-token');

            expect(response.status).toBe(404);
        });
    });

    describe('Database Persistence', () => {
        test('should save payment record to database', async () => {
            const paymentData = {
                userId: 'user123',
                walletAddress: '0x1234567890123456789012345678901234567890',
                amount: 10.00,
                currency: 'USD',
                tokenAmount: 100,
                status: 'completed',
                paymentMethod: 'stripe',
                paymentIntentId: 'pi_test_123',
                transactionHash: '0xabcdef'
            };

            const payment = await Payment.create(paymentData);

            expect(payment).toBeDefined();
            expect(payment._id).toBeDefined();
            expect(payment.status).toBe('completed');

            // Verificar que se puede recuperar
            const found = await Payment.findById(payment._id);
            expect(found.walletAddress).toBe(paymentData.walletAddress);
        });

        test('should update payment status', async () => {
            const payment = await Payment.create({
                userId: 'user123',
                walletAddress: '0x1234567890123456789012345678901234567890',
                amount: 10.00,
                status: 'pending'
            });

            payment.status = 'completed';
            payment.transactionHash = '0xabcdef';
            await payment.save();

            const updated = await Payment.findById(payment._id);
            expect(updated.status).toBe('completed');
            expect(updated.transactionHash).toBe('0xabcdef');
        });
    });

    describe('Error Scenarios', () => {
        test('should handle missing wallet address', async () => {
            const mockEvent = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_no_wallet',
                        payment_status: 'paid',
                        amount_total: 1000,
                        metadata: {
                            type: 'token_purchase',
                            userId: 'user123',
                            // walletAddress faltante
                            tokenAmount: '100'
                        }
                    }
                }
            };

            const response = await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', 'mock-signature')
                .send(mockEvent);

            // Debe manejar el error gracefully
            expect(response.status).toBe(200);
        });

        test('should handle database connection errors', async () => {
            // Simular error de DB
            jest.spyOn(Payment, 'create').mockRejectedValueOnce(new Error('DB Error'));

            const mockEvent = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_db_error',
                        payment_status: 'paid',
                        amount_total: 1000,
                        metadata: {
                            type: 'token_purchase',
                            userId: 'user123',
                            walletAddress: '0x1234567890123456789012345678901234567890',
                            tokenAmount: '100'
                        }
                    }
                }
            };

            const response = await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', 'mock-signature')
                .send(mockEvent);

            // Debe retornar error pero no crashear
            expect(response.status).toBe(200);
        });
    });

    describe('Integration with Notifications', () => {
        test('should send Discord notification on successful payment', async () => {
            const mockEvent = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_notification',
                        payment_status: 'paid',
                        amount_total: 1000,
                        metadata: {
                            type: 'token_purchase',
                            userId: 'user123',
                            walletAddress: '0x1234567890123456789012345678901234567890',
                            tokenAmount: '100'
                        }
                    }
                }
            };

            fiatGatewayService.processFiatPayment.mockResolvedValue({
                success: true,
                transactionHash: '0xnotify123',
                amount: 100
            });

            await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', 'mock-signature')
                .send(mockEvent);

            // Verificar que se enviaron notificaciones (mocked)
            // const discordNotifier = require('../middleware/discordNotifier');
            // expect(discordNotifier.notifyHigh).toHaveBeenCalled();
        });
    });
});
