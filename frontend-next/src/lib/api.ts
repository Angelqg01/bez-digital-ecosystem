/* eslint-disable */
/**
 * api.ts â€” BeZhas API Client
 * Centralized HTTP client for all backend communications.
 * Handles JWT tokens from Zustand store + SIWE cookie sessions.
 */

import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true, // Required for SIWE session cookies
    timeout: 15000,
});

// â”€â”€â”€ REQUEST INTERCEPTOR: Attach JWT from localStorage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('bezhas-user-storage');
            if (stored) {
                const { state } = JSON.parse(stored);
                if (state?.token) {
                    config.headers['Authorization'] = `Bearer ${state.token}`;
                }
            }
        } catch (_) {
            // Silent fail â€“ SIWE session cookie will handle auth
        }
    }
    return config;
});

// â”€â”€â”€ RESPONSE INTERCEPTOR: Handle auth errors globally â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
api.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            console.warn('[BeZhas API] Unauthorized â€“ session may have expired.');
        }
        return Promise.reject(error);
    }
);

export default api;

// â”€â”€â”€ TYPED API HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Quote: how many BEZ will I get for `amount` of `currency` */
export async function getCryptoQuote(amount: number, currency: 'USDT' | 'USDC' | 'MATIC') {
    const res = await api.post('/api/crypto/quote', { amount, currency });
    return res.data as {
        success: boolean;
        quote: {
            fromAmount: number;
            fromCurrency: string;
            toAmount: number;
            toCurrency: string;
            exchangeRate: number;
            pricePerBEZ: number;
            estimatedGasFee: number;
        };
    };
}

/** Initiate crypto payment â€” backend pulls USDT/USDC from user wallet and sends BEZ */
export async function initiateCryptoPayment(
    walletAddress: string,
    amount: number,
    currency: 'USDT' | 'USDC' | 'MATIC'
) {
    const res = await api.post('/api/crypto/initiate', { walletAddress, amount, currency });
    return res.data as {
        success: boolean;
        transactionHash?: string;
        bezAmount?: number;
        requiresApproval?: boolean;
        approvalData?: { contractAddress: string; spender: string; amount: string };
        error?: string;
    };
}

/** Check the status of an on-chain tx */
export async function checkTxStatus(txHash: string) {
    const res = await api.get(`/api/crypto/status/${txHash}`);
    return res.data as { status: 'pending' | 'success' | 'failed' | 'error'; blockNumber?: number };
}

/** Server-side BEZ balance for a wallet (for SSR or non-wagmi contexts) */
export async function getServerBezBalance(walletAddress: string) {
    const res = await api.get(`/api/crypto/balance/${walletAddress}`);
    return res.data as { success: boolean; balance: string; decimals: number };
}

/** Stripe-initiated fiat â†’ BEZ payment */
export async function initiateFiatPayment(amountUSD: number, walletAddress: string) {
    const res = await api.post('/api/payment/stripe/create-session', { amountUSD, walletAddress });
    return res.data as { success: boolean; checkoutUrl: string; sessionId: string };
}

