/**
 * Developer Console Tests
 * 
 * Tests for:
 * 1. requireWalletOrJwt middleware (auth fix)
 * 2. Sector permissions map completeness
 * 3. Wallet address validation
 * 4. JWT token validation
 * 5. Route and controller structure
 */

const jwt = require('jsonwebtoken');

// Mock mongoose to avoid MongoDB driver ESM issues in Jest
jest.mock('mongoose', () => {
    const Schema = function (def) { this.def = def; };
    Schema.prototype.index = function () { return this; };
    Schema.prototype.pre = function () { return this; };
    Schema.prototype.post = function () { return this; };
    Schema.prototype.virtual = function () { return { get: function () { } }; };
    Schema.prototype.methods = {};
    Schema.prototype.statics = {};
    Schema.prototype.set = function () { return this; };
    Schema.Types = { ObjectId: 'ObjectId', Mixed: 'Mixed' };

    const model = function (name, schema) {
        const ModelFn = function () { };
        ModelFn.find = jest.fn().mockResolvedValue([]);
        ModelFn.findOne = jest.fn().mockResolvedValue(null);
        ModelFn.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
        ModelFn.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
        ModelFn.findByIdAndDelete = jest.fn().mockResolvedValue(null);
        ModelFn.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
        ModelFn.countDocuments = jest.fn().mockResolvedValue(0);
        ModelFn.create = jest.fn().mockResolvedValue({});
        ModelFn.aggregate = jest.fn().mockResolvedValue([]);
        ModelFn.prototype.save = jest.fn().mockResolvedValue({});
        ModelFn.modelName = name;
        return ModelFn;
    };

    return {
        Schema,
        model,
        Types: { ObjectId: { isValid: (id) => typeof id === 'string' && id.length > 0 } },
        connection: { readyState: 0 }, // 0 = disconnected for tests
        connect: jest.fn(),
        set: jest.fn()
    };
});

// Also mock bcrypt and other potential native dependencies
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('hashed'),
    hashSync: jest.fn().mockReturnValue('$2a$10$mockhash'),
    compare: jest.fn().mockResolvedValue(true),
    compareSync: jest.fn().mockReturnValue(true),
    genSalt: jest.fn().mockResolvedValue('salt'),
    genSaltSync: jest.fn().mockReturnValue('$2a$10$salt')
}));


// ============================================================================
// TEST 1: JWT Token Validation
// ============================================================================
describe('JWT Token Validation', () => {
    const TEST_SECRET = 'test-secret-key-for-jwt';

    it('should generate a valid JWT token', () => {
        const token = jwt.sign({ id: 'user-123' }, TEST_SECRET, { expiresIn: '1h' });
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);
    });

    it('should verify a valid JWT token', () => {
        const token = jwt.sign({ id: 'user-123' }, TEST_SECRET, { expiresIn: '1h' });
        const decoded = jwt.verify(token, TEST_SECRET);
        expect(decoded.id).toBe('user-123');
    });

    it('should reject an invalid JWT token', () => {
        const token = jwt.sign({ id: 'user-123' }, 'wrong-secret');
        expect(() => jwt.verify(token, TEST_SECRET)).toThrow();
    });

    it('should reject an expired JWT token', () => {
        const token = jwt.sign({ id: 'user-123' }, TEST_SECRET, { expiresIn: '-1s' });
        expect(() => jwt.verify(token, TEST_SECRET)).toThrow();
    });
});

// ============================================================================
// TEST 2: Wallet Address Validation
// ============================================================================
describe('Wallet Address Validation', () => {
    const walletRegex = /^0x[a-fA-F0-9]{40}$/;

    it('should accept valid Ethereum addresses', () => {
        expect(walletRegex.test('0x52Df82920CBAE522880dD7657e43d1A754eD044E')).toBe(true);
        expect(walletRegex.test('0x0000000000000000000000000000000000000000')).toBe(true);
        expect(walletRegex.test('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')).toBe(true);
    });

    it('should reject invalid addresses', () => {
        expect(walletRegex.test('')).toBe(false);
        expect(walletRegex.test('not-an-address')).toBe(false);
        expect(walletRegex.test('0x123')).toBe(false);
        expect(walletRegex.test('52Df82920CBAE522880dD7657e43d1A754eD044E')).toBe(false);
        expect(walletRegex.test('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false);
    });
});

// ============================================================================
// TEST 3: Sector Permissions Map (replicates the frontend map)
// ============================================================================
describe('Sector Permissions Map', () => {
    const SECTOR_PERMISSIONS_MAP = {
        ecommerce: ['marketplace:read', 'marketplace:write', 'payments:read', 'payments:escrow:create', 'payments:swap', 'logistics:read', 'logistics:write'],
        logistics: ['logistics:read', 'logistics:write', 'logistics:fleet', 'supply:provenance:track', 'supply:compliance:verify', 'supply:warehouse:manage'],
        services: ['payments:read', 'payments:escrow:create', 'ai:moderate', 'identity:read', 'identity:verify'],
        realestate: ['realestate:tokenize', 'realestate:fractionate', 'realestate:manage', 'realestate:rent:collect', 'payments:read', 'payments:escrow:create', 'legal:contract:deploy'],
        finance: ['payments:read', 'payments:escrow:create', 'payments:swap', 'ai:analyze', 'identity:read', 'identity:verify'],
        healthcare: ['healthcare:prescriptions:verify', 'healthcare:supply:track', 'healthcare:records:read', 'healthcare:records:write', 'healthcare:compliance:audit', 'identity:verify'],
        automotive: ['automotive:vehicle:tokenize', 'automotive:parts:sync', 'automotive:maintenance:log', 'automotive:history:read', 'automotive:ownership:transfer', 'logistics:read'],
        manufacturing: ['manufacturing:iot:read', 'manufacturing:quality:certify', 'manufacturing:supply:track', 'manufacturing:twin:create', 'manufacturing:compliance:verify', 'supply:provenance:track'],
        energy: ['energy:credits:trade', 'energy:consumption:track', 'energy:grid:balance', 'energy:renewable:certify', 'energy:meters:read', 'carbon:credits:trade'],
        agriculture: ['agriculture:harvest:certify', 'agriculture:supply:track', 'agriculture:land:tokenize', 'agriculture:organic:verify', 'agriculture:iot:sensors', 'supply:provenance:track'],
        education: ['education:credentials:issue', 'education:credentials:verify', 'education:courses:manage', 'education:enrollment:track', 'education:certificates:mint', 'identity:verify'],
        insurance: ['insurance:policy:create', 'insurance:claim:process', 'insurance:claim:verify', 'insurance:oracle:trigger', 'insurance:premium:calculate', 'identity:verify', 'ai:analyze'],
        entertainment: ['entertainment:nft:mint', 'entertainment:royalties:distribute', 'entertainment:rights:manage', 'entertainment:tickets:issue', 'entertainment:streaming:track', 'payments:read'],
        legal: ['legal:contract:deploy', 'legal:notarize', 'legal:dispute:arbitrate', 'legal:documents:verify', 'legal:signatures:collect', 'identity:verify'],
        supply_chain: ['supply:provenance:track', 'supply:compliance:verify', 'supply:carbon:offset', 'supply:customs:clear', 'supply:warehouse:manage', 'logistics:read', 'logistics:write'],
        government: ['gov:identity:issue', 'gov:identity:verify', 'gov:vote:cast', 'gov:records:certify', 'gov:licenses:issue', 'identity:verify'],
        carbon: ['carbon:credits:issue', 'carbon:credits:trade', 'carbon:offset:verify', 'carbon:projects:certify', 'carbon:compliance:report', 'energy:renewable:certify'],
        other: []
    };

    it('should have 18 sectors defined', () => {
        expect(Object.keys(SECTOR_PERMISSIONS_MAP)).toHaveLength(18);
    });

    it('should have all frontend dropdown sectors', () => {
        const expectedSectors = [
            'ecommerce', 'logistics', 'services', 'realestate', 'finance',
            'healthcare', 'automotive', 'manufacturing', 'energy', 'agriculture',
            'education', 'insurance', 'entertainment', 'legal', 'supply_chain',
            'government', 'carbon', 'other'
        ];
        expectedSectors.forEach(sector => {
            expect(SECTOR_PERMISSIONS_MAP).toHaveProperty(sector);
        });
    });

    it('should have non-empty permissions for all sectors except "other"', () => {
        Object.entries(SECTOR_PERMISSIONS_MAP).forEach(([sector, perms]) => {
            if (sector === 'other') {
                expect(perms).toHaveLength(0);
            } else {
                expect(perms.length).toBeGreaterThan(0);
                expect(perms.length).toBeLessThanOrEqual(10);
            }
        });
    });

    it('should only contain valid permission format (module:action)', () => {
        const validFormat = /^[a-z_]+:[a-z_:]+$/;
        Object.values(SECTOR_PERMISSIONS_MAP).flat().forEach(perm => {
            expect(perm).toMatch(validFormat);
        });
    });

    it('should have ecommerce with marketplace and payments', () => {
        expect(SECTOR_PERMISSIONS_MAP.ecommerce).toContain('marketplace:read');
        expect(SECTOR_PERMISSIONS_MAP.ecommerce).toContain('marketplace:write');
        expect(SECTOR_PERMISSIONS_MAP.ecommerce).toContain('payments:read');
    });

    it('should have healthcare with medical permissions', () => {
        expect(SECTOR_PERMISSIONS_MAP.healthcare).toContain('healthcare:prescriptions:verify');
        expect(SECTOR_PERMISSIONS_MAP.healthcare).toContain('healthcare:records:read');
        expect(SECTOR_PERMISSIONS_MAP.healthcare).toContain('healthcare:compliance:audit');
    });

    it('should have realestate with tokenization', () => {
        expect(SECTOR_PERMISSIONS_MAP.realestate).toContain('realestate:tokenize');
        expect(SECTOR_PERMISSIONS_MAP.realestate).toContain('realestate:fractionate');
        expect(SECTOR_PERMISSIONS_MAP.realestate).toContain('payments:escrow:create');
    });

    it('should have no duplicate permissions within any sector', () => {
        Object.entries(SECTOR_PERMISSIONS_MAP).forEach(([sector, perms]) => {
            const unique = new Set(perms);
            expect(unique.size).toBe(perms.length);
        });
    });
});

// ============================================================================
// TEST 4: requireWalletOrJwt Middleware (loads via routes file)
// ============================================================================
describe('requireWalletOrJwt Middleware', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-secret-key-for-jwt';
        process.env.NODE_ENV = 'test';
    });

    it('should load the routes file without errors', () => {
        expect(() => {
            require('../routes/developerConsole.routes');
        }).not.toThrow();
    });

    it('should export an Express Router', () => {
        const router = require('../routes/developerConsole.routes');
        expect(router).toBeDefined();
        expect(typeof router).toBe('function');
    });

    it('should have routes for API key CRUD operations', () => {
        const router = require('../routes/developerConsole.routes');
        const routes = router.stack
            .filter(layer => layer.route)
            .map(layer => ({
                path: layer.route.path,
                methods: Object.keys(layer.route.methods)
            }));

        const paths = routes.map(r => r.path);
        expect(paths).toContain('/usage-stats/:address');
        expect(paths).toContain('/keys');
        expect(paths).toContain('/keys/:id');
        expect(paths).toContain('/keys/:id/rotate');
        expect(paths).toContain('/keys/:id/usage');
        expect(paths).toContain('/keys/:id/test');
        expect(paths).toContain('/keys/:id/webhooks');
    });

    it('should have auth middleware layer before CRUD routes', () => {
        const router = require('../routes/developerConsole.routes');
        const middlewareLayers = router.stack.filter(layer => !layer.route);
        expect(middlewareLayers.length).toBeGreaterThan(0);
    });

    it('should have usage-stats as the first route (public, before auth)', () => {
        const router = require('../routes/developerConsole.routes');
        const firstRoute = router.stack.find(layer => layer.route);
        expect(firstRoute).toBeDefined();
        expect(firstRoute.route.path).toBe('/usage-stats/:address');
    });
});

// ============================================================================
// TEST 5: Controller exports
// ============================================================================
describe('Developer Console Controller', () => {
    it('should load the controller without errors', () => {
        expect(() => {
            require('../controllers/developerConsole.controller');
        }).not.toThrow();
    });

    it('should export all 12 handler functions', () => {
        const controller = require('../controllers/developerConsole.controller');
        const expectedFns = [
            'createApiKey', 'getApiKeys', 'getApiKeyById', 'updateApiKey',
            'deleteApiKey', 'rotateApiKey', 'getApiKeyUsageStats', 'testApiKey',
            'addWebhook', 'deleteWebhook', 'getWebhooks', 'getUsageStats'
        ];
        expectedFns.forEach(fn => {
            expect(controller[fn]).toBeDefined();
            expect(typeof controller[fn]).toBe('function');
        });
    });
});

// ============================================================================
// TEST 6: Integration - Auth Middleware Behavior
// ============================================================================
describe('Auth Middleware Integration', () => {
    const express = require('express');
    const request = require('supertest');

    let app;

    beforeAll(() => {
        process.env.JWT_SECRET = 'test-secret-key-for-jwt';
        app = express();
        app.use(express.json());

        const router = require('../routes/developerConsole.routes');
        app.use('/api/developer', router);
    });

    it('should return 401 when no auth header is provided', async () => {
        const res = await request(app).get('/api/developer/keys');
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Authentication required');
    });

    it('should accept valid JWT Bearer token', async () => {
        const token = jwt.sign({ id: 'test-user-id' }, 'test-secret-key-for-jwt', { expiresIn: '1h' });
        const res = await request(app)
            .get('/api/developer/keys')
            .set('Authorization', `Bearer ${token}`);
        // Should NOT be 401 — it may be 200 or 500 (due to mocked DB), but not auth failure
        expect(res.status).not.toBe(401);
    });

    it('should accept valid wallet address header', async () => {
        const res = await request(app)
            .get('/api/developer/keys')
            .set('x-wallet-address', '0x52Df82920CBAE522880dD7657e43d1A754eD044E');
        // Should NOT be 401
        expect(res.status).not.toBe(401);
    });

    it('should reject invalid wallet address format', async () => {
        const res = await request(app)
            .get('/api/developer/keys')
            .set('x-wallet-address', 'invalid-address');
        expect(res.status).toBe(401);
    });

    it('should reject short wallet address', async () => {
        const res = await request(app)
            .get('/api/developer/keys')
            .set('x-wallet-address', '0x1234');
        expect(res.status).toBe(401);
    });

    it('should accept expired JWT but fallback to wallet header', async () => {
        const token = jwt.sign({ id: 'test-user' }, 'test-secret-key-for-jwt', { expiresIn: '-1s' });
        const res = await request(app)
            .get('/api/developer/keys')
            .set('Authorization', `Bearer ${token}`)
            .set('x-wallet-address', '0x52Df82920CBAE522880dD7657e43d1A754eD044E');
        // JWT is expired but wallet address should work as fallback
        expect(res.status).not.toBe(401);
    });

    it('should allow public access to usage-stats/:address', async () => {
        const res = await request(app)
            .get('/api/developer/usage-stats/0x52Df82920CBAE522880dD7657e43d1A754eD044E');
        // No auth required — should NOT be 401
        expect(res.status).not.toBe(401);
    });

    it('should reject requests with invalid JWT and no wallet', async () => {
        const res = await request(app)
            .get('/api/developer/keys')
            .set('Authorization', 'Bearer invalid.token.here');
        expect(res.status).toBe(401);
    });
});
