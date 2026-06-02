'use client';
import useSWR from 'swr';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const ORACLE_PRICE_ENDPOINT =
    process.env.NEXT_PUBLIC_BEZHAS_ORACLE_PRICE_ENDPOINT ||
    '/gateway/v1/oracle/token-prices';

const publicFetcher = (url: string) =>
    fetch(url.startsWith('http') ? url : `${API_BASE}${url}`).then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
    });

export function usePublicStats() {
    return useSWR('/gateway/v1/network/stats', publicFetcher, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        dedupingInterval: 15_000,
    });
}

export function useOracleTokenPrices() {
    return useSWR(ORACLE_PRICE_ENDPOINT, publicFetcher, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        dedupingInterval: 15_000,
    });
}
