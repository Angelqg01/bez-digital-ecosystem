/**
 * ============================================================================
 * TWO-FACTOR AUTHENTICATION (2FA) TESTS
 * ============================================================================
 * 
 * Test suite for TOTP and WebAuthn services
 * Tests both unit functionality and API endpoints
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_2fa_testing';
process.env.ENABLE_2FA = 'true';
process.env.ENABLE_WEBAUTHN = 'true';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.APP_NAME = 'Bezhas Test';

// Import services
const totpService = require('../services/totp.service');
const webauthnService = require('../services/webauthn.service');

// Helper to generate valid test JWT
const generateTestToken = (userId = 'test_user_123') => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// ============================================================================
// TOTP SERVICE UNIT TESTS
// ============================================================================

describe('TOTP Service', () => {
    describe('generate2FASecret', () => {
        it('should generate a valid TOTP secret with QR code', async () => {
            const result = await totpService.generate2FASecret('test@bezhas.com');

            expect(result).toBeDefined();
            expect(result.secret).toBeDefined();
            expect(result.secret.length).toBeGreaterThan(10);
            expect(result.qrCodeUrl).toBeDefined();
            expect(result.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
            expect(result.backupCodes).toBeDefined();
            expect(result.backupCodes).toHaveLength(10);
        });

        it('should generate unique secrets for each call', async () => {
            const result1 = await totpService.generate2FASecret('user1@test.com');
            const result2 = await totpService.generate2FASecret('user2@test.com');

            expect(result1.secret).not.toBe(result2.secret);
        });

        it('should include the app name in the otpauth URL', async () => {
            const result = await totpService.generate2FASecret('test@bezhas.com');

            expect(result.otpauthUrl).toContain('Bezhas');
            // The email may be URL-encoded (@ becomes %40)
            expect(result.otpauthUrl.includes('test@bezhas.com') || result.otpauthUrl.includes('test%40bezhas.com')).toBe(true);
        });
    });

    describe('verify2FAToken', () => {
        let testSecret;

        beforeAll(async () => {
            const result = await totpService.generate2FASecret('verify-test@bezhas.com');
            testSecret = result.secret;
        });

        it('should reject empty token', () => {
            const result = totpService.verify2FAToken('', testSecret);
            expect(result).toBe(false);
        });

        it('should reject null token', () => {
            const result = totpService.verify2FAToken(null, testSecret);
            expect(result).toBe(false);
        });

        it('should reject invalid format token (letters)', () => {
            const result = totpService.verify2FAToken('abcdef', testSecret);
            expect(result).toBe(false);
        });

        it('should reject token with wrong length', () => {
            const result = totpService.verify2FAToken('12345', testSecret);
            expect(result).toBe(false);

            const result2 = totpService.verify2FAToken('1234567', testSecret);
            expect(result2).toBe(false);
        });

        it('should reject incorrect 6-digit token', () => {
            // A random 6-digit code is extremely unlikely to be valid
            const result = totpService.verify2FAToken('000000', testSecret);
            expect(result).toBe(false);
        });

        it('should handle tokens with spaces', () => {
            // This tests the normalization
            const result = totpService.verify2FAToken('123 456', testSecret);
            // The token is normalized and then validated
            expect(typeof result).toBe('boolean');
        });
    });

    describe('generateBackupCodes', () => {
        it('should generate 10 backup codes by default', () => {
            const codes = totpService.generateBackupCodes();

            expect(codes).toHaveLength(10);
        });

        it('should generate specified number of codes', () => {
            const codes = totpService.generateBackupCodes(5);

            expect(codes).toHaveLength(5);
        });

        it('should generate 8-character uppercase codes', () => {
            const codes = totpService.generateBackupCodes();

            codes.forEach(code => {
                expect(code.length).toBe(8);
                expect(code).toMatch(/^[A-F0-9]{8}$/);
            });
        });

        it('should generate unique codes', () => {
            const codes = totpService.generateBackupCodes(100);
            const uniqueCodes = new Set(codes);

            // With 100 codes, there's an extremely low probability of collision
            expect(uniqueCodes.size).toBe(100);
        });
    });

    describe('verifyBackupCode', () => {
        it('should verify valid backup code', () => {
            const storedCodes = ['ABCD1234', 'EFGH5678', 'IJKL9012'];
            const result = totpService.verifyBackupCode('EFGH5678', storedCodes);

            expect(result.valid).toBe(true);
            expect(result.remainingCodes).toHaveLength(2);
            expect(result.remainingCodes).not.toContain('EFGH5678');
        });

        it('should reject invalid backup code', () => {
            const storedCodes = ['ABCD1234', 'EFGH5678'];
            const result = totpService.verifyBackupCode('WRONG123', storedCodes);

            expect(result.valid).toBe(false);
            expect(result.remainingCodes).toHaveLength(2);
        });

        it('should normalize input (lowercase to uppercase)', () => {
            const storedCodes = ['ABCD1234'];
            const result = totpService.verifyBackupCode('abcd1234', storedCodes);

            expect(result.valid).toBe(true);
        });

        it('should handle spaces in input', () => {
            const storedCodes = ['ABCD1234'];
            const result = totpService.verifyBackupCode('ABCD 1234', storedCodes);

            expect(result.valid).toBe(true);
        });
    });

    describe('encryptSecret / decryptSecret', () => {
        it('should encrypt and decrypt a secret correctly', () => {
            const originalSecret = 'JBSWY3DPEHPK3PXP';

            const encrypted = totpService.encryptSecret(originalSecret);
            expect(encrypted).not.toBe(originalSecret);
            expect(encrypted).toContain(':'); // Format: iv:authTag:encrypted

            const decrypted = totpService.decryptSecret(encrypted);
            expect(decrypted).toBe(originalSecret);
        });

        it('should produce different ciphertext for same input (due to random IV)', () => {
            const secret = 'TESTSECRET123';

            const encrypted1 = totpService.encryptSecret(secret);
            const encrypted2 = totpService.encryptSecret(secret);

            expect(encrypted1).not.toBe(encrypted2);

            // But both should decrypt to the same value
            expect(totpService.decryptSecret(encrypted1)).toBe(secret);
            expect(totpService.decryptSecret(encrypted2)).toBe(secret);
        });
    });

    describe('is2FAEnabled', () => {
        it('should return true when ENABLE_2FA is set', () => {
            process.env.ENABLE_2FA = 'true';
            expect(totpService.is2FAEnabled()).toBe(true);
        });

        it('should return false when ENABLE_2FA is not set', () => {
            process.env.ENABLE_2FA = 'false';
            expect(totpService.is2FAEnabled()).toBe(false);

            // Reset for other tests
            process.env.ENABLE_2FA = 'true';
        });
    });
});

// ============================================================================
// WEBAUTHN SERVICE UNIT TESTS
// ============================================================================

describe('WebAuthn Service', () => {
    describe('getRegistrationOptions', () => {
        it('should generate valid registration options', async () => {
            const mockUser = {
                _id: 'user123',
                email: 'test@bezhas.com',
                firstName: 'Test',
                lastName: 'User',
            };

            const options = await webauthnService.getRegistrationOptions(mockUser, []);

            expect(options).toBeDefined();
            expect(options.challenge).toBeDefined();
            expect(options.rp).toBeDefined();
            expect(options.rp.name).toBe('Bezhas Network');
            expect(options.rp.id).toBe('localhost');
            expect(options.user).toBeDefined();
            expect(options.user.name).toBe('test@bezhas.com');
            expect(options.pubKeyCredParams).toBeDefined();
            expect(options.pubKeyCredParams.length).toBeGreaterThan(0);
        });

        it('should exclude existing credentials', async () => {
            const mockUser = {
                _id: 'user456',
                email: 'existing@bezhas.com',
            };

            const existingCredentials = [
                { credentialID: Buffer.from('cred123').toString('base64url'), transports: ['internal'] },
                { credentialID: Buffer.from('cred456').toString('base64url'), transports: ['usb'] },
            ];

            const options = await webauthnService.getRegistrationOptions(mockUser, existingCredentials);

            expect(options.excludeCredentials).toBeDefined();
            expect(options.excludeCredentials).toHaveLength(2);
        });

        it('should use wallet address if email not available', async () => {
            const mockUser = {
                _id: 'user789',
                walletAddress: '0x1234567890abcdef',
            };

            const options = await webauthnService.getRegistrationOptions(mockUser, []);

            expect(options.user.name).toBe('0x1234567890abcdef');
        });
    });

    describe('getAuthenticationOptions', () => {
        it('should generate valid authentication options', async () => {
            const { options, challengeKey } = await webauthnService.getAuthenticationOptions();

            expect(options).toBeDefined();
            expect(options.challenge).toBeDefined();
            expect(options.rpId).toBe('localhost');
            expect(challengeKey).toBeDefined();
        });

        it('should include allowed credentials when provided', async () => {
            const credentials = [
                { credentialID: Buffer.from('cred123').toString('base64url'), transports: ['internal'] },
            ];

            const { options } = await webauthnService.getAuthenticationOptions('userId', credentials);

            expect(options.allowCredentials).toBeDefined();
            expect(options.allowCredentials).toHaveLength(1);
        });
    });

    describe('isWebAuthnEnabled', () => {
        it('should return true when ENABLE_WEBAUTHN is set', () => {
            process.env.ENABLE_WEBAUTHN = 'true';
            expect(webauthnService.isWebAuthnEnabled()).toBe(true);
        });

        it('should return false when ENABLE_WEBAUTHN is not set', () => {
            process.env.ENABLE_WEBAUTHN = 'false';
            expect(webauthnService.isWebAuthnEnabled()).toBe(false);

            // Reset for other tests
            process.env.ENABLE_WEBAUTHN = 'true';
        });
    });

    describe('validateConfiguration', () => {
        it('should validate correct localhost configuration', () => {
            process.env.WEBAUTHN_RP_ID = 'localhost';
            process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';

            const result = webauthnService.validateConfiguration();

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.config.rpID).toBe('localhost');
        });

        it('should warn about HTTP with non-localhost domain', () => {
            const originalRpId = process.env.WEBAUTHN_RP_ID;
            const originalOrigin = process.env.WEBAUTHN_ORIGIN;

            process.env.WEBAUTHN_RP_ID = 'example.com';
            process.env.WEBAUTHN_ORIGIN = 'http://example.com';

            const result = webauthnService.validateConfiguration();

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('WebAuthn requires HTTPS in production');

            // Restore
            process.env.WEBAUTHN_RP_ID = originalRpId;
            process.env.WEBAUTHN_ORIGIN = originalOrigin;
        });
    });

    describe('getWebAuthnOrigin', () => {
        it('should return configured origin', () => {
            process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';

            const origin = webauthnService.getWebAuthnOrigin();

            expect(origin).toBe('http://localhost:5173');
        });
    });
});

// ============================================================================
// 2FA API ROUTES INTEGRATION TESTS
// ============================================================================

describe('2FA API Routes', () => {
    let app;
    let testToken;
    let testUserId;

    beforeAll(async () => {
        // Create a simple Express app for testing
        const express = require('express');
        app = express();
        app.use(express.json());

        // Mock auth middleware
        app.use((req, res, next) => {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.substring(7);
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    req.user = decoded;
                } catch (e) {
                    // Token invalid, continue without user
                }
            }
            next();
        });

        // Mount 2FA routes
        const twoFactorRoutes = require('../routes/2fa.routes');
        app.use('/api/2fa', twoFactorRoutes);

        // Generate test token
        testUserId = 'test_user_' + Date.now();
        testToken = generateTestToken(testUserId);
    });

    describe('GET /api/2fa/config', () => {
        it('should return 2FA configuration (public endpoint)', async () => {
            const response = await request(app)
                .get('/api/2fa/config')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.config).toBeDefined();
            expect(response.body.config.totp).toBeDefined();
            expect(response.body.config.webauthn).toBeDefined();
            expect(typeof response.body.config.totp.enabled).toBe('boolean');
            expect(typeof response.body.config.webauthn.enabled).toBe('boolean');
        });
    });

    describe('GET /api/2fa/status', () => {
        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/2fa/status')
                .expect(401);

            expect(response.body.error).toBeDefined();
        });

        it('should return 2FA status for authenticated user', async () => {
            // Mock User.findById for this test
            const User = require('../models/user.model');
            const originalFindById = User.findById;

            User.findById = jest.fn().mockResolvedValue({
                _id: testUserId,
                email: 'test@bezhas.com',
                twoFactorAuth: {
                    totp: { enabled: false },
                    webauthn: { enabled: false, credentials: [] },
                    preferredMethod: null,
                },
            });

            const response = await request(app)
                .get('/api/2fa/status')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.enabled).toBe(false);
            expect(response.body.methods).toBeDefined();
            expect(response.body.methods.totp.enabled).toBe(false);
            expect(response.body.methods.webauthn.enabled).toBe(false);

            // Restore
            User.findById = originalFindById;
        });
    });

    describe('POST /api/2fa/totp/setup', () => {
        it('should return 401 without authentication', async () => {
            await request(app)
                .post('/api/2fa/totp/setup')
                .expect(401);
        });

        it('should generate TOTP setup for authenticated user', async () => {
            // Mock User
            const User = require('../models/user.model');
            const mockUser = {
                _id: testUserId,
                email: 'totp-test@bezhas.com',
                twoFactorAuth: null,
                save: jest.fn().mockResolvedValue(true),
            };

            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/2fa/totp/setup')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.qrCodeUrl).toBeDefined();
            expect(response.body.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
            expect(response.body.backupCodes).toBeDefined();
            expect(response.body.backupCodes).toHaveLength(10);
            expect(response.body.instructions).toBeDefined();
        });
    });

    describe('POST /api/2fa/totp/verify-setup', () => {
        it('should reject invalid token format', async () => {
            const response = await request(app)
                .post('/api/2fa/totp/verify-setup')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ token: 'abc' }) // Invalid - not 6 digits
                .expect(400);

            expect(response.body.errors).toBeDefined();
        });
    });

    describe('POST /api/2fa/webauthn/register/options', () => {
        it('should return 401 without authentication', async () => {
            await request(app)
                .post('/api/2fa/webauthn/register/options')
                .expect(401);
        });

        it('should generate WebAuthn registration options', async () => {
            // Mock User
            const User = require('../models/user.model');
            const mockUser = {
                _id: testUserId,
                email: 'webauthn-test@bezhas.com',
                twoFactorAuth: {
                    webauthn: { credentials: [] },
                },
            };

            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/2fa/webauthn/register/options')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.options).toBeDefined();
            expect(response.body.options.challenge).toBeDefined();
            expect(response.body.options.rp).toBeDefined();
            expect(response.body.options.user).toBeDefined();
        });
    });

    describe('POST /api/2fa/webauthn/authenticate/options', () => {
        it('should generate authentication options (public endpoint)', async () => {
            const response = await request(app)
                .post('/api/2fa/webauthn/authenticate/options')
                .send({})
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.options).toBeDefined();
            expect(response.body.options.challenge).toBeDefined();
            expect(response.body.challengeKey).toBeDefined();
        });
    });

    describe('PUT /api/2fa/preferred-method', () => {
        it('should reject invalid method', async () => {
            const response = await request(app)
                .put('/api/2fa/preferred-method')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ method: 'sms' }) // Invalid method
                .expect(400);

            expect(response.body.errors).toBeDefined();
        });
    });
});

// ============================================================================
// SECURITY TESTS
// ============================================================================

describe('2FA Security', () => {
    describe('Secret Encryption', () => {
        it('should not expose plain secrets in encrypted form', () => {
            const secret = 'SECRETKEY123456';
            const encrypted = totpService.encryptSecret(secret);

            // The encrypted form should not contain the original secret
            expect(encrypted).not.toContain(secret);
            expect(encrypted).not.toContain('SECRET');
        });
    });

    describe('Challenge Expiration', () => {
        it('should use time-based challenges', async () => {
            const { options: options1 } = await webauthnService.getAuthenticationOptions();
            const { options: options2 } = await webauthnService.getAuthenticationOptions();

            // Each call should generate a different challenge
            expect(options1.challenge).not.toBe(options2.challenge);
        });
    });

    describe('Backup Code Usage', () => {
        it('should remove used backup code', () => {
            const codes = ['CODE0001', 'CODE0002', 'CODE0003'];

            // Use first code
            const result1 = totpService.verifyBackupCode('CODE0001', codes);
            expect(result1.valid).toBe(true);
            expect(result1.remainingCodes).toHaveLength(2);

            // Try to use same code again (should fail)
            const result2 = totpService.verifyBackupCode('CODE0001', result1.remainingCodes);
            expect(result2.valid).toBe(false);
        });
    });
});
