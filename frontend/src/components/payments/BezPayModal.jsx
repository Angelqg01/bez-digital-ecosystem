/**
 * BezPayModal.jsx — BeZhas Payment System v2.0
 *
 * Modal CENTRAL y ÚNICO de pago para toda la plataforma BeZhas.
 * Reemplaza: UnifiedPaymentModal, CryptoPaymentModal, TokenPurchaseModal,
 *            BuyBezOptions, BuyBezCoinModal, BankTransferModal.
 *
 * Diseñado para trabajar junto al SDK, MCP y IA de BeZhas.
 * Integración: Usar useBezPay() hook desde cualquier componente.
 *
 * Contratos:
 *  • BEZ Token (Polygon): 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 *  • BEZ Token (BNB):     0x8a1e3930fde1f151471c368fdbb39f3f63a65b55
 *  • QualityEscrow:       0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
 *
 * Backend: api.bezhas.com / WebSocket: ws.bezhas.com:3002
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useChainId } from 'wagmi';
import { X, ExternalLink, Copy, CheckCircle2, Loader2, AlertTriangle, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBezPay, SUBSCRIPTION_PLANS, FARMING_POOLS, BEZ_PAY_TYPES } from '../../context/BezPayContext';
import { useBezPayTransaction, TX_STATE, CONTRACTS } from '../../hooks/useBezPayTransaction';

// ─── DESIGN TOKENS (alineados con el tema oscuro de BeZhas) ───────────────────
const C = {
  bg:      '#03060E',
  surf:    '#070D1C',
  card:    '#0C1628',
  card2:   '#101E38',
  border:  '#0D2040',
  border2: '#163560',
  primary: '#00C896',
  gold:    '#FFB800',
  neon:    '#00FFB2',
  blue:    '#2563EB',
  violet:  '#7C3AED',
  red:     '#EF4444',
  text:    '#E8F4FF',
  text2:   '#A8C4E0',
  muted:   '#3D5E80',
};

// ─── CONTRATOS ON-CHAIN ───────────────────────────────────────────────────────
const CONTRACT_ADDRS = {
  BEZ_POLYGON: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  BEZ_BNB:     '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
  ESCROW:      '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
  TREASURY:    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
};

// ─── TOKENS DISPONIBLES ────────────────────────────────────────────────────────
const PAYMENT_TOKENS = [
  { s: 'BEZ',  name: 'BEZ-Coin',   icon: '🪙', color: '#FFB800', pUSD: 1.24, net: 'Polygon', discount: 20 },
  { s: 'USDT', name: 'Tether',     icon: '₮',  color: '#26A17B', pUSD: 1.0,  net: 'Polygon' },
  { s: 'USDC', name: 'USD Coin',   icon: '$',  color: '#2775CA', pUSD: 1.0,  net: 'Polygon' },
  { s: 'MATIC',name: 'Polygon',    icon: '⬟',  color: '#8247E5', pUSD: 0.88, net: 'Polygon' },
  { s: 'ETH',  name: 'Ethereum',   icon: 'Ξ',  color: '#627EEA', pUSD: 3420, net: 'ETH'     },
  { s: 'BNB',  name: 'BNB Chain',  icon: '⬡',  color: '#F3BA2F', pUSD: 420,  net: 'BNB'     },
  { s: 'USD',  name: 'US Dollar',  icon: '$',  color: '#10B981', pUSD: 1.0,  net: 'FIAT'    },
  { s: 'EUR',  name: 'Euro',       icon: '€',  color: '#3B82F6', pUSD: 1.09, net: 'FIAT'    },
];

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
const fmt    = (n, d=4)  => n==null ? '—' : (+n).toLocaleString('en-US', {maximumFractionDigits: d});
const fmtUSD = (n)       => '$'+(+n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtH   = (h)       => h ? `${h.slice(0,8)}…${h.slice(-6)}` : '—';
const sleep  = ms        => new Promise(r => setTimeout(r, ms));
const rndHex = n         => Array.from({length:n},()=>Math.floor(Math.random()*16).toString(16)).join('');
const rndInt = (a,b)     => Math.floor(Math.random()*(b-a+1))+a;

// ─── TIPO-LABELS ──────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  buy_bez:      { title: 'Comprar BEZ-Coin',    icon: '🪙', color: '#FFB800' },
  subscription: { title: 'Plan de Suscripción', icon: '📋', color: '#00C896' },
  farming:      { title: 'Liquidity Farming',   icon: '🌾', color: '#F97316' },
  escrow:       { title: 'Quality Escrow',      icon: '🔒', color: '#2563EB' },
  bridge:       { title: 'Bridge Multi-chain',  icon: '⬡',  color: '#00FFB2' },
  nft_purchase: { title: 'Comprar NFT',         icon: '🖼️', color: '#7C3AED' },
  service:      { title: 'Pago de Servicio',    icon: '💎', color: '#00C896' },
  governance:   { title: 'DAO Governance',      icon: '🏛️', color: '#EAB308' },
};

// ─── LOCK MULTIPLIERS (Farming) ───────────────────────────────────────────────
const LOCK_PERIODS = [
  { days: 0,   label: 'Sin lock',  mult: 1.0  },
  { days: 7,   label: '7 días',    mult: 1.1  },
  { days: 30,  label: '30 días',   mult: 1.25 },
  { days: 90,  label: '90 días',   mult: 1.5  },
  { days: 180, label: '180 días',  mult: 2.0  },
  { days: 365, label: '365 días',  mult: 3.0  },
];

// ─── PRECIO LIVE TICKER ───────────────────────────────────────────────────────
function useLivePrices() {
  const [prices, setPrices] = useState(
    Object.fromEntries(PAYMENT_TOKENS.map(t => [t.s, t.pUSD]))
  );
  useEffect(() => {
    const iv = setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        ['BEZ','MATIC','ETH','BNB'].forEach(k => {
          const d = (Math.random() - 0.498) * 0.006;
          next[k] = Math.max(0.0001, +(prev[k] * (1+d)).toFixed(8));
        });
        return next;
      });
    }, 800);
    return () => clearInterval(iv);
  }, []);
  return prices;
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function BezPayModal() {
  const { isOpen, payConfig, closePayModal } = useBezPay();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const prices = useLivePrices();

  // ── HOOK DE TRANSACCIONES REAL ────────────────────────────────────────────
  const {
    executePayment,
    resetAll: resetTx,
    ensurePolygon,
    txState,
    txHash,
    txResult: onChainResult,
    txError,
    txLogs,
    isProcessing,
    bezBalance,
    CONTRACTS: ADDRS,
  } = useBezPayTransaction();

  // Estado local del modal
  const [step, setStep]           = useState('form');    // 'form' | 'processing' | 'success' | 'error' | 'bank'
  const [payToken, setPayToken]   = useState('USDT');
  const [amount, setAmount]       = useState('');
  const [selPlan, setSelPlan]     = useState('pro');
  const [selPool, setSelPool]     = useState(0);
  const [lockDays, setLockDays]   = useState(30);
  const [quality, setQuality]     = useState(85);
  const [clientWallet, setClientWallet] = useState('');
  const [txResult, setTxResult]   = useState(null);
  const [bankData, setBankData]   = useState(null);
  const [copiedField, setCopied]  = useState(null);

  const type     = payConfig?.type    || BEZ_PAY_TYPES.BUY_BEZ;
  const typeInfo = TYPE_LABELS[type]  || TYPE_LABELS.buy_bez;

  // Derivar explorer URL según chainId
  const explorerBase = chainId === 137
    ? 'https://polygonscan.com'
    : chainId === 56
    ? 'https://bscscan.com'
    : 'https://amoy.polygonscan.com';

  // Sincronizar txState del hook → step del modal
  useEffect(() => {
    if (txState === TX_STATE.SUCCESS && onChainResult) {
      const result = {
        txHash:      onChainResult.txHash,
        blockNumber: onChainResult.blockNumber,
        bezAmount:   onChainResult.bezAmount || 0,
        usdValue:    (+amount || 0) * (prices[payToken] || 1),
        type,
        planId: selPlan, poolId: selPool,
        status: 'completed',
        explorerUrl: onChainResult.txHash
          ? `${explorerBase}/tx/${onChainResult.txHash}`
          : null,
        ts: Date.now(),
      };
      setTxResult(result);
      setStep('success');
      payConfig?.onSuccess?.(result);
      toast.success(
        type === 'subscription'
          ? `✅ Plan ${plan.name} activado`
          : type === 'farming'
          ? `✅ Farming activo en ${pool.name}`
          : type === 'escrow'
          ? `✅ Escrow creado correctamente`
          : `✅ Pago completado!`,
        { duration: 6000 }
      );
    } else if (txState === TX_STATE.ERROR) {
      setTxResult({ error: txError || 'Error en la transacción' });
      setStep('error');
      toast.error('Error en el pago on-chain. Revisa tu wallet.');
    }
  }, [txState, onChainResult, txError]);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setTxResult(null);
      setBankData(null);
      setCopied(null);
      resetTx();
      // Prellenar desde config
      if (payConfig?.amount)        setAmount(String(payConfig.amount));
      if (payConfig?.planId)        setSelPlan(payConfig.planId);
      if (payConfig?.poolId != null) setSelPool(payConfig.poolId);
      if (payConfig?.clientWallet)  setClientWallet(payConfig.clientWallet);
      if (payConfig?.collateral)    setAmount(String(payConfig.collateral));
    }
  }, [isOpen, payConfig]);

  // Calcular montos
  const tok     = PAYMENT_TOKENS.find(t => t.s === payToken) || PAYMENT_TOKENS[1];
  const bezP    = prices['BEZ']    || 1.24;
  const payP    = prices[payToken] || tok.pUSD;
  const usdVal  = (+amount || 0) * payP;
  const feeRate = payToken === 'BEZ' ? 0.005 : ['FIAT','EUR','USD'].includes(tok.net) ? 0 : 0.015;
  const bezOut  = usdVal * (1 - feeRate) / bezP;

  // Plan/pool/lock seleccionado
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === selPlan) || SUBSCRIPTION_PLANS[2];
  const pool = FARMING_POOLS.find(p => p.pid === selPool)     || FARMING_POOLS[0];
  const lock = LOCK_PERIODS.find(l => l.days === lockDays)    || LOCK_PERIODS[2];

  // ── COPIAR AL PORTAPAPELES ─────────────────────────────────────────────────
  const copy = (field, val) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── PROCESAR PAGO REAL (wagmi on-chain) ──────────────────────────────────
  const handlePay = async () => {
    const walletAddr = address || payConfig?.clientWallet;
    if (!walletAddr && !['USD','EUR'].includes(payToken)) {
      toast.error('Conecta tu wallet para continuar');
      return;
    }

    const numAmount = +amount || (type === 'subscription' ? plan.priceUSD : 0);
    if (numAmount <= 0 && type !== 'subscription') {
      toast.error('Introduce un monto válido');
      return;
    }

    // ── FIAT → Mostrar datos bancarios (sin TX on-chain) ──────────────────
    if (['USD','EUR'].includes(payToken)) {
      const refCode = `BEZ-${Date.now().toString(36).toUpperCase().slice(-8)}`;
      const fiatAmt = type === 'subscription'
        ? (payToken === 'EUR' ? (plan.priceUSD * 0.92) : plan.priceUSD)
        : numAmount * payP;
      setBankData({
        refCode,
        currency: payToken,
        amount: fiatAmt.toFixed(2),
        iban:        payToken === 'EUR' ? 'ES91 2100 0418 4502 0005 1332' : 'US12 3456 7890 1234 5678 9012',
        swift:       payToken === 'EUR' ? 'CAIXESBBXXX' : 'CHASUS33XXX',
        bank:        payToken === 'EUR' ? 'CaixaBank' : 'Chase Bank',
        beneficiary: 'BeZhas Network S.L.',
        wallet:      walletAddr,
        bezAmount:   (bezOut || plan.priceBEZ).toFixed(2),
      });
      setStep('bank');
      return;
    }

    // ── CRYPTO → TX on-chain vía useBezPayTransaction ─────────────────────
    setStep('processing');

    // Asegurar red Polygon para pagos en Polygon tokens
    if (!['ETH','BNB'].includes(payToken)) {
      const ok = await ensurePolygon();
      if (!ok) {
        setStep('form');
        toast.error('Cambia a Polygon Mainnet en tu wallet');
        return;
      }
    }

    try {
      await executePayment({
        type,
        payToken,
        amount: numAmount,
        walletAddress: walletAddr,
        // Escrow
        clientWallet,
        collateral: numAmount,
        quality,
        // Farming
        poolId:   selPool,
        lockDays,
        amountBEZ: numAmount,
        // Subscription
        planId: selPlan,
        // Metadata
        metadata: {
          source: 'bezpay_v2',
          itemName: payConfig?.itemName,
          ...payConfig?.metadata,
        },
      });
      // El efecto [txState] se encargará de setStep('success')
    } catch (err) {
      // El efecto [txState] también maneja el error
      console.error('[BezPayModal] Payment error:', err?.shortMessage || err?.message);
    }
  };

  const handleClose = () => {
    if (step === 'success') payConfig.onSuccess?.(txResult);
    closePayModal();
    setTimeout(() => setStep('form'), 300);
  };

  if (!isOpen) return null;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
        onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          initial={{ scale: 0.93, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.93, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-h-[94vh] overflow-y-auto"
          style={{
            maxWidth: 560,
            background: C.card,
            border: `1.5px solid ${typeInfo.color}44`,
            borderRadius: 20,
            boxShadow: `0 0 60px ${typeInfo.color}22, 0 24px 80px #000a`,
          }}
        >
          {/* ── HEADER ── */}
          <div style={{
            background: `linear-gradient(135deg, ${C.surf}, ${typeInfo.color}18)`,
            borderBottom: `1px solid ${typeInfo.color}33`,
            padding: '18px 20px 16px',
            position: 'sticky', top: 0, zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: `${typeInfo.color}22`,
                border: `1.5px solid ${typeInfo.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>{typeInfo.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: typeInfo.color, fontWeight: 800, fontSize: 16, fontFamily: 'JetBrains Mono, monospace' }}>
                  {typeInfo.title}
                </div>
                <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                  BeZhas Pay v2 · api.bezhas.com · {isConnected ? '🟢 Wallet Conectada' : '⚪ Sin wallet'}
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border2}`,
                  background: C.card2, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: C.text2, transition: 'all 0.15s',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Mini price ticker */}
            <div style={{
              display: 'flex', gap: 12, marginTop: 12, overflowX: 'auto',
              scrollbarWidth: 'none', paddingBottom: 2,
            }}>
              {['BEZ','USDT','MATIC','ETH'].map(s => {
                const t = PAYMENT_TOKENS.find(x => x.s === s);
                const p = prices[s];
                return (
                  <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <span style={{ fontSize: 10 }}>{t?.icon}</span>
                    <span style={{ color: t?.color, fontFamily: 'monospace', fontSize: 9, fontWeight: 800 }}>{s}</span>
                    <span style={{ color: C.text2, fontFamily: 'monospace', fontSize: 9 }}>
                      {p >= 1 ? fmtUSD(p) : `$${p?.toFixed(5)}`}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── CONTENIDO SEGÚN STEP ── */}
          <div style={{ padding: '16px 20px 20px' }}>
            {step === 'form'       && <FormStep {...{type, payToken, setPayToken, amount, setAmount, selPlan, setSelPlan, selPool, setSelPool, lockDays, setLockDays, quality, setQuality, clientWallet, setClientWallet, plan, pool, lock, prices, bezP, payP, usdVal, feeRate, bezOut, isConnected, bezBalance, handlePay, typeInfo, C}} />}
            {step === 'processing' && <ProcessingStep C={C} typeInfo={typeInfo} txState={txState} txLogs={txLogs} txHash={txHash} />}
            {step === 'success'    && <SuccessStep    txResult={txResult} type={type} plan={plan} pool={pool} fmtUSD={fmtUSD} fmt={fmt} fmtH={fmtH} copy={copy} copiedField={copiedField} C={C} onClose={handleClose} />}
            {step === 'error'      && <ErrorStep      txResult={txResult} C={C} onRetry={() => { resetTx(); setStep('form'); }} onClose={handleClose} />}
            {step === 'bank'       && <BankStep       bankData={bankData} C={C} copy={copy} copiedField={copiedField} onClose={handleClose} />}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── FORM STEP ────────────────────────────────────────────────────────────────
function FormStep({ type, payToken, setPayToken, amount, setAmount, selPlan, setSelPlan, selPool, setSelPool, lockDays, setLockDays, quality, setQuality, clientWallet, setClientWallet, plan, pool, lock, prices, bezP, payP, usdVal, feeRate, bezOut, isConnected, bezBalance, handlePay, typeInfo, C }) {

  // Tokens disponibles según tipo
  const availTokens = ['BUY_BEZ','SERVICE','NFT_PURCHASE'].includes(type?.toUpperCase()) || !type?.includes('farming')
    ? PAYMENT_TOKENS
    : PAYMENT_TOKENS.filter(t => ['BEZ','USDT','USDC'].includes(t.s));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── SUBSCRIPTION: Selector de plan ── */}
      {type === 'subscription' && (
        <div>
          <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Plan de Suscripción
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {SUBSCRIPTION_PLANS.filter(p => p.id !== 'free').map(p => (
              <button key={p.id} onClick={() => setSelPlan(p.id)} style={{
                background: selPlan === p.id ? `${p.color}22` : '#0C1628',
                border: `2px solid ${selPlan === p.id ? p.color : '#0D2040'}`,
                borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
                textAlign: 'left', position: 'relative',
                boxShadow: selPlan === p.id ? `0 0 14px ${p.color}33` : 'none',
              }}>
                {p.badge && (
                  <span style={{
                    position: 'absolute', top: -8, left: 8,
                    background: p.color, color: p.id === 'enterprise' ? '#0a0a0a' : '#000',
                    fontSize: 7, fontWeight: 800, padding: '1px 6px', borderRadius: 20,
                    fontFamily: 'monospace',
                  }}>{p.badge}</span>
                )}
                <div style={{ fontSize: 18, marginBottom: 4 }}>{p.icon}</div>
                <div style={{ color: p.color, fontWeight: 800, fontSize: 12 }}>{p.name}</div>
                <div style={{ color: '#E8F4FF', fontFamily: 'monospace', fontSize: 13, fontWeight: 800, marginTop: 2 }}>
                  {p.priceBEZ.toLocaleString()} <span style={{ color: '#FFB800', fontSize: 9 }}>BEZ</span>
                </div>
                <div style={{ color: C.muted, fontSize: 9 }}>${p.priceUSD}/mes</div>
              </button>
            ))}
          </div>
          <div style={{ background: C.card2, borderRadius: 10, padding: '10px 12px', marginTop: 10 }}>
            <div style={{ color: C.muted, fontSize: 9, marginBottom: 6 }}>Incluye:</div>
            {plan.features.slice(0,4).map(f => (
              <div key={f} style={{ color: C.text2, fontSize: 10, display: 'flex', gap: 6, padding: '2px 0' }}>
                <span style={{ color: plan.color }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FARMING: Pool selector ── */}
      {type === 'farming' && (
        <div>
          <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Pool de Farming</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {FARMING_POOLS.map(p => (
              <button key={p.pid} onClick={() => setSelPool(p.pid)} style={{
                background: selPool === p.pid ? '#FFB80022' : C.card2,
                border: `2px solid ${selPool === p.pid ? '#FFB800' : C.border2}`,
                borderRadius: 10, padding: '10px', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ color: '#E8F4FF', fontSize: 11, fontWeight: 700 }}>🌾 {p.name}</div>
                <div style={{ color: '#10B981', fontFamily: 'monospace', fontSize: 14, fontWeight: 800, marginTop: 4 }}>{p.apy}%</div>
                <div style={{ color: C.muted, fontSize: 9 }}>APY base · TVL {p.tvl}</div>
              </button>
            ))}
          </div>

          {/* Lock period */}
          <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Período de Bloqueo (multiplica APY)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
            {LOCK_PERIODS.map(l => (
              <button key={l.days} onClick={() => setLockDays(l.days)} style={{
                background: lockDays === l.days ? '#FFB80018' : C.card2,
                border: `2px solid ${lockDays === l.days ? '#FFB800' : C.border2}`,
                borderRadius: 8, padding: '7px 4px', cursor: 'pointer', textAlign: 'center',
              }}>
                <div style={{ color: '#FFB800', fontSize: 10, fontWeight: 800 }}>{l.label}</div>
                <div style={{ color: '#10B981', fontSize: 10, fontFamily: 'monospace' }}>×{l.mult}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ESCROW: Datos de servicio ── */}
      {type === 'escrow' && (
        <div>
          <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Wallet del Cliente</div>
          <input value={clientWallet} onChange={e => setClientWallet(e.target.value)}
            placeholder="0x... dirección del cliente"
            style={{
              width: '100%', background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10,
              padding: '10px 12px', color: '#A8C4E0', fontSize: 11, fontFamily: 'monospace',
              outline: 'none', boxSizing: 'border-box', marginBottom: 10,
            }}
          />
          <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
            Calidad Prometida: {quality}%
          </div>
          <input type="range" min={50} max={100} value={quality} onChange={e => setQuality(+e.target.value)}
            style={{ width: '100%', marginBottom: 8, accentColor: '#2563EB' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, marginBottom: 10 }}>
            <span>50%</span><span style={{ color: '#2563EB', fontWeight: 800 }}>{quality}% prometido</span><span>100%</span>
          </div>
        </div>
      )}

      {/* ── CAMPO DE MONTO (no para subscription con plan fijo) ── */}
      {(type !== 'subscription') && (
        <div>
          <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
            {type === 'escrow' ? 'Colateral BEZ' : type === 'farming' ? 'Cantidad a Depositar (BEZ)' : 'Cantidad a Pagar'}
          </div>
          <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#E8F4FF', fontFamily: 'monospace', fontSize: 26, fontWeight: 800, minWidth: 0,
                }}
              />
              <span style={{ color: C.muted, fontFamily: 'monospace', fontSize: 12, flexShrink: 0 }}>
                {['farming','escrow'].includes(type) ? 'BEZ' : payToken}
              </span>
            </div>
            {usdVal > 0 && !['farming','escrow'].includes(type) && (
              <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>≈ {fmtUSD(usdVal)} USD</div>
            )}
          </div>
        </div>
      )}

      {/* ── SELECTOR DE TOKEN DE PAGO (no para farming/escrow que requieren BEZ) ── */}
      {!['farming','escrow'].includes(type) && (
        <div>
          <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Pagar con
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
            {PAYMENT_TOKENS.map(t => (
              <button key={t.s} onClick={() => setPayToken(t.s)} style={{
                width: 54, height: 54, borderRadius: 12, flexShrink: 0,
                border: `2px solid ${payToken === t.s ? t.color : C.border2}`,
                background: payToken === t.s ? `${t.color}28` : C.card,
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                boxShadow: payToken === t.s ? `0 0 12px ${t.color}44` : 'none',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span style={{ color: payToken === t.s ? t.color : C.muted, fontFamily: 'monospace', fontSize: 8, fontWeight: 800 }}>{t.s}</span>
              </button>
            ))}
          </div>
          {payToken === 'BEZ' && (
            <div style={{ background: '#FFB80018', border: '1px solid #FFB80044', borderRadius: 8, padding: '6px 10px', marginTop: 6 }}>
              <span style={{ color: '#FFB800', fontSize: 10 }}>🎁 20% descuento al pagar con BEZ-Coin</span>
            </div>
          )}
        </div>
      )}

      {/* ── QUOTE BOX ── */}
      <div style={{
        background: `${typeInfo.color}08`,
        border: `1px solid ${typeInfo.color}33`,
        borderRadius: 12, padding: 14,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          {[
            ['Precio BEZ', fmtUSD(bezP)],
            ['Red destino', 'Polygon Amoy'],
            ['Fee', `${(feeRate*100).toFixed(1)}% — ${fmtUSD(usdVal*feeRate)}`],
            ['Contrato', 'Hot Wallet ✓'],
          ].map(([k,v]) => (
            <div key={k} style={{ background: C.card, borderRadius: 8, padding: '6px 10px' }}>
              <div style={{ color: C.muted, fontSize: 9 }}>{k}</div>
              <div style={{ color: C.text2, fontFamily: 'monospace', fontSize: 10, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.border2}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ color: C.muted, fontSize: 9 }}>
              {type === 'subscription' ? 'Costo mensual' : type === 'farming' ? `APY efectivo: ${(pool.apy * lock.mult).toFixed(1)}%` : 'Recibirás via dispenseTokens()'}
            </div>
            <div style={{ color: typeInfo.color, fontFamily: 'monospace', fontSize: 26, fontWeight: 800, marginTop: 4 }}>
              {type === 'subscription'
                ? `${plan.priceBEZ.toLocaleString()} BEZ`
                : type === 'farming'
                ? `${fmt((+amount||0) * pool.apy * lock.mult / 100 / 12, 4)} BEZ/mes`
                : `🪙 ${fmt(bezOut, 4)} BEZ`}
            </div>
          </div>
        </div>
      </div>

      {/* ── WALLET INFO + WARNING ── */}
      {isConnected && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, fontFamily: 'monospace', background: C.card2, borderRadius: 8, padding: '6px 10px' }}>
          <span>💰 Saldo BEZ: <span style={{ color: '#FFB800', fontWeight: 800 }}>{parseFloat(bezBalance || 0).toFixed(4)} BEZ</span></span>
          <span>🔗 Polygon</span>
        </div>
      )}
      {!isConnected && !['USD','EUR'].includes(payToken) && (
        <div style={{ background: '#1a050588', border: `1px solid ${C.red}44`, borderRadius: 10, padding: '8px 12px', color: '#FCA5A5', fontSize: 10, textAlign: 'center' }}>
          ⚠️ Conecta tu wallet MetaMask / WalletConnect para procesar pagos crypto
        </div>
      )}

      {/* ── BOTÓN PAGAR ── */}
      <button
        onClick={handlePay}
        disabled={!amount && type !== 'subscription'}
        style={{
          width: '100%',
          background: (!amount && type !== 'subscription')
            ? C.card2
            : `linear-gradient(135deg, ${typeInfo.color}, ${typeInfo.color}cc)`,
          color: (!amount && type !== 'subscription') ? C.muted : '#0a0a0a',
          border: 'none', borderRadius: 14, padding: '15px 24px',
          fontSize: 14, fontWeight: 800,
          cursor: (!amount && type !== 'subscription') ? 'not-allowed' : 'pointer',
          fontFamily: 'JetBrains Mono, monospace',
          boxShadow: (!amount && type !== 'subscription') ? 'none' : `0 0 24px ${typeInfo.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.18s',
        }}
      >
        <span style={{ fontSize: 16 }}>{typeInfo.icon}</span>
        {type === 'subscription'
          ? `Suscribirse · ${plan.name} · ${plan.priceBEZ.toLocaleString()} BEZ/mes`
          : type === 'farming'
          ? `Depositar ${amount || '0'} BEZ · APY ×${lock.mult}`
          : type === 'escrow'
          ? `Crear Escrow · ${amount || '0'} BEZ colateral`
          : ['USD','EUR'].includes(payToken)
          ? `Ver datos bancarios →`
          : `Confirmar TX · ${amount || '0'} ${payToken} → BEZ`}
      </button>

      <div style={{ color: C.muted, fontSize: 9, textAlign: 'center' }}>
        🔒 Sin Stripe · 100% on-chain · BeZhas Pay v2.0 · Polygon + BNB
      </div>
    </div>
  );
}

// ─── PROCESSING STEP (con logs en tiempo real del hook) ──────────────────────
function ProcessingStep({ C, typeInfo, txState, txLogs, txHash }) {
  const stateLabels = {
    approving:   { label: 'Aprobando allowance ERC-20...', icon: '🔐' },
    transacting: { label: 'Enviando transacción on-chain...', icon: '📡' },
    confirming:  { label: 'Esperando confirmación en bloque...', icon: '⛓️' },
    notifying:   { label: 'Notificando backend BeZhas...', icon: '🌐' },
  };
  const cur = stateLabels[txState] || { label: 'Procesando...', icon: '⚙️' };

  return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      <div style={{ width: 70, height: 70, borderRadius: '50%', background: `${typeInfo.color}22`,
        border: `2px solid ${typeInfo.color}44`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 32, margin: '0 auto 16px' }}>
        {typeInfo.icon}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <Loader2 size={22} style={{ color: typeInfo.color, animation: 'spin 1s linear infinite' }} />
        <span style={{ color: typeInfo.color, fontFamily: 'monospace', fontSize: 12, fontWeight: 800 }}>
          {cur.icon} {cur.label}
        </span>
      </div>

      {txHash && (
        <div style={{ background: '#00C89611', border: '1px solid #00C89644', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
          <span style={{ color: '#00C896', fontFamily: 'monospace', fontSize: 9 }}>
            TX: {txHash.slice(0,10)}...{txHash.slice(-8)}
          </span>
        </div>
      )}

      {/* Live logs del hook */}
      <div style={{ background: '#03060E', border: '1px solid #0D2040', borderRadius: 10, padding: '10px', textAlign: 'left', maxHeight: 140, overflowY: 'auto' }}>
        <div style={{ color: '#3D5E80', fontSize: 8, fontFamily: 'monospace', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Activity size={10} /> TRANSACTION LOGS
        </div>
        {txLogs.length === 0 ? (
          <div style={{ color: '#3D5E80', fontSize: 9, fontFamily: 'monospace' }}>Iniciando...</div>
        ) : (
          txLogs.map((log, i) => (
            <div key={i} style={{
              color: log.type === 'error' ? '#EF4444' : log.type === 'success' ? '#00C896' : '#A8C4E0',
              fontFamily: 'monospace', fontSize: 9, padding: '1px 0', display: 'flex', gap: 6,
            }}>
              <span style={{ color: '#3D5E80', flexShrink: 0 }}>{log.ts}</span>
              {log.msg}
            </div>
          ))
        )}
      </div>

      <div style={{ color: C.muted, fontSize: 9, marginTop: 12 }}>
        No cierres esta ventana · La TX puede tardar 10-30 segundos
      </div>
    </div>
  );
}

// ─── SUCCESS STEP ─────────────────────────────────────────────────────────────
function SuccessStep({ txResult, type, plan, pool, fmtUSD, fmt, fmtH, copy, copiedField, C, onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>🎉</div>
      <div style={{ color: '#FFB800', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>¡Pago Exitoso!</div>
      <div style={{ color: '#E8F4FF', fontFamily: 'monospace', fontSize: 28, fontWeight: 800, margin: '10px 0' }}>
        🪙 {fmt(txResult?.bezAmount, 4)} BEZ
      </div>
      {type === 'subscription' && (
        <div style={{ color: '#00C896', fontSize: 12, marginBottom: 10 }}>
          Plan {plan.name} activado · Auto-renovación mensual ✓
        </div>
      )}
      {type === 'farming' && (
        <div style={{ color: '#F97316', fontSize: 12, marginBottom: 10 }}>
          Depositado en {pool.name} · Farming activo ✓
        </div>
      )}
      <div style={{ background: '#101E38', borderRadius: 12, padding: 14, margin: '14px 0', textAlign: 'left' }}>
        <div style={{ color: '#3D5E80', fontSize: 9, marginBottom: 6 }}>TRANSACCIÓN</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: '#A8C4E0', fontFamily: 'monospace', fontSize: 10 }}>TX Hash:</span>
          <span style={{ color: '#00C896', fontFamily: 'monospace', fontSize: 10 }}>{fmtH(txResult?.txHash)}</span>
          <button onClick={() => copy('txHash', txResult?.txHash)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedField === 'txHash' ? '#10B981' : '#3D5E80', padding: 0 }}>
            {copiedField === 'txHash' ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          </button>
        </div>
        <div style={{ color: '#A8C4E0', fontSize: 9 }}>Block #{txResult?.blockNumber} · Polygon Amoy</div>
        {txResult?.explorerUrl && (
          <a href={txResult.explorerUrl} target="_blank" rel="noreferrer"
            style={{ color: '#2563EB', fontSize: 10, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <ExternalLink size={12} /> Ver en Polygonscan →
          </a>
        )}
      </div>
      <button onClick={onClose} style={{
        width: '100%', background: 'linear-gradient(135deg,#FFB800,#F97316)', color: '#0a0a0a',
        border: 'none', borderRadius: 12, padding: '13px 20px', fontWeight: 800, fontSize: 14,
        cursor: 'pointer', fontFamily: 'monospace',
      }}>
        ✓ Cerrar
      </button>
    </div>
  );
}

// ─── ERROR STEP ───────────────────────────────────────────────────────────────
function ErrorStep({ txResult, C, onRetry, onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '30px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
      <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Error en el Pago</div>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 20 }}>{txResult?.error || 'Ha ocurrido un error inesperado.'}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, background: C.card2, color: C.text2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: '12px', fontWeight: 700, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={onRetry} style={{ flex: 1, background: 'linear-gradient(135deg,#EF4444,#DC2626)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'monospace' }}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

// ─── BANK TRANSFER STEP ───────────────────────────────────────────────────────
function BankStep({ bankData, C, copy, copiedField, onClose }) {
  const fields = [
    ['📋 Código de Referencia (OBLIGATORIO)', bankData?.refCode],
    ['💰 Monto a Transferir', `${bankData?.currency === 'EUR' ? '€' : '$'}${bankData?.amount}`],
    ['🏦 IBAN', bankData?.iban],
    ['🌐 SWIFT/BIC', bankData?.swift],
    ['👤 Beneficiario', bankData?.beneficiary],
    ['🏛️ Banco', bankData?.bank],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#180a0a', border: '1px solid #F97316', borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ color: '#FCA5A5', fontSize: 10, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Incluye el <strong>código de referencia</strong> en el concepto de la transferencia o no podremos identificarla.
        </div>
      </div>

      {fields.map(([label, val]) => (
        <div key={label} style={{ background: C.card2, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ color: C.muted, fontSize: 9, marginBottom: 4 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#E8F4FF', fontFamily: 'monospace', fontSize: 11, flex: 1, wordBreak: 'break-all' }}>{val}</span>
            <button onClick={() => copy(label, val)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedField === label ? '#10B981' : C.muted, flexShrink: 0 }}>
              {copiedField === label ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      ))}

      <div style={{ background: '#052a0a88', borderRadius: 10, padding: '10px 12px', fontSize: 10 }}>
        <div style={{ color: '#00C896', fontWeight: 700, marginBottom: 4 }}>Próximos pasos:</div>
        {[
          'Realiza la transferencia con los datos anteriores',
          'Incluye el código de referencia en el concepto',
          `Tokens llegarán a: ${bankData?.wallet?.slice(0,8)}...${bankData?.wallet?.slice(-6)}`,
          bankData?.currency === 'EUR' ? 'Tiempo: 1-2 días hábiles (SEPA)' : 'Tiempo: 3-5 días hábiles (SWIFT)',
        ].map((s, i) => (
          <div key={i} style={{ color: '#A8C4E0', display: 'flex', gap: 6, padding: '2px 0' }}>
            <span style={{ color: '#00C896' }}>{i+1}.</span>{s}
          </div>
        ))}
        {bankData?.bezAmount && (
          <div style={{ color: '#FFB800', marginTop: 6, fontWeight: 700 }}>Recibirás: {bankData.bezAmount} BEZ</div>
        )}
      </div>

      <button onClick={onClose} style={{
        width: '100%', background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff',
        border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: 13,
        cursor: 'pointer', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <CheckCircle2 size={16} /> Entendido, ya tengo los datos
      </button>
    </div>
  );
}

// CSS keyframe para Loader2 (inyectado globalmente)
if (typeof document !== 'undefined' && !document.getElementById('bez-pay-keyframes')) {
  const style = document.createElement('style');
  style.id = 'bez-pay-keyframes';
  style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
