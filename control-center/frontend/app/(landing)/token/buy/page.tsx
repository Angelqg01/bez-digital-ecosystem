'use client';

import Link from 'next/link';
import { useState } from 'react';
import { STRIPE_PAYMENT_LINKS } from '@/lib/stripe-payment-links';

// ── Precio fijo del token ────────────────────────────────────────────────────
const BEZ_PRICE_USD = 0.0075;     // precio por 1 BEZ-Coin
const BEZ_ADDRESS_POLYGON = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

// ── Packs de venta directa ───────────────────────────────────────────────────
const PACKS = [
  {
    id: 'starter',
    label: 'Pack Starter',
    bezAmount: 13_333,
    usdAmount: 100,
    stripeLink: STRIPE_PAYMENT_LINKS.starter,
    audience: 'crypto',
    badge: null,
    perks: ['13.333 BEZ-Coin', 'Acceso dashboard DeFi', 'Staking desde día 1'],
  },
  {
    id: 'pro',
    label: 'Pack Pro',
    bezAmount: 73_333,
    usdAmount: 550,
    stripeLink: STRIPE_PAYMENT_LINKS.pro,
    audience: 'crypto',
    badge: 'Popular',
    perks: ['73.333 BEZ-Coin', '+10% bonus tokens', 'Acceso BeZhas Vision Scan', 'Priority support'],
  },
  {
    id: 'enterprise',
    label: 'Pack Enterprise',
    bezAmount: 266_667,
    usdAmount: 2_000,
    stripeLink: STRIPE_PAYMENT_LINKS.enterprise,
    audience: 'empresa',
    badge: 'B2B',
    perks: [
      '266.667 BEZ-Coin',
      '+15% bonus tokens',
      'SDK B2B licencia anual',
      'Integración CargoLink / PureScan',
      'Manager asignado',
      'Factura válida para AEAT',
    ],
  },
  {
    id: 'tokenPurchase',
    label: 'Compra libre',
    bezAmount: null,
    usdAmount: null,
    stripeLink: STRIPE_PAYMENT_LINKS.tokenPurchase,
    audience: 'crypto',
    badge: 'Flexible',
    perks: ['Tú eliges el importe', 'Entrega según tipo de cambio fijo', 'Recibo automático'],
  },
] as const;

const FOUNDING = [
  {
    id: 'foundingPartner',
    label: 'Founding Partner',
    stripeLink: STRIPE_PAYMENT_LINKS.foundingPartner,
    desc: 'Acceso a DAO + validador + comisión perpetua sobre red',
    badge: '⭐ Limitado',
  },
  {
    id: 'architect',
    label: 'Network Architect',
    stripeLink: STRIPE_PAYMENT_LINKS.architect,
    desc: 'Nodo edge + reparto de gas fees + acceso early features',
    badge: '🔧',
  },
];

type Tab = 'crypto' | 'empresa';

export default function BuyTokenPage() {
  const [tab, setTab] = useState<Tab>('crypto');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(BEZ_ADDRESS_POLYGON);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const packs = PACKS.filter(p => p.audience === tab || p.audience === 'crypto');
  const empresaPacks = PACKS.filter(p => p.audience === 'empresa' || p.id === 'tokenPurchase');

  return (
    <main className="min-h-screen bg-[#0A0E1A] text-white px-4 py-16">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-mono text-cyan-400 border border-cyan-400/30 rounded-full mb-4">
            VENTA DIRECTA · PRECIO FIJO
          </span>
          <h1 className="text-4xl font-bold font-['Syne'] mb-3">
            Compra <span className="text-cyan-400">BEZ-Coin</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Precio fijo: <span className="text-white font-semibold">${BEZ_PRICE_USD} USD / BEZ</span> · Pago con tarjeta, SEPA o cripto · Entrega en 24–48h
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-[#111827] border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setTab('crypto')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'crypto'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              💎 Crypto / Inversores
            </button>
            <button
              onClick={() => setTab('empresa')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'empresa'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🏢 Empresas B2B
            </button>
          </div>
        </div>

        {/* ── TAB CRYPTO ─────────────────────────────────────────────────── */}
        {tab === 'crypto' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
              {PACKS.filter(p => p.id !== 'enterprise').map(pack => (
                <PackCard key={pack.id} pack={pack} accentColor="cyan" />
              ))}
            </div>

            {/* Founding roles */}
            <div className="mb-10">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 text-center">Roles Fundadores — Cupos limitados</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FOUNDING.map(f => (
                  <a
                    key={f.id}
                    href={f.stripeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-white/10 rounded-xl p-5 hover:border-cyan-400/40 hover:bg-white/5 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-white group-hover:text-cyan-300">{f.label}</span>
                      <span className="text-xs px-2 py-0.5 bg-cyan-400/10 text-cyan-400 rounded-full">{f.badge}</span>
                    </div>
                    <p className="text-sm text-gray-400">{f.desc}</p>
                    <p className="text-xs text-cyan-400 mt-3 group-hover:underline">Reservar plaza →</p>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── TAB EMPRESA ────────────────────────────────────────────────── */}
        {tab === 'empresa' && (
          <>
            <div className="bg-violet-500/10 border border-violet-400/20 rounded-xl p-5 mb-8 text-sm text-violet-200">
              <strong className="text-violet-300">Para empresas:</strong> BEZ-Coin es el activo de utilidad de la red BeZhas. Lo usas para gas fees, liquidaciones automáticas entre proveedores, escrow de entregas y acceso al SDK B2B. Factura válida para AEAT. Sin blockchain en la propuesta comercial.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
              {empresaPacks.map(pack => (
                <PackCard key={pack.id} pack={pack} accentColor="violet" />
              ))}
            </div>

            {/* CTA contacto empresa */}
            <div className="text-center border border-white/10 rounded-xl p-8">
              <p className="text-gray-400 mb-2">¿Necesitas un volumen personalizado o integración técnica?</p>
              <p className="text-white font-semibold mb-4">Contacta con nuestro equipo comercial</p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="mailto:info.angelqg@gmail.com?subject=Compra BEZ-Coin Enterprise"
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  📧 Email comercial
                </a>
                <a
                  href="https://t.me/BeZhasBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 border border-violet-400/30 text-violet-300 hover:bg-violet-500/10 rounded-lg text-sm font-semibold transition-colors"
                >
                  ✉️ Telegram
                </a>
              </div>
            </div>
          </>
        )}

        {/* ── Proceso de entrega ─────────────────────────────────────────── */}
        <div className="mt-14 border border-white/10 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-5">Cómo funciona</h2>
          <ol className="space-y-4">
            {[
              { n: '01', title: 'Elige tu pack y paga', desc: 'Tarjeta, SEPA o transferencia. Stripe procesa el pago de forma segura.' },
              { n: '02', title: 'Envíanos tu wallet Polygon', desc: 'Por email o Telegram tras el pago. Asegúrate de que la wallet soporta tokens ERC-20.' },
              { n: '03', title: 'Recibes tus BEZ-Coin', desc: 'Transferencia directa desde el Treasury DAO en 24–48h hábiles. Confirmación por Telegram.' },
              { n: '04', title: 'Activa staking (opcional)', desc: 'Con tu wallet conectada en bez.digital accedes a staking, farming y gobernanza DAO desde el primer día.' },
            ].map(step => (
              <li key={step.n} className="flex gap-4 items-start">
                <span className="text-cyan-400 font-mono text-lg font-bold w-8 shrink-0">{step.n}</span>
                <div>
                  <p className="font-semibold text-white text-sm">{step.title}</p>
                  <p className="text-gray-400 text-sm">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Contrato */}
        <div className="mt-8 p-4 bg-[#111827] rounded-xl flex items-center gap-3 border border-white/10">
          <span className="text-xs text-gray-500 font-mono shrink-0">Contrato Polygon:</span>
          <code className="text-xs text-cyan-300 font-mono flex-1 truncate">{BEZ_ADDRESS_POLYGON}</code>
          <button
            onClick={handleCopy}
            className="text-xs text-gray-400 hover:text-white shrink-0 transition-colors"
          >
            {copied ? '✅ Copiado' : '📋 Copiar'}
          </button>
          <a
            href={`https://polygonscan.com/token/${BEZ_ADDRESS_POLYGON}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:underline shrink-0"
          >
            Polygonscan →
          </a>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-600 mt-8">
          BEZ-Coin es un token de utilidad. No constituye oferta de inversión ni producto financiero. · Cumplimiento MiCA UE · Precio fijo sin garantía de revalorización.
        </p>

        <div className="flex justify-center gap-6 mt-6">
          <Link href="/token" className="text-sm text-gray-400 hover:text-white">← Token info</Link>
          <Link href="/financial" className="text-sm text-gray-400 hover:text-white">Tokenomics →</Link>
          <Link href="/dashboard/wallet" className="text-sm text-gray-400 hover:text-white">Mi wallet →</Link>
        </div>
      </div>
    </main>
  );
}

// ── Componente PackCard ──────────────────────────────────────────────────────
function PackCard({
  pack,
  accentColor,
}: {
  pack: (typeof PACKS)[number];
  accentColor: 'cyan' | 'violet';
}) {
  const accent = accentColor === 'cyan' ? 'cyan' : 'violet';
  const accentClasses = {
    cyan: {
      border: 'border-cyan-400/20 hover:border-cyan-400/50',
      badge: 'bg-cyan-400/10 text-cyan-400',
      btn: 'bg-cyan-500 hover:bg-cyan-400 text-black',
      price: 'text-cyan-300',
    },
    violet: {
      border: 'border-violet-400/20 hover:border-violet-400/50',
      badge: 'bg-violet-400/10 text-violet-400',
      btn: 'bg-violet-600 hover:bg-violet-500 text-white',
      price: 'text-violet-300',
    },
  }[accent];

  return (
    <div className={`relative border rounded-2xl p-6 bg-[#111827] transition-all hover:bg-white/5 ${accentClasses.border}`}>
      {pack.badge && (
        <span className={`absolute top-4 right-4 text-xs px-2 py-0.5 rounded-full font-semibold ${accentClasses.badge}`}>
          {pack.badge}
        </span>
      )}

      <p className="text-sm text-gray-400 mb-1">{pack.label}</p>

      {pack.bezAmount ? (
        <p className={`text-3xl font-bold font-mono mb-1 ${accentClasses.price}`}>
          {pack.bezAmount.toLocaleString()} <span className="text-lg">BEZ</span>
        </p>
      ) : (
        <p className={`text-3xl font-bold font-mono mb-1 ${accentClasses.price}`}>Libre</p>
      )}

      {pack.usdAmount && (
        <p className="text-sm text-gray-500 mb-4">${pack.usdAmount} USD · ${BEZ_PRICE_USD}/BEZ</p>
      )}

      <ul className="space-y-1.5 mb-6">
        {pack.perks.map(perk => (
          <li key={perk} className="text-sm text-gray-300 flex items-center gap-2">
            <span className={`text-xs ${accentClasses.price}`}>✓</span> {perk}
          </li>
        ))}
      </ul>

      <a
        href={pack.stripeLink}
        target="_blank"
        rel="noopener noreferrer"
        className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-colors ${accentClasses.btn}`}
      >
        Comprar con Stripe →
      </a>
    </div>
  );
}
