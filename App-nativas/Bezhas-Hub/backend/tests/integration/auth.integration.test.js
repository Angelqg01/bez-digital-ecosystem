/**
 * Authentication Integration Tests
 * Tests for JWT and authentication middleware
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test_jwt_secret_key_for_testing_only';

describe('Authentication Integration', () => {
    let app;
    let server;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Simple auth middleware for testing
        const authMiddleware = (req, res, next) => {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                return res.status(401).json({ error: 'No token provided' });
            }

            const token = authHeader.replace('Bearer ', '');

            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                req.user = decoded;
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        };

        // Public route
        app.get('/api/public', (req, res) => {
            res.json({ message: 'Public route' });
        });

        // Protected route
        app.get('/api/protected', authMiddleware, (req, res) => {
            res.json({
                message: 'Protected route',
                user: req.user
            });
        });

        // Login route
        app.post('/api/auth/login', (req, res) => {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password required' });
            }

            // Mock authentication
            if (email === 'test@example.com' && password === 'password123') {
                const token = jwt.sign(
                    { userId: 'user123', email, role: 'user' },
                    JWT_SECRET,
                    { expiresIn: '1h' }
                );

                return res.json({ token, user: { email, role: 'user' } });
            }

            return res.status(401).json({ error: 'Invalid credentials' });
        });

        // Wallet auth route
        app.post('/api/auth/wallet', (req, res) => {
            const { walletAddress, signature } = req.body;

            if (!walletAddress || !signature) {
                return res.status(400).json({ error: 'Wallet address and signature required' });
            }

            // Mock wallet authentication
            if (/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                const token = jwt.sign(
                    { userId: walletAddress, walletAddress, role: 'user' },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                return res.json({ token, user: { walletAddress, role: 'user' } });
            }

            return res.status(400).json({ error: 'Invalid wallet address' });
        });

        server = app.listen(0);
    });

    afterAll(() => {
        if (server) {
            server.close();
        }
    });

    describe('Public Routes', () => {
        it('should allow access without authentication', async () => {
            const res = await request(app)
                .get('/api/public')
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Public route');
        });
    });

    describe('Protected Routes', () => {
        it('should reject requests without token', async () => {
            await request(app)
                .get('/api/protected')
                .expect(401);
        });

        it('should reject requests with invalid token', async () => {
            await request(app)
                .get('/api/protected')
                .set('Authorization', 'Bearer invalid_token')
                .expect(401);
        });

        it('should accept requests with valid token', async () => {
            const token = jwt.sign(
                { userId: 'user123', email: 'test@example.com' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const res = await request(app)
                .get('/api/protected')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Protected route');
            expect(res.body).toHaveProperty('user');
        });

        it('should reject expired tokens', async () => {
            const token = jwt.sign(
                { userId: 'user123', email: 'test@example.com' },
                JWT_SECRET,
                { expiresIn: '-1h' } // Already expired
            );

            await request(app)
                .get('/api/protected')
                .set('Authorization', `Bearer ${token}`)
                .expect(401);
        });
    });

    describe('Login', () => {
        it('should return token for valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password123' })
                .expect(200);

            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('user');
        });

        it('should reject invalid credentials', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' })
                .expect(401);
        });

        it('should require email and password', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({})
                .expect(400);
        });
    });

    describe('Wallet Authentication', () => {
        it('should authenticate with valid wallet address', async () => {
            const res = await request(app)
                .post('/api/auth/wallet')
                .send({
                    walletAddress: '0x1234567890123456789012345678901234567890',
                    signature: 'mock_signature'
                })
                .expect(200);

            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('walletAddress');
        });

        it('should reject invalid wallet address format', async () => {
            await request(app)
                .post('/api/auth/wallet')
                .send({
                    walletAddress: 'invalid_address',
                    signature: 'mock_signature'
                })
                .expect(400);
        });
    });
});
