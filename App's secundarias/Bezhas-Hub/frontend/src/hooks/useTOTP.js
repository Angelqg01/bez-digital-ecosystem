/**
 * useTOTP Hook
 * 
 * React hook for TOTP (Time-based One-Time Password) 2FA integration
 * Works with Google Authenticator, Authy, and similar apps
 * 
 * Usage:
 * const { setupTOTP, verifyTOTP, disableTOTP } = useTOTP();
 */

import { useState, useCallback } from 'react';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Hook for managing TOTP 2FA
 */
export const useTOTP = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [setupData, setSetupData] = useState(null);

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
     * Start TOTP setup - generates QR code and backup codes
     * @param {string} token - JWT auth token
     */
    const setupTOTP = useCallback(async (token) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/2fa/totp/setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to setup TOTP');
            }

            const data = await response.json();
            setSetupData(data);
            setLoading(false);
            return data;

        } catch (err) {
            setLoading(false);
            setError(err.message);
            throw err;
        }
    }, []);

    /**
     * Complete TOTP setup by verifying a token
     * @param {string} token - JWT auth token
     * @param {string} totpCode - 6-digit code from authenticator app
     */
    const verifySetup = useCallback(async (token, totpCode) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/2fa/totp/verify-setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ token: totpCode }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Invalid verification code');
            }

            const data = await response.json();
            setSetupData(null); // Clear setup data after successful verification
            setLoading(false);
            return data;

        } catch (err) {
            setLoading(false);
            setError(err.message);
            throw err;
        }
    }, []);

    /**
     * Verify a TOTP token (for login or sensitive actions)
     * @param {string} token - JWT auth token
     * @param {string} totpCode - 6-digit code from authenticator app (or 8-char backup code)
     */
    const verifyTOTP = useCallback(async (token, totpCode) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/2fa/totp/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ token: totpCode }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Invalid code');
            }

            const data = await response.json();
            setLoading(false);
            return data;

        } catch (err) {
            setLoading(false);
            setError(err.message);
            throw err;
        }
    }, []);

    /**
     * Disable TOTP 2FA
     * @param {string} token - JWT auth token
     * @param {string} totpCode - Current 6-digit code to confirm
     */
    const disableTOTP = useCallback(async (token, totpCode) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/2fa/totp/disable`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ token: totpCode }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to disable TOTP');
            }

            const data = await response.json();
            setLoading(false);
            return data;

        } catch (err) {
            setLoading(false);
            setError(err.message);
            throw err;
        }
    }, []);

    /**
     * Regenerate backup codes
     * @param {string} token - JWT auth token
     * @param {string} totpCode - Current 6-digit code to confirm
     */
    const regenerateBackupCodes = useCallback(async (token, totpCode) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/2fa/totp/regenerate-backup-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ token: totpCode }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to regenerate backup codes');
            }

            const data = await response.json();
            setLoading(false);
            return data;

        } catch (err) {
            setLoading(false);
            setError(err.message);
            throw err;
        }
    }, []);

    /**
     * Set preferred 2FA method
     * @param {string} token - JWT auth token
     * @param {string} method - 'totp', 'webauthn', or null
     */
    const setPreferredMethod = useCallback(async (token, method) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/2fa/preferred-method`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ method }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to set preferred method');
            }

            const data = await response.json();
            setLoading(false);
            return data;

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
        setupData,

        // Methods
        getStatus,
        setupTOTP,
        verifySetup,
        verifyTOTP,
        disableTOTP,
        regenerateBackupCodes,
        setPreferredMethod,

        // Clear states
        clearError: () => setError(null),
        clearSetupData: () => setSetupData(null),
    };
};

export default useTOTP;
