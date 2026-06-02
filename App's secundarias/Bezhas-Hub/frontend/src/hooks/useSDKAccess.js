import { useState, useEffect, useCallback } from 'react';
import http from '../services/http';

/**
 * useSDKAccess Hook
 * Provides SDK module/tier information for the Developer Console.
 * Checks which modules and features the current user/developer can access
 * based on their API key tier.
 */
export function useSDKAccess(apiKey) {
    const [sdkAccess, setSdkAccess] = useState({
        tier: null,
        modules: [],
        features: {},
        limits: {},
        loading: true,
        error: null
    });

    const fetchAccess = useCallback(async () => {
        if (!apiKey) {
            setSdkAccess(prev => ({ ...prev, loading: false, error: 'No API key provided' }));
            return;
        }

        try {
            setSdkAccess(prev => ({ ...prev, loading: true, error: null }));

            // Fetch SDK overview (public-ish endpoint, or developer-scoped)
            const res = await http.get('/api/admin/sdk/overview', {
                headers: { 'x-api-key': apiKey }
            });

            const data = res.data?.data;
            if (data) {
                setSdkAccess({
                    tier: data.currentTier || null,
                    modules: data.availableModules || [],
                    features: data.features || {},
                    limits: {
                        requestsPerDay: data.requestsPerDay || 100,
                        requestsPerMinute: data.requestsPerMinute || 5,
                        maxTokensPerRequest: data.maxTokensPerRequest || 500
                    },
                    loading: false,
                    error: null
                });
            } else {
                setSdkAccess(prev => ({ ...prev, loading: false }));
            }
        } catch (err) {
            setSdkAccess(prev => ({
                ...prev,
                loading: false,
                error: err.response?.data?.error || err.message
            }));
        }
    }, [apiKey]);

    useEffect(() => {
        fetchAccess();
    }, [fetchAccess]);

    const canAccessModule = useCallback((moduleId) => {
        return sdkAccess.modules.some(m =>
            (m.moduleId === moduleId || m === moduleId) && m.isEnabled !== false
        );
    }, [sdkAccess.modules]);

    const hasFeature = useCallback((featureName) => {
        return !!sdkAccess.features[featureName];
    }, [sdkAccess.features]);

    return {
        ...sdkAccess,
        canAccessModule,
        hasFeature,
        refresh: fetchAccess
    };
}

/**
 * useSDKModules Hook
 * Fetches the list of available SDK modules for display in Developer Console.
 */
export function useSDKModules() {
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchModules = async () => {
            try {
                const res = await http.get('/api/admin/sdk/modules');
                const data = res.data?.data || [];
                // Filter only enabled modules for developer-facing display
                setModules(data.filter(m => m.isEnabled));
            } catch (err) {
                console.error('useSDKModules error:', err);
                setModules([]);
            } finally {
                setLoading(false);
            }
        };
        fetchModules();
    }, []);

    return { modules, loading };
}

export default useSDKAccess;
