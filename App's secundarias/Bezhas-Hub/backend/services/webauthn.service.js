/**
 * WebAuthn / Passkeys Service
 * 
 * Provides passwordless authentication using FIDO2/WebAuthn standard
 * Supports hardware keys (YubiKey), biometrics (TouchID, FaceID), and platform authenticators
 * 
 * IMPORTANT: WebAuthn requires HTTPS in production.
 * Set ENABLE_WEBAUTHN=true and configure WEBAUTHN_ORIGIN in .env to activate.
 */

const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const crypto = require('crypto');

// ============================================
// Configuration
// ============================================

// Relying Party (your app) configuration
// IMPORTANT: Update these values for production!
const getConfig = () => ({
    rpName: process.env.WEBAUTHN_RP_NAME || 'Bezhas Network',
    rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
    origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173',
});

// In-memory challenge storage (use Redis in production)
const challenges = new Map();

// Challenge expiration time (5 minutes)
const CHALLENGE_EXPIRATION_MS = 5 * 60 * 1000;

// ============================================
// Registration Flow
// ============================================

/**
 * Generate registration options for a new passkey
 * Step 1 of registration: Send these options to the browser
 * 
 * @param {Object} user - User object with _id and email
 * @param {Array} existingCredentials - User's existing WebAuthn credentials
 * @returns {Promise<Object>} Registration options for the browser
 */
const getRegistrationOptions = async (user, existingCredentials = []) => {
    try {
        const config = getConfig();

        // Convert user ID to Uint8Array (required by WebAuthn)
        const userIdBuffer = Buffer.from(user._id.toString());

        // Exclude already registered credentials to prevent duplicates
        // In @simplewebauthn/server v13+, use the base64url string directly
        const excludeCredentials = existingCredentials.map(cred => ({
            id: cred.credentialID, // Already base64url encoded string
            type: 'public-key',
            transports: cred.transports || ['internal', 'usb', 'ble', 'nfc'],
        }));

        const options = await generateRegistrationOptions({
            rpName: config.rpName,
            rpID: config.rpID,
            userID: userIdBuffer,
            userName: user.email || user.walletAddress || 'user',
            userDisplayName: user.firstName ? `${user.firstName} ${user.lastName}` : user.email,
            // Prefer passkeys (resident keys) for passwordless login
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: 'platform', // Use device's built-in authenticator
            },
            // Don't require attestation (simpler, more privacy-preserving)
            attestationType: 'none',
            // Exclude already registered credentials
            excludeCredentials,
            // Supported algorithms (prefer newer, more secure)
            supportedAlgorithmIDs: [-7, -257], // ES256, RS256
        });

        // Store challenge for verification (with expiration)
        challenges.set(user._id.toString(), {
            challenge: options.challenge,
            timestamp: Date.now(),
            type: 'registration',
        });

        // Cleanup old challenges
        cleanupExpiredChallenges();

        console.log(`🔐 WebAuthn registration options generated for user: ${user._id}`);

        return options;
    } catch (error) {
        console.error('Error generating WebAuthn registration options:', error);
        throw new Error('Failed to generate passkey registration options');
    }
};

/**
 * Verify registration response from the browser
 * Step 2 of registration: Validate and store the new credential
 * 
 * @param {string} userId - User's ID
 * @param {Object} response - Registration response from browser
 * @returns {Promise<Object>} Verified credential to store in database
 */
const verifyRegistration = async (userId, response) => {
    try {
        const config = getConfig();

        // Get stored challenge
        const storedData = challenges.get(userId);
        if (!storedData || storedData.type !== 'registration') {
            throw new Error('Challenge not found or expired');
        }

        // Check expiration
        if (Date.now() - storedData.timestamp > CHALLENGE_EXPIRATION_MS) {
            challenges.delete(userId);
            throw new Error('Challenge expired');
        }

        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: storedData.challenge,
            expectedOrigin: config.origin,
            expectedRPID: config.rpID,
        });

        // Clear used challenge
        challenges.delete(userId);

        if (!verification.verified) {
            throw new Error('Registration verification failed');
        }

        const { registrationInfo } = verification;

        // Format credential for storage
        const credential = {
            credentialID: Buffer.from(registrationInfo.credential.id).toString('base64url'),
            credentialPublicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64url'),
            counter: registrationInfo.credential.counter,
            credentialDeviceType: registrationInfo.credentialDeviceType,
            credentialBackedUp: registrationInfo.credentialBackedUp,
            transports: response.response.transports || [],
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
            deviceName: response.deviceName || 'Unknown Device',
        };

        console.log(`✅ WebAuthn credential registered for user: ${userId}`);

        return credential;
    } catch (error) {
        console.error('Error verifying WebAuthn registration:', error);
        throw error;
    }
};

// ============================================
// Authentication Flow
// ============================================

/**
 * Generate authentication options for login
 * Step 1 of authentication: Send these options to the browser
 * 
 * @param {string} userId - User's ID (optional for discoverable credentials)
 * @param {Array} credentials - User's stored WebAuthn credentials
 * @returns {Promise<Object>} Authentication options for the browser
 */
const getAuthenticationOptions = async (userId = null, credentials = []) => {
    try {
        const config = getConfig();

        // Allow specific credentials or any discoverable credential
        // In @simplewebauthn/server v13+, use the base64url string directly
        const allowCredentials = credentials.length > 0
            ? credentials.map(cred => ({
                id: cred.credentialID, // Already base64url encoded string
                type: 'public-key',
                transports: cred.transports || ['internal', 'usb', 'ble', 'nfc'],
            }))
            : undefined;

        const options = await generateAuthenticationOptions({
            rpID: config.rpID,
            allowCredentials,
            userVerification: 'preferred',
        });

        // Generate a temporary ID if no user specified
        const challengeKey = userId || crypto.randomUUID();

        // Store challenge for verification
        challenges.set(challengeKey, {
            challenge: options.challenge,
            timestamp: Date.now(),
            type: 'authentication',
        });

        // Cleanup old challenges
        cleanupExpiredChallenges();

        console.log(`🔐 WebAuthn authentication options generated`);

        return {
            options,
            challengeKey, // Return this so frontend can include it in verification
        };
    } catch (error) {
        console.error('Error generating WebAuthn authentication options:', error);
        throw new Error('Failed to generate passkey authentication options');
    }
};

/**
 * Verify authentication response from the browser
 * Step 2 of authentication: Validate the signature
 * 
 * @param {string} challengeKey - Key used to store the challenge
 * @param {Object} response - Authentication response from browser
 * @param {Object} credential - Stored credential to verify against
 * @returns {Promise<Object>} Verification result with updated counter
 */
const verifyAuthentication = async (challengeKey, response, credential) => {
    try {
        const config = getConfig();

        // Get stored challenge
        const storedData = challenges.get(challengeKey);
        if (!storedData || storedData.type !== 'authentication') {
            throw new Error('Challenge not found or expired');
        }

        // Check expiration
        if (Date.now() - storedData.timestamp > CHALLENGE_EXPIRATION_MS) {
            challenges.delete(challengeKey);
            throw new Error('Challenge expired');
        }

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: storedData.challenge,
            expectedOrigin: config.origin,
            expectedRPID: config.rpID,
            credential: {
                id: Buffer.from(credential.credentialID, 'base64url'),
                publicKey: Buffer.from(credential.credentialPublicKey, 'base64url'),
                counter: credential.counter,
            },
        });

        // Clear used challenge
        challenges.delete(challengeKey);

        if (!verification.verified) {
            throw new Error('Authentication verification failed');
        }

        console.log(`✅ WebAuthn authentication successful`);

        return {
            verified: true,
            newCounter: verification.authenticationInfo.newCounter,
        };
    } catch (error) {
        console.error('Error verifying WebAuthn authentication:', error);
        throw error;
    }
};

// ============================================
// Utility Functions
// ============================================

/**
 * Clean up expired challenges from memory
 */
const cleanupExpiredChallenges = () => {
    const now = Date.now();
    for (const [key, value] of challenges.entries()) {
        if (now - value.timestamp > CHALLENGE_EXPIRATION_MS) {
            challenges.delete(key);
        }
    }
};

/**
 * Check if WebAuthn is enabled globally
 * @returns {boolean}
 */
const isWebAuthnEnabled = () => {
    return process.env.ENABLE_WEBAUTHN === 'true';
};

/**
 * Get the configured origin for WebAuthn
 * @returns {string}
 */
const getWebAuthnOrigin = () => {
    return getConfig().origin;
};

/**
 * Validate that the environment is properly configured for WebAuthn
 * @returns {{valid: boolean, errors: string[]}}
 */
const validateConfiguration = () => {
    const errors = [];
    const config = getConfig();

    if (config.origin.startsWith('http://') && config.rpID !== 'localhost') {
        errors.push('WebAuthn requires HTTPS in production');
    }

    if (!config.rpID) {
        errors.push('WEBAUTHN_RP_ID is not configured');
    }

    if (!config.origin) {
        errors.push('WEBAUTHN_ORIGIN is not configured');
    }

    return {
        valid: errors.length === 0,
        errors,
        config: {
            rpName: config.rpName,
            rpID: config.rpID,
            origin: config.origin,
        },
    };
};

module.exports = {
    getRegistrationOptions,
    verifyRegistration,
    getAuthenticationOptions,
    verifyAuthentication,
    isWebAuthnEnabled,
    getWebAuthnOrigin,
    validateConfiguration,
};
