/**
 * ============================================================================
 * PRUEBAS E2E DEL FLUJO DE PAGO
 * ============================================================================
 *
 * Flujo completo de cobro con Stripe y asignación de BEZ-Coins.
 *
 * ─── Por qué estaba rota ────────────────────────────────────────────────────
 *
 * Las 14 pruebas fallaban y la suite ni siquiera terminaba de cargar. Tres
 * causas, todas de deriva entre la prueba y el código:
 *
 *  1. `app = require('../server')`. El servidor exporta `{ app, server }`, así
 *     que `app` era el objeto del módulo, no la aplicación de Express:
 *     supertest reventaba con «app.address is not a function» en cada petición.
 *
 *  2. `await pool.end()` en `afterAll`. `db/pool.js` solo exponía `query` y
 *     `getClient`; `end` no existía y tumbaba la suite entera («pool.end is not
 *     a function»), además de dejar el pool abierto. Se ha añadido `end()` al
 *     pool, que hacía falta de todos modos para un apagado limpio.
 *
 *  3. Las pruebas del webhook mandaban `stripe-signature: 'mock-signature'`.
 *     El router verifica la firma de verdad —como debe— y responde 400. La
 *     prueba describía un webhook sin autenticar que ya no existe.
 *
 * ─── Cómo se prueba ahora ───────────────────────────────────────────────────
 *
 * Los tokens de acceso se firman con el secreto real del proyecto y los
 * webhooks con `stripe.webhooks.generateTestHeaderString`, que es HMAC puro y
 * no sale a la red. Así se ejercita la verificación de firma de verdad, en vez
 * de saltársela: un webhook mal firmado debe rechazarse, y ésa es justamente
 * la prueba que más valor tiene aquí.
 *
 * Las pruebas de persistencia necesitan PostgreSQL y solo corren con
 * `RUN_DB_TESTS=true`, la misma convención que `tests/database-connection.test.js`.
 */

process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_para_pruebas';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';

// El registro de idempotencia del webhook vive en PostgreSQL. Aquí se sustituye
// por un doble en memoria con la misma semántica —la clave primaria decide
// quién procesa— para que estas pruebas no necesiten una base de datos y sigan
// siendo deterministas. Las pruebas de persistencia de más abajo cogen el pool
// de verdad con `jest.requireActual`.
//
// Funciones planas, no `jest.fn()`: la configuración del proyecto activa
// `resetMocks`, que vaciaría la implementación antes de cada prueba.
jest.mock('../db/pool', () => {
    const eventos = new Map();

    /** Reproduce solo las consultas que hace routes/stripe-webhook.routes.js. */
    async function query(texto, valores = []) {
        const sql = String(texto);

        if (sql.includes('INSERT INTO stripe_webhook_events')) {
            const [eventId, eventType, digest] = valores;
            if (eventos.has(eventId)) return { rows: [] }; // ON CONFLICT DO NOTHING
            eventos.set(eventId, {
                event_id: eventId,
                event_type: eventType,
                status: 'processing',
                attempts: 1,
                payload_digest: digest,
                updated_at: Date.now(),
            });
            return { rows: [{ event_id: eventId }] };
        }

        if (sql.includes('UPDATE stripe_webhook_events') && sql.includes("SET status = 'processing'")) {
            const [eventId] = valores;
            const fila = eventos.get(eventId);
            if (!fila) return { rows: [] };

            // Misma condición que el SQL: se reclama lo fallido siempre, y lo
            // que lleva demasiado en 'processing'.
            const caducado = Date.now() - fila.updated_at > 15 * 60 * 1000;
            if (fila.status === 'failed' || (fila.status === 'processing' && caducado)) {
                fila.status = 'processing';
                fila.attempts += 1;
                fila.updated_at = Date.now();
                return { rows: [{ event_id: eventId }] };
            }
            return { rows: [] };
        }

        if (sql.includes('UPDATE stripe_webhook_events')) {
            const [eventId, status, error] = valores;
            const fila = eventos.get(eventId);
            if (fila) {
                fila.status = status;
                fila.last_error = error;
                fila.updated_at = Date.now();
            }
            return { rows: [] };
        }

        // Cualquier otra consulta (los pagos, por ejemplo) va al pool de
        // verdad: aquí solo se sustituye el registro de idempotencia.
        return realPool().query(texto, valores);
    }

    let cacheado = null;
    function realPool() {
        if (!cacheado) cacheado = jest.requireActual('../db/pool');
        return cacheado;
    }

    return {
        query,
        getClient: (...args) => realPool().getClient(...args),
        end: () => (cacheado ? cacheado.end() : Promise.resolve()),
        __eventos: eventos,
    };
});

// Servicios externos: fuera. No se llama a Stripe ni a la cadena en pruebas.
jest.mock('../services/fiat-gateway.service');
jest.mock('../middleware/discordNotifier');
jest.mock('../middleware/telegramNotifier');
jest.mock('../services/stripe.service', () => ({
    STRIPE_CONFIG: { publishableKey: 'pk_test_mock', currency: 'usd' },
    createNFTCheckoutSession: jest.fn(),
    createSubscriptionCheckoutSession: jest.fn(),
    createTokenPurchaseSession: jest.fn(),
    getCheckoutSession: jest.fn(),
    createPaymentIntent: jest.fn(),
    cancelSubscription: jest.fn(),
    getCustomerSubscriptions: jest.fn(),
    createRefund: jest.fn(),
    handleStripeWebhook: jest.fn(),
    handleCheckoutCompleted: jest.fn(),
    handlePaymentSucceeded: jest.fn(),
    handlePaymentFailed: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const stripeLib = require('stripe');
const pool = require('../db/pool');

const stripeService = require('../services/stripe.service');
const Payment = require('../models/pg/Payment');
const { app, server } = require('../server');

const WALLET = '0x1234567890123456789012345678901234567890';
// `payments.user_id` es de tipo UUID en PostgreSQL: 'user123' no cuela.
const USER_UUID = '11111111-2222-3333-4444-555555555555';
const EJECUTAR_PRUEBAS_DB = process.env.RUN_DB_TESTS === 'true';

/** Token de acceso válido para `verifyTokenMiddleware` (type: 'access'). */
function tokenDeAcceso(extra = {}) {
    return jwt.sign(
        { userId: 'user123', walletAddress: WALLET, type: 'access', ...extra },
        process.env.JWT_SECRET || 'default-secret-change-me',
        { expiresIn: '15m' }
    );
}

/** Cuerpo + cabecera de un webhook firmado como lo firmaría Stripe. */
function webhookFirmado(evento) {
    const payload = JSON.stringify(evento);
    const firma = stripeLib.webhooks.generateTestHeaderString({
        payload,
        secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    return { payload, firma };
}

let contadorEventos = 0;
/** Cada evento de Stripe trae un id único; reutilizarlo lo marca como repetido. */
function idEvento(prefijo = 'evt_test') {
    return `${prefijo}_${Date.now()}_${++contadorEventos}`;
}

function eventoCheckoutCompletado(overrides = {}) {
    return {
        id: idEvento(),
        type: 'checkout.session.completed',
        data: {
            object: {
                id: 'cs_test_123',
                payment_status: 'paid',
                amount_total: 1000, // 10,00 USD en céntimos
                customer_email: 'test@example.com',
                metadata: {
                    type: 'token_purchase',
                    userId: 'user123',
                    walletAddress: WALLET,
                    tokenAmount: '100',
                },
                ...overrides,
            },
        },
    };
}

/** Envía un webhook ya firmado al endpoint real. */
function enviarWebhook(evento) {
    const { payload, firma } = webhookFirmado(evento);
    return request(app)
        .post('/api/stripe/webhook')
        .set('stripe-signature', firma)
        .set('Content-Type', 'application/json')
        .send(payload);
}

describe('Flujo de pago E2E', () => {
    const auth = { Authorization: `Bearer ${tokenDeAcceso()}` };

    afterAll(async () => {
        try { server.close(); } catch (_) { /* el servidor puede no estar escuchando */ }
        if (EJECUTAR_PRUEBAS_DB) await pool.end();
    });

    describe('Creación de sesión de checkout', () => {
        test('crea la sesión de compra de tokens', async () => {
            stripeService.createTokenPurchaseSession.mockResolvedValue({
                success: true,
                sessionId: 'cs_test_new',
                url: 'https://checkout.stripe.com/c/pay/cs_test_new',
            });

            const res = await request(app)
                .post('/api/stripe/create-token-purchase-session')
                .set(auth)
                .send({ tokenAmount: 100, email: 'test@example.com' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('sessionId');
            expect(res.body).toHaveProperty('url');
        });

        test('pasa al servicio el monedero del token, no uno del cuerpo', async () => {
            // La dirección de destino sale del token verificado. Si viniera del
            // cuerpo, cualquiera podría comprar tokens a la cartera de otro.
            stripeService.createTokenPurchaseSession.mockResolvedValue({
                success: true, sessionId: 'cs_x', url: 'https://x',
            });

            await request(app)
                .post('/api/stripe/create-token-purchase-session')
                .set(auth)
                .send({ tokenAmount: 100, walletAddress: '0xATACANTE' });

            expect(stripeService.createTokenPurchaseSession).toHaveBeenCalledWith(
                100,
                expect.objectContaining({ walletAddress: WALLET, userId: 'user123' })
            );
        });

        test('rechaza una cantidad de tokens inválida', async () => {
            for (const tokenAmount of [-10, 0, 0.5]) {
                const res = await request(app)
                    .post('/api/stripe/create-token-purchase-session')
                    .set(auth)
                    .send({ tokenAmount, email: 'test@example.com' });

                expect(res.status).toBe(400);
                expect(res.body).toHaveProperty('error');
            }
        });

        test('exige autenticación', async () => {
            const res = await request(app)
                .post('/api/stripe/create-token-purchase-session')
                .send({ tokenAmount: 100, email: 'test@example.com' });

            expect(res.status).toBe(401);
        });

        test('rechaza un token firmado con otro secreto', async () => {
            const falso = jwt.sign(
                { userId: 'user123', walletAddress: WALLET, type: 'access' },
                'secreto-que-no-es-el-nuestro',
                { expiresIn: '15m' }
            );

            const res = await request(app)
                .post('/api/stripe/create-token-purchase-session')
                .set({ Authorization: `Bearer ${falso}` })
                .send({ tokenAmount: 100 });

            expect(res.status).toBe(401);
        });

        test('rechaza un refresh token usado como access token', async () => {
            const refresh = jwt.sign(
                { userId: 'user123', type: 'refresh' },
                process.env.JWT_SECRET || 'default-secret-change-me',
                { expiresIn: '7d' }
            );

            const res = await request(app)
                .post('/api/stripe/create-token-purchase-session')
                .set({ Authorization: `Bearer ${refresh}` })
                .send({ tokenAmount: 100 });

            expect(res.status).toBe(401);
        });
    });

    describe('Verificación de firma del webhook', () => {
        // Estas pruebas provocan a propósito rechazos de firma, y la ruta los
        // registra con console.error. Sin silenciarlos, la salida de la suite
        // se llena de «[STRIPE WEBHOOK] Signature verification failed», que
        // parece un fallo cuando en realidad es la prueba de que la
        // verificación hace su trabajo.
        let errorOriginal;
        beforeAll(() => { errorOriginal = console.error; console.error = () => {}; });
        afterAll(() => { console.error = errorOriginal; });

        test('rechaza un webhook sin cabecera de firma', async () => {
            const res = await request(app)
                .post('/api/stripe/webhook')
                .set('Content-Type', 'application/json')
                .send(JSON.stringify(eventoCheckoutCompletado()));

            expect(res.status).toBe(400);
            expect(String(res.body.error)).toMatch(/signature/i);
        });

        test('rechaza un webhook con una firma inventada', async () => {
            const res = await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', 'mock-signature')
                .set('Content-Type', 'application/json')
                .send(JSON.stringify(eventoCheckoutCompletado()));

            expect(res.status).toBe(400);
        });

        test('rechaza un webhook cuyo cuerpo se alteró después de firmar', async () => {
            const { firma } = webhookFirmado(eventoCheckoutCompletado());
            const manipulado = eventoCheckoutCompletado();
            manipulado.data.object.metadata.tokenAmount = '999999';

            const res = await request(app)
                .post('/api/stripe/webhook')
                .set('stripe-signature', firma)
                .set('Content-Type', 'application/json')
                .send(JSON.stringify(manipulado));

            expect(res.status).toBe(400);
        });

        test('acepta un webhook correctamente firmado', async () => {
            stripeService.handleCheckoutCompleted.mockResolvedValue({ ok: true });

            const res = await enviarWebhook(eventoCheckoutCompletado());

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('received', true);
            expect(res.body).toHaveProperty('eventType', 'checkout.session.completed');
        });
    });

    describe('Procesamiento de eventos', () => {
        test('despacha checkout.session.completed al servicio de Stripe', async () => {
            stripeService.handleCheckoutCompleted.mockResolvedValue({ ok: true });

            await enviarWebhook(eventoCheckoutCompletado());

            expect(stripeService.handleCheckoutCompleted).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'cs_test_123',
                    metadata: expect.objectContaining({ walletAddress: WALLET }),
                })
            );
        });

        test('despacha payment_intent.payment_failed', async () => {
            stripeService.handlePaymentFailed.mockResolvedValue({ ok: true });

            const res = await enviarWebhook({
                id: idEvento('evt_failed'),
                type: 'payment_intent.payment_failed',
                data: {
                    object: {
                        id: 'pi_test_failed',
                        amount: 1000,
                        last_payment_error: { code: 'card_declined', message: 'Your card was declined' },
                        metadata: { walletAddress: WALLET },
                    },
                },
            });

            expect(res.status).toBe(200);
            expect(stripeService.handlePaymentFailed).toHaveBeenCalled();
        });

        test('un tipo de evento desconocido se acepta pero se marca como no gestionado', async () => {
            const res = await enviarWebhook({
                id: idEvento('evt_raro'),
                type: 'radar.early_fraud_warning.created',
                data: { object: { id: 'issfr_1' } },
            });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('handled', false);
        });

        test('espera a que termine el handler antes de contestar a Stripe', async () => {
            // Regresión: el despachador tenía `await A ? B : C`, que por
            // precedencia esperaba a `A` y dejaba la rama elegida SIN await.
            // Se respondía 200 mientras el procesamiento seguía corriendo —y,
            // si fallaba, con una promesa rechazada sin capturar que tumba el
            // proceso—. Aquí se comprueba que la respuesta llega después.
            let terminado = false;
            stripeService.handleCheckoutCompleted.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => {
                    terminado = true;
                    resolve({ ok: true });
                }, 50))
            );

            const res = await enviarWebhook(eventoCheckoutCompletado());

            expect(terminado).toBe(true);
            expect(res.status).toBe(200);
        });

        test('`handled` dice la verdad: falso cuando nadie gestionó el evento', async () => {
            // Con el fallo anterior, `results` guardaba una promesa y la
            // comprobación `r.handled !== false` leía `undefined !== false`:
            // siempre respondía `handled: true`, incluso sin gestionar nada.
            const res = await enviarWebhook({
                id: idEvento('evt_sin_handler'),
                type: 'charge.dispute.created',
                data: { object: { id: 'dp_1' } },
            });

            expect(res.body.handled).toBe(false);
        });

        test('un handler que rechaza no deja promesas sin capturar', async () => {
            const sinCapturar = [];
            const escucha = (razon) => sinCapturar.push(razon);
            process.on('unhandledRejection', escucha);

            try {
                stripeService.handleCheckoutCompleted.mockRejectedValue(new Error('boom'));
                await enviarWebhook(eventoCheckoutCompletado());
                // Margen para que el bucle de eventos emita el evento si lo hubiera.
                await new Promise((r) => setTimeout(r, 50));
            } finally {
                process.off('unhandledRejection', escucha);
            }

            expect(sinCapturar).toEqual([]);
        });

        test('si el handler lanza, devuelve 200 para que Stripe no reintente en bucle', async () => {
            stripeService.handleCheckoutCompleted.mockRejectedValue(new Error('fallo interno'));

            const res = await enviarWebhook(eventoCheckoutCompletado());

            // El router traga el error a propósito: reintentar indefinidamente
            // un evento que siempre falla solo multiplica el problema.
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('received', true);
        });

        test('un evento sin monedero no tumba el endpoint', async () => {
            stripeService.handleCheckoutCompleted.mockResolvedValue({ ok: true });

            const sinMonedero = eventoCheckoutCompletado();
            delete sinMonedero.data.object.metadata.walletAddress;

            const res = await enviarWebhook(sinMonedero);
            expect(res.status).toBe(200);
        });
    });

    describe('Consulta del estado de un pago', () => {
        test('devuelve la sesión cuando existe', async () => {
            stripeService.getCheckoutSession.mockResolvedValue({
                success: true,
                session: { id: 'cs_test_query', payment_status: 'paid' },
            });

            const res = await request(app).get('/api/stripe/session/cs_test_query').set(auth);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success');
        });

        test('devuelve 404 si la sesión no existe', async () => {
            stripeService.getCheckoutSession.mockResolvedValue({
                success: false,
                error: 'No such checkout session',
            });

            const res = await request(app).get('/api/stripe/session/cs_nonexistent').set(auth);

            expect(res.status).toBe(404);
        });

        test('exige autenticación', async () => {
            const res = await request(app).get('/api/stripe/session/cs_test_query');
            expect(res.status).toBe(401);
        });
    });

    describe('Idempotencia (Stripe entrega al menos una vez)', () => {
        test('la segunda entrega del mismo evento no vuelve a procesar el pago', async () => {
            stripeService.handleCheckoutCompleted.mockResolvedValue({ ok: true });
            const evento = eventoCheckoutCompletado();

            const primera = await enviarWebhook(evento);
            const segunda = await enviarWebhook(evento);

            expect(primera.status).toBe(200);
            expect(primera.body.duplicate).toBeUndefined();

            // Reintento: Stripe reenvía el MISMO evt_... tras un 5xx, un 429 o
            // un timeout. Si se volviera a procesar, `processFiatPayment`
            // transferiría los BEZ una segunda vez.
            expect(segunda.status).toBe(200);
            expect(segunda.body.duplicate).toBe(true);
            expect(stripeService.handleCheckoutCompleted).toHaveBeenCalledTimes(1);
        });

        test('dos eventos distintos sí se procesan los dos', async () => {
            stripeService.handleCheckoutCompleted.mockResolvedValue({ ok: true });

            await enviarWebhook(eventoCheckoutCompletado());
            await enviarWebhook(eventoCheckoutCompletado());

            expect(stripeService.handleCheckoutCompleted).toHaveBeenCalledTimes(2);
        });

        test('el mismo evento reenviado en paralelo se procesa una sola vez', async () => {
            stripeService.handleCheckoutCompleted.mockResolvedValue({ ok: true });
            const evento = eventoCheckoutCompletado();

            const respuestas = await Promise.all([
                enviarWebhook(evento),
                enviarWebhook(evento),
                enviarWebhook(evento),
            ]);

            expect(respuestas.every((r) => r.status === 200)).toBe(true);
            expect(stripeService.handleCheckoutCompleted).toHaveBeenCalledTimes(1);
        });
    });

    describe('Semántica de reintentos', () => {
        test('un fallo pasajero devuelve 5xx para que Stripe reintente', async () => {
            // Antes esto devolvía 200: Stripe daba el evento por bueno, no
            // volvía nunca, y el cliente se quedaba pagando sin recibir nada.
            const caida = new Error('connect ECONNREFUSED 127.0.0.1:8545');
            caida.code = 'ECONNREFUSED';
            stripeService.handleCheckoutCompleted.mockRejectedValue(caida);

            const res = await enviarWebhook(eventoCheckoutCompletado());

            expect(res.status).toBeGreaterThanOrEqual(500);
            expect(res.body.retryable).toBe(true);
        });

        test('un 503 del proveedor también se considera reintentable', async () => {
            const caida = new Error('Service Unavailable');
            caida.status = 503;
            stripeService.handleCheckoutCompleted.mockRejectedValue(caida);

            const res = await enviarWebhook(eventoCheckoutCompletado());
            expect(res.status).toBeGreaterThanOrEqual(500);
        });

        test('un fallo permanente devuelve 200: reintentarlo repetiría el error tres días', async () => {
            stripeService.handleCheckoutCompleted.mockRejectedValue(
                new Error('Wallet address missing in metadata')
            );

            const res = await enviarWebhook(eventoCheckoutCompletado());

            expect(res.status).toBe(200);
            expect(res.body.retryable).toBeUndefined();
        });

        test('tras un fallo pasajero, el reintento de Stripe sí vuelve a procesarse', async () => {
            // La deduplicación no puede tragarse el reintento que nosotros
            // mismos hemos pedido con un 5xx: el pago se perdería igual, solo
            // que en silencio.
            const caida = new Error('ETIMEDOUT');
            caida.code = 'ETIMEDOUT';
            stripeService.handleCheckoutCompleted.mockRejectedValueOnce(caida);
            stripeService.handleCheckoutCompleted.mockResolvedValue({ ok: true });

            const evento = eventoCheckoutCompletado();

            const primera = await enviarWebhook(evento);
            expect(primera.status).toBeGreaterThanOrEqual(500);

            const segunda = await enviarWebhook(evento);
            expect(segunda.status).toBe(200);
            expect(segunda.body.duplicate).toBeUndefined();
            expect(stripeService.handleCheckoutCompleted).toHaveBeenCalledTimes(2);
        });
    });

    // Estas necesitan PostgreSQL de verdad: comprueban el SQL del DAO, y
    // contra un pool simulado no probarían nada.
    const describeDB = EJECUTAR_PRUEBAS_DB ? describe : describe.skip;

    describeDB('Persistencia en base de datos (RUN_DB_TESTS=true)', () => {
        // `payments.user_id` tiene clave ajena contra `users`, así que el
        // usuario de prueba tiene que existir antes de insertar ningún pago.
        beforeAll(async () => {
            await pool.query(
                `INSERT INTO users (id, wallet_address, username, email)
                 VALUES ($1, $2, 'usuario_pruebas_pagos', 'pagos@pruebas.local')
                 ON CONFLICT (id) DO NOTHING`,
                [USER_UUID, WALLET]
            );
        });

        afterAll(async () => {
            await pool.query('DELETE FROM payments WHERE user_id = $1', [USER_UUID]);
            await pool.query('DELETE FROM users WHERE id = $1', [USER_UUID]);
        });

        beforeEach(async () => {
            await pool.query('DELETE FROM payments WHERE user_id = $1', [USER_UUID]);
        });

        test('guarda el registro de pago', async () => {
            const pago = await Payment.create({
                paymentIntentId: 'pi_test_123',
                userId: USER_UUID,
                walletAddress: WALLET,
                fiatAmount: 10.0,
                fiatCurrency: 'usd',
                bezAmount: 100,
                status: 'completed',
                type: 'token_purchase',
            });

            expect(pago).toBeDefined();
            expect(pago.id).toBeDefined();
            expect(pago.status).toBe('completed');

            const encontrado = await Payment.findById(pago.id);
            expect(encontrado.wallet_address).toBe(WALLET);
        });

        test('actualiza el estado a partir del payment intent', async () => {
            const pago = await Payment.create({
                paymentIntentId: 'pi_test_update',
                userId: USER_UUID,
                walletAddress: WALLET,
                fiatAmount: 10.0,
                status: 'pending',
                type: 'token_purchase',
            });

            await Payment.updateByPaymentIntent('pi_test_update', {
                status: 'completed',
                txHash: '0xabcdef',
            });

            const actualizado = await Payment.findById(pago.id);
            expect(actualizado.status).toBe('completed');
            expect(actualizado.tx_hash).toBe('0xabcdef');
        });

        test('encuentra el pago por su payment intent', async () => {
            await Payment.create({
                paymentIntentId: 'pi_test_lookup',
                userId: USER_UUID,
                walletAddress: WALLET,
                fiatAmount: 25.5,
                status: 'pending',
                type: 'token_purchase',
            });

            const encontrado = await Payment.findByPaymentIntent('pi_test_lookup');
            expect(encontrado).toBeDefined();
            expect(Number(encontrado.fiat_amount)).toBeCloseTo(25.5);
        });
    });
});
