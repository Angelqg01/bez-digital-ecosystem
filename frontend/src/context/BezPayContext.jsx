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
export const SUBSCRIPTION_PLANS = [
  {
    id: 'free', name: 'Free', icon: '🌱',
    priceBEZ: 0, priceUSD: 0,
    color: '#3D5E80',
    features: ['1 Bot básico', '5 Activos cartera', 'Bridge $500/mes', 'Soporte comunidad'],
    limits: { bots: 1, assets: 5, bridge: '$500', api: false, escrow: false, farming: false }
  },
  {
    id: 'starter', name: 'Starter', icon: '⚡',
    priceBEZ: 500, priceUSD: 29,
    color: '#2563EB',
    features: ['3 Bots de trading', '20 Activos', 'Bridge $5k/mes', 'Farming básico', 'Alertas real-time'],
    limits: { bots: 3, assets: 20, bridge: '$5k', api: false, escrow: false, farming: true }
  },
  {
    id: 'pro', name: 'Pro', icon: '🚀', badge: 'POPULAR',
    priceBEZ: 1500, priceUSD: 79,
    color: '#00C896',
    features: ['Bots ilimitados+IA', '50 Activos', 'IA Claude+Gemini', 'Quality Escrow', 'API completa', 'Farming avanzado'],
    limits: { bots: '∞', assets: 50, bridge: '∞', api: true, escrow: true, farming: true }
  },
  {
    id: 'enterprise', name: 'Enterprise', icon: '🏛️', badge: 'WHITE LABEL',
    priceBEZ: 5000, priceUSD: 299,
    color: '#FFB800',
    features: ['Todo Pro', 'Activos ilimitados', 'White label', 'API institucional', 'DAO governance', 'Multi-cuenta 50', 'Account manager', 'SLA 99.9%'],
    limits: { bots: '∞', assets: '∞', bridge: '∞', api: true, escrow: true, farming: true }
  },
];

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

  const openSubscription = useCallback((planId = 'pro', options = {}) => {
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
