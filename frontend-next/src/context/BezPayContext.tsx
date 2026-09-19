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
// Precio oficial del BEZ V1: 0,0075 $. Debe coincidir con
// backend/config/tokenomics.config.js. Es el valor de arranque y el que se
// usa mientras el backend no ha respondido; el precio real llega de la API.
export const BEZ_PRECIO_USD_INICIAL =
    Number(process.env.NEXT_PUBLIC_BEZ_PRICE_USD) > 0
        ? Number(process.env.NEXT_PUBLIC_BEZ_PRICE_USD)
        : 0.0075;

// Formatea el precio con cifras significativas en lugar de 4 decimales fijos.
// A 0,0075 $, toFixed(4) deja solo dos cifras significativas y el ticker se
// queda congelado: cualquier variacion por debajo de 0,00005 $ desaparece.
export function formatearPrecioBez(valor: number, significativas = 4): string {
    if (!Number.isFinite(valor) || valor === 0) return '0';
    const magnitud = Math.floor(Math.log10(Math.abs(valor)));
    const decimales = Math.min(Math.max(significativas - 1 - magnitud, 2), 100);
    return valor.toFixed(decimales);
}

const DEFAULT_STATS: GlobalStats = {
    bezPriceUSD:    BEZ_PRECIO_USD_INICIAL,
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

    const [livePrice,     setLivePrice]     = useState(BEZ_PRECIO_USD_INICIAL);
    const [globalStats,   setGlobalStats]   = useState<GlobalStats>(DEFAULT_STATS);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // â”€â”€ Live BEZ price simulation (replace with Chainlink oracle in prod) â”€â”€
    useEffect(() => {
        const tick = () => {
            setLivePrice((prev) => {
                const delta = (Math.random() - 0.498) * 0.008;
                // El suelo es relativo al precio: uno absoluto de 0,01 $
                // quedaba por encima de 0,0075 $ y clavaba el ticker.
                const suelo = BEZ_PRECIO_USD_INICIAL * 0.1;
                return Math.max(suelo, Number(formatearPrecioBez(prev * (1 + delta), 6)));
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

