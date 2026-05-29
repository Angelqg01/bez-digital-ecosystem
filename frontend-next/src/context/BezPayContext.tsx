/* eslint-disable */
'use client';

/**
 * BezPayContext.tsx â€” Global Payment Context (Next.js v3)
 *
 * Drop-in replacement for the Vite BezPayContext.jsx.
 * Provides:
 *  - openBuyBez()       â†’ opens the BuyBEZ modal
 *  - openSubscription() â†’ opens subscription plan selector
 *  - openEscrow()       â†’ opens escrow creation form
 *  - livePrice          â†’ current BEZ price in USD (polled every 30s)
 *  - globalStats        â†’ platform-wide stats
 */

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from 'react';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface BuyBezOptions {
    amount?:   number;
    itemName?: string;
    metadata?: Record<string, any>;
}

interface EscrowOptions {
    clientWallet: string;
    collateral:   number;
    quality:      number;
    metadata?:    Record<string, any>;
}

interface GlobalStats {
    bezPriceUSD:     number;
    volumeBEZ:       number;
    totalPayments:   number;
    activeFarmers:   number;
    tvlFarming:      string;
    bezCirculating:  string;
}

interface BezPayContextValue {
    // Modals
    isBuyModalOpen:      boolean;
    isSubModalOpen:      boolean;
    isEscrowModalOpen:   boolean;

    // Modal config
    buyOptions:          BuyBezOptions | null;
    subPlanId:           string | null;
    escrowOptions:       EscrowOptions | null;

    // Data
    livePrice:           number;
    globalStats:         GlobalStats;
    isLoadingStats:      boolean;

    // Actions
    openBuyBez:          (amount?: number, options?: Omit<BuyBezOptions, 'amount'>) => void;
    closeBuyBez:         () => void;
    openSubscription:    (planId: string) => void;
    closeSubscription:   () => void;
    openEscrow:          (clientWallet: string, collateral: number, quality: number, opts?: { metadata?: any }) => void;
    closeEscrow:         () => void;
}

// â”€â”€â”€ Default Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEFAULT_STATS: GlobalStats = {
    bezPriceUSD:    1.24,
    volumeBEZ:      2_840_420,
    totalPayments:  14_238,
    activeFarmers:  3_847,
    tvlFarming:     '$2.75M',
    bezCirculating: '28.4M BEZ',
};

// â”€â”€â”€ Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BezPayContext = createContext<BezPayContextValue | null>(null);

export function BezPayProvider({ children }: { children: ReactNode }) {
    const [isBuyModalOpen,    setIsBuyModalOpen]    = useState(false);
    const [isSubModalOpen,    setIsSubModalOpen]    = useState(false);
    const [isEscrowModalOpen, setIsEscrowModalOpen] = useState(false);

    const [buyOptions,    setBuyOptions]    = useState<BuyBezOptions | null>(null);
    const [subPlanId,     setSubPlanId]     = useState<string | null>(null);
    const [escrowOptions, setEscrowOptions] = useState<EscrowOptions | null>(null);

    const [livePrice,     setLivePrice]     = useState(1.24);
    const [globalStats,   setGlobalStats]   = useState<GlobalStats>(DEFAULT_STATS);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // â”€â”€ Live BEZ price simulation (replace with Chainlink oracle in prod) â”€â”€
    useEffect(() => {
        const tick = () => {
            setLivePrice((prev) => {
                const delta = (Math.random() - 0.498) * 0.008;
                return Math.max(0.01, +(prev * (1 + delta)).toFixed(4));
            });
        };
        const iv = setInterval(tick, 5000);
        return () => clearInterval(iv);
    }, []);

    // â”€â”€ Sync globalStats with live price â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        setGlobalStats((s) => ({ ...s, bezPriceUSD: livePrice }));
    }, [livePrice]);

    // â”€â”€â”€ Modal Openers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const openBuyBez = useCallback(
        (amount?: number, options?: Omit<BuyBezOptions, 'amount'>) => {
            setBuyOptions({ amount, ...options });
            setIsBuyModalOpen(true);
        },
        []
    );
    const closeBuyBez = useCallback(() => {
        setIsBuyModalOpen(false);
        setBuyOptions(null);
    }, []);

    const openSubscription = useCallback((planId: string) => {
        setSubPlanId(planId);
        setIsSubModalOpen(true);
    }, []);
    const closeSubscription = useCallback(() => {
        setIsSubModalOpen(false);
        setSubPlanId(null);
    }, []);

    const openEscrow = useCallback(
        (clientWallet: string, collateral: number, quality: number, opts?: { metadata?: any }) => {
            setEscrowOptions({ clientWallet, collateral, quality, metadata: opts?.metadata });
            setIsEscrowModalOpen(true);
        },
        []
    );
    const closeEscrow = useCallback(() => {
        setIsEscrowModalOpen(false);
        setEscrowOptions(null);
    }, []);

    return (
        <BezPayContext.Provider
            value={{
                isBuyModalOpen,
                isSubModalOpen,
                isEscrowModalOpen,
                buyOptions,
                subPlanId,
                escrowOptions,
                livePrice,
                globalStats,
                isLoadingStats,
                openBuyBez,
                closeBuyBez,
                openSubscription,
                closeSubscription,
                openEscrow,
                closeEscrow,
            }}
        >
            {children}
        </BezPayContext.Provider>
    );
}

// â”€â”€â”€ Consumer Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useBezPay(): BezPayContextValue {
    const ctx = useContext(BezPayContext);
    if (!ctx) throw new Error('useBezPay must be used inside <BezPayProvider>');
    return ctx;
}

