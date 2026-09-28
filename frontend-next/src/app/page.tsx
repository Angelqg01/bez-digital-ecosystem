/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    Wallet, TrendingUp, Building, ShoppingBag, ShieldCheck,
    Zap, ChevronRight, Globe, Code2, Cpu
} from 'lucide-react';
import { useBezPay } from '../context/BezPayContext';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { STRIPE_PAYMENT_LINKS } from '../lib/bezhasPaymentConfig';

const BEZ_POLYGON_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const BEZ_POLYGONSCAN_URL = `https://polygonscan.com/token/${BEZ_POLYGON_ADDRESS}`;
const DEFI_TOKENOMICS_URL = process.env.NEXT_PUBLIC_BEZHAS_DEFI_URL || '/tokenomics';

// â”€â”€â”€ Animated Counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const step = end / 60;
        let current = 0;
        const timer = setInterval(() => {
            current = Math.min(current + step, end);
            setCount(Math.floor(current));
            if (current >= end) clearInterval(timer);
        }, 16);
        return () => clearInterval(timer);
    }, [end]);
    return <>{count.toLocaleString()}{suffix}</>;
}

// â”€â”€â”€ Live BEZ Price Ticker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PriceTicker({ price }: { price: number }) {
    const [prev, setPrev] = useState(price);
    const [dir,  setDir ] = useState<'up' | 'down' | 'neutral'>('neutral');
    useEffect(() => {
        setDir(price > prev ? 'up' : price < prev ? 'down' : 'neutral');
        setPrev(price);
    }, [price]);
    const color = dir === 'up' ? '#00C896' : dir === 'down' ? '#EF4444' : '#FFB800';
    return (
        <span style={{ color, fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1em' }}>
            ${price.toFixed(4)} {dir === 'up' ? 'â–²' : dir === 'down' ? 'â–¼' : 'â—'}
        </span>
    );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function HomePage() {
    const { openBuyBez, livePrice, globalStats } = useBezPay();
    const { isConnected } = useAccount();
    const { open } = useWeb3Modal();

    const ECOSYSTEM_CARDS = [
        {
            icon: <Wallet size={28} />,
            title: 'Wallet Web3',
            desc: 'Gestiona tu BEZ-Coin y activos del ecosistema con firma criptogrÃ¡fica SIWE.',
            href: '/wallet',
            color: '#00C896',
            glow: '#00C89644',
        },
        {
            icon: <Zap size={28} />,
            title: 'BeZhas Pay',
            desc: 'Motor de pagos multi-token. Compra BEZ con USDT, USDC, MATIC o fiat.',
            href: '/bezpay',
            color: '#FFB800',
            glow: '#FFB80044',
            action: () => openBuyBez(),
        },
        {
            icon: <Building size={28} />,
            title: 'Activos RWA',
            desc: 'Invierte en propiedades tokenizadas desde 50 BEZ. APY garantizado on-chain.',
            href: '/rwa',
            color: '#2563EB',
            glow: '#2563EB44',
        },
        {
            icon: <ShoppingBag size={28} />,
            title: 'Marketplace',
            desc: 'Compra licencias digitales y activos fÃ­sicos protegidos por Quality Escrow.',
            href: '/marketplace',
            color: '#7C3AED',
            glow: '#7C3AED44',
        },
        {
            icon: <Code2 size={28} />,
            title: 'Developer Console',
            desc: 'API Keys, webhooks, SDK y el agente autÃ³nomo OpenClaw.',
            href: '/developer-console',
            color: '#06B6D4',
            glow: '#06B6D444',
        },
        {
            icon: <Cpu size={28} />,
            title: 'AEGIS AI',
            desc: 'Monitor inteligente que protege transacciones y optimiza la plataforma.',
            href: '/developer-console',
            color: '#10B981',
            glow: '#10B98144',
        },
    ];

    return (
        <div style={{ background: '#03060E', minHeight: '100vh', color: '#E8F4FF' }}>

            {/* â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section
                style={{
                    background: 'radial-gradient(ellipse at 60% 0%, #1a0a3e 0%, #03060E 60%)',
                    borderBottom: '1px solid #0D2040',
                    padding: '80px 28px 100px',
                }}
                className="relative overflow-hidden"
            >
                {/* Background grid */}
                <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'linear-gradient(rgba(0,200,150,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,150,.04) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }} />

                {/* Live ticker bar */}
                <div className="flex justify-center mb-8">
                    <div style={{ background: '#FFB80018', border: '1px solid #FFB80044', borderRadius: 999 }} className="px-6 py-2 flex items-center gap-3 text-sm">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                        <span style={{ color: '#A8C4E0' }}>BEZ-Coin price live:</span>
                        <PriceTicker price={livePrice} />
                        <span style={{ color: '#3D5E80', fontFamily: 'monospace', fontSize: '0.85em' }}>Â· Polygon Network</span>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="text-center max-w-4xl mx-auto relative z-10"
                >
                    <h1 className="text-6xl md:text-7xl font-black mb-6 leading-tight tracking-tight">
                        <span style={{ color: '#E8F4FF' }}>El ecosistema</span>{' '}
                        <span style={{ background: 'linear-gradient(135deg, #FFB800, #00C896)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Web3
                        </span>{' '}
                        <br />
                        <span style={{ color: '#E8F4FF' }}>que lo une todo</span>
                    </h1>

                    <p style={{ color: '#A8C4E0', fontSize: '1.2rem', lineHeight: 1.7 }} className="mb-10 max-w-2xl mx-auto">
                        Pagos multi-token, activos del mundo real, marketplace con escrow y una IA autÃ³noma.
                        Todo en la <strong style={{ color: '#00C896' }}>BeZhas Blockchain Core</strong> sobre Polygon.
                    </p>

                    <div className="flex flex-wrap justify-center gap-4">
                        <button
                            onClick={() => openBuyBez()}
                            className="group flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all"
                            style={{ background: 'linear-gradient(135deg, #FFB800, #F97316)', color: '#0a0a0a', boxShadow: '0 0 30px #FFB80066' }}
                        >
                            <Zap size={22} strokeWidth={2.5} />
                            Comprar BEZ-Coin
                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                            onClick={() => isConnected ? null : open()}
                            className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid #163560', color: '#E8F4FF' }}
                        >
                            <ShieldCheck size={22} />
                            {isConnected ? 'Wallet Conectada âœ“' : 'Conectar Wallet'}
                        </button>
                    </div>
                </motion.div>

                {/* Stats bar */}
                <div
                    className="mt-16 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4"
                    style={{ borderTop: '1px solid #0D2040', paddingTop: 32 }}
                >
                    {[
                        { label: 'BEZ Circulando', value: globalStats.bezCirculating },
                        { label: 'Volumen Total', value: `${(globalStats.volumeBEZ / 1_000_000).toFixed(1)}M BEZ` },
                        { label: 'Pagos On-chain', value: globalStats.totalPayments, isNumber: true },
                        { label: 'TVL Farming', value: globalStats.tvlFarming },
                    ].map(({ label, value, isNumber }) => (
                        <div key={label} className="text-center">
                            <div style={{ color: '#00C896', fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 900 }}>
                                {isNumber ? <Counter end={value as number} /> : value}
                            </div>
                            <div style={{ color: '#3D5E80', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
                                {label}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-6xl rounded-2xl border border-[#22d3ee]/20 bg-[#070b14] p-6 md:p-10 shadow-2xl shadow-cyan-950/20">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#22d3ee]">Venta directa Polygon</span>
                        <h2 className="mt-4 text-3xl md:text-5xl font-black uppercase italic text-white">BEZ-Coin real en mainnet</h2>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
                            Compra BEZ-Coin usando el contrato verificado actual en Polygon hasta completar el despliegue de BEZ-CoinV2.
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
                            <a href={BEZ_POLYGONSCAN_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:border-[#22d3ee]/50">
                                <p className="text-[10px] uppercase tracking-widest text-slate-500">Contrato</p>
                                <p className="font-mono text-sm font-bold text-[#22d3ee]">0xEcBa...11A8</p>
                            </a>
                        </div>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <a href={STRIPE_PAYMENT_LINKS.tokenPurchase} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center justify-center rounded-lg bg-[#22d3ee] px-6 font-black uppercase tracking-widest text-[#06111d] hover:brightness-110">
                                Comprar BEZ-Coin
                            </a>
                            <Link href={DEFI_TOKENOMICS_URL} className="flex h-14 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-6 font-black uppercase tracking-widest text-white hover:bg-white/10">
                                Tokenomics en DeFi
                            </Link>
                        </div>
                    </div>
                    <div className="rounded-xl border border-[#a855f7]/20 bg-[#11091f] p-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#a855f7]">DeFi routing</p>
                        <h3 className="mt-4 text-2xl font-black uppercase italic text-white">Staking, farming y tesorería</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-400">
                            Cuando el usuario quiera hacer tokenomics, el flujo lo dirige al módulo DeFi para analizar emisión, liquidez, rendimiento y gobernanza.
                        </p>
                        <Link href={DEFI_TOKENOMICS_URL} className="mt-8 flex h-12 items-center justify-center rounded-lg bg-[#a855f7] px-5 font-bold uppercase tracking-widest text-white hover:bg-[#9333ea]">
                            Abrir DeFi
                        </Link>
                    </div>
                </div>
            </section>

            {/* â”€â”€ ECOSYSTEM CARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section style={{ padding: '80px 28px', maxWidth: 1200, margin: '0 auto' }}>
                <div className="text-center mb-12">
                    <div style={{ color: '#00C896', fontFamily: 'monospace', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                        MÃ³dulos del Ecosistema
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#E8F4FF' }}>
                        Una plataforma,{' '}
                        <span style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            infinitas posibilidades
                        </span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ECOSYSTEM_CARDS.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                        >
                            <Link
                                href={card.href}
                                onClick={card.action ? (e) => { e.preventDefault(); card.action!(); } : undefined}
                                className="block group h-full"
                            >
                                <div
                                    className="h-full p-6 rounded-2xl transition-all duration-300"
                                    style={{
                                        background: '#0C1628',
                                        border: `1.5px solid #163560`,
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLDivElement).style.border = `1.5px solid ${card.color}66`;
                                        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 30px ${card.glow}`;
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLDivElement).style.border = '1.5px solid #163560';
                                        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                                    }}
                                >
                                    <div
                                        className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                                        style={{ background: `${card.color}22`, color: card.color }}
                                    >
                                        {card.icon}
                                    </div>
                                    <h3 style={{ color: '#E8F4FF', fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
                                        {card.title}
                                    </h3>
                                    <p style={{ color: '#3D5E80', fontSize: '0.9rem', lineHeight: 1.6 }}>
                                        {card.desc}
                                    </p>
                                    <div className="mt-6 flex items-center gap-2 font-semibold" style={{ color: card.color, fontSize: '0.875rem' }}>
                                        Explorar <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* â”€â”€ CTA: BEZPAY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section style={{ background: '#070D1C', borderTop: '1px solid #0D2040', borderBottom: '1px solid #0D2040', padding: '80px 28px' }}>
                <div className="max-w-3xl mx-auto text-center">
                    <div className="text-5xl mb-6">ðŸª™</div>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#E8F4FF', marginBottom: 16 }}>
                        BeZhas Pay â€” El motor on-chain
                    </h2>
                    <p style={{ color: '#A8C4E0', lineHeight: 1.7, marginBottom: 40 }}>
                        Compra BEZ con USDT, USDC, MATIC o Stripe. El contrato{' '}
                        <code style={{ color: '#00C896', fontFamily: 'monospace' }}>dispenseTokens()</code>{' '}
                        te envÃ­a BEZ directamente a tu wallet en Polygon. Sin intermediarios. 0 custodios.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button
                            onClick={() => openBuyBez()}
                            className="px-10 py-4 rounded-2xl font-bold text-lg text-black transition-all"
                            style={{ background: 'linear-gradient(135deg, #FFB800, #00C896)', boxShadow: '0 0 40px #FFB80055' }}
                        >
                            Comprar BEZ ahora
                        </button>
                        <Link
                            href="/bezpay"
                            className="px-10 py-4 rounded-2xl font-bold text-lg transition-all"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid #163560', color: '#E8F4FF' }}
                        >
                            Ver Ecosystem Hub â†’
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── APPS EN DESARROLLO ────────────────────────────────────────────── */}
            <section style={{ padding: '80px 28px', maxWidth: 1200, margin: '0 auto', borderTop: '1px solid #0D2040' }}>
                <div className="text-center mb-12">
                    <div style={{ color: '#FFB800', fontFamily: 'monospace', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                        Fase 1: Implementación Activa
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#E8F4FF' }}>
                        Acceso Directo a{' '}
                        <span style={{ background: 'linear-gradient(135deg, #FFB800, #F97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Sub-Apps P0
                        </span>
                    </h2>
                    <p style={{ color: '#A8C4E0', marginTop: 16, maxWidth: '600px', margin: '16px auto 0' }}>
                        Explora las herramientas fundamentales del ecosistema BeZhas V3.0 actualmente en desarrollo.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { title: 'BEZ Wallet', desc: 'Gestión on-chain de activos, NFTs y staking.', href: 'https://bez.digital/dashboard/wallet', color: '#00C896', icon: <Wallet size={24} /> },
                        { title: 'Gas Tank', desc: 'Recarga de gas con Stripe y predicción Aegis.', href: 'https://bez.digital/dashboard/gas', color: '#FFB800', icon: <Zap size={24} /> },
                        { title: 'Edge Nodes', desc: 'Gestión de nodos DePIN y recompensas.', href: 'https://bez.digital/dashboard/validators', color: '#06B6D4', icon: <Cpu size={24} /> },
                        { title: 'Vision Scan', desc: 'Verificación mediante AI Vision + Blockchain.', href: 'https://bez.digital/dashboard/qr', color: '#F97316', icon: <ShieldCheck size={24} /> },
                    ].map((app) => (
                        <a
                            key={app.title}
                            href={app.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group"
                        >
                            <div
                                className="p-6 rounded-2xl transition-all duration-300 h-full flex flex-col"
                                style={{
                                    background: '#0C1628',
                                    border: '1.5px solid #163560',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.border = `1.5px solid ${app.color}66`;
                                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-5px)';
                                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 10px 30px ${app.color}22`;
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.border = '1.5px solid #163560';
                                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
                                }}
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                                    style={{ background: `${app.color}22`, color: app.color }}
                                >
                                    {app.icon}
                                </div>
                                <h3 style={{ color: '#E8F4FF', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                                    {app.title}
                                </h3>
                                <p style={{ color: '#3D5E80', fontSize: '0.85rem', lineHeight: 1.5, flex: 1 }}>
                                    {app.desc}
                                </p>
                                <div className="mt-4 flex items-center gap-2 font-bold uppercase tracking-widest" style={{ color: app.color, fontSize: '0.65rem' }}>
                                    Abrir App <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </section>

            {/* ── ECOSISTEMA EXPANDIDO ─────────────────────────────────────────── */}
            <section style={{ padding: '40px 28px 80px', maxWidth: 1200, margin: '0 auto' }}>
                <div className="text-center mb-12">
                    <div style={{ color: '#06B6D4', fontFamily: 'monospace', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                        Visión Industrial & RWA
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#E8F4FF' }}>
                        Módulos de{' '}
                        <span style={{ background: 'linear-gradient(135deg, #06B6D4, #2563EB)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Próxima Generación
                        </span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { 
                            title: 'Bezhas-Hub', 
                            desc: 'Consola central de mando. Supervisa la red L2, gestiona la gobernanza DAO y visualiza métricas globales en tiempo real.', 
                            href: 'https://bez.digital/dashboard', 
                            color: '#00C896', 
                            icon: <Globe size={24} /> 
                        },
                        { 
                            title: 'BZ CargoLink', 
                            desc: 'Logística inteligente. Conecta la cadena de suministro física con blockchain para rastreo inmutable y liquidación automática.', 
                            href: 'https://bez.digital/dashboard/sectors', 
                            color: '#FFB800', 
                            icon: <TrendingUp size={24} /> 
                        },
                        { 
                            title: 'BZ Prestige', 
                            desc: 'Mercado de lujo y RWA. Verificación de autenticidad para activos de alto valor mediante certificados NFT de propiedad.', 
                            href: 'https://bez.digital/dashboard/nfts', 
                            color: '#7C3AED', 
                            icon: <ShoppingBag size={24} /> 
                        },
                        { 
                            title: 'BZ Sphere', 
                            desc: 'Nexo social y comunidad. Espacio descentralizado para colaboración entre nodos, votaciones e intercambio de conocimientos.', 
                            href: 'https://bez.digital/solutions', 
                            color: '#06B6D4', 
                            icon: <Cpu size={24} /> 
                        },
                    ].map((app) => (
                        <a
                            key={app.title}
                            href={app.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group"
                        >
                            <div
                                className="p-6 rounded-2xl transition-all duration-300 h-full flex flex-col"
                                style={{
                                    background: '#070D1C',
                                    border: '1.5px solid #163560',
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.border = `1.5px solid ${app.color}66`;
                                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-5px)';
                                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 10px 30px ${app.color}11`;
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.border = '1.5px solid #163560';
                                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                                }}
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                                    style={{ background: `${app.color}22`, color: app.color }}
                                >
                                    {app.icon}
                                </div>
                                <h3 style={{ color: '#E8F4FF', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                                    {app.title}
                                </h3>
                                <p style={{ color: '#3D5E80', fontSize: '0.85rem', lineHeight: 1.5, flex: 1 }}>
                                    {app.desc}
                                </p>
                                <div className="mt-4 flex items-center gap-2 font-bold uppercase tracking-widest" style={{ color: app.color, fontSize: '0.65rem' }}>
                                    Explorar Módulo <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </section>

            {/* ── FOOTER ────────────────────────────────────────────────────────── */}
            <footer style={{ background: '#03060E', borderTop: '1px solid #0D2040', padding: '24px 28px' }}>
                <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
                    <span style={{ color: '#3D5E80', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        bez.digital Â· Next.js v3 Migration Â· Polygon Core Â· BEZ Token: 0xEcBa87â€¦
                    </span>
                    <div className="flex gap-6">
                        {['/auth', '/wallet', '/bezpay', '/rwa', '/marketplace', '/developer-console'].map((href) => (
                            <Link key={href} href={href} style={{ color: '#3D5E80', fontSize: '0.75rem', fontFamily: 'monospace' }} className="hover:text-green-400 transition-colors">
                                {href.replace('/', '')}
                            </Link>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
}

