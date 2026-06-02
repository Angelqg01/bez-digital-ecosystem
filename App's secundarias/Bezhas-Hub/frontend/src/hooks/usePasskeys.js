/**
 * usePasskeys Hook
 * 
 * React hook for WebAuthn/Passkeys integration
 * Provides passwordless authentication using biometrics or hardware keys
 * 
 * Usage:
 * const { registerPasskey, authenticateWithPasskey, isSupported } = usePasskeys();
 */

import { useState, useCallback, useMemo } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Hook for managing WebAuthn/Passkeys
 */
export const usePasskeys = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Check if WebAuthn is supported in the current browser
     */
    const isSupported = useMemo(() => {
        return window.PublicKeyCredential !== undefined;
    }, []);

    /**
     * Check if platform authenticator (TouchID, FaceID, Windows Hello) is available
     */
    const checkPlatformAuthenticator = useCallback(async () => {
        if (!isSupported) return false;

        try {
            return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {
            return false;
        }
    }, [isSupported]);

    /**
     * Get the 2FA configuration from the server
     */
    const getConfig = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/2fa/config`);
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('Error fetching 2FA config:', err);
            return null;
        }
    }, []);

    /**
     * Get the user's 2FA status
     */
    const getStatus = useCallback(async (token) => {
        try {
            const response = await fetch(`${API_BASE}/api/2fa/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('Error fetching 2FA status:', err);
            return null;
        }
    }, []);

    /**
     * Register a new passkey for the authenticated user
     * @param {string} token - JWT auth token
     * @param {string} deviceName - Optional name for the device
     */
    const registerPasskey = useCallback(async (token, deviceName = 'My Passkey') => {
        if (!isSupported) {
            throw new Error('WebAuthn is not supported in this browser');
        }

        setLoading(true);
        setError(null);

        try {
            // Step 1: Get registration options from server
            const optionsResponse = await fetch(`${API_BASE}/api/2fa/webauthn/register/options`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!optionsResponse.ok) {
                const errorData = await optionsResponse.json();
                throw new Error(errorData.error || 'Failed to get registration options');
            }

            const { options } = await optionsResponse.json();

            // Step 2: Create credentials using browser API
            const attestationResponse = await startRegistration({ optionsJSON: options });

            // Step 3: Send attestation to server for verification
            const verifyResponse = await fetch(`${API_BASE}/api/2fa/webauthn/register/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    response: attestationResponse,
                    deviceName,
                }),
            });

            if (!verifyResponse.ok) {
                const errorData = await verifyResponse.json();
                throw new Error(errorData.error || 'Failed to verify registration');
            }

            const result = await verifyResponse.json();
            setLoading(false);
            return result;

        } catch (err) {
            setLoading(false);
            setError(err.message);
            throw err;
        }
    }, [isSupported]);

    /**
     * Authenticate using a passkey
     * @param {string} userId - Optional user ID for non-discoverable credentials
     * @param {string} walletAddress - Optional wallet address to identify user
     */
    const authenticateWithPasskey = useCallback(async (userId = null, walletAddress = null) => {
        if (!isSupported) {
            throw new Error('WebAuthn is not supported in this browser');
        }

        setLoading(true);
        setError(null);

        try {
            // Step 1: Get authentication options from server
            const optionsResponse = await fetch(`${API_BASE}/api/2fa/webauthn/authenticate/options`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, walletAddress }),
            });

            if (!optionsResponse.ok) {
                const errorData = await optionsResponse.json();
                throw new Error(errorData.error || 'Failed to get authentication options');
            }

            const { options, challengeKey } = await optionsResponse.json();

            // Step 2: Authenticate using browser API
            const assertionResponse = await startAuthentication({ optionsJSON: options });

            // Step 3: Verify assertion on server
            const verifyResponse = await fetch(`${API_BASE}/api/2fa/webauthn/authenticate/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    response: assertionResponse,
                    challengeKey,
                    userId,
                    walletAddress,
                }),
            });

            if (!verifyResponse.ok) {
                const errorData = await verifyResponse.json();
                throw new Error(errorData.error || 'Authentication failed');
            }

            const result = await verifyResponse.json();
            setLoading(false);
            return result;

        } catch (err) {
            setLoading(false);

            // Handle user cancellation gracefully
            if (err.name === 'NotAllowedError') {
                setError('Authentication was cancelled');
            } else {
                setError(err.message);
            }
            throw err;
        }
    }, [isSupported]);

    /**
     * Remove a passkey
     * @param {string} token - JWT auth token
     * @param {string} credentialId - ID of the credential to remove
     */
    const removePasskey = useCallback(async (token, credentialId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/2fa/webauthn/credential/${credentialId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to remove passkey');
            }

            const result = await response.json();
            setLoading(false);
            return result;

        } catch (err) {
            setLoading(false);
            setError(err.message);
            throw err;
        }
    }, []);

    /**
     * Rename a passkey
     * @param {string} token - JWT auth token
     * @param {string} credentialId - ID of the credential to rename
     * @param {string} deviceName - New name for the device
     */
    const renamePasskey = useCallback(async (token, credentialId, deviceName) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/2fa/webauthn/credential/${credentialId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ deviceName }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to rename passkey');
            }

            const result = await response.json();
            setLoading(false);
            return result;

        } catch (err) {
            setLoading(false);
            setError(err.message);
            throw err;
        }
    }, []);

    return {
        // State
        loading,
        error,
        isSupported,

        // Methods
        checkPlatformAuthenticator,
        getConfig,
        getStatus,
        registerPasskey,
        authenticateWithPasskey,
        removePasskey,
        renamePasskey,

        // Clear error
        clearError: () => setError(null),
    };
};

export default usePasskeys;
