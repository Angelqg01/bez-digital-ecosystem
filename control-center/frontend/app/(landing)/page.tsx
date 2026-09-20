'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { STRIPE_PAYMENT_LINKS } from '@/lib/stripe-payment-links';
import { useOracleTokenPrices } from '@/lib/public-hooks';

import s from './home.module.css';
import Reveal from './_components/Reveal';
import ScrollProgress from './_components/ScrollProgress';
import NetworkTicker from './_components/NetworkTicker';
import AnchorPanel from './_components/AnchorPanel';
import EvidenceChain from './_components/EvidenceChain';
import StatGrid from './_components/StatGrid';
import VerticalProtocols from './_components/VerticalProtocols';
import SecurityControls from './_components/SecurityControls';
import IntegrationsWall from './_components/IntegrationsWall';
import OraclePanel from './_components/OraclePanel';
import ResourceCards from './_components/ResourceCards';
import HeroNetCanvas from './_components/HeroNetCanvas';
import DepartmentContact from './_components/DepartmentContact';
import { DEPARTMENT_CONTACTS } from '@/lib/contact-emails';
import {
    tickerItems,
    missionPills,
    aegisPills,
    chainSteps,
    chainStats,
    verticals,
    securityControls,
    securityStats,
    integrationGroups,
    tokenFacts,
    tokenUses,
    oracleContracts,
    resources,
    BEZ_POLYGON_ADDRESS,
} from './_components/home-content';

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
    title: 'Comercio internacional',
    desc: 'Puertos, aduanas y bancos leen la misma prueba. Trazabilidad y liquidacion instantanea sin ceder tus datos comerciales.',
  },
  {
    href: '/network',
    icon: 'psychology',
    title: 'Oraculos de IA privados',
    desc: 'Sensores, rutas, inventarios y riesgo operativo validados con confianza medible — sin exponer tus datos crudos a la cadena.',
  },
  {
    href: '/enterprise',
    icon: 'domain',
    title: 'Activos bajo tu llave',
    desc: 'Hubs, almacenes y maquinaria tokenizados como RWA. Tu tesoreria en MultiSig, tu firma, tu contrato — ningun custodio decide por ti.',
  },
  {
    href: '/validators',
    icon: 'verified_user',
    title: 'Red independiente',
    desc: 'Gobernanza, nodos, RPC y AEGIS operados en abierto. Ninguna empresa controla la red; ningun proveedor puede apagarla.',
  },
];

const audienceTracks = [
  { title: 'Empresas', text: 'Integra pagos, evidencia y auditoria de tu cadena internacional sin ceder datos ni exclusividad.', href: '/enterprise', icon: 'business' },
  { title: 'Developers', text: 'SDKs, APIs, RPC y guias para construir productos abiertos sobre BeZhas — codigo publico, contratos verificables.', href: '/developers', icon: 'code' },
  { title: 'Comunidad', text: 'Soporte humano, Telegram, Discord y documentacion abierta. La red es de todos: nadie es solo cliente.', href: '/support', icon: 'groups' },
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
    source: 'Venta directa · Fase 1',
    chain: 'Polygon 137',
  },
  {
    symbol: 'BEZ-CoinV2',
    name: 'Token canonico L2',
    source: 'Oraculo V2',
    chain: 'BeZhas L2',
  },
];

const nativeApps = [
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

// Apps secundarias del ecosistema con enlace directo a su propia App Nativa (subdominios bez.digital).
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
  // Precio definitivo de la fase semilla, confirmado por Yoel 2026-09-18
  // (api/config/bez-price.js). Este widget del hero muestra el precio de VENTA
  // — que es FIJO, no cotizacion —, asi que no depende del oraculo: el
  // OraclePanel de mas abajo si sigue leyendo mercados en vivo cuando existan.
  const bezPriceLabel = '$0.0075';
  const bezChangeLabel = 'Fase semilla · precio fijo';
  const v2PriceLabel = typeof v2Price === 'number' ? `$${v2Price.toFixed(3)}` : 'Pre-mainnet';
  const v2ChangeLabel = typeof v2Price === 'number' ? 'Oracle V2' : 'Sin precio activo';
  // El precio ya no depende de estos hooks; el linter los reclamaria si no se referencian.
  void bezPrice; void bezChange;

  const [nativeAppsList, setNativeAppsList] = useState(nativeApps);

  useEffect(() => {
    // Commented out local Vite bypasses to enforce unified portal routes across all environments.
    /*
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      setNativeAppsList([
        {
          ...nativeApps[0],
          href: 'http://127.0.0.1:5173',
        },
        {
          ...nativeApps[1],
          href: 'http://127.0.0.1:5174',
        },
        {
          ...nativeApps[2],
          href: 'http://127.0.0.1:3013',
        },
      ]);
    }
    */
  }, []);

  return (
    <div className={s.bzHome}>
      <ScrollProgress />

      {/* ═══ 1 · HERO — se mantiene oscuro en ambos temas: es la firma de marca ═══ */}
      <section className="relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#050711]">
        <div className="absolute inset-0">
          <img
            className="h-full w-full object-cover opacity-40"
            data-alt="Futuristic industrial port with digital supply chain network overlays"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCe7rwgyLLBz4KfQKDEEit7pU8jhZDPOHSNsqjPs4f8oU_MJGkLKGeQKSmKZpur-HyRosnxS5fqygVDJV0Or1goEP-cJHwwua78P0ZpY113IzwXTAS44H6aZAJ3n4-MkgRgi8t20t1vGnaGsYVeExmrwnukoXk3dSmjSjgdAb10mwxJxMrUdFaSEQCj6F_ZLu_vOgQ55kbi-W70G0_zwBfiPRBjktqMr94LlRn7gt8POzWL_xAZJEfEajWswHbSZLi7NuO6Z-xkodw"
            alt="Puerto industrial conectado por red BeZhas"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#050711_0%,rgba(5,7,17,0.82)_42%,rgba(5,7,17,0.35)_100%)]" />
          <HeroNetCanvas className="absolute inset-0 h-full w-full opacity-70" />
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
              Comercia sin ceder tus datos. Cobra sin pedir permiso.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              <b className="text-white">BeZhas es una red B2B firmada</b> que conecta tu ERP con puertos, aduanas,
              bancos y clientes de cualquier pais. Cada operacion se prueba con un hash — tus datos comerciales
              se quedan en casa, tu pago se libera cuando la contraparte acepta, y ningun intermediario decide
              por ti.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200/90">
              <span>Privacidad por diseno</span>
              <span className="text-white/30">·</span>
              <span>Seguridad AEGIS fail-closed</span>
              <span className="text-white/30">·</span>
              <span>Comercio internacional sin fronteras</span>
              <span className="text-white/30">·</span>
              <span>Independencia total</span>
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:info.angelqg@gmail.com?subject=BeZhas%20—%20Solicitar%20demo"
                className="flex h-14 items-center justify-center rounded-lg bg-[#0d33f2] px-7 text-xs font-black uppercase tracking-[0.18em] !text-white shadow-[0_0_28px_rgba(13,51,242,0.36)] transition hover:translate-y-[-2px] hover:brightness-110"
              >
                Solicitar demo
              </a>
              <a
                href={STRIPE_PAYMENT_LINKS.tokenPurchase}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 items-center justify-center rounded-lg bg-emerald-400 px-7 text-xs font-black uppercase tracking-[0.18em] text-[#052e1e] shadow-[0_0_28px_rgba(52,211,153,0.42)] transition hover:translate-y-[-2px] hover:bg-emerald-300"
              >
                Comprar BEZ-Coin
              </a>
              <Link
                href="/solutions"
                className="flex h-14 items-center justify-center rounded-lg bg-orange-400 px-7 text-xs font-black uppercase tracking-[0.18em] text-[#3a1a06] shadow-[0_0_24px_rgba(251,146,60,0.36)] transition hover:translate-y-[-2px] hover:bg-orange-300"
              >
                Explorar ecosistema
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200">Precio semilla · BEZ-Coin</p>
                    <h2 className="mt-1 text-xl font-black uppercase italic text-white">$0.0075 fijo</h2>
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

      {/* ═══ 2 · TICKER ═══ */}
      <NetworkTicker items={tickerItems} />

      {/* ═══ 3 · MISION — panel ancla ═══ */}
      <AnchorPanel title="Nuestra mision" pills={missionPills} art="port" bars={24} />

      <div className={s.anchorBody}>
        <div className={`${s.wrap} ${s.grid12}`}>
          <Reveal as="p" className={s.anchorKicker}>
            Nuestra mision
          </Reveal>
          <Reveal as="p" index={1} className={s.anchorStatement}>
            Que un contenedor, una factura, un lote farmaceutico o un kilovatio puedan demostrar por si
            mismos donde estuvieron y quien los firmo — sin depender de la palabra de ninguna de las
            partes.
          </Reveal>
        </div>
      </div>

      {/* ═══ 4 · EL PROBLEMA + esquema de atestacion ═══ */}
      <section className={`${s.slab} ${s.slabWhite}`}>
        <div className={`${s.wrap} ${s.grid12}`} style={{ alignItems: 'start' }}>
          <Reveal className={s.problemCol}>
            <p className={s.eyebrow}>El problema</p>
            <h2 className={`${s.secTitle} ${s.secTitleSm}`}>
              Ninguna empresa puede certificar su propia cadena.
            </h2>
            <p className={s.lede}>
              Hoy la trazabilidad vive dentro de cada ERP. Cuando aduanas, un auditor, una aseguradora o
              el comprador piden pruebas, cada parte presenta su propia version y alguien tiene que
              conciliarlas a mano. Eso cuesta dias, deja huecos y te obliga a ceder datos al intermediario
              que los concilie.
            </p>
            <p className={s.lede}>
              BeZhas no sustituye tu ERP: lo ancla. Cada evento sale por tu propio Edge Node, se anonimiza y
              aterriza en la cadena como un hash firmado. <b>Tu operacion no se mueve de casa; tu prueba se
              vuelve comun</b> — y cualquier contraparte, en cualquier pais, la lee sin negociar con nadie.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              <Link className={`${s.btn} ${s.btnSolid}`} href="/docs">
                Como funciona <span className={s.arw}>→</span>
              </Link>
              <Link className={`${s.btn} ${s.btnGhost}`} href="/validators">
                Ver AEGIS y privacidad
              </Link>
            </div>
          </Reveal>

          <Reveal index={1} className={s.attestCol}>
            <div className={s.attest}>
              <div className={s.attestBar}>
                <span className={s.dot} />
                Esquema de atestacion
                <span className={s.attestLive}>ejemplo ilustrativo</span>
              </div>
              <div className={s.attestBody}>
                <pre>
                  <span className={s.tc}>{'// lo unico que se escribe on-chain'}</span>
                  {'\n{\n  '}
                  <span className={s.tk}>&quot;protocol&quot;</span>
                  {': '}
                  <span className={s.ts}>&quot;logistics-global-kinetics&quot;</span>
                  {',\n  '}
                  <span className={s.tk}>&quot;event&quot;</span>
                  {': '}
                  <span className={s.ts}>&quot;customs.clearance&quot;</span>
                  {',\n  '}
                  <span className={s.tk}>&quot;evidenceHash&quot;</span>
                  {': '}
                  <span className={s.tv}>0x9f3c…a41b</span>
                  {',\n  '}
                  <span className={s.tk}>&quot;jurisdiction&quot;</span>
                  {': '}
                  <span className={s.ts}>&quot;ES-CA&quot;</span>
                  {',\n  '}
                  <span className={s.tk}>&quot;signer&quot;</span>
                  {': '}
                  <span className={s.tv}>0x4Bd2…77E0</span>
                  {',\n  '}
                  <span className={s.tk}>&quot;schema&quot;</span>
                  {': '}
                  <span className={s.ts}>&quot;v2.3&quot;</span>
                  {',\n  '}
                  <span className={s.tk}>&quot;freshness&quot;</span>
                  {': '}
                  <span className={s.tv}>900</span>
                  {' '}
                  <span className={s.tc}>{'// segundos'}</span>
                  {',\n  '}
                  <span className={s.tk}>&quot;confidence&quot;</span>
                  {': '}
                  <span className={s.tv}>0.97</span>
                  {'\n}\n'}
                  <span className={s.tc}>{'// factura, PII y ruta permanecen fuera de la cadena'}</span>
                </pre>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 5 · CADENA DE EVIDENCIA ═══ */}
      <section className={`${s.slab} ${s.slabPaper}`} id="arquitectura">
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={s.eyebrow}>Arquitectura compartida</p>
            <h2 className={s.secTitle}>La cadena de evidencia</h2>
            <p className={s.lede}>
              Seis pasos identicos para los siete sectores. Ningun dato regulado sale de tu casa, ningun
              intermediario se lleva un peaje, ninguna prueba depende de la palabra de una sola parte.
            </p>
          </Reveal>

          <EvidenceChain steps={chainSteps} />
          <StatGrid items={chainStats} light />
        </div>
      </section>

      {/* ═══ 6 · ECOSISTEMA CHAIN-FLOW (rutas internas existentes) ═══ */}
      <section className={`${s.slab} ${s.slabWhite}`}>
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={s.eyebrow}>Core protocol</p>
            <h2 className={s.secTitle}>Cuatro columnas, un solo estandar</h2>
            <p className={s.lede}>
              Comercio internacional firmado, oraculos de IA sin ceder datos, activos reales bajo tu llave
              y una red de validadores independiente. Cada pieza vale por si sola; juntas quitan al
              intermediario del medio.
            </p>
          </Reveal>

          <div className={s.verticals}>
            {ecosystemCards.map((card, i) => (
              <Reveal key={card.href} index={i}>
                <Link href={card.href} className={s.vcard} style={{ height: '100%' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 34, color: 'var(--accent)' }}>
                    {card.icon}
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                  <span className={s.vcardGo}>
                    Abrir <span className={s.arw}>→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7 · PROTOCOLOS VERTICALES ═══ */}
      <section className={`${s.slab} ${s.slabPaper}`} id="protocolos">
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={s.eyebrow}>Protocolos sectoriales</p>
            <h2 className={s.secTitle}>Siete industrias, una sola libertad</h2>
            <p className={s.lede}>
              Cada vertical llega con su mapa de contratos, sus actores, su oraculo y su suite de tests —
              listo para operar fuera de tu pais sin cambiar de plataforma. La privacidad y la firma
              son las mismas; lo que cambia son las reglas de tu sector.
            </p>
          </Reveal>

          <VerticalProtocols verticals={verticals} />
        </div>
      </section>

      {/* ═══ 8 · AEGIS — panel ancla ═══ */}
      <AnchorPanel title="AEGIS" pills={aegisPills} art="aegis" bars={30} />

      {/* ═══ 9 · EL PROTOCOLO FALLA CERRADO ═══ */}
      <section className={`${s.slab} ${s.slabDeep}`} id="seguridad">
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={`${s.eyebrow} ${s.onDark}`}>AEGIS · seguridad por diseno</p>
            <h2 className={`${s.secTitle} ${s.onDark}`}>El protocolo protege tu dinero</h2>
            <p className={`${s.lede} ${s.onDark}`}>
              Si un oraculo esta obsoleto o se contradice, el pago automatico se detiene y el caso pasa a
              revision humana. Preferimos una liquidacion bloqueada a una liquidacion equivocada — y
              preferimos que tu contraparte no cobre a costa de tu descuido.
            </p>
          </Reveal>

          <SecurityControls controls={securityControls} />
          <StatGrid items={securityStats} />
        </div>
      </section>

      {/* ═══ 10 · INTEGRACIONES ═══ */}
      <section className={`${s.slab} ${s.slabPaper}`} id="integraciones">
        <div className={s.wrap}>
          <div className={s.panel}>
            <Reveal className={s.secHead} style={{ marginBottom: 8 }}>
              <p className={s.eyebrow}>Interoperabilidad</p>
              <h2 className={`${s.secTitle} ${s.secTitleSm}`}>Tu operacion no cambia. Tu evidencia deja de estar sola.</h2>
              <p className={s.lede}>
                Universal Bridge API sobre tu ERP, nodos MCP dedicados para aislar los datos de cada cliente
                y puentes nativos a las redes donde ya tienes liquidez. Cambias de pais o de banco sin
                rehacer nada.
              </p>
            </Reveal>

            <IntegrationsWall groups={integrationGroups} />

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 40 }}>
              <Link className={`${s.btn} ${s.btnSolid}`} href="/bridges">
                Ver bridges <span className={s.arw}>→</span>
              </Link>
              <Link className={`${s.btn} ${s.btnGhost}`} href="/rpc">
                RPC y nodos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 11 · BEZ-COIN: ficha, usos y oraculo en vivo ═══ */}
      <section className={`${s.slab} ${s.slabWhite}`} id="token">
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={s.eyebrow}>BEZ-Coin</p>
            <h2 className={s.secTitle}>La llave del comercio libre</h2>
            <p className={s.lede}>
              BEZ-Coin es el combustible operativo de la red: paga el gas, liquida entre proveedores en
              cualquier pais, bloquea escrows sin banco intermediario y da voto en la gobernanza que
              decide como evoluciona el protocolo. No es un producto de inversion — es tu acceso a una
              infraestructura que ni tu ni tu contraparte controlan.
            </p>
          </Reveal>

          <div className={`${s.grid12} ${s.tokenGrid}`}>
            <Reveal as="dl" className={s.tokenFacts}>
              {tokenFacts.map(([dt, dd]) => (
                <div key={dt} className={s.tfact}>
                  <dt>{dt}</dt>
                  <dd>{dd}</dd>
                </div>
              ))}
            </Reveal>

            <Reveal index={1} className={s.tokenUse}>
              <p className={s.eyebrow}>Para que sirve dentro de la red</p>
              <ul className={s.uselist}>
                {tokenUses.map((use) => (
                  <li key={use.title}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>
                      <b>{use.title}</b> {use.text}
                    </span>
                  </li>
                ))}
              </ul>

              <div className={s.tokenActions}>
                <a
                  className={`${s.btn} ${s.btnSolid}`}
                  href={STRIPE_PAYMENT_LINKS.tokenPurchase}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Comprar BEZ-Coin <span className={s.arw}>→</span>
                </a>
                <Link className={`${s.btn} ${s.btnGhost}`} href={DEFI_TOKENOMICS_URL}>
                  Ver tokenomics
                </Link>
              </div>

              <div className={s.addr}>
                <span className={s.addrLbl}>Contrato Polygon</span>
                <code>{BEZ_POLYGON_ADDRESS}</code>
                <a
                  className={`${s.btn} ${s.btnGhost}`}
                  style={{ padding: '8px 16px', fontSize: 13 }}
                  href={BEZ_POLYGONSCAN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Polygonscan <span className={s.arw}>↗</span>
                </a>
              </div>
            </Reveal>
          </div>

          <OraclePanel contracts={oracleContracts} />
        </div>
      </section>

      {/* ═══ 12 · TRES CAMINOS DE ENTRADA ═══ */}
      <section className={`${s.slab} ${s.slabPaper}`}>
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={s.eyebrow}>Para quien es</p>
            <h2 className={s.secTitle}>Tres formas de entrar sin ataduras</h2>
            <p className={s.lede}>
              Si compras, si construyes o si necesitas soporte, el siguiente paso esta a un clic — sin
              onboarding forzoso, sin dependencia de un proveedor.
            </p>
          </Reveal>

          <div className={s.apps}>
            {audienceTracks.map((track, i) => (
              <Reveal key={track.title} index={i}>
                <Link href={track.href} className={s.app} style={{ height: '100%' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>
                    {track.icon}
                  </span>
                  <span className={s.appN}>{track.title}</span>
                  <span className={s.appD}>{track.text}</span>
                  <span className={s.appS}>
                    Entrar <span className={s.arw}>→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 13 · APLICACIONES SOBRE EL ESTANDAR (SubApps desplegadas) ═══ */}
      <section className={`${s.slab} ${s.slabWhite}`} id="ecosistema">
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={s.eyebrow}>Ecosistema</p>
            <h2 className={s.secTitle}>Aplicaciones ya en produccion</h2>
            <p className={s.lede}>
              Cinco aplicaciones desplegadas que comparten contratos, roles y politicas de privacidad. Lo
              que aprende una, lo hereda el resto — y todo lo que tocan es tuyo, no de la plataforma.
            </p>
          </Reveal>

          <div className={s.apps}>
            {secondaryApps.map((app, i) => (
              <Reveal key={app.name} index={i}>
                <a
                  className={s.app}
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${app.name}`}
                  style={{ height: '100%' }}
                >
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>
                    {app.icon}
                  </span>
                  <span className={s.appN}>{app.name}</span>
                  <span className={s.appD}>{app.desc}</span>
                  <span className={s.appS}>
                    <span className={s.pulse} />
                    {app.status === 'Online' ? 'En produccion' : app.status}
                  </span>
                </a>
              </Reveal>
            ))}
          </div>

          {/* Apps Nativas del portal unificado (rutas internas + API docs) */}
          <Reveal className={s.secHead} style={{ marginTop: 'clamp(48px, 6vw, 88px)', marginBottom: 24 }}>
            <p className={s.eyebrow}>App Nativas</p>
            <h2 className={`${s.secTitle} ${s.secTitleSm}`}>Tu portal, sin salir de la red</h2>
            <p className={s.lede}>
              Hub para comunidad y marketplace, DeFi para servicios financieros Web3, y Vision Scan para
              IA, trazabilidad y oraculos verificables — todo bajo la misma identidad, sin volver a ceder
              tus datos.
            </p>
          </Reveal>

          <div className={s.apps}>
            {nativeAppsList.map((app, i) => (
              <Reveal key={app.name} index={i}>
                <div className={s.app} style={{ height: '100%' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>
                    {app.icon}
                  </span>
                  <span className={s.appN}>{app.name}</span>
                  <span className={s.appD}>{app.desc}</span>
                  <span className={s.appS} style={{ gap: 16 }}>
                    <Link href={app.href} style={{ color: 'var(--accent)' }}>
                      Abrir App →
                    </Link>
                    {app.docsHref && (
                      <Link href={app.docsHref} style={{ color: 'var(--ink-3)' }}>
                        API Docs
                      </Link>
                    )}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 14 · FEED DEL ECOSISTEMA ═══ */}
      <section className={`${s.slab} ${s.slabPaper}`}>
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={s.eyebrow}>Que esta pasando</p>
            <h2 className={s.secTitle}>Movimiento real, evidencia publica</h2>
          </Reveal>

          <div className={s.res}>
            {liveFeed.map((item, i) => (
              <Reveal key={item.title} index={i}>
                <Link href={item.href} className={s.rcard} style={{ height: '100%' }}>
                  <span className={s.rcardType}>{item.tag}</span>
                  <h4>{item.title}</h4>
                  <p>{item.meta}</p>
                  <span className={s.rcardGo}>
                    Ver <span className={s.arw}>→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 15 · RECURSOS ═══ */}
      <section className={`${s.slab} ${s.slabWhite}`} id="recursos">
        <div className={s.wrap}>
          <Reveal className={s.secHead}>
            <p className={s.eyebrow}>Documentacion</p>
            <h2 className={s.secTitle}>Lee antes de firmar</h2>
          </Reveal>

          <ResourceCards resources={resources} />
        </div>
      </section>

      {/* ═══ 16 · CONTACTO / PILOTO ═══ */}
      <section className={`${s.slab} ${s.slabPaper}`} id="contacto">
        <div className={s.wrap}>
          <div className={s.panel}>
            <div className={`${s.grid12} ${s.ctaGrid}`}>
              <Reveal className={s.ctaCopy}>
                <p className={s.eyebrow}>Unete a la red</p>
                <h2 className={`${s.secTitle} ${s.secTitleSm}`}>
                  El comercio libre no se declara. Se firma.
                </h2>
                <p className={s.lede}>
                  Buscamos operadores logisticos, plantas industriales, aseguradoras e integradores de ERP
                  dispuestos a anclar un proceso real. Empezamos por un flujo, con tus datos, tus llaves y
                  evidencia exportable desde el primer dia — sin ceder control ni exclusividad.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                  <a
                    className={`${s.btn} ${s.btnSolid}`}
                    href="mailto:info.angelqg@gmail.com?subject=BeZhas%20—%20Piloto%20empresarial"
                  >
                    Solicitar un piloto <span className={s.arw}>→</span>
                  </a>
                  <a
                    className={`${s.btn} ${s.btnGhost}`}
                    href="https://t.me/BeZhasBot"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Hablar por Telegram
                  </a>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 8 }}>
                  Perfiles abiertos: miembro industrial · partner integrador · validador de red · nodo edge
                </p>

                <div className={s.res} style={{ marginTop: 26 }}>
                  {contactLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className={s.rcard}
                      style={{ minHeight: 0, padding: '16px 18px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14.5 }}>{link.label}</span>
                      <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: 20 }}>
                        {link.icon}
                      </span>
                    </a>
                  ))}
                </div>
              </Reveal>

              <Reveal index={1} className={s.ctaArt}>
                {/*
                  Antes: mosaico decorativo (seis bloques sin destino).
                  Ahora: directorio de correos por departamento. Fuente unica
                  en `lib/contact-emails.ts`; si cambia un buzon se cambia alli
                  y se propaga a home + cada pagina sectorial.
                */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                    Correos por departamento
                  </p>
                  <h3 className="mt-2 text-xl font-black uppercase italic text-white">
                    Directorio directo
                  </h3>
                  <p className="mt-3 text-xs leading-6 text-slate-400">
                    Cada bandeja llega a un equipo concreto, con sus agentes
                    ya asignados. No hay filtros ni recepcion generica.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {DEPARTMENT_CONTACTS.map((contact) => (
                      <DepartmentContact
                        key={contact.key}
                        contact={contact}
                        subject={`BeZhas — ${contact.label}`}
                      />
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 17 · DISCLAIMER MiCA ═══ */}
      <section className={s.legal}>
        <div className={`${s.wrap} ${s.legalInner}`}>
          <p className={s.disclaimer}>
            <b>BEZ-Coin es un token de utilidad de la red BeZhas.</b> No constituye una oferta de
            inversion ni un producto financiero regulado, y esta pagina no proporciona asesoramiento
            financiero. El valor de los activos digitales puede fluctuar y no esta garantizado.
            Cumplimiento del Reglamento MiCA (UE) 2023/1114 y de las obligaciones informativas de la AEAT
            (Espana), incluida la directiva DAC8.
          </p>
          <div className={s.legalLinks}>
            <Link href="/privacy">Privacidad</Link>
            <Link href="/support">Soporte</Link>
            <Link href="/token">BEZ-Coin</Link>
            <a href="https://t.me/BeZhasBot" target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
            <span>© 2026 BeZhas</span>
          </div>
        </div>
      </section>
    </div>
  );
}
