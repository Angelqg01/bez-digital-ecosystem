/**
 * BezPayPage.jsx — BeZhas Pay System v2.0 — Página Completa
 *
 * Página dedicada al sistema financiero nativo de BeZhas.
 * Accesible en /pay y /bez-pay
 *
 * Fusiona las funcionalidades de:
 *  - bezhas-pay-system.jsx (prototipo raíz)
 *  - BuyTokensPage.jsx (compra de tokens)
 *  - DeFiHub.jsx (farming y staking)
 *  - BeVIP.jsx (suscripciones)
 *  - WalletPage.jsx (historial de transacciones)
 *
 * Todos los pagos pasan por BezPayModal vía useBezPay() hook.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useBezPay, SUBSCRIPTION_PLANS, FARMING_POOLS } from '../context/BezPayContext';
import { STRIPE_PAYMENT_LINKS } from '../config/bezhasPaymentConfig';
import { ExternalLink, Wallet, TrendingUp, Shield, Zap, Activity, Crown, ChevronRight, Info, BarChart2 } from 'lucide-react';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:      '#03060E',
  surf:    '#070D1C',
  card:    '#0C1628',
  card2:   '#101E38',
  card3:   '#142444',
  border:  '#0D2040',
  border2: '#163560',
  primary: '#00C896',
  gold:    '#FFB800',
  neon:    '#00FFB2',
  blue:    '#2563EB',
  violet:  '#7C3AED',
  orange:  '#F97316',
  red:     '#EF4444',
  text:    '#E8F4FF',
  text2:   '#A8C4E0',
  muted:   '#3D5E80',
  mono:    "'JetBrains Mono','Courier New',monospace",
  sans:    "'Inter','Segoe UI',system-ui,sans-serif",
};

// Helpers
const fmt    = (n, d=2)  => n==null ? '—' : (+n).toLocaleString('en-US', {maximumFractionDigits:d});
const fmtUSD = (n)       => '$'+(+n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

// Precio simulado de BEZ (en prod: usar contexto de precios real)
const BASE_PRICES = {BEZ:1.24,USDT:1,USDC:1,MATIC:0.88,ETH:3420,BNB:420};

function useLivePrices() {
  const [prices, setPrices] = useState(BASE_PRICES);
  useEffect(() => {
    const iv = setInterval(() => {
      setPrices(prev => {
        const n = {...prev};
        ['BEZ','MATIC','ETH','BNB'].forEach(k => {
          const d = (Math.random()-0.498)*0.006;
          n[k] = Math.max(0.0001, +(prev[k]*(1+d)).toFixed(8));
        });
        return n;
      });
    }, 750);
    return () => clearInterval(iv);
  }, []);
  return prices;
}

// ─── ESTADÍSTICAS GLOBALES SIMULADAS ─────────────────────────────────────────
const GLOBAL_STATS = {
  totalVolumeBEZ: 2_840_420,
  totalPayments:  14_238,
  activeFarmers:  3_847,
  totalEscrows:   921,
  tvlFarming:     '$2.75M',
  bezCirculating: '28.4M BEZ',
};

const BEZ_COIN_PACKAGES = [
  { id:'direct', name:'BEZ-Coin Polygon', tokens:'Compra directa', bonus:'Entrega segun orden Stripe', price:'FIAT', color:'#FFB800', icon:'🪙', href:STRIPE_PAYMENT_LINKS.tokenPurchase, featured:true },
  { id:'starter', name:'Starter', tokens:100, bonus:0, price:10, color:'#3D5E80', icon:'🌱' },
  { id:'pro', name:'Pro', tokens:500, bonus:50, price:50, color:'#2563EB', icon:'⚡' },
  { id:'business', name:'Business', tokens:1000, bonus:150, price:100, color:'#7C3AED', icon:'🚀', popular:true },
  { id:'enterprise', name:'Enterprise', tokens:5000, bonus:1000, price:500, color:'#FFB800', icon:'🏛️' },
  { id:'whale', name:'Whale', tokens:25000, bonus:7500, price:2500, color:'#06B6D4', icon:'💎' },
];

const ENTERPRISE_SUBSCRIPTION_PLANS = [
  {
    id:'starter',
    name:'BeZhas Starter',
    price:'29€',
    period:'/mes',
    icon:'🌱',
    color:'#2563EB',
    href:STRIPE_PAYMENT_LINKS.subscriptions.starter,
    badge:'Inicio empresa',
    features:['Acceso profesional inicial', 'Pagos BEZ Pay y fiat', 'Panel operativo BeZhas Hub', 'Soporte estandar'],
  },
  {
    id:'pro',
    name:'BeZhas Pro',
    price:'79€',
    period:'/mes',
    icon:'🚀',
    color:'#00C896',
    href:STRIPE_PAYMENT_LINKS.subscriptions.pro,
    badge:'Recomendado',
    features:['Funciones Pro', 'Automatizaciones y analitica', 'Mayor capacidad de uso', 'Prioridad en soporte'],
  },
  {
    id:'enterprise',
    name:'BeZhas Enterprise',
    price:'299€',
    period:'/mes',
    icon:'🏛️',
    color:'#FFB800',
    href:STRIPE_PAYMENT_LINKS.subscriptions.enterprise,
    badge:'Empresa',
    features:['Cuenta empresarial', 'White label y API institucional', 'Soporte dedicado', 'Escalado para equipos'],
  },
];

// ─── TABS DE NAVEGACIÓN ───────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',     label: 'Overview',     icon: '📊' },
  { id: 'buy',          label: 'Comprar BEZ',  icon: '🪙' },
  { id: 'subscription', label: 'Suscripciones', icon: '📋' },
  { id: 'farming',      label: 'Farming',      icon: '🌾' },
  { id: 'escrow',       label: 'Escrow',       icon: '🔒' },
  { id: 'history',      label: 'Analytics',    icon: '📈' },
];

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function BezPayPage() {
  const { address, isConnected } = useAccount();
  const { openBuyBez, openSubscription, openFarming, openEscrow, openBridge } = useBezPay();
  const prices = useLivePrices();
  const [tab, setTab] = useState('overview');
  const [bp, setBp] = useState('desktop');

  // Responsive
  useEffect(() => {
    const fn = () => {
      const w = window.innerWidth;
      setBp(w < 480 ? 'mobile' : w < 768 ? 'tablet' : 'desktop');
    };
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const M = bp === 'mobile';

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: C.sans, fontSize: 13 }}>

      {/* ── HEADER ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.surf}, #0a1a30)`,
        borderBottom: `1px solid ${C.border}`,
        padding: M ? '14px 14px 0' : '18px 28px 0',
      }}>
        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{
            background: `linear-gradient(135deg,${C.gold},${C.primary})`,
            borderRadius: 14, padding: M ? '8px 12px' : '10px 16px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: M ? 18 : 22 }}>🪙</span>
            <div>
              <div style={{ color: '#0a0a0a', fontFamily: C.mono, fontSize: M ? 14 : 18, fontWeight: 900 }}>BeZhas Pay</div>
              {!M && <div style={{ color: '#0a0a0a77', fontSize: 8, letterSpacing: 2 }}>PAYMENT SYSTEM v2.0</div>}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: M ? 18 : 24, fontWeight: 800, color: C.text }}>
              Sistema Financiero <span style={{ color: C.gold }}>Descentralizado</span>
            </h1>
            <p style={{ margin: 0, color: C.muted, fontSize: 11, marginTop: 2 }}>
              Paga, invierte y gestiona BEZ-Coin · Sin intermediarios · 100% on-chain
            </p>
          </div>

          {!M && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                {l:'Polygon Amoy',c:'#8247E5'},
                {l:'BNB Chain',c:'#F3BA2F'},
                {l:'Hot Wallet ✓',c:C.primary},
                {l:'WS Live',c:C.neon},
              ].map(b => (
                <span key={b.l} style={{
                  background:`${b.c}22`, color:b.c, border:`1px solid ${b.c}33`,
                  borderRadius:20, padding:'3px 10px', fontSize:9, fontFamily:C.mono, fontWeight:700,
                }}>{b.l}</span>
              ))}
            </div>
          )}

          {isConnected && (
            <div style={{
              background:`${C.primary}22`, border:`1px solid ${C.primary}44`,
              borderRadius: 10, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.primary, boxShadow:`0 0 6px ${C.primary}`, display:'inline-block' }} />
              <span style={{ color: C.primary, fontFamily: C.mono, fontSize: 10, fontWeight: 800 }}>
                {address?.slice(0,6)}…{address?.slice(-4)}
              </span>
            </div>
          )}
        </div>

        {/* Price Ticker */}
        <div style={{ display:'flex', gap: M?12:20, overflowX:'auto', scrollbarWidth:'none', paddingBottom:8 }}>
          {['BEZ','USDT','MATIC','ETH','BNB'].map(s => {
            const p = prices[s];
            const cols = {BEZ:C.gold,USDT:'#26A17B',MATIC:'#8247E5',ETH:'#627EEA',BNB:'#F3BA2F'};
            const icons = {BEZ:'🪙',USDT:'₮',MATIC:'⬟',ETH:'Ξ',BNB:'⬡'};
            return (
              <span key={s} style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
                <span style={{ fontSize: M?10:12 }}>{icons[s]}</span>
                <span style={{ color:cols[s], fontFamily:'monospace', fontSize: M?9:11, fontWeight:800 }}>{s}</span>
                <span style={{ color:C.text2, fontFamily:'monospace', fontSize: M?9:11 }}>
                  {p >= 1 ? fmtUSD(p) : `$${p?.toFixed(5)}`}
                </span>
              </span>
            );
          })}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, marginTop: 12,
          overflowX: 'auto', scrollbarWidth: 'none',
          borderTop: `1px solid ${C.border}`,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab===t.id ? `${C.primary}22` : 'transparent',
              color: tab===t.id ? C.primary : C.muted,
              border: `1px solid ${tab===t.id ? C.primary : 'transparent'}`,
              borderBottom: 'none',
              borderRadius: '10px 10px 0 0',
              padding: M ? '8px 10px' : '9px 18px',
              fontSize: M ? 10 : 12, fontWeight: tab===t.id ? 800 : 400,
              fontFamily: C.mono, cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: M?12:14 }}>{t.icon}</span>
              {!M && t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: M ? '14px 12px' : '20px 28px', maxWidth: 1300, margin: '0 auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'overview'     && <OverviewTab  prices={prices} M={M} openBuyBez={openBuyBez} openSubscription={openSubscription} openFarming={openFarming} C={C} />}
            {tab === 'buy'          && <BuyTab       prices={prices} M={M} openBuyBez={openBuyBez} isConnected={isConnected} C={C} />}
            {tab === 'subscription' && <SubscriptionTab M={M} openSubscription={openSubscription} isConnected={isConnected} C={C} />}
            {tab === 'farming'      && <FarmingTab prices={prices} M={M} openFarming={openFarming} isConnected={isConnected} C={C} />}
            {tab === 'escrow'       && <EscrowTab M={M} openEscrow={openEscrow} isConnected={isConnected} C={C} />}
            {tab === 'history'      && <AnalyticsTab M={M} C={C} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div style={{ borderTop:`1px solid ${C.border}`, padding:'10px 28px', display:'flex', justifyContent:'space-between',
        color:C.muted, fontSize:9, fontFamily:C.mono, background:C.surf, flexWrap:'wrap', gap:6 }}>
        <span>bez.digital · BEZ Payment System v2.0 · Polygon Amoy → Mainnet · BNB Chain</span>
        <span>LiquidityFarming.sol · QualityEscrow.sol · Node.js+Express+MongoDB+WebSocket</span>
      </div>
    </div>
  );
}

// ─── TAB: OVERVIEW ────────────────────────────────────────────────────────────
function OverviewTab({ prices, M, openBuyBez, openSubscription, openFarming, C }) {
  const stats = [
    { l:'Volumen Total BEZ', v:`${fmt(GLOBAL_STATS.totalVolumeBEZ/1e6,2)}M BEZ`, c:C.gold   },
    { l:'Pagos Completados', v:GLOBAL_STATS.totalPayments.toLocaleString(),       c:C.primary},
    { l:'Farmers Activos',   v:GLOBAL_STATS.activeFarmers.toLocaleString(),       c:C.orange },
    { l:'TVL Farming',       v:GLOBAL_STATS.tvlFarming,                           c:C.blue   },
  ];

  const quickActions = [
    {
      icon:'🪙', title:'Comprar BEZ', desc:'Multi-token: USDT, USDC, MATIC, crypto y fiat',
      color:C.gold, action:() => window.open(STRIPE_PAYMENT_LINKS.tokenPurchase, '_blank', 'noopener,noreferrer'),
    },
    {
      icon:'📋', title:'Suscripción empresarial', desc:'Starter, Pro y Enterprise con checkout real de Stripe',
      color:C.primary, action:() => window.open(STRIPE_PAYMENT_LINKS.subscriptions.pro, '_blank', 'noopener,noreferrer'),
    },
    {
      icon:'🌾', title:'Liquidity Farming', desc:'APY hasta 38.2% con multiplicadores por lock',
      color:C.orange, action:() => openFarming(1, null),
    },
    {
      icon:'🔒', title:'Quality Escrow', desc:'Garantía del servicio on-chain. Sin disputas arbitrarias.',
      color:C.blue, action:null, href:null, tab:'escrow',
    },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Stats Row */}
      <div style={{ display:'grid', gridTemplateColumns: M?'1fr 1fr':'repeat(4,1fr)', gap:10 }}>
        {stats.map(s => (
          <div key={s.l} style={{
            background:C.card, border:`1px solid ${s.c}33`, borderRadius:14,
            padding:'14px 16px', borderTop:`3px solid ${s.c}`,
          }}>
            <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', letterSpacing:0.8 }}>{s.l}</div>
            <div style={{ color:s.c, fontFamily:C.mono, fontSize: M?16:22, fontWeight:800, marginTop:4 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Acciones Rápidas</div>
        <div style={{ display:'grid', gridTemplateColumns: M?'1fr':'repeat(2,1fr)', gap:12 }}>
          {quickActions.map((a,i) => (
            <motion.button
              key={i}
              onClick={a.action}
              whileHover={{ scale:1.02 }}
              whileTap={{ scale:0.98 }}
              style={{
                background: `linear-gradient(135deg,${C.card2},${a.color}15)`,
                border:`1.5px solid ${a.color}33`,
                borderRadius:16, padding:'18px 20px',
                cursor:'pointer', textAlign:'left', width:'100%',
                display:'flex', alignItems:'center', gap:14,
                transition:'all 0.18s',
              }}
            >
              <div style={{
                width:52, height:52, borderRadius:14, flexShrink:0,
                background:`${a.color}22`, border:`1px solid ${a.color}44`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:26,
              }}>{a.icon}</div>
              <div style={{ flex:1, textAlign:'left' }}>
                <div style={{ color:a.color, fontWeight:800, fontSize:14, marginBottom:3 }}>{a.title}</div>
                <div style={{ color:C.text2, fontSize:11 }}>{a.desc}</div>
              </div>
              <ChevronRight size={18} style={{ color:a.color, flexShrink:0 }} />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Contracts & Networks */}
      <div style={{ display:'grid', gridTemplateColumns: M?'1fr':'1fr 1fr', gap:12 }}>
        <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>🏗️ Smart Contracts</div>
          {[
            {l:'BEZ Token (Polygon)',v:'0xEcBa87…369f11A8',c:C.primary},
            {l:'BEZ Token (BNB)',    v:'0x8a1e39…63a65b55',c:C.gold},
            {l:'QualityEscrow',      v:'0x3EfC42…E00e8a3',c:C.blue},
            {l:'Safe Wallet',        v:'0x3EfC42…E00e8a3',c:C.violet},
          ].map(c => (
            <div key={c.l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${C.border}`, fontSize:10 }}>
              <span style={{ color:C.muted }}>{c.l}</span>
              <span style={{ color:c.c, fontFamily:'monospace' }}>{c.v}</span>
            </div>
          ))}
        </div>

        <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>🔌 API Endpoints</div>
          {[
            {m:'POST',p:'/api/payment/webhook',   d:'Webhook BEZ automático'},
            {m:'GET', p:'/api/payment/history',   d:'Historial de pagos'},
            {m:'GET', p:'/api/farming/pools',     d:'Pools de farming'},
            {m:'POST',p:'/api/quality-escrow',    d:'Crear escrow'},
            {m:'GET', p:'/api/payment/stats',     d:'Estadísticas globales'},
          ].map(e => (
            <div key={e.p} style={{ display:'flex', gap:6, padding:'4px 0', borderBottom:`1px solid ${C.border}`, alignItems:'center' }}>
              <span style={{
                background: e.m==='POST'?`${C.orange}22`:`${C.blue}22`,
                color: e.m==='POST'?C.orange:C.blue,
                fontFamily:'monospace', fontSize:8, fontWeight:800,
                padding:'1px 5px', borderRadius:4, flexShrink:0,
              }}>{e.m}</span>
              <span style={{ color:C.primary, fontFamily:'monospace', fontSize:9, flex:1 }}>{e.p}</span>
              <span style={{ color:C.muted, fontSize:9 }}>{e.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: COMPRAR BEZ ─────────────────────────────────────────────────────────
function BuyTab({ prices, M, openBuyBez, isConnected, C }) {
  return (
    <div>
      <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
        Compra directa de BEZ-Coin con Stripe y paquetes BEZ Pay
      </div>
      <div style={{ display:'grid', gridTemplateColumns: M?'1fr 1fr':'repeat(3,1fr)', gap:12 }}>
        {BEZ_COIN_PACKAGES.map(pkg => (
          <motion.div key={pkg.id} whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={() => pkg.href
              ? window.open(pkg.href, '_blank', 'noopener,noreferrer')
              : openBuyBez(pkg.price, { itemName:`Paquete ${pkg.name}`, metadata:{packageId:pkg.id} })
            }
            style={{
              background:C.card, border:`1.5px solid ${pkg.color}44`,
              borderRadius:16, cursor:'pointer', overflow:'hidden', position:'relative',
              transition:'all 0.18s',
            }}>
            {(pkg.popular || pkg.featured) && (
              <div style={{
                position:'absolute', top:-1, left:'50%', transform:'translateX(-50%)',
                background:pkg.color, color:'#000', fontSize:7, fontWeight:800, fontFamily:'monospace',
                padding:'2px 10px', borderRadius:'0 0 8px 8px', whiteSpace:'nowrap',
              }}>{pkg.featured ? 'STRIPE REAL' : 'MÁS POPULAR'}</div>
            )}
            <div style={{ background:`linear-gradient(135deg,${pkg.color}33,${pkg.color}11)`, padding:'16px 14px 12px', borderBottom:`1px solid ${pkg.color}22` }}>
              <div style={{ fontSize: M?20:24, marginBottom:4 }}>{pkg.icon}</div>
              <div style={{ color:pkg.color, fontWeight:800, fontSize: M?13:15 }}>{pkg.name}</div>
              <div style={{ color:C.text, fontFamily:'monospace', fontSize: M?18:22, fontWeight:900, marginTop:4 }}>
                {typeof pkg.price === 'number' ? `$${pkg.price}` : pkg.price} <span style={{ color:C.muted, fontSize:10 }}>{typeof pkg.price === 'number' ? 'USD' : 'Stripe'}</span>
              </div>
            </div>
            <div style={{ padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <span style={{ color:C.gold, fontSize:13 }}>🪙</span>
                <span style={{ color:C.text, fontFamily:'monospace', fontWeight:800 }}>{typeof pkg.tokens === 'number' ? pkg.tokens.toLocaleString() : pkg.tokens}</span>
                {typeof pkg.bonus === 'number' && pkg.bonus > 0 && <span style={{ color:'#10B981', fontFamily:'monospace', fontSize:10 }}>+{pkg.bonus.toLocaleString()}</span>}
                <span style={{ color:C.muted, fontSize:9 }}>BEZ</span>
              </div>
              <div style={{ color:C.muted, fontSize:9, marginBottom:10 }}>
                {typeof pkg.tokens === 'number'
                  ? <>Total: <span style={{ color:C.text2, fontWeight:700 }}>{(pkg.tokens+pkg.bonus).toLocaleString()} BEZ</span>{pkg.bonus > 0 && <span style={{ color:'#10B981' }}> (+{Math.round(pkg.bonus/pkg.tokens*100)}% bonus)</span>}</>
                  : <span style={{ color:C.text2, fontWeight:700 }}>{pkg.bonus}</span>
                }
              </div>
              <button style={{
                width:'100%', background:`${pkg.color}22`, color:pkg.color,
                border:`1px solid ${pkg.color}44`, borderRadius:10, padding:'8px',
                fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'monospace',
              }}>
                {pkg.href ? 'Comprar BEZ-Coin con Stripe →' : 'Comprar con BEZ Pay →'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ marginTop:16, background:`${C.card}`, borderRadius:12, padding:14, border:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
          <Info size={16} style={{ color:C.primary, flexShrink:0, marginTop:1 }} />
          <div>
            <div style={{ color:C.text, fontWeight:700, fontSize:12, marginBottom:4 }}>¿Cómo funciona BEZ Pay?</div>
            <div style={{ color:C.muted, fontSize:10, lineHeight:1.7 }}>
              Paga con USDT, USDC, MATIC, ETH, BNB o fiat (EUR/USD). El sistema BEZ Pay procesa el pago
              y envía automáticamente los tokens BEZ a tu wallet vía <strong style={{color:C.primary}}>dispenseTokens()</strong> desde
              la Hot Wallet de BeZhas en Polygon. 0.5% fee para pagos en BEZ, 1.5% para otros activos.
              <br />
              <span style={{color:C.gold}}>🎁 Paga con BEZ-Coin y obtén 20% de descuento adicional.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: SUSCRIPCIONES ───────────────────────────────────────────────────────
function SubscriptionTab({ M, openSubscription, isConnected, C }) {
  return (
    <div>
      <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
        Suscripción empresarial BeZhas · Checkout real de Stripe
      </div>
      <div style={{ display:'grid', gridTemplateColumns: M?'1fr':'repeat(3,1fr)', gap:12, marginBottom:18 }}>
        {ENTERPRISE_SUBSCRIPTION_PLANS.map(plan => (
          <motion.div key={plan.id} whileHover={{ scale:1.02 }}
            style={{
              background:C.card, border:`2px solid ${plan.color}44`, borderRadius:18,
              overflow:'hidden', position:'relative',
            }}>
            {plan.badge && (
              <div style={{
                position:'absolute', top:-1, left:'50%', transform:'translateX(-50%)',
                background:plan.color, color:'#0a0a0a',
                fontSize:7, fontWeight:800, fontFamily:'monospace',
                padding:'2px 10px', borderRadius:'0 0 8px 8px', whiteSpace:'nowrap',
              }}>{plan.badge}</div>
            )}
            <div style={{
              background:`linear-gradient(135deg,${plan.color}22,${plan.color}08)`,
              padding:'18px 14px 14px', borderBottom:`1px solid ${plan.color}22`,
              textAlign:'center',
            }}>
              <div style={{ fontSize:28, marginBottom:6 }}>{plan.icon}</div>
              <div style={{ color:plan.color, fontWeight:800, fontSize:15 }}>{plan.name}</div>
              <div style={{ marginTop:6 }}>
                <div style={{ color:C.text, fontFamily:'monospace', fontSize: M?20:26, fontWeight:900 }}>
                  {plan.price} <span style={{ color:C.muted, fontSize:10 }}>{plan.period}</span>
                </div>
                <div style={{ color:C.muted, fontSize:9 }}>Pago seguro con Stripe</div>
              </div>
            </div>
            <div style={{ padding:'12px 14px' }}>
              {plan.features.map(f => (
                <div key={f} style={{ color:C.text2, fontSize:10, display:'flex', gap:6, padding:'2px 0' }}>
                  <span style={{ color:plan.color }}>✓</span>{f}
                </div>
              ))}
              <a href={plan.href} target="_blank" rel="noopener noreferrer" style={{
                  width:'100%', marginTop:12, background:`${plan.color}22`,
                  color:plan.color, border:`1px solid ${plan.color}44`,
                  borderRadius:10, padding:'9px', fontSize:11, fontWeight:800,
                  cursor:'pointer', fontFamily:'monospace', display:'block', textAlign:'center', textDecoration:'none', boxSizing:'border-box',
                }}>
                  Suscribirse con Stripe <ExternalLink size={12} style={{ display:'inline', marginLeft:4 }} />
                </a>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
        Planes VIP BeZhas-HUB
      </div>
      <div style={{ display:'grid', gridTemplateColumns: M?'1fr':'repeat(2,1fr)', gap:12 }}>
        {[
          { name:'Be-VIP', href:STRIPE_PAYMENT_LINKS.vip, color:C.violet, icon:'👑', desc:'Acceso Be-VIP y funciones premium para suscriptores.' },
          { name:'Be-VIP Plus', href:STRIPE_PAYMENT_LINKS.vipPlus, color:C.primary, icon:'💎', desc:'Niveles superiores de suscriptor y ventajas ampliadas.' },
        ].map(plan => (
          <a key={plan.name} href={plan.href} target="_blank" rel="noopener noreferrer" style={{
            background:C.card, border:`1.5px solid ${plan.color}44`, borderRadius:16, padding:16,
            display:'flex', alignItems:'center', gap:14, textDecoration:'none',
          }}>
            <div style={{ width:48, height:48, borderRadius:14, background:`${plan.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{plan.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ color:plan.color, fontWeight:800 }}>{plan.name}</div>
              <div style={{ color:C.muted, fontSize:10, marginTop:3 }}>{plan.desc}</div>
            </div>
            <ExternalLink size={16} style={{ color:plan.color }} />
          </a>
        ))}
      </div>

      <div style={{ marginTop:14, background:C.card2, borderRadius:12, padding:12, display:'flex', gap:10, alignItems:'flex-start' }}>
        <Shield size={16} style={{ color:C.primary, flexShrink:0, marginTop:1 }} />
        <div style={{ color:C.muted, fontSize:10, lineHeight:1.6 }}>
          <strong style={{color:C.text2}}>Suscripciones reales:</strong> Los botones usan los Payment Links reales del archivo
          <code style={{color:C.primary}}> Link's Stripe.txt</code> para Starter, Pro, Enterprise, Be-VIP y Be-VIP Plus.
          <br/>
          BEZ Pay mantiene la capa cripto/on-chain, y Stripe procesa los cobros FIAT cuando el usuario elige suscribirse con tarjeta.
        </div>
      </div>
    </div>
  );
}

// ─── TAB: FARMING ─────────────────────────────────────────────────────────────
function FarmingTab({ prices, M, openFarming, isConnected, C }) {
  const LOCK = [
    {days:0,label:'Sin lock',mult:1},
    {days:7,label:'7d',mult:1.1},
    {days:30,label:'30d',mult:1.25},
    {days:90,label:'90d',mult:1.5},
    {days:180,label:'180d',mult:2},
    {days:365,label:'365d',mult:3},
  ];

  return (
    <div>
      {/* Global Farming Stats */}
      <div style={{ display:'grid', gridTemplateColumns: M?'1fr 1fr':'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          {l:'TVL Total',    v:GLOBAL_STATS.tvlFarming,  c:C.primary},
          {l:'Pools Activos',v:'4',                       c:C.gold},
          {l:'Mejor APY',    v:'38.2%',                   c:'#10B981'},
          {l:'BEZ/Block',    v:'0.1 BEZ',                 c:C.violet},
        ].map(s => (
          <div key={s.l} style={{
            background:C.card, border:`1px solid ${s.c}33`,
            borderRadius:14, padding:'12px', borderTop:`3px solid ${s.c}`,
          }}>
            <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase' }}>{s.l}</div>
            <div style={{ color:s.c, fontFamily:'monospace', fontSize: M?16:20, fontWeight:800, marginTop:4 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Pool Cards */}
      <div style={{ display:'grid', gridTemplateColumns: M?'1fr':'1fr 1fr', gap:12 }}>
        {FARMING_POOLS.map(pool => (
          <div key={pool.pid} style={{
            background:C.card, border:`1.5px solid ${C.border2}`,
            borderRadius:16, padding:16,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ color:C.text, fontWeight:800, fontSize:14 }}>🌾 {pool.name}</div>
                <span style={{
                  background:`${C.muted}22`, color:C.muted,
                  border:`1px solid ${C.muted}44`, borderRadius:20,
                  padding:'1px 8px', fontSize:9, fontFamily:'monospace', fontWeight:800,
                }}>{pool.lpToken}</span>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ color:'#10B981', fontFamily:'monospace', fontSize:20, fontWeight:800 }}>{pool.apy}%</div>
                <div style={{ color:C.muted, fontSize:9 }}>APY base</div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              {[['TVL',pool.tvl],['Min Stake',`${pool.minStake} BEZ`]].map(([k,v]) => (
                <div key={k} style={{ background:C.card2, borderRadius:8, padding:'6px 10px' }}>
                  <div style={{ color:C.muted, fontSize:8 }}>{k}</div>
                  <div style={{ color:C.text2, fontFamily:'monospace', fontSize:10, fontWeight:700 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Lock multipliers mini-view */}
            <div style={{ display:'flex', gap:4, marginBottom:12, overflowX:'auto' }}>
              {LOCK.slice(1).map(l => (
                <span key={l.days} style={{
                  background:`${C.orange}18`, color:C.orange,
                  border:`1px solid ${C.orange}33`, borderRadius:6,
                  padding:'2px 6px', fontSize:8, fontFamily:'monospace', fontWeight:800, flexShrink:0,
                }}>{l.label}·×{l.mult}</span>
              ))}
            </div>

            <button onClick={() => openFarming(pool.pid)} style={{
              width:'100%', background:`${C.orange}22`, color:C.orange,
              border:`1px solid ${C.orange}44`, borderRadius:10, padding:'9px',
              fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'monospace',
            }}>
              Depositar en {pool.name} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: ESCROW ──────────────────────────────────────────────────────────────
function EscrowTab({ M, openEscrow, isConnected, C }) {
  const [clientWallet, setClientWallet] = useState('');
  const [collateral, setCollateral] = useState('100');
  const [quality, setQuality] = useState(85);
  const [desc, setDesc] = useState('');

  return (
    <div style={{ display:'grid', gridTemplateColumns: M?'1fr':'1fr 340px', gap:16 }}>
      <div>
        <div style={{ color:C.blue, fontWeight:800, fontSize:15, marginBottom:14 }}>
          🔒 Quality Escrow — QualityEscrow.sol
        </div>
        <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', marginBottom:5 }}>Wallet del cliente</div>
        <input value={clientWallet} onChange={e => setClientWallet(e.target.value)} placeholder="0x... wallet del cliente"
          style={{
            width:'100%', background:C.card2, border:`1px solid ${C.border2}`, borderRadius:10,
            padding:'10px 12px', color:C.muted, fontSize:11, fontFamily:'monospace',
            outline:'none', boxSizing:'border-box', marginBottom:12,
          }}
        />
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ color:C.muted, fontSize:9, textTransform:'uppercase' }}>Colateral BEZ</span>
          <span style={{ color:C.blue, fontFamily:'monospace', fontSize:10 }}>{collateral} BEZ ≈ ${(+collateral*1.24).toFixed(2)}</span>
        </div>
        <input type="number" value={collateral} onChange={e=>setCollateral(e.target.value)}
          style={{
            width:'100%', background:C.card2, border:`1px solid ${C.border2}`, borderRadius:10,
            padding:'10px 12px', color:C.text, fontSize:16, fontFamily:'monospace',
            outline:'none', boxSizing:'border-box', marginBottom:12, fontWeight:800,
          }}
        />
        <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', marginBottom:6 }}>
          Calidad prometida: {quality}%
        </div>
        <input type="range" min={50} max={100} value={quality} onChange={e => setQuality(+e.target.value)}
          style={{ width:'100%', marginBottom:8, accentColor:C.blue }}
        />
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:C.muted, marginBottom:14 }}>
          <span>50% (mínimo)</span>
          <span style={{ color:C.blue, fontWeight:800 }}>{quality}% prometido</span>
          <span>100%</span>
        </div>
        <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', marginBottom:5 }}>Descripción del servicio</div>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
          placeholder="Describe el servicio garantizado..."
          style={{
            width:'100%', background:C.card2, border:`1px solid ${C.border2}`, borderRadius:10,
            padding:'10px', color:C.text, fontSize:12, fontFamily:C.sans,
            resize:'vertical', outline:'none', boxSizing:'border-box', marginBottom:14,
          }}
        />
        <button
          onClick={() => openEscrow(clientWallet, +collateral, quality, {metadata:{desc}})}
          disabled={!clientWallet || +collateral <= 0}
          style={{
            width:'100%', background:`linear-gradient(135deg,#2563EB,#1D4ED8)`,
            color:'#fff', border:'none', borderRadius:14, padding:'14px',
            fontSize:14, fontWeight:800, cursor: (!clientWallet || +collateral<=0) ? 'not-allowed':'pointer',
            fontFamily:'monospace', opacity:(!clientWallet || +collateral<=0) ? 0.5:1,
          }}
        >
          🔒 Crear Escrow — {collateral} BEZ colateral
        </button>
      </div>

      {!M && (
        <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', marginBottom:12 }}>Funciones del Contrato</div>
          {[
            {f:'createService(clientWallet, collateral, initialQuality)', d:'Crea nuevo escrow con colateral BEZ'},
            {f:'finalizeService(serviceId, finalQuality)', d:'Finaliza y calcula retorno según calidad real'},
            {f:'raiseDispute(serviceId)', d:'Cliente abre disputa'},
            {f:'resolveDispute(serviceId, inFavor, quality)', d:'Oracle resuelve disputa'},
          ].map(e => (
            <div key={e.f} style={{ padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
              <div style={{ color:C.primary, fontFamily:'monospace', fontSize:9 }}>{e.f}</div>
              <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>{e.d}</div>
            </div>
          ))}
          <div style={{ marginTop:12, background:C.card2, borderRadius:10, padding:10 }}>
            <div style={{ color:C.muted, fontSize:9, marginBottom:4 }}>Fórmula de penalización:</div>
            <div style={{ color:C.text2, fontFamily:'monospace', fontSize:10 }}>
              penalty = (initialQuality - finalQuality) × 2%<br/>
              returnAmount = collateral × (1 - penalty%)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: ANALYTICS ───────────────────────────────────────────────────────────
function AnalyticsTab({ M, C }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns: M?'1fr':'repeat(3,1fr)', gap:12 }}>
        {[
          {l:'Tasa de Éxito',  v:'96.3%',   c:'#10B981', icon:'✅', sub:'de transacciones completadas'},
          {l:'Avg. Process',   v:'1.2s',     c:C.blue,    icon:'⚡', sub:'tiempo medio de confirmación'},
          {l:'Avg. Fee',       v:'0.7%',     c:C.gold,    icon:'💰', sub:'fee promedio del sistema'},
        ].map(s => (
          <div key={s.l} style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${s.c}33`, textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>{s.icon}</div>
            <div style={{ color:s.c, fontFamily:'monospace', fontSize:28, fontWeight:900 }}>{s.v}</div>
            <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', marginTop:4 }}>{s.l}</div>
            <div style={{ color:C.text2, fontSize:10, marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}` }}>
        <div style={{ color:C.muted, fontSize:9, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
          <BarChart2 size={12} style={{ display:'inline', marginRight:4 }} />
          Distribución de Pagos por Tipo
        </div>
        {[
          {t:'🪙 Compra BEZ',    pct:45, c:C.gold},
          {t:'📋 Suscripciones', pct:28, c:C.primary},
          {t:'🌾 Farming',       pct:15, c:C.orange},
          {t:'🔒 Escrow',        pct:8,  c:C.blue},
          {t:'⬡ Bridge',        pct:4,  c:C.neon},
        ].map(row => (
          <div key={row.t} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ color:C.text2, fontSize:11 }}>{row.t}</span>
              <span style={{ color:row.c, fontFamily:'monospace', fontSize:11, fontWeight:800 }}>{row.pct}%</span>
            </div>
            <div style={{ background:C.border, borderRadius:4, height:6 }}>
              <motion.div
                initial={{ width:0 }}
                animate={{ width:`${row.pct}%` }}
                transition={{ duration:0.8, ease:'easeOut' }}
                style={{ height:'100%', background:row.c, borderRadius:4 }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:C.card2, borderRadius:12, padding:14, border:`1px solid ${C.border}`, textAlign:'center' }}>
        <Activity size={20} style={{ color:C.primary, marginBottom:8, display:'block', margin:'0 auto 8px' }} />
        <div style={{ color:C.text, fontWeight:700, fontSize:13, marginBottom:4 }}>Analytics en tiempo real</div>
        <div style={{ color:C.muted, fontSize:10 }}>
          Conecta a ws.bez.digital:3002 para recibir eventos de pago en tiempo real via WebSocket.
          <br/>Disponible en el SDK: <code style={{color:C.primary}}>bezPay.onEvent((event) {'=> '}...)</code>
        </div>
      </div>
    </div>
  );
}
