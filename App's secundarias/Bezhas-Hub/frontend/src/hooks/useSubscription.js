/**
 * ============================================================================
 * USE SUBSCRIPTION HOOK
 * ============================================================================
 * 
 * Hook de React para manejar suscripciones del usuario.
 * Integra backend API con estado local de React.
 * 
 * @version 2.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import {
    SUBSCRIPTION_TIERS,
    getTierConfig,
    calculatePotentialROI,
    BEZ_TO_USD_RATE,
    TIER_HIERARCHY
} from '../config/tier.config';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Estado inicial de suscripción
 */
const initialState = {
    tier: 'STARTER',
    isLoading: true,
    isActive: false,
    expiresAt: null,
    source: 'none', // 'stripe' | 'token_lock' | 'none'
    tokenLock: null,
    aiCredits: {
        used: 0,
        remaining: 0,
        total: 0
    },
    stakingSignature: null
};

/**
 * Hook principal de suscripción
 */
export const useSubscription = () => {
    const { address, isConnected } = useAccount();
    const [subscription, setSubscription] = useState(initialState);
    const [error, setError] = useState(null);

    /**
     * Fetch subscription status from backend
     */
    const fetchSubscription = useCallback(async () => {
        if (!isConnected || !address) {
            setSubscription({ ...initialState, isLoading: false });
            return;
        }

        try {
            setSubscription(prev => ({ ...prev, isLoading: true }));
            setError(null);

            const response = await fetch(`${API_BASE}/subscription/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch subscription status');
            }

            const data = await response.json();

            setSubscription({
                tier: data.tier || 'STARTER',
                isLoading: false,
                isActive: data.isActive || false,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
                source: data.source || 'none',
                tokenLock: data.tokenLock || null,
                aiCredits: data.aiCredits || initialState.aiCredits,
                stakingSignature: data.stakingSignature || null
            });

        } catch (err) {
            console.error('Error fetching subscription:', err);
            setError(err.message);
            setSubscription({ ...initialState, isLoading: false });
        }
    }, [address, isConnected]);

    /**
     * Fetch on mount and address change
     */
    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    /**
     * Get current tier config
     */
    const tierConfig = useMemo(() => {
        return getTierConfig(subscription.tier);
    }, [subscription.tier]);

    /**
     * Check if user has feature access
     */
    const hasFeature = useCallback((feature) => {
        return tierConfig.features[feature] === true;
    }, [tierConfig]);

    /**
     * Check if user can upgrade to a tier
     */
    const canUpgradeTo = useCallback((targetTier) => {
        const currentIndex = TIER_HIERARCHY.indexOf(subscription.tier);
        const targetIndex = TIER_HIERARCHY.indexOf(targetTier.toUpperCase());
        return targetIndex > currentIndex;
    }, [subscription.tier]);

    /**
     * Create checkout session for subscription
     */
    const createCheckout = useCallback(async (tier, billingCycle = 'monthly') => {
        if (!isConnected || !address) {
            throw new Error('Wallet not connected');
        }

        try {
            const response = await fetch(`${API_BASE}/subscription/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address
                },
                credentials: 'include',
                body: JSON.stringify({ tier, billingCycle })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create checkout');
            }

            const data = await response.json();
            return data.checkoutUrl;

        } catch (err) {
            console.error('Error creating checkout:', err);
            throw err;
        }
    }, [address, isConnected]);

    /**
     * Register token lock for free tier access
     */
    const registerTokenLock = useCallback(async (tier, txHash) => {
        if (!isConnected || !address) {
            throw new Error('Wallet not connected');
        }

        try {
            const response = await fetch(`${API_BASE}/subscription/token-lock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address
                },
                credentials: 'include',
                body: JSON.stringify({ tier, txHash })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to register token lock');
            }

            // Refresh subscription status
            await fetchSubscription();

            return true;

        } catch (err) {
            console.error('Error registering token lock:', err);
            throw err;
        }
    }, [address, isConnected, fetchSubscription]);

    /**
     * Get staking signature for smart contract
     */
    const getStakingSignature = useCallback(async () => {
        if (!isConnected || !address) {
            throw new Error('Wallet not connected');
        }

        try {
            const response = await fetch(`${API_BASE}/subscription/staking-signature`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to get staking signature');
            }

            const data = await response.json();
            return data.signature;

        } catch (err) {
            console.error('Error getting staking signature:', err);
            throw err;
        }
    }, [address, isConnected]);

    /**
     * Calculate ROI for current tier
     */
    const calculateROI = useCallback((stakeAmount, durationMonths = 12) => {
        return calculatePotentialROI(stakeAmount, subscription.tier, durationMonths);
    }, [subscription.tier]);

    /**
     * Get effective APY for current tier
     */
    const effectiveAPY = useMemo(() => {
        return tierConfig.staking.effectiveAPY;
    }, [tierConfig]);

    /**
     * Get gas subsidy percent
     */
    const gasSubsidy = useMemo(() => {
        return tierConfig.gas.subsidyPercent;
    }, [tierConfig]);

    /**
     * Check AI access
     */
    const aiAccess = useMemo(() => {
        const config = tierConfig.ai;
        return {
            dailyLimit: config.dailyQueries,
            monthlyLimit: config.monthlyQueries,
            remaining: subscription.aiCredits.remaining,
            used: subscription.aiCredits.used,
            hasAccess: subscription.aiCredits.remaining > 0,
            models: config.models
        };
    }, [tierConfig, subscription.aiCredits]);

    /**
     * Refresh subscription data
     */
    const refresh = useCallback(() => {
        return fetchSubscription();
    }, [fetchSubscription]);

    return {
        // State
        ...subscription,
        tierConfig,
        error,

        // Computed
        effectiveAPY,
        gasSubsidy,
        aiAccess,

        // Methods
        hasFeature,
        canUpgradeTo,
        createCheckout,
        registerTokenLock,
        getStakingSignature,
        calculateROI,
        refresh
    };
};

/**
 * Hook para verificar acceso a feature
 */
export const useFeatureGate = (feature) => {
    const { hasFeature, tier, isLoading, createCheckout } = useSubscription();

    const hasAccess = useMemo(() => {
        return hasFeature(feature);
    }, [hasFeature, feature]);

    const requiredTier = useMemo(() => {
        for (const tierKey of TIER_HIERARCHY) {
            const config = getTierConfig(tierKey);
            if (config.features[feature]) {
                return tierKey;
            }
        }
        return null;
    }, [feature]);

    return {
        hasAccess,
        currentTier: tier,
        requiredTier,
        isLoading,
        upgrade: () => requiredTier ? createCheckout(requiredTier) : null
    };
};

/**
 * Hook para manejar rate limiting de AI
 */
export const useAICredits = () => {
    const { aiAccess, tier, refresh } = useSubscription();
    const [localUsed, setLocalUsed] = useState(0);

    useEffect(() => {
        setLocalUsed(aiAccess.used);
    }, [aiAccess.used]);

    const useCredit = useCallback(() => {
        if (aiAccess.remaining > 0) {
            setLocalUsed(prev => prev + 1);
            return true;
        }
        return false;
    }, [aiAccess.remaining]);

    const canUseAI = useMemo(() => {
        return (aiAccess.dailyLimit - localUsed) > 0;
    }, [aiAccess.dailyLimit, localUsed]);

    return {
        ...aiAccess,
        used: localUsed,
        remaining: Math.max(0, aiAccess.dailyLimit - localUsed),
        canUseAI,
        useCredit,
        refresh
    };
};

/**
 * Hook para calcular subsidio de gas
 */
export const useGasSubsidy = () => {
    const { gasSubsidy, tierConfig } = useSubscription();

    const calculateSubsidizedGas = useCallback((estimatedGasUSD) => {
        const subsidyAmount = estimatedGasUSD * gasSubsidy;
        const userPays = estimatedGasUSD - subsidyAmount;

        return {
            original: estimatedGasUSD,
            subsidyAmount,
            userPays,
            isFreeGas: tierConfig.gas.gasFree
        };
    }, [gasSubsidy, tierConfig.gas.gasFree]);

    return {
        subsidyPercent: gasSubsidy * 100,
        isFreeGas: tierConfig.gas.gasFree,
        calculateSubsidizedGas
    };
};

export default useSubscription;
