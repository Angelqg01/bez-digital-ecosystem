'use client';

import {
    ArrowLeftRight,
    ArrowRight,
    BarChart3,
    Coins,
    Landmark,
    Layers,
    Loader2,
    PieChart,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Vote,
    Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useTokenInfo, useTreasuryOverview, useGovernanceProposals, useWalletBalance } from '@/lib/hooks';

const BEZ_DIRECT_SALE_URL = 'https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806';
const BEZ_POLYGON_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const BEZ_POLYGONSCAN_URL = `https://polygonscan.com/token/${BEZ_POLYGON_ADDRESS}`;
const BEZHAS_HOME_URL = process.env.NEXT_PUBLIC_BEZHAS_HOME_URL || 'http://localhost:5173';

export default function DashboardPage() {
    const { data: token, isLoading: tokenLoading } = useTokenInfo();
    const { data: treasury, isLoading: treasuryLoading } = useTreasuryOverview();
    const { data: govData } = useGovernanceProposals();
    const { data: walletBal } = useWalletBalance();

    const activeProposals = govData?.proposals?.filter(p => p.status === 'active').length ?? 0;
    const loading = tokenLoading || treasuryLoading;

    const stats = [
        { label: 'Total Supply', value: token?.totalSupply ? `${Number(token.totalSupply).toLocaleString()} ${token.symbol}` : '—', icon: Coins },
        { label: 'Circulating Supply', value: token?.circulatingSupply ? `${Number(token.circulatingSupply).toLocaleString()} ${token.symbol}` : '—', icon: TrendingUp },
        { label: 'Active Proposals', value: String(activeProposals), icon: Vote },
        { label: 'Treasury', value: treasury?.totalFunds ?? '—', icon: PieChart },
        { label: 'Your BEZ Balance', value: walletBal?.balanceBEZ ? `${walletBal.balanceBEZ} BEZ` : '—', icon: Wallet },
        { label: 'Token', value: token?.name ?? 'BEZCoinV2', icon: Coins },
    ];

    const quickActions = [
        { href: '/staking', label: 'Staking BEZ', desc: 'Bloquea tokens y recibe recompensas del ecosistema.', icon: Coins },
        { href: '/farming', label: 'Farming', desc: 'Aporta liquidez a pools y captura incentivos extra.', icon: TrendingUp },
        { href: '/treasury', label: 'Tokenomics', desc: 'Consulta tesoreria, suministro y distribucion del token.', icon: PieChart },
        { href: '/governance', label: 'Gobernanza', desc: `${activeProposals} propuestas activas para votar.`, icon: Vote },
        { href: '/bridge', label: 'Bridge', desc: 'Mueve liquidez entre redes compatibles.', icon: ArrowLeftRight },
        { href: '/wallet', label: 'Wallet', desc: 'Conecta tu wallet para operar con BEZ.', icon: Wallet },
    ];

    const defiUses = [
        {
            title: 'Ahorro activo con staking',
            desc: 'El usuario conserva exposicion a BEZ-Coin y puede generar recompensas por participar en la seguridad y actividad del protocolo.',
            icon: ShieldCheck,
        },
        {
            title: 'Liquidez con farming',
            desc: 'Los pools permiten poner capital a trabajar, recibir incentivos y aumentar la profundidad de mercado del ecosistema BeZhas.',
            icon: Layers,
        },
        {
            title: 'Tesoreria y tokenomics',
            desc: 'La pagina de treasury concentra datos para entender suministro, reservas, uso del token y salud economica del proyecto.',
            icon: BarChart3,
        },
    ];

    const yieldSteps = [
        { step: '1', title: 'Comprar o recibir BEZ', desc: 'Adquiere BEZ-Coin en Polygon o transfiere tokens a tu wallet conectada.' },
        { step: '2', title: 'Elegir estrategia', desc: 'Usa staking para una participacion sencilla o farming cuando quieras aportar liquidez.' },
        { step: '3', title: 'Reclamar y reinvertir', desc: 'Consulta recompensas, retira cuando corresponda y reinvierte si quieres ampliar rendimiento.' },
    ];

    return (
        <div className="space-y-8">
            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] items-stretch">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 md:p-8">
                    <div className="inline-flex items-center gap-2 rounded-full border border-bez-primary/30 bg-bez-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-bez-primary">
                        <Sparkles size={14} />
                        BeZhas DeFi
                    </div>
                    <h1 className="mt-5 text-4xl md:text-5xl font-bold text-white leading-tight">
                        Finanzas descentralizadas para hacer trabajar tu BEZ-Coin
                    </h1>
                    <p className="mt-4 max-w-3xl text-slate-300 text-lg">
                        DeFi en BeZhas es el panel donde los usuarios conectan su wallet, consultan el token, participan en staking,
                        aportan liquidez, revisan tokenomics y gobiernan decisiones del ecosistema sin salir de la plataforma.
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <Link href="/staking" className="btn-primary inline-flex items-center justify-center gap-2 py-3">
                            Empezar con staking <ArrowRight size={18} />
                        </Link>
                        <a href={BEZHAS_HOME_URL} className="btn-secondary inline-flex items-center justify-center gap-2 py-3">
                            Volver al Home principal <Landmark size={18} />
                        </a>
                    </div>
                </div>

                <div className="bg-slate-900/70 border border-bez-primary/30 rounded-xl p-6 flex flex-col justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Ruta recomendada</p>
                        <h2 className="text-2xl font-bold text-white mt-2">Usar, generar y decidir</h2>
                        <p className="text-slate-400 mt-3">
                            La rentabilidad extra llega cuando el token deja de estar pasivo: staking para recompensas, farming para liquidez
                            y gobernanza para orientar el valor del protocolo.
                        </p>
                    </div>
                    <div className="mt-6 grid gap-3">
                        {yieldSteps.map(({ step, title, desc }) => (
                            <div key={step} className="flex gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bez-primary text-sm font-bold text-white">{step}</span>
                                <div>
                                    <h3 className="font-semibold text-white">{title}</h3>
                                    <p className="text-sm text-slate-400 mt-1">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {loading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="animate-spin" size={16} /> Cargando datos en vivo...</div>
            )}

            <section className="bg-slate-800/50 border border-bez-primary/30 rounded-xl p-6">
                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-center">
                    <div>
                        <p className="text-bez-primary text-xs uppercase tracking-widest font-bold mb-2">BEZ-Coin Polygon sale</p>
                        <h2 className="text-2xl md:text-3xl font-bold text-white">Compra directa y tokenomics en DeFi</h2>
                        <p className="text-slate-400 mt-3">
                            Compra BEZ-Coin real en Polygon y vuelve al panel DeFi para staking, farming, tesorería y análisis tokenómico.
                        </p>
                    </div>
                    <div className="grid gap-3">
                        <a href={BEZ_POLYGONSCAN_URL} target="_blank" rel="noopener noreferrer" className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 hover:border-bez-primary">
                            <span className="block text-slate-500 text-xs uppercase">Contrato</span>
                            <span className="font-mono text-bez-primary text-sm">0xEcBa...11A8</span>
                        </a>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <a href={BEZ_DIRECT_SALE_URL} target="_blank" rel="noopener noreferrer" className="flex-1 bg-bez-primary hover:bg-bez-secondary text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors">
                                Comprar BEZ-Coin
                            </a>
                            <Link href="/treasury" className="flex-1 border border-bez-border hover:border-bez-primary text-slate-300 font-semibold py-3 px-4 rounded-lg text-center transition-colors">
                                Tokenomics
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Que aporta DeFi a BeZhas</h2>
                        <p className="text-slate-400 mt-1">Una capa financiera para convertir actividad, liquidez y gobernanza en utilidad real.</p>
                    </div>
                    <Link href="/treasury" className="text-bez-primary text-sm font-semibold inline-flex items-center gap-2">
                        Ver tokenomics <ArrowRight size={16} />
                    </Link>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {defiUses.map(({ title, desc, icon: Icon }) => (
                        <div key={title} className="card">
                            <Icon className="w-8 h-8 text-bez-primary mb-4" />
                            <h3 className="text-lg font-semibold text-white">{title}</h3>
                            <p className="text-slate-400 text-sm mt-2">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-sm">{label}</span>
                            <Icon className="w-5 h-5 text-bez-primary" />
                        </div>
                        <p className="text-2xl font-bold text-white">{value}</p>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">Entradas DeFi</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {quickActions.map(({ href, label, desc, icon: Icon }) => (
                        <Link key={href} href={href}
                            className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-bez-primary transition-colors group">
                            <Icon className="w-8 h-8 text-bez-primary mb-3 group-hover:scale-110 transition-transform" />
                            <h3 className="text-white font-semibold">{label}</h3>
                            <p className="text-slate-400 text-sm mt-1">{desc}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
