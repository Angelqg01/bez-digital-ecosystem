/**
 * Validation Routes Integration Tests
 * Tests for the quality oracle validation endpoints
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test_jwt_secret_key_for_testing_only';

describe('Validation API Integration', () => {
    let app;
    let server;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Mock validation data store
        const pendingValidations = new Map();
        const validationResults = new Map();

        // Auth middleware
        const authMiddleware = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'No token provided' });
            }
            try {
                const token = authHeader.replace('Bearer ', '');
                req.user = jwt.verify(token, JWT_SECRET);
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        };

        // Get pending validations
        app.get('/api/validation/pending', authMiddleware, (req, res) => {
            const pending = Array.from(pendingValidations.values())
                .filter(v => v.status === 'pending')
                .slice(0, 10);

            res.json({
                success: true,
                validations: pending,
                total: pending.length
            });
        });

        // Submit validation
        app.post('/api/validation/submit', authMiddleware, (req, res) => {
            const { postId, vote, reason } = req.body;

            if (!postId || !vote) {
                return res.status(400).json({ error: 'postId and vote are required' });
            }

            if (!['approve', 'reject'].includes(vote)) {
                return res.status(400).json({ error: 'vote must be approve or reject' });
            }

            const validationId = `val_${Date.now()}`;
            validationResults.set(validationId, {
                id: validationId,
                postId,
                vote,
                reason,
                validatorId: req.user.userId,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                validationId,
                message: 'Validation submitted successfully'
            });
        });

        // Get validation stats
        app.get('/api/validation/stats', authMiddleware, (req, res) => {
            const results = Array.from(validationResults.values())
                .filter(v => v.validatorId === req.user.userId);

            res.json({
                success: true,
                stats: {
                    totalValidations: results.length,
                    approved: results.filter(v => v.vote === 'approve').length,
                    rejected: results.filter(v => v.vote === 'reject').length,
                    accuracy: 0.95,
                    rank: 'Expert Validator',
                    rewardsEarned: results.length * 10
                }
            });
        });

        // Get validator leaderboard
        app.get('/api/validation/leaderboard', (req, res) => {
            res.json({
                success: true,
                leaderboard: [
                    { rank: 1, address: '0x1234...5678', validations: 1000, accuracy: 0.98 },
                    { rank: 2, address: '0xabcd...efgh', validations: 850, accuracy: 0.96 },
                    { rank: 3, address: '0x9876...5432', validations: 720, accuracy: 0.94 }
                ]
            });
        });

        // Admin: Get all validation activity
        app.get('/api/validation/admin/activity', authMiddleware, (req, res) => {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }

            res.json({
                success: true,
                activity: {
                    last24h: {
                        totalValidations: 150,
                        avgProcessingTime: '2.3s',
                        approvalRate: 0.72
                    },
                    validators: {
                        active: 25,
                        total: 100
                    }
                }
            });
        });

        server = app.listen(0);
    });

    afterAll(() => {
        if (server) {
            server.close();
        }
    });

    // Helper to create auth token
    const createToken = (payload = {}) => {
        return jwt.sign(
            { userId: 'user123', role: 'user', ...payload },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
    };

    describe('GET /api/validation/pending', () => {
        it('should return pending validations', async () => {
            const token = createToken();

            const res = await request(app)
                .get('/api/validation/pending')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('validations');
            expect(Array.isArray(res.body.validations)).toBe(true);
        });

        it('should require authentication', async () => {
            await request(app)
                .get('/api/validation/pending')
                .expect(401);
        });
    });

    describe('POST /api/validation/submit', () => {
        it('should submit a validation', async () => {
            const token = createToken();

            const res = await request(app)
                .post('/api/validation/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    postId: 'post_123',
                    vote: 'approve',
                    reason: 'High quality content'
                })
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('validationId');
        });

        it('should validate vote value', async () => {
            const token = createToken();

            await request(app)
                .post('/api/validation/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    postId: 'post_123',
                    vote: 'invalid_vote'
                })
                .expect(400);
        });

        it('should require postId and vote', async () => {
            const token = createToken();

            await request(app)
                .post('/api/validation/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({})
                .expect(400);
        });
    });

    describe('GET /api/validation/stats', () => {
        it('should return validator stats', async () => {
            const token = createToken();

            const res = await request(app)
                .get('/api/validation/stats')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('stats');
            expect(res.body.stats).toHaveProperty('totalValidations');
            expect(res.body.stats).toHaveProperty('accuracy');
        });
    });

    describe('GET /api/validation/leaderboard', () => {
        it('should return public leaderboard', async () => {
            const res = await request(app)
                .get('/api/validation/leaderboard')
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('leaderboard');
            expect(Array.isArray(res.body.leaderboard)).toBe(true);
        });
    });

    describe('GET /api/validation/admin/activity', () => {
        it('should return admin activity for admin users', async () => {
            const token = createToken({ role: 'admin' });

            const res = await request(app)
                .get('/api/validation/admin/activity')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('activity');
        });

        it('should reject non-admin users', async () => {
            const token = createToken({ role: 'user' });

            await request(app)
                .get('/api/validation/admin/activity')
                .set('Authorization', `Bearer ${token}`)
                .expect(403);
        });
    });
});
