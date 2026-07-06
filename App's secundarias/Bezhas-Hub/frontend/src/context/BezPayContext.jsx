/**
 * BezPayContext.jsx
 * 
 * Contexto global para el sistema de pago BEZ nativo de BeZhas.
 * Este contexto reemplaza todos los modales de pago dispersos por un
 * sistema centralizado que la IA, SDK, MCP y cualquier componente pueden usar.
 * 
 * Uso desde cualquier componente:
 *   const { openBuyBez, openSubscription, openFarming } = useBezPay();
 *   openBuyBez(100); // abre modal para comprar 100 USD de BEZ
 */

import { createContext, useContext, useState, useCallback } from 'react';
// FUENTE ÚNICA de planes definitivos (PDF). Ver config/plans.js.
import { PLANS as DEFINITIVE_PLANS } from '../config/plans';

// ─── TIPOS DE PAGO SOPORTADOS ─────────────────────────────────────────────────
export const BEZ_PAY_TYPES = {
  BUY_BEZ:      'buy_bez',       // Comprar tokens BEZ (multi-método)
  SUBSCRIPTION: 'subscription',  // Suscripción VIP / Plan
  FARMING:      'farming',       // Depositar en pool de Liquidity Farming
  ESCROW:       'escrow',        // Quality Escrow para servicios
  BRIDGE:       'bridge',        // Bridge multi-chain
  NFT:          'nft_purchase',  // Compra de NFT
  SERVICE:      'service',       // Pago de servicio en la plataforma
  GOVERNANCE:   'governance',    // Stake para DAO governance
};

// ─── PLANES DE SUSCRIPCIÓN ────────────────────────────────────────────────────
// FUENTE ÚNICA: config/plans.js (4 planes definitivos del PDF). Aquí se derivan
// con la forma que consume BezPayModal (priceUSD = importe €/mes, priceBEZ = BEZ/mes).
export const SUBSCRIPTION_PLANS = DEFINITIVE_PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  icon: p.icon,
  badge: p.badge || undefined,
  color: p.color,
  priceEUR: p.priceEUR,
  priceUSD: p.priceEUR,   // importe €/mes (compat con BezPayModal)
  priceBEZ: p.bezPerMonth,
  profile: p.profile,
  features: p.features,
  recommended: p.recommended,
}));

// ─── POOLS DE FARMING ─────────────────────────────────────────────────────────
export const FARMING_POOLS = [
  { pid: 0, name: 'BEZ Solo',     lpToken: 'BEZ',  apy: 24.5, tvl: '$245k',  minStake: 100 },
  { pid: 1, name: 'BEZ-USDT LP', lpToken: 'LP',   apy: 38.2, tvl: '$1.2M',  minStake: 50  },
  { pid: 2, name: 'BEZ-MATIC LP',lpToken: 'LP',   apy: 18.7, tvl: '$420k',  minStake: 100 },
  { pid: 3, name: 'BEZ-ETH LP',  lpToken: 'LP',   apy: 29.4, tvl: '$890k',  minStake: 100 },
];

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const BezPayContext = createContext(null);

export function BezPayProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [payConfig, setPayConfig] = useState({
    type: BEZ_PAY_TYPES.BUY_BEZ,
    amount: null,
    planId: null,
    poolId: null,
    clientWallet: null,
    collateral: null,
    itemName: null,
    metadata: {},
    onSuccess: null,
    onClose: null,
  });

  // ── Abrir modal genérico ───────────────────────────────────────────────────
  const openPayModal = useCallback((config) => {
    setPayConfig(prev => ({ ...prev, ...config }));
    setIsOpen(true);
  }, []);

  // ── Helpers específicos para cada tipo ────────────────────────────────────
  const openBuyBez = useCallback((amount = null, options = {}) => {
    openPayModal({ type: BEZ_PAY_TYPES.BUY_BEZ, amount, ...options });
  }, [openPayModal]);

  const openSubscription = useCallback((planId = 'business', options = {}) => {
    openPayModal({ type: BEZ_PAY_TYPES.SUBSCRIPTION, planId, ...options });
  }, [openPayModal]);

  const openFarming = useCallback((poolId = 0, amount = null, options = {}) => {
    openPayModal({ type: BEZ_PAY_TYPES.FARMING, poolId, amount, ...options });
  }, [openPayModal]);

  const openEscrow = useCallback((clientWallet, collateral, quality = 85, options = {}) => {
    openPayModal({ type: BEZ_PAY_TYPES.ESCROW, clientWallet, collateral, metadata: { quality }, ...options });
  }, [openPayModal]);

  const openBridge = useCallback((amount = null, options = {}) => {
    openPayModal({ type: BEZ_PAY_TYPES.BRIDGE, amount, ...options });
  }, [openPayModal]);

  const openNFTPurchase = useCallback((itemName, amount, options = {}) => {
    openPayModal({ type: BEZ_PAY_TYPES.NFT, itemName, amount, ...options });
  }, [openPayModal]);

  const openServicePayment = useCallback((itemName, amount, options = {}) => {
    openPayModal({ type: BEZ_PAY_TYPES.SERVICE, itemName, amount, ...options });
  }, [openPayModal]);

  const closePayModal = useCallback(() => {
    setIsOpen(false);
    payConfig.onClose?.();
  }, [payConfig]);

  const value = {
    // State
    isOpen,
    payConfig,
    // Methods
    openPayModal,
    openBuyBez,
    openSubscription,
    openFarming,
    openEscrow,
    openBridge,
    openNFTPurchase,
    openServicePayment,
    closePayModal,
    // Constants (para AI / SDK / MCP awareness)
    BEZ_PAY_TYPES,
    SUBSCRIPTION_PLANS,
    FARMING_POOLS,
  };

  return (
    <BezPayContext.Provider value={value}>
      {children}
    </BezPayContext.Provider>
  );
}

// ─── HOOK DE CONSUMO ──────────────────────────────────────────────────────────
export function useBezPay() {
  const ctx = useContext(BezPayContext);
  if (!ctx) {
    throw new Error('useBezPay must be used within a BezPayProvider');
  }
  return ctx;
}

export default BezPayContext;
