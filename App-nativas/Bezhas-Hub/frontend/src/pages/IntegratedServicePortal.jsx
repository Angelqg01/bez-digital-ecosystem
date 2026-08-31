/**
 * IntegratedServicePortal — Portal Integrado de Servicios BeZhas-Hub.
 *
 * Rediseño completo de la landing/portal según el sistema visual "Cyber-Pipeline"
 * (glassmorphism industrial + neon-cyan, fuentes Inter + JetBrains Mono).
 *
 * Una sola superficie con navegación inferior (Feed · Hub · BEZ-Pay · Support) y
 * pantalla de Planes. Toda la información del ecosistema (módulos, servicios,
 * precios, feed) se adapta aquí; todos los enlaces son REALES:
 *   - Apps Nativas  → deep-link a producción (config/nativeAppUrls.js)
 *   - Internos → rutas reales del Hub (/pay, /rwa, /oracle, /compliance, /docs…)
 *   - Pagos    → BezPayModal global vía useBezPay() (pago real BEZ/fiat)
 *
 * La landing legacy sigue accesible en /landing-legacy.
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network as NetIcon, LayoutGrid, CreditCard, LifeBuoy, Rss, ArrowUpRight,
  Copy, Mail, Send, ShieldCheck, Zap, Activity, Server, Wallet,
  CheckCircle2, Building2, User, Coins,
} from 'lucide-react';
import { useBezPay } from '../context/BezPayContext';
import { PLANS, calcSubscription, BEZ_DISCOUNT_RATE, STAKING_APY_MAX } from '../config/plans';
import { CORE_MODULES, SERVICE_MATRIX, NETWORK_FEED, NETWORK_HEALTH, CONTACT } from '../components/portal/portalData';

// ── Tokens de diseño (Cyber-Pipeline) ────────────────────────────────────────
const C = {
  bg: '#020617',
  cardLow: 'rgba(19,27,46,0.55)',
  card: 'rgba(23,31,51,0.7)',
  bright: '#31394d',
  text: '#dae2fd',
  dim: '#b9cacb',
  cyan: '#00F0FF',
  emerald: '#10B981',
  orange: '#F59E0B',
  border: 'rgba(255,255,255,0.12)',
};
const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

// ── Helpers de navegación ─────────────────────────────────────────────────────
function useOpen() {
  const navigate = useNavigate();
  return useCallback((link) => {
    if (!link) return;
    if (link.external) window.open(link.href, '_blank', 'noopener,noreferrer');
    else navigate(link.href);
  }, [navigate]);
}

// ── Píldora de estado ─────────────────────────────────────────────────────────
function StatusPill({ status }) {
  if (status === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
        style={{ ...mono, color: C.orange, border: `1px solid ${C.orange}55`, background: `${C.orange}14` }}>
        Syncing
      </span>
    );
  }
  if (status === 'core') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
        style={{ ...mono, color: C.cyan, border: `1px solid ${C.cyan}40`, background: `${C.cyan}12` }}>
        Core
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
      style={{ ...mono, color: C.emerald, border: `1px solid ${C.emerald}4d`, background: `${C.emerald}1a` }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.emerald, boxShadow: `0 0 8px ${C.emerald}` }} />
      Active
    </span>
  );
}

// ── Tarjeta de cristal genérica ───────────────────────────────────────────────
function Glass({ children, className = '', style = {}, active = false, ...rest }) {
  return (
    <div
      className={`rounded-2xl backdrop-blur-xl ${className}`}
      style={{
        background: C.cardLow,
        border: `1px solid ${active ? `${C.cyan}55` : C.border}`,
        boxShadow: active ? `0 0 18px ${C.cyan}1f` : 'none',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// =============================================================================
// VISTA · HUB (Dashboard central)
// =============================================================================
function HubView({ onGoPlans }) {
  const open = useOpen();
  return (
    <div className="flex flex-col gap-8">
      {/* Hero — The Transparent Blockchain */}
      <Glass className="relative overflow-hidden p-6">
        <div className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle at 80% 20%, ${C.cyan}1f, transparent 55%), radial-gradient(circle at 10% 90%, ${C.emerald}1a, transparent 55%)` }} />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <NetIcon size={26} style={{ color: C.cyan }} />
            <h2 className="text-[30px] leading-tight font-extrabold text-white tracking-tight">The Transparent Blockchain</h2>
          </div>
          <p className="text-[15px]" style={{ color: C.dim }}>
            Valida contratos, elimina disputas y resuelve problemas mediante pipelines de datos inmutables y transparentes.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]"
              style={{ ...mono, color: C.dim, background: 'rgba(49,57,77,0.5)', border: `1px solid ${C.border}` }}>
              <Server size={13} /> Connected Services
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold"
              style={{ ...mono, color: C.emerald, background: `${C.emerald}1a`, border: `1px solid ${C.emerald}4d` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.emerald, boxShadow: `0 0 8px ${C.emerald}` }} />
              ALL SYSTEMS ONLINE
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={onGoPlans}
              className="px-5 h-11 rounded-full text-sm font-bold active:scale-95 transition"
              style={{ background: C.cyan, color: '#00363a', boxShadow: `0 0 16px ${C.cyan}55` }}>
              Ver planes de suscripción
            </button>
            <button onClick={() => open({ href: '/developer-console', external: false })}
              className="px-5 h-11 rounded-full text-sm font-semibold active:scale-95 transition"
              style={{ color: C.cyan, border: `1px solid ${C.cyan}`, background: 'transparent' }}>
              Dev Portal
            </button>
          </div>
        </div>
      </Glass>

      {/* Core Modules */}
      <section className="flex flex-col gap-4">
        <h3 className="uppercase tracking-[0.2em] text-[12px] pl-1" style={{ ...mono, color: C.dim }}>Core Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CORE_MODULES.map((m) => {
            const Icon = m.icon;
            const verified = m.status === 'active' && m.id === 'prestige';
            return (
              <button key={m.id} onClick={() => open(m)}
                className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl backdrop-blur-lg transition active:scale-95"
                style={{ background: C.cardLow, border: `1px solid ${C.border}` }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${C.cyan}80`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center transition"
                  style={verified
                    ? { background: `${C.emerald}1a`, color: C.emerald, border: `1px solid ${C.emerald}33`, boxShadow: `0 0 10px ${C.emerald}33` }
                    : { background: 'rgba(49,57,77,0.5)', color: C.dim }}>
                  <Icon size={22} />
                </div>
                <span className="text-sm font-medium" style={{ color: C.text }}>{m.name}</span>
                <span className="text-[10px]" style={{ ...mono, color: C.dim }}>{m.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Feed preview */}
      <Glass className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${C.cyan}1a`, border: `1px solid ${C.cyan}33` }}>
              <Rss size={15} style={{ color: C.cyan }} />
            </div>
            <div>
              <h4 className="text-sm font-semibold" style={{ color: C.text }}>@BeZhas Network</h4>
              <p className="text-[10px]" style={{ ...mono, color: C.dim }}>Just now · System Log</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(23,31,51,0.5)', border: `1px solid ${C.border}` }}>
          <p className="text-sm leading-relaxed" style={{ color: C.dim }}>
            Smart Contract <span style={{ ...mono, color: C.cyan }}>#743</span> validado en todos los nodos. Cero disputas. El pipeline fluye óptimo. 🌊{' '}
            <span style={{ color: `${C.cyan}cc` }}>#TransparentBlockchain</span>
          </p>
        </div>
      </Glass>
    </div>
  );
}

// =============================================================================
// VISTA · SERVICES MATRIX (Explorador)
// =============================================================================
function ServicesView() {
  const open = useOpen();
  return (
    <div className="flex flex-col gap-6">
      <Glass className="relative overflow-hidden p-6">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(circle at 90% 10%, ${C.cyan}1f, transparent 55%)` }} />
        <div className="relative z-10">
          <h2 className="text-[30px] font-extrabold text-white tracking-tight">Services Matrix</h2>
          <p className="mt-2 text-[15px]" style={{ color: C.dim }}>
            Toda la lógica de automatización distribuida del ecosistema. Accede directo a cada producto y servicio de BeZhas-Hub.
          </p>
        </div>
      </Glass>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SERVICE_MATRIX.map((s) => {
          const Icon = s.icon;
          return (
            <Glass key={s.id} className="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(49,57,77,0.5)', color: C.cyan }}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-semibold" style={{ color: C.text }}>{s.name}</h3>
                </div>
                <StatusPill status={s.status} />
              </div>
              <p className="text-sm leading-relaxed" style={{ color: C.dim }}>{s.desc}</p>
              <button onClick={() => open(s)}
                className="mt-1 h-10 rounded-full text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                style={s.status === 'syncing'
                  ? { color: C.text, border: `1px solid ${C.border}`, background: 'rgba(49,57,77,0.4)' }
                  : { background: C.cyan, color: '#00363a', boxShadow: `0 0 14px ${C.cyan}40` }}>
                {s.status === 'syncing' ? 'Initialize' : 'Conectar'} <ArrowUpRight size={15} />
              </button>
            </Glass>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// VISTA · PLANES (Suscripción — Usuarios y Empresas)
// =============================================================================
function PlansView() {
  const { openSubscription } = useBezPay();
  const [payBez, setPayBez] = useState(false); // pagar con $BEZ → −20%

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-[34px] font-extrabold text-white leading-none tracking-tight">Planes de Suscripción</h2>
        <p className="text-[15px]" style={{ color: C.dim }}>
          4 niveles para escalar según el tamaño de tu organización. Precios EUR/mes (sin IVA). Pago en FIAT (Stripe) o en $BEZ con <span style={{ color: C.cyan }}>−{Math.round(BEZ_DISCOUNT_RATE * 100)}%</span>.
        </p>
        {/* Toggle pago $BEZ */}
        <button onClick={() => setPayBez((v) => !v)}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-full w-max text-sm font-semibold transition"
          style={payBez ? { background: C.cyan, color: '#00363a' } : { color: C.dim, border: `1px solid ${C.border}` }}>
          <Coins size={15} /> {payBez ? `Pagando con $BEZ (−${Math.round(BEZ_DISCOUNT_RATE * 100)}%)` : 'Pagar con $BEZ y ahorrar 20%'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((p) => {
          const isRec = !!p.recommended;
          const q = calcSubscription({ planId: p.id, payWithBez: payBez });
          const free = p.priceEUR === 0;
          return (
            <Glass key={p.id} active={isRec} className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: C.text }}><span>{p.icon}</span> {p.name}</h3>
                {p.badge && <span className="px-2.5 py-1 rounded-full text-[9px] font-bold" style={{ ...mono, background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}55` }}>{p.badge}</span>}
              </div>
              <p className="text-[11px]" style={{ ...mono, color: C.dim }}>{p.profile}</p>
              <div className="flex items-end gap-1">
                <span className="text-[34px] font-extrabold leading-none text-white">{free ? 'Gratis' : `${q.subtotal}€`}</span>
                {!free && <span className="text-xs mb-1" style={{ color: C.dim }}>/mes</span>}
              </div>
              {!free && (
                <p className="text-[11px]" style={{ ...mono, color: payBez ? C.cyan : C.dim }}>
                  {payBez ? `antes ${p.priceEUR}€ · ${p.bezPerMonth.toLocaleString()} BEZ` : `IVA inc. ${p.priceIVA}€ · o ${p.bezPerMonth.toLocaleString()} BEZ`}
                </p>
              )}
              {p.roiPercent && <p className="text-[11px] font-bold" style={{ color: C.emerald }}>ROI {p.valueLine}</p>}
              <ul className="grid grid-cols-1 gap-1.5 mt-1">
                {p.features.slice(0, 6).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px]" style={{ color: C.text }}>
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: C.emerald }} /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => openSubscription(p.id)}
                className="mt-auto h-11 rounded-full text-sm font-bold active:scale-95 transition"
                style={isRec
                  ? { background: C.cyan, color: '#00363a', boxShadow: `0 0 16px ${C.cyan}55` }
                  : { color: C.text, border: `1px solid ${C.border}`, background: 'rgba(49,57,77,0.4)' }}>
                {free ? 'Empezar gratis' : `Suscribirme · ${p.name}`}
              </button>
            </Glass>
          );
        })}
      </div>

      <p className="text-xs text-center" style={{ ...mono, color: C.dim }}>
        Staking corporativo $BEZ hasta {STAKING_APY_MAX}% APY · Enterprise VIP: 20% de comisiones de sub-empresas · Ahorro 85% en conciliación/auditoría
      </p>

      {/* Secure Payment Conduits → BEZ-Pay */}
      <Glass className="p-6 flex flex-col gap-3">
        <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: C.text }}><ShieldCheck size={18} style={{ color: C.cyan }} /> Conductos de pago seguros</h3>
        <p className="text-sm" style={{ color: C.dim }}>
          Liquida tu suscripción con BEZ-Token nativo (gas reducido) o con tarjeta vía Stripe. Pagos reales procesados por BeZhas Pay.
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]" style={{ ...mono, color: C.cyan, background: `${C.cyan}12`, border: `1px solid ${C.cyan}40` }}><Coins size={13} /> BEZ Token Native</span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]" style={{ ...mono, color: C.dim, background: 'rgba(49,57,77,0.5)', border: `1px solid ${C.border}` }}><CreditCard size={13} /> Stripe Verified</span>
        </div>
      </Glass>
    </div>
  );
}

// =============================================================================
// VISTA · BEZ-PAY
// =============================================================================
function PayView() {
  const { openBuyBez } = useBezPay();
  const open = useOpen();
  return (
    <div className="flex flex-col gap-6">
      <Glass className="relative overflow-hidden p-6">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: `radial-gradient(circle at 20% 20%, ${C.cyan}1f, transparent 55%)` }} />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CreditCard size={24} style={{ color: C.cyan }} />
            <h2 className="text-[30px] font-extrabold text-white tracking-tight">BeZhas Pay</h2>
          </div>
          <p className="text-[15px]" style={{ color: C.dim }}>
            Cobros y pagos fiat/cripto con liquidación instantánea. On-ramp, checkout y settlement en BEZ-Token.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <button onClick={() => open({ href: '/pay', external: false })}
              className="px-5 h-11 rounded-full text-sm font-bold active:scale-95 transition"
              style={{ background: C.cyan, color: '#00363a', boxShadow: `0 0 16px ${C.cyan}55` }}>
              Abrir BeZhas Pay
            </button>
            <button onClick={() => openBuyBez()}
              className="px-5 h-11 rounded-full text-sm font-semibold active:scale-95 transition"
              style={{ color: C.cyan, border: `1px solid ${C.cyan}`, background: 'transparent' }}>
              Comprar BEZ
            </button>
          </div>
        </div>
      </Glass>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Zap, t: 'Settlement instantáneo', d: 'Liquidez inmediata entre socios del ecosistema.' },
          { icon: ShieldCheck, t: 'Quality Escrow', d: 'Garantía por calidad en pagos de servicios B2B.' },
          { icon: Coins, t: 'Gas reducido', d: 'BEZ-Token paga las operaciones a coste mínimo.' },
        ].map(({ icon: Icon, t, d }) => (
          <Glass key={t} className="p-5 flex flex-col gap-2">
            <Icon size={20} style={{ color: C.cyan }} />
            <h3 className="text-base font-semibold" style={{ color: C.text }}>{t}</h3>
            <p className="text-sm" style={{ color: C.dim }}>{d}</p>
          </Glass>
        ))}
      </div>

      <Glass className="p-5 flex flex-col gap-3">
        <h3 className="text-sm uppercase tracking-[0.2em]" style={{ ...mono, color: C.dim }}>Acceso rápido</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => open({ href: '/buy-tokens', external: false })} className="h-11 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ color: C.text, border: `1px solid ${C.border}` }}><Wallet size={15} /> Buy Tokens</button>
          <button onClick={() => open({ href: '/rwa', external: false })} className="h-11 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ color: C.text, border: `1px solid ${C.border}` }}><Activity size={15} /> RWA Market</button>
        </div>
      </Glass>
    </div>
  );
}

// =============================================================================
// VISTA · FEED & CONTACTO
// =============================================================================
function FeedView() {
  const open = useOpen();
  const [copied, setCopied] = useState(false);
  const copyEmail = () => {
    navigator.clipboard?.writeText(CONTACT.email).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[30px] font-extrabold text-white tracking-tight">Network Feed</h2>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold" style={{ ...mono, color: C.emerald, background: `${C.emerald}1a`, border: `1px solid ${C.emerald}4d` }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.emerald }} /> SYNCED
        </span>
      </div>

      {NETWORK_FEED.map((e) => {
        const tone = e.tone === 'orange' ? C.orange : C.cyan;
        const Icon = e.icon === 'alert' ? Activity : e.icon === 'sync' ? Server : CheckCircle2;
        return (
          <Glass key={e.id} className="p-4 flex gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${tone}1a`, color: tone, border: `1px solid ${tone}33` }}>
              <Icon size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold" style={{ color: C.text }}>{e.title}</h4>
                <span className="text-[10px]" style={{ ...mono, color: C.dim }}>{e.when}</span>
              </div>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: C.dim }}>{e.body}</p>
              {e.hash && (
                <code className="inline-block mt-2 px-2 py-1 rounded-md text-[11px]" style={{ ...mono, color: C.cyan, background: 'rgba(0,240,255,0.08)' }}>TX_HASH: {e.hash}</code>
              )}
            </div>
          </Glass>
        );
      })}

      {/* Network health */}
      <Glass className="p-5">
        <h3 className="text-[12px] uppercase tracking-[0.2em] mb-4" style={{ ...mono, color: C.dim }}>Network Health</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px]" style={{ ...mono, color: C.dim }}>ACTIVE NODES</p>
            <p className="text-2xl font-bold" style={{ color: C.text }}>{NETWORK_HEALTH.activeNodes}</p>
          </div>
          <div>
            <p className="text-[10px]" style={{ ...mono, color: C.dim }}>TPS</p>
            <p className="text-2xl font-bold" style={{ color: C.cyan }}>{NETWORK_HEALTH.tps}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px]" style={{ ...mono, color: C.dim }}>UPTIME</p>
            <p className="text-2xl font-bold mb-2" style={{ color: C.emerald }}>{NETWORK_HEALTH.uptime}</p>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(49,57,77,0.5)' }}>
              <div className="h-full rounded-full" style={{ width: '99.9%', background: `linear-gradient(90deg, ${C.cyan}, ${C.emerald})`, boxShadow: `0 0 10px ${C.cyan}` }} />
            </div>
          </div>
        </div>
      </Glass>

      {/* Contacto directo */}
      <Glass className="p-5 flex flex-col gap-3">
        <h3 className="text-[12px] uppercase tracking-[0.2em]" style={{ ...mono, color: C.dim }}>Direct Comms</h3>
        <button onClick={copyEmail} className="flex items-center justify-between gap-2 h-12 px-4 rounded-full" style={{ background: 'rgba(23,31,51,0.6)', border: `1px solid ${C.border}` }}>
          <span className="flex items-center gap-2 text-sm" style={{ color: C.text }}><Mail size={16} style={{ color: C.cyan }} /> {CONTACT.email}</span>
          <span className="flex items-center gap-1 text-[11px]" style={{ ...mono, color: copied ? C.emerald : C.dim }}><Copy size={13} /> {copied ? 'Copiado' : 'Copiar'}</span>
        </button>
        <div className="flex items-center justify-between gap-2 h-12 px-4 rounded-full" style={{ background: 'rgba(23,31,51,0.6)', border: `1px solid ${C.border}` }}>
          <span className="flex items-center gap-2 text-sm" style={{ color: C.text }}><Send size={16} style={{ color: C.cyan }} /> {CONTACT.social}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ ...mono, color: C.emerald, background: `${C.emerald}1a` }}>Fastest</span>
        </div>
        <button onClick={() => open({ href: CONTACT.supportHref, external: false })}
          className="h-12 rounded-full text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
          style={{ background: C.cyan, color: '#00363a', boxShadow: `0 0 16px ${C.cyan}55` }}>
          <LifeBuoy size={16} /> Acceder al módulo de soporte
        </button>
      </Glass>
    </div>
  );
}

// =============================================================================
// SHELL + NAVEGACIÓN
// =============================================================================
const TABS = [
  { id: 'feed', label: 'Feed', icon: Rss },
  { id: 'hub', label: 'Hub', icon: LayoutGrid },
  { id: 'pay', label: 'BEZ-Pay', icon: CreditCard },
  { id: 'support', label: 'Support', icon: LifeBuoy },
];

export default function IntegratedServicePortal() {
  const [tab, setTab] = useState('hub');
  const [showPlans, setShowPlans] = useState(false);
  const navigate = useNavigate();

  const goPlans = () => { setShowPlans(true); setTab('hub'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const selectTab = (id) => {
    setShowPlans(false);
    if (id === 'support') { navigate('/docs'); return; }
    setTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const view = showPlans ? 'plans' : tab;

  return (
    <div className="min-h-screen pt-20 pb-28" style={{ background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Fuentes Cyber-Pipeline */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');`}</style>
      {/* Fondo de flujo */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: `radial-gradient(circle at top left, ${C.cyan}0d, transparent 50%), radial-gradient(circle at bottom right, ${C.emerald}0d, transparent 50%)` }} />

      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 flex items-center justify-between px-5 backdrop-blur-xl"
        style={{ background: 'rgba(19,27,46,0.6)', borderBottom: `1px solid ${C.border}`, boxShadow: `0 0 12px ${C.cyan}1a` }}>
        <button onClick={() => { setTab('hub'); setShowPlans(false); }} className="flex items-center gap-2" style={{ color: C.cyan }}>
          <NetIcon size={22} />
          <span className="text-lg font-bold tracking-tight">BeZhas-Hub</span>
        </button>
        <button onClick={() => navigate('/developer-console')}
          className="px-4 py-2 rounded-full text-[11px] font-medium transition active:scale-95"
          style={{ ...mono, color: C.cyan, border: `1px solid ${C.cyan}`, boxShadow: `0 0 10px ${C.cyan}33` }}>
          Dev Portal
        </button>
      </header>

      {/* Contenido */}
      <main className="relative z-10 max-w-5xl mx-auto px-5 pt-6">
        {view === 'hub' && <HubView onGoPlans={goPlans} />}
        {view === 'services' && <ServicesView />}
        {view === 'plans' && <PlansView />}
        {view === 'pay' && <PayView />}
        {view === 'feed' && <FeedView />}
      </main>

      {/* Acceso a Services Matrix (flotante, contextual al Hub) */}
      {view === 'hub' && (
        <button onClick={() => { setShowPlans(false); setTab('services'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="fixed right-5 bottom-28 z-40 px-4 h-11 rounded-full text-sm font-bold flex items-center gap-2 active:scale-95 transition"
          style={{ background: C.cyan, color: '#00363a', boxShadow: `0 0 18px ${C.cyan}66` }}>
          <Server size={16} /> Servicios
        </button>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-50 h-20 flex justify-around items-center px-4 backdrop-blur-2xl rounded-t-2xl"
        style={{ background: 'rgba(45,52,73,0.8)', borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 20px rgba(0,0,0,0.4)' }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = !showPlans && tab === id;
          return (
            <button key={id} onClick={() => selectTab(id)}
              className="flex flex-col items-center justify-center w-16 h-14 rounded-xl transition active:scale-90"
              style={active ? { color: C.cyan, background: `${C.cyan}1a`, border: `1px solid ${C.cyan}33`, boxShadow: `0 0 15px ${C.cyan}1a` } : { color: C.dim }}>
              <Icon size={20} />
              <span className="text-[10px] mt-1 font-bold" style={mono}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
