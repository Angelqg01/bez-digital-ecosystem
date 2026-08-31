'use client';

import Link from 'next/link';
import { usePublicStats } from '@/lib/public-hooks';
import { STRIPE_PAYMENT_LINKS } from '@/lib/stripe-payment-links';

const BEZ_POLYGON_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const BEZ_POLYGONSCAN_URL = `https://polygonscan.com/token/${BEZ_POLYGON_ADDRESS}`;
const DEFI_TOKENOMICS_URL = process.env.NEXT_PUBLIC_BEZHAS_DEFI_URL || '/financial';

export default function TokenPage() {
    const { data } = usePublicStats();
    const tk = data?.token;
    const stk = data?.staking;
    const net = data?.network;

    const price = tk ? `$${tk.priceUSD.toFixed(3)}` : '—';
    const change = tk ? `${tk.change24h >= 0 ? '+' : ''}${tk.change24h.toFixed(1)}%` : '—';
    const changePositive = tk ? tk.change24h >= 0 : true;
    const mCap = tk ? `$${(tk.marketCap / 1_000_000).toFixed(1)}M` : '—';
    const supply = tk ? `${(tk.totalSupply / 1_000_000).toFixed(0)}M` : '—';
    const circulating = tk ? `${(tk.circulatingSupply / 1_000_000).toFixed(1)}M` : '—';
    const circulatingPct = tk ? ((tk.circulatingSupply / tk.totalSupply) * 100).toFixed(1) : '42.8';
    const totalStaked = stk ? `${(stk.totalStaked / 1_000_000).toFixed(1)}M` : '—';
    const apr = stk ? `${stk.apr.toFixed(2)}%` : '—';
    const validatorCount = net?.validatorsActive?.toLocaleString() ?? '—';

    return (
        <>
            {/* Ambient Hero Gradient */}
            <div className="absolute top-0 left-0 w-full h-[600px] hero-gradient pointer-events-none"></div>
            <div className="max-w-7xl mx-auto px-8 py-12 relative z-10">

                {/* Hero Section */}
                <section className="mb-16">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="h-2 w-2 bg-primary rounded-full animate-pulse"></span>
                        <span className="text-[10px] tracking-[0.4em] uppercase text-primary font-bold">Mainnet Live</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase mb-6 leading-none">
                        BEZ<span className="text-primary">Coin</span>
                    </h1>
                    <p className="text-xl text-on-surface-variant max-w-2xl font-light leading-relaxed mb-8">
                        El token nativo de la red BeZhas. Paga gas, participa en governance, obtén rewards por staking y accede a servicios premium del protocolo.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <Link href="/token/buy" className="bg-primary text-white px-10 py-4 font-bold italic tracking-widest uppercase text-sm hover:shadow-[0_0_30px_rgba(13,51,242,0.4)] transition-all inline-flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">wallet</span>
                            COMPRAR BEZ-COIN
                        </Link>
                        <Link href={DEFI_TOKENOMICS_URL} className="glass-panel border border-white/10 text-white px-10 py-4 font-bold italic tracking-widest uppercase text-sm hover:bg-white/5 transition-all inline-flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">savings</span>
                            TOKENOMICS EN DEFI
                        </Link>
                        <a href="https://t.me/BeZhasBot" target="_blank" rel="noopener noreferrer" className="glass-panel border border-white/10 text-white px-10 py-4 font-bold italic tracking-widest uppercase text-sm hover:bg-white/5 transition-all inline-flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                            PREGUNTAS AL BOT
                        </a>
                    </div>
                </section>

                <section className="mb-16 glass-panel border border-primary/20 rounded-xl p-8">
                    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
                        <div>
                            <p className="text-[10px] tracking-[0.4em] uppercase text-primary font-bold mb-3">Venta directa Polygon</p>
                            <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">BEZ-Coin verificado</h2>
                            <p className="text-on-surface-variant leading-relaxed">
                                La venta directa usa el token BEZ-Coin real de Polygon hasta el despliegue de BEZ-CoinV2. El contrato está publicado y verificable en mainnet.
                            </p>
                        </div>
                        <div className="grid gap-3">
                            <a href={BEZ_POLYGONSCAN_URL} target="_blank" rel="noopener noreferrer" className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-primary/40">
                                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">Contrato Polygon</div>
                                <div className="font-mono text-primary text-sm break-all">{BEZ_POLYGON_ADDRESS}</div>
                            </a>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <a href={STRIPE_PAYMENT_LINKS.tokenPurchase} target="_blank" rel="noopener noreferrer" className="flex-1 bg-primary text-white px-6 py-4 font-bold italic tracking-widest uppercase text-sm text-center">
                                    Comprar ahora
                                </a>
                                <Link href={DEFI_TOKENOMICS_URL} className="flex-1 bg-white/5 border border-white/10 text-white px-6 py-4 font-bold italic tracking-widest uppercase text-sm text-center">
                                    Ir a DeFi
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Token Stats Bento Grid */}
                <section className="grid grid-cols-12 gap-6 mb-16">
                    {/* Price Card */}
                    <div className="col-span-12 lg:col-span-4 glass-panel p-8 border border-white/5 rounded-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <span className="material-symbols-outlined text-primary text-3xl">candlestick_chart</span>
                                <span className={`text-[10px] px-3 py-1 tracking-widest uppercase font-bold ${changePositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{change}</span>
                            </div>
                            <p className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Precio BEZ-Coin</p>
                            <div className="text-4xl font-black italic tracking-tighter mb-2">{price}</div>
                            <p className="text-xs text-on-surface-variant">Market Cap: {mCap}</p>
                        </div>
                    </div>

                    {/* Supply Card */}
                    <div className="col-span-12 lg:col-span-4 glass-panel p-8 border border-white/5 rounded-xl">
                        <span className="material-symbols-outlined text-tertiary text-3xl mb-6 block">token</span>
                        <p className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Total Supply</p>
                        <div className="text-4xl font-black italic tracking-tighter mb-2">{supply}</div>
                        <div className="space-y-3 mt-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-on-surface-variant">Circulante</span>
                                <span className="font-bold">{circulating} BEZ</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${circulatingPct}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Staking Card */}
                    <div className="col-span-12 lg:col-span-4 glass-panel p-8 border border-white/5 rounded-xl">
                        <span className="material-symbols-outlined text-primary text-3xl mb-6 block">lock</span>
                        <p className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Total Staked</p>
                        <div className="text-4xl font-black italic tracking-tighter mb-2">{totalStaked}</div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="bg-white/5 p-3 rounded-lg">
                                <div className="text-[10px] text-on-surface-variant uppercase">APY</div>
                                <div className="text-lg font-bold text-primary">{apr}</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg">
                                <div className="text-[10px] text-on-surface-variant uppercase">Validadores</div>
                                <div className="text-lg font-bold">{validatorCount}</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How to Buy Section */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">Cómo Obtener <span className="text-primary">BEZ-Coin</span></h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-8 border border-white/5 rounded-xl relative overflow-hidden group hover:border-primary/30 transition-all">
                            <div className="text-6xl font-black italic text-primary/10 absolute top-4 right-4">01</div>
                            <span className="material-symbols-outlined text-primary text-3xl mb-4 block">account_balance_wallet</span>
                            <h3 className="text-xl font-bold italic uppercase tracking-tight mb-3">Conecta tu Wallet</h3>
                            <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                                Conecta MetaMask, WalletConnect o Coinbase Wallet para acceder al ecosistema BeZhas.
                            </p>
                            <Link href="/login" className="text-primary text-xs font-bold tracking-widest uppercase inline-flex items-center gap-1 hover:gap-2 transition-all">
                                CONECTAR <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </Link>
                        </div>

                        <div className="glass-panel p-8 border border-white/5 rounded-xl relative overflow-hidden group hover:border-primary/30 transition-all">
                            <div className="text-6xl font-black italic text-primary/10 absolute top-4 right-4">02</div>
                            <span className="material-symbols-outlined text-primary text-3xl mb-4 block">swap_horiz</span>
                            <h3 className="text-xl font-bold italic uppercase tracking-tight mb-3">Swap o Bridge</h3>
                            <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                                Intercambia ETH, USDC o MATIC por BEZ-Coin usando nuestro bridge cross-chain o los DEXs integrados.
                            </p>
                            <Link href="/bridges" className="text-primary text-xs font-bold tracking-widest uppercase inline-flex items-center gap-1 hover:gap-2 transition-all">
                                BRIDGE <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </Link>
                        </div>

                        <div className="glass-panel p-8 border border-white/5 rounded-xl relative overflow-hidden group hover:border-primary/30 transition-all">
                            <div className="text-6xl font-black italic text-primary/10 absolute top-4 right-4">03</div>
                            <span className="material-symbols-outlined text-primary text-3xl mb-4 block">savings</span>
                            <h3 className="text-xl font-bold italic uppercase tracking-tight mb-3">Stake & Earn</h3>
                            <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                                Haz staking de tus BEZ-Coin para ganar rewards y participar en la gobernanza del protocolo.
                            </p>
                            <Link href={DEFI_TOKENOMICS_URL} className="text-primary text-xs font-bold tracking-widest uppercase inline-flex items-center gap-1 hover:gap-2 transition-all">
                                STAKING <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Token Distribution */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">Distribución del <span className="text-primary">Token</span></h2>
                    <div className="glass-panel p-8 border border-white/5 rounded-xl">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Ecosistema & Rewards', pct: '35%', color: 'bg-primary' },
                                { label: 'Equipo & Advisors', pct: '15%', color: 'bg-tertiary' },
                                { label: 'Staking Rewards', pct: '25%', color: 'bg-cyan-500' },
                                { label: 'Tesorería DAO', pct: '25%', color: 'bg-amber-500' },
                            ].map((item) => (
                                <div key={item.label} className="text-center">
                                    <div className={`w-16 h-16 ${item.color} rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-black italic`}>
                                        {item.pct}
                                    </div>
                                    <p className="text-sm font-bold uppercase tracking-tight">{item.label}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 h-3 bg-white/5 rounded-full overflow-hidden flex">
                            <div className="h-full bg-primary" style={{ width: '35%' }}></div>
                            <div className="h-full bg-tertiary" style={{ width: '15%' }}></div>
                            <div className="h-full bg-cyan-500" style={{ width: '25%' }}></div>
                            <div className="h-full bg-amber-500" style={{ width: '25%' }}></div>
                        </div>
                    </div>
                </section>

                {/* Token Utility */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">Utilidad del <span className="text-primary">Token</span></h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { icon: 'local_gas_station', title: 'Gas Nativo', desc: 'BEZ-Coin es el token de gas de la red BeZhas L2. Cada transacción consume BEZ como fee.' },
                            { icon: 'how_to_vote', title: 'Gobernanza', desc: 'Los holders de BEZ votan propuestas de protocolo, upgrades y cambios de parámetros de la red.' },
                            { icon: 'lock', title: 'Staking & Validación', desc: 'Haz stake de BEZ para operar nodos validadores y ganar rewards por asegurar la red.' },
                            { icon: 'redeem', title: 'Acceso a Servicios', desc: 'Desbloquea servicios premium: API avanzada, prioridad de transacciones, analytics institucional.' },
                        ].map((item) => (
                            <div key={item.title} className="glass-panel p-6 border border-white/5 rounded-xl flex gap-4 hover:border-primary/30 transition-all">
                                <span className="material-symbols-outlined text-primary text-3xl flex-shrink-0">{item.icon}</span>
                                <div>
                                    <h3 className="text-lg font-bold italic uppercase tracking-tight mb-2">{item.title}</h3>
                                    <p className="text-on-surface-variant text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Tokenomics Sostenible */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Tokenomics <span className="text-primary">Sostenible</span></h2>
                    <p className="text-on-surface-variant max-w-2xl mb-8">Modelo económico auditado con emisiones controladas y topes diarios para garantizar la estabilidad a largo plazo del ecosistema.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-6 border border-white/5 rounded-xl">
                            <span className="material-symbols-outlined text-primary text-3xl mb-4 block">lock</span>
                            <h3 className="text-lg font-bold italic uppercase tracking-tight mb-2">Staking Pool</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-on-surface-variant">Reward Rate</span><span className="font-bold">0.05 BEZ/s</span></div>
                                <div className="flex justify-between"><span className="text-on-surface-variant">Tope Diario</span><span className="font-bold text-primary">50,000 BEZ</span></div>
                                <div className="flex justify-between"><span className="text-on-surface-variant">APR Base</span><span className="font-bold text-tertiary">~8.2%</span></div>
                            </div>
                        </div>
                        <div className="glass-panel p-6 border border-white/5 rounded-xl">
                            <span className="material-symbols-outlined text-primary text-3xl mb-4 block">compost</span>
                            <h3 className="text-lg font-bold italic uppercase tracking-tight mb-2">Liquidity Farming</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-on-surface-variant">Emisión</span><span className="font-bold">0.5 BEZ/bloque</span></div>
                                <div className="flex justify-between"><span className="text-on-surface-variant">Tope Diario</span><span className="font-bold text-primary">25,000 BEZ</span></div>
                                <div className="flex justify-between"><span className="text-on-surface-variant">Mejor APY</span><span className="font-bold text-tertiary">~14.2%</span></div>
                            </div>
                        </div>
                        <div className="glass-panel p-6 border border-white/5 rounded-xl">
                            <span className="material-symbols-outlined text-primary text-3xl mb-4 block">payments</span>
                            <h3 className="text-lg font-bold italic uppercase tracking-tight mb-2">Comisiones de Red</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-on-surface-variant">BeZhas Pay</span><span className="font-bold">2.5%</span></div>
                                <div className="flex justify-between"><span className="text-on-surface-variant">Bridge Cross-Chain</span><span className="font-bold">0.5% + 10 BEZ</span></div>
                                <div className="flex justify-between"><span className="text-on-surface-variant">Marketplace</span><span className="font-bold">7.5%</span></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Rentabilidad por Segmento */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Rentabilidad por <span className="text-primary">Segmento</span></h2>
                    <p className="text-on-surface-variant max-w-2xl mb-8">Descubre cómo BEZ-Coin genera valor según tu perfil de uso. Cada segmento accede a beneficios diseñados para maximizar su retorno.</p>
                    <div className="space-y-6">
                        {/* Empresas */}
                        <div className="glass-panel p-8 border border-white/5 rounded-xl hover:border-primary/30 transition-all">
                            <div className="flex items-start gap-4 mb-6">
                                <span className="material-symbols-outlined text-primary text-4xl">corporate_fare</span>
                                <div>
                                    <h3 className="text-2xl font-bold italic uppercase tracking-tight">Empresas</h3>
                                    <p className="text-on-surface-variant text-sm">Logística, manufactura, comercio internacional</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">BeZhas Pay</div>
                                    <div className="text-xl font-bold text-primary">2.5%</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Comisión plana vs Stripe 2.9%+$0.30</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Bridge Corporativo</div>
                                    <div className="text-xl font-bold text-primary">0.5%</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">+ 10 BEZ mínimo por tx</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Staking Empresarial</div>
                                    <div className="text-xl font-bold text-tertiary">8.2-12.4%</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">APR como validador Tier 2-3</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Invoice Factoring</div>
                                    <div className="text-xl font-bold">1%</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Liquidez instantánea sobre facturas</p>
                                </div>
                            </div>
                        </div>

                        {/* Aduanas */}
                        <div className="glass-panel p-8 border border-white/5 rounded-xl hover:border-primary/30 transition-all">
                            <div className="flex items-start gap-4 mb-6">
                                <span className="material-symbols-outlined text-primary text-4xl">local_shipping</span>
                                <div>
                                    <h3 className="text-2xl font-bold italic uppercase tracking-tight">Aduanas</h3>
                                    <p className="text-on-surface-variant text-sm">Agentes aduaneros, operadores de comercio exterior</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Compliance ZKP</div>
                                    <div className="text-xl font-bold text-primary">Automático</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Filing aduanero con zero-knowledge proofs</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Bill of Lading</div>
                                    <div className="text-xl font-bold text-primary">On-Chain</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Tokenización de conocimientos de embarque</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Escrow Logístico</div>
                                    <div className="text-xl font-bold text-tertiary">Smart</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Liberación por geofence GPS</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Ahorro Auditoría</div>
                                    <div className="text-xl font-bold text-tertiary">~32%</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Reducción en tiempos de espera</p>
                                </div>
                            </div>
                        </div>

                        {/* Instituciones / Gobiernos */}
                        <div className="glass-panel p-8 border border-white/5 rounded-xl hover:border-primary/30 transition-all">
                            <div className="flex items-start gap-4 mb-6">
                                <span className="material-symbols-outlined text-primary text-4xl">account_balance</span>
                                <div>
                                    <h3 className="text-2xl font-bold italic uppercase tracking-tight">Instituciones & Gobiernos</h3>
                                    <p className="text-on-surface-variant text-sm">Entidades públicas, fondos soberanos, reguladores</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Gobernanza DAO</div>
                                    <div className="text-xl font-bold text-primary">Voto Directo</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Participación en propuestas del protocolo</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Tesorería Automatizada</div>
                                    <div className="text-xl font-bold text-primary">40+ FIAT</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Settlements cross-border con stablecoins</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Validador Core Nexus</div>
                                    <div className="text-xl font-bold text-tertiary">~12.4% APR</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">1M+ BEZ staked, 2% comisión</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">ESG Compliance</div>
                                    <div className="text-xl font-bold text-tertiary">100%</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Tracking on-chain certificado</p>
                                </div>
                            </div>
                        </div>

                        {/* Clientes Retail */}
                        <div className="glass-panel p-8 border border-white/5 rounded-xl hover:border-primary/30 transition-all">
                            <div className="flex items-start gap-4 mb-6">
                                <span className="material-symbols-outlined text-primary text-4xl">person</span>
                                <div>
                                    <h3 className="text-2xl font-bold italic uppercase tracking-tight">Clientes Retail</h3>
                                    <p className="text-on-surface-variant text-sm">Inversores individuales, freelancers, usuarios DeFi</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Staking Base</div>
                                    <div className="text-xl font-bold text-tertiary">~8.5% APY</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Sin lock, acceso inmediato</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Staking 365 días</div>
                                    <div className="text-xl font-bold text-tertiary">~25.5% APY</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Multiplicador 3x por lock máximo</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Farming LP</div>
                                    <div className="text-xl font-bold text-tertiary">9-14% APY</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Pools BEZ-USDT, BEZ-ETH, BEZ-MATIC</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Freelance Market</div>
                                    <div className="text-xl font-bold">7.5%</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Comisión plataforma con escrow</p>
                                </div>
                            </div>
                        </div>

                        {/* Grandes Tenedores */}
                        <div className="glass-panel p-8 border border-primary/20 rounded-xl bg-primary/5">
                            <div className="flex items-start gap-4 mb-6">
                                <span className="material-symbols-outlined text-primary text-4xl">diamond</span>
                                <div>
                                    <h3 className="text-2xl font-bold italic uppercase tracking-tight">Grandes Tenedores</h3>
                                    <p className="text-on-surface-variant text-sm">Whales, fondos de inversión, instituciones con +250K BEZ</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Validador Guardian</div>
                                    <div className="text-xl font-bold text-tertiary">~10.5% APR</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">250K+ BEZ, comisión reducida 5%</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Validador Core Nexus</div>
                                    <div className="text-xl font-bold text-tertiary">~12.4% APR</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">1M+ BEZ, comisión mínima 2%</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Gobernanza DAO</div>
                                    <div className="text-xl font-bold text-primary">Peso Premium</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">Mayor influencia en propuestas</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Analytics Premium</div>
                                    <div className="text-xl font-bold text-primary">Institucional</div>
                                    <p className="text-[10px] text-on-surface-variant mt-1">API avanzada + prioridad en tx</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Beneficios Staking & Holding */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Staking, Holding & <span className="text-primary">DAO</span></h2>
                    <p className="text-on-surface-variant max-w-2xl mb-8">Cuanto más tiempo mantengas y bloquees tus BEZ-Coin, mayores son tus multiplicadores de reward y tu influencia en el protocolo.</p>
                    <div className="glass-panel p-8 border border-white/5 rounded-xl overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] tracking-[0.3em] uppercase text-on-surface-variant border-b border-white/10">
                                    <th className="p-4 font-medium">Periodo Lock</th>
                                    <th className="p-4 font-medium">Multiplicador</th>
                                    <th className="p-4 font-medium">APY Efectivo</th>
                                    <th className="p-4 font-medium">Retorno Anual (10K BEZ)</th>
                                    <th className="p-4 font-medium">Beneficio DAO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {[
                                    { lock: 'Sin lock', mult: '1x', apy: '8.5%', ret: '850 BEZ (~$85)', dao: 'Voto básico' },
                                    { lock: '7 días', mult: '1.1x', apy: '9.35%', ret: '935 BEZ (~$93)', dao: 'Voto básico' },
                                    { lock: '30 días', mult: '1.25x', apy: '10.6%', ret: '1,063 BEZ (~$106)', dao: 'Voto + Propuestas' },
                                    { lock: '90 días', mult: '1.5x', apy: '12.75%', ret: '1,275 BEZ (~$128)', dao: 'Voto + Propuestas' },
                                    { lock: '180 días', mult: '2x', apy: '17.0%', ret: '1,700 BEZ (~$170)', dao: 'Voto Priority' },
                                    { lock: '365 días', mult: '3x', apy: '25.5%', ret: '2,550 BEZ (~$255)', dao: 'Voto Priority + Delegación' },
                                ].map((row) => (
                                    <tr key={row.lock} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-bold">{row.lock}</td>
                                        <td className="p-4 text-primary font-bold">{row.mult}</td>
                                        <td className="p-4 font-bold text-tertiary">{row.apy}</td>
                                        <td className="p-4 text-sm">{row.ret}</td>
                                        <td className="p-4 text-xs text-on-surface-variant">{row.dao}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Acumulación por Suscripción */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Beneficios de <span className="text-primary">Suscripción</span></h2>
                    <p className="text-on-surface-variant max-w-2xl mb-8">Al suscribirte mensualmente al protocolo BeZhas, acumulas beneficios progresivos que aumentan tu rentabilidad.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-6 border border-white/5 rounded-xl hover:border-primary/30 transition-all">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-cyan-400 text-2xl">star_half</span>
                                <h3 className="text-xl font-bold italic uppercase tracking-tight">STARTER</h3>
                            </div>
                            <div className="text-3xl font-black italic text-primary mb-4">50 BEZ<span className="text-sm text-on-surface-variant font-normal">/mes</span></div>
                            <ul className="space-y-3 text-sm text-on-surface-variant">
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Acceso API básica (1,000 req/día)</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Staking boost +5% extra</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Soporte por Telegram Bot</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Dashboard analytics básico</li>
                            </ul>
                            <a href={STRIPE_PAYMENT_LINKS.starter} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-primary/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-white">
                                Suscribirse
                            </a>
                        </div>
                        <div className="glass-panel p-6 border border-primary/30 rounded-xl bg-primary/5 relative">
                            <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1">Popular</div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-primary text-2xl">star</span>
                                <h3 className="text-xl font-bold italic uppercase tracking-tight">BUSINESS</h3>
                            </div>
                            <div className="text-3xl font-black italic text-primary mb-4">250 BEZ<span className="text-sm text-on-surface-variant font-normal">/mes</span></div>
                            <ul className="space-y-3 text-sm text-on-surface-variant">
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> API ilimitada + webhooks</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Staking boost +15% extra</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Soporte prioritario email</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Analytics avanzado + RWA data</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Gasless tx para usuarios finales</li>
                            </ul>
                            <a href={STRIPE_PAYMENT_LINKS.pro} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-primary/80">
                                Suscribirse
                            </a>
                        </div>
                        <div className="glass-panel p-6 border border-white/5 rounded-xl hover:border-primary/30 transition-all">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-amber-400 text-2xl">workspace_premium</span>
                                <h3 className="text-xl font-bold italic uppercase tracking-tight">ENTERPRISE</h3>
                            </div>
                            <div className="text-3xl font-black italic text-primary mb-4">1,000 BEZ<span className="text-sm text-on-surface-variant font-normal">/mes</span></div>
                            <ul className="space-y-3 text-sm text-on-surface-variant">
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> API dedicada + SLA 99.9%</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Staking boost +25% extra</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Account manager dedicado</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Analytics institucional completo</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Custom smart contracts</li>
                                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Bridge prioritario sin mínimo</li>
                            </ul>
                            <a href={STRIPE_PAYMENT_LINKS.enterprise} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-primary/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-white">
                                Suscribirse
                            </a>
                        </div>
                    </div>
                </section>

                {/* Contract Info */}
                <section className="mb-16">
                    <div className="glass-panel p-8 border border-primary/20 rounded-xl bg-primary/5">
                        <h3 className="text-xl font-bold italic uppercase tracking-tight mb-4">Información del Contrato</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div>
                                <p className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Network</p>
                                <p className="font-bold">BeZhas L2 Mainnet (OP Stack)</p>
                            </div>
                            <div>
                                <p className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Token Standard</p>
                                <p className="font-bold">ERC-20 (BEZCoinV2)</p>
                            </div>
                            <div>
                                <p className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Contract Address</p>
                                <p className="font-mono text-xs text-primary break-all">Verificar en el explorador de bloques</p>
                            </div>
                            <div>
                                <p className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Decimals</p>
                                <p className="font-bold">18</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center py-16 relative">
                    <div className="absolute inset-0 bg-primary/5 -z-10"></div>
                    <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-6">
                        Únete al Ecosistema <span className="text-primary">BeZhas</span>
                    </h2>
                    <p className="text-on-surface-variant text-xl mb-10 max-w-2xl mx-auto">
                        Compra BEZ-Coin, haz staking y participa en la gobernanza del protocolo industrial más avanzado.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/onboarding" className="bg-primary text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform inline-flex items-center justify-center">
                            COMENZAR AHORA
                        </Link>
                        <a href="https://t.me/BeZhasBot" target="_blank" rel="noopener noreferrer" className="glass-panel border border-white/10 text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                            HABLA CON NUESTRO BOT
                        </a>
                    </div>
                </section>
            </div>
        </>
    );
}
