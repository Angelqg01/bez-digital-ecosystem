/**
 * Security Service - 2FA & Passkeys API Client
 * Optimized with robust error handling and offline support
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_2FA = `${API_BASE}/api/2fa`;

// Cache para evitar llamadas repetidas cuando el servidor está offline
let serverAvailable = null;
let lastServerCheck = 0;
const SERVER_CHECK_INTERVAL = 30000; // 30 segundos

const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

// Wrapper para fetch con timeout y manejo de errores de red
const safeFetch = async (url, options = {}, timeout = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        serverAvailable = true;
        lastServerCheck = Date.now();
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        serverAvailable = false;
        lastServerCheck = Date.now();
        if (error.name === 'AbortError') throw new Error('BACKEND_TIMEOUT');
        throw new Error('BACKEND_OFFLINE');
    }
};

const shouldTryServer = () => {
    if (serverAvailable === null || serverAvailable === true) return true;
    return Date.now() - lastServerCheck > SERVER_CHECK_INTERVAL;
};

const offlineStatus = { offline: true, enabled: false, methods: { totp: { enabled: false }, webauthn: { enabled: false } } };
const offlineConfig = { offline: true, config: { totp: { enabled: false, available: false }, webauthn: { enabled: false, available: false } } };

// ============================================
// Status & Configuration
// ============================================

export const get2FAStatus = async () => {
    if (!shouldTryServer()) return offlineStatus;
    try {
        const response = await safeFetch(`${API_2FA}/status`, { headers: getAuthHeaders() });
        if (!response.ok) {
            if (response.status === 401) return { ...offlineStatus, unauthorized: true };
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to get 2FA status');
        }
        return response.json();
    } catch (error) {
        if (error.message === 'BACKEND_OFFLINE' || error.message === 'BACKEND_TIMEOUT') return offlineStatus;
        throw error;
    }
};

export const get2FAConfig = async () => {
    if (!shouldTryServer()) return offlineConfig;
    try {
        const response = await safeFetch(`${API_2FA}/config`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to get 2FA config');
        }
        return response.json();
    } catch (error) {
        if (error.message === 'BACKEND_OFFLINE' || error.message === 'BACKEND_TIMEOUT') return offlineConfig;
        throw error;
    }
};

export const isBackendAvailable = () => serverAvailable === true;

export const checkBackendAvailability = async () => {
    try {
        await safeFetch(`${API_2FA}/config`, {}, 3000);
        return true;
    } catch { return false; }
};

// ============================================
// TOTP (Time-based One-Time Password)
// ============================================

export const setupTOTP = async () => {
    const response = await safeFetch(`${API_2FA}/totp/setup`, { method: 'POST', headers: getAuthHeaders() });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to setup TOTP');
    }
    return response.json();
};

export const verifyTOTPSetup = async (token) => {
    const response = await safeFetch(`${API_2FA}/totp/verify-setup`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ token }) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Invalid verification code');
    }
    return response.json();
};

export const verifyTOTP = async (token) => {
    const response = await safeFetch(`${API_2FA}/totp/verify`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ token }) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Invalid token');
    }
    return response.json();
};

export const disableTOTP = async (token) => {
    const response = await safeFetch(`${API_2FA}/totp/disable`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ token }) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to disable TOTP');
    }
    return response.json();
};

export const regenerateBackupCodes = async (token) => {
    const response = await safeFetch(`${API_2FA}/totp/regenerate-backup-codes`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ token }) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to regenerate backup codes');
    }
    return response.json();
};

// ============================================
// WebAuthn / Passkeys
// ============================================

export const getPasskeyRegistrationOptions = async () => {
    const response = await safeFetch(`${API_2FA}/webauthn/register/options`, { method: 'POST', headers: getAuthHeaders() });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to get registration options');
    }
    return response.json();
};

export const verifyPasskeyRegistration = async (response, deviceName) => {
    const fetchResponse = await safeFetch(`${API_2FA}/webauthn/register/verify`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ response, deviceName }) });
    if (!fetchResponse.ok) {
        const error = await fetchResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to register passkey');
    }
    return fetchResponse.json();
};

export const getPasskeyAuthOptions = async (userId, walletAddress) => {
    const response = await safeFetch(`${API_2FA}/webauthn/authenticate/options`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ userId, walletAddress }) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to get authentication options');
    }
    return response.json();
};

export const verifyPasskeyAuth = async (response, challengeKey, userId, walletAddress) => {
    const fetchResponse = await safeFetch(`${API_2FA}/webauthn/authenticate/verify`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ response, challengeKey, userId, walletAddress }) });
    if (!fetchResponse.ok) {
        const error = await fetchResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Authentication failed');
    }
    return fetchResponse.json();
};

export const removePasskey = async (credentialId) => {
    const response = await safeFetch(`${API_2FA}/webauthn/credential/${encodeURIComponent(credentialId)}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to remove passkey');
    }
    return response.json();
};

export const updatePasskeyName = async (credentialId, deviceName) => {
    const response = await safeFetch(`${API_2FA}/webauthn/credential/${encodeURIComponent(credentialId)}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ deviceName }) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update passkey');
    }
    return response.json();
};

export const setPreferredMethod = async (method) => {
    const response = await safeFetch(`${API_2FA}/preferred-method`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ method }) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to set preferred method');
    }

    return response.json();
};

// ============================================
// WebAuthn Browser API Helpers
// ============================================

/**
 * Check if WebAuthn is supported in this browser
 */
export const isWebAuthnSupported = () => {
    return window.PublicKeyCredential !== undefined;
};

/**
 * Check if platform authenticator (biometric) is available
 */
export const isPlatformAuthenticatorAvailable = async () => {
    if (!isWebAuthnSupported()) return false;
    try {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
};

/**
 * Base64 URL encode/decode utilities for WebAuthn
 */
export const base64urlEncode = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let str = '';
    bytes.forEach(b => str += String.fromCharCode(b));
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

export const base64urlDecode = (str) => {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
};

/**
 * Register a new passkey using browser's WebAuthn API
 */
export const registerPasskey = async (deviceName = 'Mi Passkey') => {
    if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn no está soportado en este navegador');
    }

    // Get registration options from server
    const { options } = await getPasskeyRegistrationOptions();

    // Prepare options for browser API
    const publicKeyCredentialCreationOptions = {
        ...options,
        challenge: base64urlDecode(options.challenge),
        user: {
            ...options.user,
            id: base64urlDecode(options.user.id),
        },
        excludeCredentials: (options.excludeCredentials || []).map(cred => ({
            ...cred,
            id: base64urlDecode(cred.id),
        })),
    };

    // Create credential using browser API
    const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
    });

    // Prepare response for server verification
    const response = {
        id: credential.id,
        rawId: base64urlEncode(credential.rawId),
        type: credential.type,
        response: {
            clientDataJSON: base64urlEncode(credential.response.clientDataJSON),
            attestationObject: base64urlEncode(credential.response.attestationObject),
        },
    };

    // Verify with server
    return verifyPasskeyRegistration(response, deviceName);
};

/**
 * Authenticate with a passkey using browser's WebAuthn API
 */
export const authenticateWithPasskey = async (userId, walletAddress) => {
    if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn no está soportado en este navegador');
    }

    // Get authentication options from server
    const { options, challengeKey } = await getPasskeyAuthOptions(userId, walletAddress);

    // Prepare options for browser API
    const publicKeyCredentialRequestOptions = {
        ...options,
        challenge: base64urlDecode(options.challenge),
        allowCredentials: (options.allowCredentials || []).map(cred => ({
            ...cred,
            id: base64urlDecode(cred.id),
        })),
    };

    // Get credential using browser API
    const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
    });

    // Prepare response for server verification
    const response = {
        id: assertion.id,
        rawId: base64urlEncode(assertion.rawId),
        type: assertion.type,
        response: {
            clientDataJSON: base64urlEncode(assertion.response.clientDataJSON),
            authenticatorData: base64urlEncode(assertion.response.authenticatorData),
            signature: base64urlEncode(assertion.response.signature),
            userHandle: assertion.response.userHandle ? base64urlEncode(assertion.response.userHandle) : null,
        },
    };

    // Verify with server
    return verifyPasskeyAuth(response, challengeKey, userId, walletAddress);
};

export default {
    // Status
    get2FAStatus,
    get2FAConfig,

    // TOTP
    setupTOTP,
    verifyTOTPSetup,
    verifyTOTP,
    disableTOTP,
    regenerateBackupCodes,

    // Passkeys
    getPasskeyRegistrationOptions,
    verifyPasskeyRegistration,
    getPasskeyAuthOptions,
    verifyPasskeyAuth,
    removePasskey,
    updatePasskeyName,
    setPreferredMethod,

    // Browser helpers
    isWebAuthnSupported,
    isPlatformAuthenticatorAvailable,
    registerPasskey,
    authenticateWithPasskey,
};
