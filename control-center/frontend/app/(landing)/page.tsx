'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { STRIPE_PAYMENT_LINKS } from '@/lib/stripe-payment-links';
import { useOracleTokenPrices } from '@/lib/public-hooks';

const BEZ_POLYGON_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const BEZ_POLYGONSCAN_URL = `https://polygonscan.com/token/${BEZ_POLYGON_ADDRESS}`;
const DEFI_TOKENOMICS_URL = process.env.NEXT_PUBLIC_BEZHAS_DEFI_URL || '/financial';

const networkStats = [
  { label: 'Demo', value: 'Read-only', detail: 'Vista cliente sin GCP' },
  { label: 'Flujos', value: '2', detail: 'Aduanas y terminales' },
  { label: 'Contactos', value: '6+', detail: 'Feed desde outreach reciente' },
  { label: 'Estado', value: 'HITL', detail: 'Envios sensibles con aprobacion' },
];

const ecosystemCards = [
  {
    href: '/commerce',
    icon: 'local_shipping',
    title: 'Logistica tokenizada',
    desc: 'Trazabilidad, liquidacion y pruebas de entrega conectadas a contratos inteligentes.',
    accent: 'cyan',
  },
  {
    href: '/network',
    icon: 'psychology',
    title: 'AI Oracles',
    desc: 'Validacion de sensores, rutas, inventarios y riesgo operativo en tiempo real.',
    accent: 'violet',
  },
  {
    href: '/enterprise',
    icon: 'domain',
    title: 'Activos reales',
    desc: 'Hubs industriales, almacenes y maquinaria listos para modelos RWA y B2B.',
    accent: 'rose',
  },
  {
    href: '/validators',
    icon: 'verified_user',
    title: 'Red y validadores',
    desc: 'Gobernanza, nodos, RPC y seguridad para la infraestructura del protocolo.',
    accent: 'emerald',
  },
];

const audienceTracks = [
  { title: 'Empresas', text: 'Integra pagos, documentacion y auditoria de cadena de suministro.', href: '/enterprise', icon: 'business' },
  { title: 'Developers', text: 'SDKs, APIs, RPC y guias para construir sobre BeZhas.', href: '/developers', icon: 'code' },
  { title: 'Comunidad', text: 'Soporte, FAQ, Telegram, Discord y recursos de aprendizaje.', href: '/support', icon: 'groups' },
];

const liveFeed = [
  { tag: 'Demo', title: 'Control Center read-only para clientes', href: '/demo', meta: 'Sin GCP ni nodo real' },
  { tag: 'Outreach', title: 'Terminal Link TX y PSA Antwerp contactados', href: '/demo', meta: 'Smart Escrow operativo' },
  { tag: 'HITL', title: 'DP World y MPET en revision humana', href: '/demo', meta: 'Cuentas grandes / alias generico' },
  { tag: 'Docs', title: 'Flujos piloto de aduanas y terminales', href: '/enterprise', meta: 'Trazabilidad + integracion' },
];

const contactLinks = [
  { label: 'Demo clientes', href: '/demo', icon: 'dashboard_customize' },
  { label: 'Email comercial', href: 'mailto:info.angelqg@gmail.com', icon: 'mail' },
  { label: 'Deck Enterprise', href: 'https://drive.google.com/file/d/10M3q1iUC_vbu8XaCvOGFKg6OYWuKrKQt/view', icon: 'slideshow' },
  { label: 'Telegram', href: 'https://t.me/BeZhasBot', icon: 'send' },
];

const tokenMarkets = [
  {
    symbol: 'BEZ-COIN',
    name: 'Polygon mainnet',
    source: 'Oraculo BEZ',
    chain: 'Polygon 137',
  },
  {
    symbol: 'BEZ-CoinV2',
    name: 'Token canonico L2',
    source: 'Oraculo V2',
    chain: 'BeZhas L2',
  },
];

const subApps = [
  {
    name: 'BeZhas-Hub',
    status: 'Creada',
    href: '/dashboard',
    docsHref: '/developers#hub',
    icon: 'apps',
    label: 'Centro social y marketplace',
    desc: 'Portal consumer de BeZhas para perfiles, comunidad, comercio, contenido, experiencia VIP y entrada publica al ecosistema.',
  },
  {
    name: 'BeZhas-DeFi',
    status: 'Creada',
    href: '/dashboard/farming',
    docsHref: '/developers#defi',
    icon: 'account_balance',
    label: 'Finanzas Web3',
    desc: 'Aplicacion para staking, farming, bridge, wallet, DAO, liquidez y servicios financieros conectados al token BEZ.',
  },
  {
    name: 'BeZhas Vision Scan',
    status: 'Integrada',
    href: '/dashboard/qr',
    docsHref: '/developers#vision',
    icon: 'qr_code_scanner',
    label: 'IA, Visión y Trazabilidad Logística',
    desc: 'Aplicación unificada para escaneo con LIDAR, firmas SIFT, Oráculos de IA y tokenización automática de activos RWA inmutables.',
  },
];

// Apps secundarias del ecosistema con enlace directo a su propia SubApp (subdominios bez.digital).
// Para cambiar un destino, edita solo el campo `href` de la tarjeta correspondiente.
const secondaryApps = [
  {
    name: 'BeZhas-Hub',
    status: 'Online',
    href: 'https://bezhas-hub-o5xep6gbwq-ew.a.run.app',
    icon: 'hub',
    label: 'Centro social y marketplace',
    desc: 'Portal consumer del ecosistema: perfiles, comunidad, comercio, contenido y experiencia VIP. La puerta de entrada publica a BeZhas.',
  },
  {
    name: 'BeZhas-DeFi',
    status: 'Online',
    href: 'https://bezhas-capital-o5xep6gbwq-ew.a.run.app/defi',
    icon: 'account_balance',
    label: 'Finanzas Web3',
    desc: 'Suite financiera descentralizada: staking, farming, bridge, wallet, DAO y liquidez conectadas al token BEZ.',
  },
  {
    name: 'BZ PureScan',
    status: 'Online',
    href: 'https://bezhas-purescan-o5xep6gbwq-ew.a.run.app',
    icon: 'document_scanner',
    label: 'IA, vision y trazabilidad',
    desc: 'Verificacion con IA y vision artificial: escaneo, firmas SIFT, Food Oracle y gemelos digitales de activos RWA inmutables.',
  },
  {
    name: 'BEZ-Energy',
    status: 'Online',
    href: 'https://bezhas-energy-o5xep6gbwq-ew.a.run.app',
    icon: 'bolt',
    label: 'Energia y RWA verde',
    desc: 'Tokenizacion energetica: certificados CAE, creditos de carbono, oraculos ESG y mercados P2P de energia on-chain.',
  },
  {
    name: 'BZ-CargoLink',
    status: 'Online',
    href: 'https://bezhas-cargolink-o5xep6gbwq-ew.a.run.app',
    icon: 'local_shipping',
    label: 'Logistica y aduanas',
    desc: 'Logistica y aduanas on-chain: tracking de cargas, NFTs de envio, escrow de entrega y despacho aduanero verificable.',
  },
];

const accentClasses: Record<string, string> = {
  cyan: 'border-cyan-400/20 text-cyan-300 shadow-cyan-950/20',
  violet: 'border-violet-400/20 text-violet-300 shadow-violet-950/20',
  rose: 'border-rose-400/20 text-rose-300 shadow-rose-950/20',
  emerald: 'border-emerald-400/20 text-emerald-300 shadow-emerald-950/20',
};

type OracleTokenRecord = {
  priceUSD?: number | string;
  usd?: number | string;
  price?: number | string;
  change24h?: number | string;
  updatedAt?: string;
  source?: string;
};

const toOracleNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.replace('$', '').replace(',', '').trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readOracleToken = (payload: any, keys: string[]): OracleTokenRecord | undefined => {
  const pools = [
    payload?.tokens,
    payload?.data?.tokens,
    payload?.prices,
    payload?.data?.prices,
    payload?.oracle?.tokens,
    payload,
    payload?.data,
  ];

  for (const pool of pools) {
    for (const key of keys) {
      const token = pool?.[key];
      if (token) return typeof token === 'object' ? token : { priceUSD: token };
    }
  }

  return undefined;
};

export default function Home() {
  const { data: oraclePrices } = useOracleTokenPrices();
  const bezOracle = readOracleToken(oraclePrices, ['BEZ-COIN', 'BEZCoin', 'BEZ_COIN', 'BEZ']);
  const v2Oracle = readOracleToken(oraclePrices, ['BEZ-CoinV2', 'BEZCoinV2', 'BEZ_COIN_V2', 'BEZV2']);
  const bezPrice = toOracleNumber(bezOracle?.priceUSD ?? bezOracle?.usd ?? bezOracle?.price ?? oraclePrices?.bezCoinPriceUSD ?? oraclePrices?.priceUSD);
  const bezChange = toOracleNumber(bezOracle?.change24h ?? oraclePrices?.bezCoinChange24h);
  const v2Price = toOracleNumber(v2Oracle?.priceUSD ?? v2Oracle?.usd ?? v2Oracle?.price);
  const bezPriceLabel = typeof bezPrice === 'number' ? `$${bezPrice.toFixed(3)}` : 'Oraculo pendiente';
  const bezChangeLabel = typeof bezChange === 'number' ? `${bezChange >= 0 ? '+' : ''}${bezChange.toFixed(1)}%` : 'Fuente Oracle';
  const v2PriceLabel = typeof v2Price === 'number' ? `$${v2Price.toFixed(3)}` : 'Pre-mainnet';
  const v2ChangeLabel = typeof v2Price === 'number' ? 'Oracle V2' : 'Sin precio activo';

  const [subAppsList, setSubAppsList] = useState(subApps);

  useEffect(() => {
    // Commented out local Vite bypasses to enforce unified portal routes across all environments.
    /*
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      setSubAppsList([
        {
          ...subApps[0],
          href: 'http://127.0.0.1:5173',
        },
        {
          ...subApps[1],
          href: 'http://127.0.0.1:5174',
        },
        {
          ...subApps[2],
          href: 'http://127.0.0.1:3013',
        },
      ]);
    }
    */
  }, []);

  return (
    <div className="space-y-20 pb-12">
      <section className="relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#050711]">
        <div className="absolute inset-0">
          <img
            className="h-full w-full object-cover opacity-40"
            data-alt="Futuristic industrial port with digital supply chain network overlays"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCe7rwgyLLBz4KfQKDEEit7pU8jhZDPOHSNsqjPs4f8oU_MJGkLKGeQKSmKZpur-HyRosnxS5fqygVDJV0Or1goEP-cJHwwua78P0ZpY113IzwXTAS44H6aZAJ3n4-MkgRgi8t20t1vGnaGsYVeExmrwnukoXk3dSmjSjgdAb10mwxJxMrUdFaSEQCj6F_ZLu_vOgQ55kbi-W70G0_zwBfiPRBjktqMr94LlRn7gt8POzWL_xAZJEfEajWswHbSZLi7NuO6Z-xkodw"
            alt="Puerto industrial conectado por red BeZhas"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#050711_0%,rgba(5,7,17,0.82)_42%,rgba(5,7,17,0.35)_100%)]" />
          <div className="bezhas-grid absolute inset-0 opacity-45" />
          <div className="bezhas-scanline absolute inset-x-0 top-0 h-32" />
        </div>

        <div className="relative z-10 grid min-h-[calc(100vh-7rem)] items-center gap-10 px-6 py-12 lg:grid-cols-[1fr_440px] lg:px-14">
          <div className="max-w-4xl">
            <Link href="/token" className="mb-5 inline-flex items-center gap-3 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-amber-100 transition hover:border-amber-200/50 hover:bg-amber-300/15">
              <img src="/bezhas-token-logo.png" alt="BEZ-Coin token" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em]">Token BEZ · Mercado y migracion V2</span>
            </Link>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">Mainnet operativo · Chain 2708</span>
            </div>

            <h1 className="max-w-5xl text-5xl font-black uppercase leading-[0.92] tracking-normal text-white md:text-7xl lg:text-8xl">
              BeZhas conecta logistica, pagos y activos reales en Web3.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              Infraestructura B2B para cadenas de suministro globales: oraculos IA, trazabilidad industrial, tokenizacion RWA y liquidacion con BEZ-Coin.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/solutions" className="flex h-14 items-center justify-center rounded-lg bg-[#0d33f2] px-7 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(13,51,242,0.36)] transition hover:translate-y-[-2px] hover:brightness-110">
                Explorar ecosistema
              </Link>
              <a href={STRIPE_PAYMENT_LINKS.tokenPurchase} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-7 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-300/15">
                Comprar BEZ-Coin
              </a>
              <Link href="/docs" className="flex h-14 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-7 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10">
                Documentacion
              </Link>
            </div>
          </div>

          <div className="relative space-y-4">
            <div className="token-price-float relative overflow-hidden rounded-2xl border border-amber-300/25 bg-black/50 p-5 shadow-2xl shadow-amber-950/20 backdrop-blur-xl">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl" />
              <div className="relative z-10 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/bezhas-token-logo.png" alt="Logo token BEZ" className="h-14 w-14 rounded-full object-cover shadow-[0_0_28px_rgba(245,190,60,0.32)]" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200">Oracle price</p>
                    <h2 className="mt-1 text-xl font-black uppercase italic text-white">BEZ Oraculo</h2>
                  </div>
                </div>
                <span className="material-symbols-outlined text-amber-200">candlestick_chart</span>
              </div>
              <div className="relative z-10 grid gap-3">
                {tokenMarkets.map((token, index) => (
                  <Link key={token.symbol} href="/token" className="rounded-xl border border-white/10 bg-white/[0.05] p-4 transition hover:border-amber-200/40 hover:bg-white/[0.075]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{token.name}</p>
                        <h3 className="mt-2 text-lg font-black text-white">{token.symbol}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-amber-100">{index === 0 ? bezPriceLabel : v2PriceLabel}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">{index === 0 ? bezChangeLabel : v2ChangeLabel}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <span>{token.chain}</span>
                      <span>{token.source}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="relative rounded-2xl border border-white/10 bg-black/35 p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-slate-500">Network feed</p>
                <h2 className="mt-2 text-xl font-black uppercase italic text-white">Terminal BeZhas</h2>
              </div>
              <span className="material-symbols-outlined text-cyan-300">hub</span>
            </div>
            <div className="space-y-3">
              {networkStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{stat.label}</p>
                    <p className="text-lg font-black text-white">{stat.value}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {networkStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{stat.label}</p>
            <p className="mt-3 text-2xl font-black text-white">{stat.value}</p>
            <p className="mt-2 text-sm text-slate-400">{stat.detail}</p>
          </div>
        ))}
      </section>

      <section className="relative rounded-2xl border border-cyan-300/15 bg-[#07101a] p-6 shadow-2xl shadow-cyan-950/20 md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300">Venta directa Polygon</span>
            <h2 className="mt-4 text-3xl font-black uppercase italic text-white md:text-5xl">BEZ-Coin real en mainnet</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              Compra BEZ-Coin usando el contrato verificado actual en Polygon mientras BeZhas despliega sus modulos de red y tokenomics publicos.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Network</p>
                <p className="font-bold text-white">Polygon 137</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Token</p>
                <p className="font-bold text-white">BEZ-Coin</p>
              </div>
              <a href={BEZ_POLYGONSCAN_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:border-cyan-300/50">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Contrato</p>
                <p className="font-mono text-sm font-bold text-cyan-300">0xEcBa...11A8</p>
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-violet-300/20 bg-[#11091f] p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300">Tokenomics publico</p>
            <h3 className="mt-4 text-2xl font-black uppercase italic text-white">Liquidez, tesoreria y gobernanza</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              La informacion publica de staking, farming, liquidez y gobernanza vive en el modulo financiero informativo, sin exponer rutas de dashboard desde la home.
            </p>
            <Link href={DEFI_TOKENOMICS_URL} className="mt-8 flex h-12 items-center justify-center rounded-lg bg-violet-500 px-5 text-xs font-bold uppercase tracking-widest text-white hover:bg-violet-600">
              Ver tokenomics
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#0d33f2]">Core protocol</span>
            <h2 className="mt-4 text-4xl font-black uppercase italic text-white md:text-6xl">Ecosistema Chain-Flow</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-400">
            Un mapa de productos publicos para entender BeZhas sin entrar en paneles sensibles: red, comercio, activos reales, validadores y soporte.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {ecosystemCards.map((card) => (
            <Link key={card.href} href={card.href} className={`group min-h-72 rounded-xl border bg-white/[0.03] p-7 shadow-2xl transition hover:-translate-y-1 hover:bg-white/[0.055] ${accentClasses[card.accent]}`}>
              <span className="material-symbols-outlined text-4xl">{card.icon}</span>
              <h3 className="mt-8 text-2xl font-black uppercase italic text-white">{card.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-400">{card.desc}</p>
              <div className="mt-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-70 transition group-hover:opacity-100">
                Abrir <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-rose-300">Para quien es</span>
          <h2 className="mt-4 text-4xl font-black uppercase italic text-white">Tres caminos de entrada</h2>
          <p className="mt-5 text-sm leading-7 text-slate-400">
            La home debe convertir rapido: quien compra, quien construye y quien necesita soporte encuentran su siguiente paso sin pasar por dashboard.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {audienceTracks.map((track) => (
            <Link key={track.title} href={track.href} className="rounded-xl border border-white/10 bg-[#0b0d17] p-6 transition hover:border-cyan-300/30 hover:bg-white/[0.05]">
              <span className="material-symbols-outlined text-cyan-300">{track.icon}</span>
              <h3 className="mt-6 text-xl font-black uppercase italic text-white">{track.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{track.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#070913] p-6 md:p-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Que esta pasando</span>
            <h2 className="mt-4 text-4xl font-black uppercase italic text-white">Feed del ecosistema</h2>
          </div>
          <Link href="/support" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
            Contacto y soporte <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {liveFeed.map((item) => (
            <Link key={item.title} href={item.href} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#0d33f2]/40 hover:bg-white/[0.05]">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0d33f2]">{item.tag}</p>
              <h3 className="mt-4 text-lg font-black uppercase italic text-white">{item.title}</h3>
              <p className="mt-5 text-xs text-slate-500">{item.meta}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-8 rounded-2xl border border-[#0d33f2]/20 bg-gradient-to-br from-[#071022] to-[#050711] p-8 md:p-12 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#0d33f2]">Contacto</span>
          <h2 className="mt-4 text-4xl font-black uppercase italic text-white md:text-6xl">Construye, integra o pregunta.</h2>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
            Centralizamos los canales publicos para soporte, comunidad, partnerships e integraciones tecnicas.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {contactLinks.map((link) => (
            <a key={link.label} href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-5 text-white transition hover:border-cyan-300/40 hover:bg-white/[0.07]">
              <span className="text-sm font-black uppercase tracking-[0.18em]">{link.label}</span>
              <span className="material-symbols-outlined text-cyan-300">{link.icon}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#f5f7fb] p-6 text-[#050711] md:p-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,51,242,0.08),transparent_32%,rgba(245,190,60,0.16)_100%)]" />
        <div className="relative z-10 mb-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.32em] text-[#0d33f2]">SubApps BeZhas</span>
            <h2 className="mt-4 text-4xl font-black uppercase italic leading-none md:text-6xl">Creadas y en desarrollo</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">
            La capa publica se organiza en tres experiencias: Hub para comunidad y marketplace, DeFi para servicios financieros Web3, y Nexus para IA, trazabilidad y oraculos de datos verificables.
          </p>
        </div>

        <div className="relative z-10 grid gap-4 lg:grid-cols-3">
          {subAppsList.map((app) => (
            <div
              key={app.name}
              className="app-orbit-card group min-h-72 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#0d33f2]/30 hover:shadow-2xl hover:shadow-blue-950/10 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d33f2] text-white">
                    <span className="material-symbols-outlined">{app.icon}</span>
                  </div>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {app.status}
                  </span>
                </div>
                <p className="mt-7 text-[10px] font-black uppercase tracking-[0.24em] text-[#0d33f2]">{app.label}</p>
                <h3 className="mt-3 text-2xl font-black uppercase italic text-slate-950">{app.name}</h3>
                <p className="mt-4 text-sm leading-6 text-slate-600">{app.desc}</p>
              </div>

              <div className="mt-7 flex items-center justify-between">
                <Link
                  href={app.href}
                  className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950 hover:text-[#0d33f2]"
                >
                  Abrir App <span className="material-symbols-outlined text-sm transition group-hover:translate-x-1">arrow_forward</span>
                </Link>
                {app.docsHref && (
                  <Link
                    href={app.docsHref}
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#0d33f2] hover:underline"
                  >
                    API Docs <span className="material-symbols-outlined text-[12px]">link</span>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Galeria vertical auto-scroll de las SubApps secundarias (enlaces directos) */}
        <div className="relative z-10 mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#0d33f2]">Accesos directos</p>
              <h3 className="mt-1 text-2xl font-black uppercase italic text-slate-950 md:text-3xl">Galeria de SubApps</h3>
            </div>
            <span className="hidden items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 md:flex">
              <span className="material-symbols-outlined text-sm">pan_tool</span>
              Pasa el raton para pausar
            </span>
          </div>

          <div className="subapp-marquee group relative mx-auto h-[34rem] max-w-2xl overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-gradient-to-b from-[#f5f7fb] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-14 bg-gradient-to-t from-[#f5f7fb] to-transparent" />
            <div className="subapp-marquee-track flex flex-col gap-4">
              {[...secondaryApps, ...secondaryApps].map((app, index) => (
                <a
                  key={`${app.name}-${index}`}
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${app.name}`}
                  className="app-orbit-card group/card block min-h-[15rem] rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#0d33f2]/30 hover:shadow-2xl hover:shadow-blue-950/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d33f2] text-white">
                      <span className="material-symbols-outlined">{app.icon}</span>
                    </div>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {app.status}
                    </span>
                  </div>
                  <p className="mt-7 text-[10px] font-black uppercase tracking-[0.24em] text-[#0d33f2]">{app.label}</p>
                  <h3 className="mt-3 text-2xl font-black uppercase italic text-slate-950">{app.name}</h3>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{app.desc}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950 group-hover/card:text-[#0d33f2]">
                    Abrir App <span className="material-symbols-outlined text-sm transition group-hover/card:translate-x-1">arrow_forward</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-8 rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">Ruta de expansion</p>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            BeZhas Vision Scan (anteriormente Nexus/Scaner) ha sido unificada como una SubApp integral conectada directamente a los Smart Contracts. Esta capa se encarga del Food Oracle, firmas SIFT y gemelos digitales, mientras que Hub y DeFi mantienen separadas las experiencias consumer y financiera.
          </p>
        </div>
      </section>
    </div>
  );
}
