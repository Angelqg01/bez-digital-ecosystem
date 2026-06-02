'use client';

import { usePublicStats } from '@/lib/public-hooks';
import { useBridgeStats, SUPPORTED_CHAINS } from '@/lib/bridge-hooks';

export default function BridgesPage() {
    const { data } = usePublicStats();
    const { data: bridgeStatsData } = useBridgeStats();
    const net = data?.network;
    const bridgeStats = bridgeStatsData?.stats;

    const tvb = bridgeStats?.totalBridged
        ? `$${(parseFloat(bridgeStats.totalBridged) / 1_000_000).toFixed(1)}M`
        : net ? `$${(parseFloat(net.bridgeVolume) / 1_000_000).toFixed(1)}M` : '—';
    const totalTx = bridgeStats?.totalTransfers ?? 0;
    const recentTx = bridgeStats?.recentFinalized ?? 0;
    const chainBreakdown = bridgeStats?.chainBreakdown ?? [];
    const activeChains = SUPPORTED_CHAINS.filter(c => c.supported);

    return (
        <>

            <div className="max-w-7xl mx-auto p-8 lg:p-12">
                {/*  Hero Section  */}
                <section className="mb-16 relative">
                    <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
                    <div className="relative z-10">
                        <h2 className="text-10px tracking-[0.4em] text-tertiary mb-4 uppercase">INTEROPERABILITY LAYER</h2>
                        <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase mb-6 leading-none">
                            BRIDGING <span className="text-primary">INDUSTRIES</span>
                        </h1>
                        <p className="text-xl text-on-surface-variant max-w-2xl leading-relaxed">
                            Securely connect BeZhas industrial intelligence with Ethereum, Solana, and institutional stablecoin pools. Fractionalize real-world assets into liquid on-chain tokens.
                        </p>
                    </div>
                </section>
                {/*  Bridge Interface / Bento Grid  */}
                <div className="grid grid-cols-12 gap-6 mb-16">
                    {/*  Main Bridge Controller  */}
                    <div className="col-span-12 lg:col-span-8 glass-panel rounded-xl p-8 border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full"></div>
                        <div className="flex justify-between items-end mb-12">
                            <div>
                                <h3 className="text-2xl font-bold italic uppercase tracking-tighter">ASSET BRIDGE</h3>
                                <p className="text-xs text-on-surface-variant tracking-widest uppercase">ULTRA-LOW LATENCY TRANSFER</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[10px] tracking-widest uppercase opacity-60">NETWORK: OPTIMIZED</span>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {/*  From Section  */}
                            <div className="bg-surface-container p-6 rounded-lg border border-white/5">
                                <label className="text-[10px] tracking-widest uppercase text-on-surface-variant block mb-4">ORIGIN NETWORK</label>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white/10 flex items-center justify-center rounded-full">
                                            <span className="material-symbols-outlined text-primary" data-icon="hub">hub</span>
                                        </div>
                                        <div>
                                            <div className="font-bold uppercase tracking-tight">BEZHAS MAINNET</div>
                                            <div className="text-xs text-on-surface-variant">0.00 BZS</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <input className="bg-transparent border-none text-2xl font-black italic text-right focus:ring-0 p-0 w-full max-w-[200px]" type="text" value="1,250.00" />
                                        <div className="text-[10px] text-on-surface-variant tracking-widest uppercase">MAX: 45,000.00</div>
                                    </div>
                                </div>
                            </div>
                            {/*  Direction Toggle  */}
                            <div className="flex justify-center -my-8 relative z-10">
                                <button className="w-12 h-12 bg-primary flex items-center justify-center rounded-none shadow-[0_0_20px_rgba(13,51,242,0.5)] active:scale-90 transition-transform">
                                    <span className="material-symbols-outlined text-white" data-icon="swap_vert">swap_vert</span>
                                </button>
                            </div>
                            {/*  To Section  */}
                            <div className="bg-surface-container p-6 rounded-lg border border-white/5">
                                <label className="text-[10px] tracking-widest uppercase text-on-surface-variant block mb-4">DESTINATION NETWORK</label>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white/10 flex items-center justify-center rounded-full overflow-hidden">
                                            <img className="w-full h-full object-cover" data-alt="Stylized ethereum logo with iridescent glass texture and neon highlights" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBx2fktXkxJk5gIG9YEVrjOLwZn5axAhE28iHHX66n1jk5tPtBL1NekHwfWJE3W_MgHYknYxD_qUulGtd2s-VLWcWefOlIYo7dZMzTsisnkzQ9tg2v_ifZaDB9upvihn-9UH9-cLuS3JdN9x9FtA8R5jCC0q8oXpHdB7YPaG0dc8LLEfJyr8qv5sVK8TrKwc-tKME_rzPNjepM82mMi89-p-oV01jOS8XT7WWReWN9oo2zEUzk6eduuAu3NXBy8kxkUxobvlbJEKwM" />
                                        </div>
                                        <div>
                                            <div className="font-bold uppercase tracking-tight">ETHEREUM MAINNET</div>
                                            <div className="text-xs text-on-surface-variant">GAS FEE: $14.22</div>
                                        </div>
                                    </div>
                                    <button className="flex items-center gap-2 bg-surface-bright px-4 py-2 border border-white/10 text-xs font-bold tracking-widest uppercase hover:bg-white/10 transition-all">
                                        SELECT ASSET <span className="material-symbols-outlined text-[16px]" data-icon="expand_more">expand_more</span>
                                    </button>
                                </div>
                            </div>
                            <a href="/support" className="block w-full bg-primary py-5 font-black italic tracking-[0.2em] uppercase text-lg shadow-[0_0_40px_rgba(13,51,242,0.2)] hover:shadow-[0_0_60px_rgba(13,51,242,0.4)] transition-all text-center">
                                REQUEST BRIDGE ACCESS
                            </a>
                        </div>
                    </div>
                    {/*  Bridge Stats  */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">
                        <div className="glass-panel p-6 border border-white/10 rounded-xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <h4 className="text-xs tracking-[0.2em] text-on-surface-variant mb-4 uppercase">TOTAL VALUE BRIDGED</h4>
                            <div className="text-4xl font-black italic tracking-tighter mb-2 text-white">{tvb}</div>
                            <div className="h-1 w-full bg-white/5 overflow-hidden">
                                <div className="h-full bg-primary w-[72%]"></div>
                            </div>
                            <div className="flex justify-between mt-2 text-[10px] tracking-widest uppercase text-on-surface-variant">
                                <span>TX TOTALES: {totalTx}</span>
                                <span>24H: {recentTx}</span>
                            </div>
                        </div>
                        <div className="glass-panel p-6 border border-white/10 rounded-xl">
                            <h4 className="text-xs tracking-[0.2em] text-on-surface-variant mb-6 uppercase">ACTIVE CONNECTIONS</h4>
                            <div className="space-y-4">
                                {activeChains.map(chain => {
                                    const breakdown = chainBreakdown.find((b: { chainId: number }) => b.chainId === chain.chainId);
                                    return (
                                        <div key={chain.chainId} className="flex items-center justify-between group cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${chain.color}`}></span>
                                                <span className="font-bold tracking-tighter text-sm uppercase">{chain.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {breakdown && <span className="text-[10px] text-on-surface-variant">{breakdown.count} tx</span>}
                                                <span className="material-symbols-outlined text-sm text-cyan-400" data-icon="check_circle">check_circle</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="bg-surface-container-high p-6 rounded-xl border-l-4 border-primary">
                            <div className="material-symbols-outlined text-primary mb-2" data-icon="security">security</div>
                            <h4 className="font-bold italic uppercase tracking-tighter mb-2">INSTITUTIONAL GRADE</h4>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                                Every bridge transaction is secured by BeZhas' Multi-Party Computation (MPC) nodes and verified by on-chain industrial sensors.
                            </p>
                        </div>
                    </div>
                </div>
                {/*  Asset Classes Section  */}
                <section className="mb-16">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-black italic uppercase tracking-tighter">SUPPORTED ASSET CLASSES</h2>
                            <p className="text-on-surface-variant text-sm tracking-widest uppercase">FROM RAW MATERIALS TO DIGITAL LIQUIDITY</p>
                        </div>
                        <a href="/bridges#assets" className="text-xs font-bold text-primary tracking-widest border border-primary/20 px-6 py-2 hover:bg-primary hover:text-white transition-all uppercase inline-flex items-center">VIEW ALL ASSETS</a>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/*  Industrial Asset  */}
                        <div className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-container">
                            <img className="w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" data-alt="High-tech industrial steel refinery at night with orange sparks and glowing blue structural lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAa8njXBoN60DN2wZyKROzWwRtoA1xwgreujtzTmxsAmuI8jYqoPrJXAxDo_IuTDqG9u4y5Ofo_LIK6VgeoNzSyQkzkKVXsWb30k5K2YdB2BT0be7DlGQ3EG803ADq_j2mOUQ_g8-EjVG7aNV9MB0cEFiL5fsAIhUwdQ0piNUEin_6dVv0JXHfSOYW3ixzk84kGzEsE7hwHatj1IY5IJIJSgKG1xrSDOula_07ufhxV3DY9gpGl1B4a0Y-AaDOTeeujl7CEPleclnw" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
                            <div className="absolute bottom-0 p-8 w-full">
                                <span className="inline-block px-3 py-1 bg-primary text-[10px] font-bold tracking-[0.2em] uppercase mb-4">WRAPPED</span>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2 leading-none">STRUCTURAL<br />STEEL INDICES</h3>
                                <p className="text-sm text-on-surface-variant mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    Trade high-grade industrial steel spot prices bridged from global physical supply chains.
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono tracking-widest uppercase text-white">SYMBOL: wSTEEL</span>
                                    <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform" data-icon="arrow_forward">arrow_forward</span>
                                </div>
                            </div>
                        </div>
                        {/*  Stablecoin Asset  */}
                        <div className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-container">
                            <img className="w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" data-alt="Abstract 3D digital visualization of interconnected currency symbols and geometric patterns in shades of deep blue and silver" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDy4pR3vZ0deZF3SBnzkNjryl24-L09oVN_7eNegLCmXt8Wrz9jM8jDzoEg1dPywCOjBp-bUHePA2JzPoK5e7k2vKKkZFMHg-b0kHoJ8xkINFAe6eMgb-SGbGrLv7dDkMBzw72_v2SeA28-PIGQuGGxB4MprOYyWIKg4XxirfJlBEF9Cx4Ktepx5l1wp1Qt2AXfohfIyEW3e0NC-c-I19BdPBfRwlFxfB1G8kgfvVYraVZun4cX1ziXNZWDnjJmBakoZbKd6gZP64A" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
                            <div className="absolute bottom-0 p-8 w-full">
                                <span className="inline-block px-3 py-1 bg-tertiary text-background text-[10px] font-bold tracking-[0.2em] uppercase mb-4">STABLE</span>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2 leading-none">GLOBAL<br />USDC POOL</h3>
                                <p className="text-sm text-on-surface-variant mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    High-liquidity stablecoin gateway for instant settlement of industrial contracts.
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono tracking-widest uppercase text-white">SYMBOL: USDC.bz</span>
                                    <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform" data-icon="arrow_forward">arrow_forward</span>
                                </div>
                            </div>
                        </div>
                        {/*  L1 Token Asset  */}
                        <div className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-container">
                            <img className="w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" data-alt="Macro photography of a computer circuit board with glowing neon pathways and high-speed data visual effects" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5RTHA0P3_l-q-H-AA3fXSmWS6mRF_JgZS6jC7NAlVe5_7AKY4ze1ffo4CNDqvpAmoNNCtk2HATRfsrwHubNhfrWv6rqCx2GfkSc98wNWR4kDxgbnX4cOyHztpJLqTLJe4OuXYhlusUf099fm5UWuR4jiF93bkbdUi42JGmJtb2ojny0pzSV1arFUk3YBW04xyvW28wI87hTeThK4sUOjDSayJe26ba-xJ-L0aJcGBRlmL32r87xEseZGmtK1KrmdM1xPonv0KkAo" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
                            <div className="absolute bottom-0 p-8 w-full">
                                <span className="inline-block px-3 py-1 bg-secondary text-white text-[10px] font-bold tracking-[0.2em] uppercase mb-4">L1 BRIDGE</span>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2 leading-none">SOLANA<br />WRAPPED SOL</h3>
                                <p className="text-sm text-on-surface-variant mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    Bridge native Solana ecosystem assets directly into BeZhas industrial dApps.
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono tracking-widest uppercase text-white">SYMBOL: bSOL</span>
                                    <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform" data-icon="arrow_forward">arrow_forward</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                {/*  Technical Detail Grid  */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 py-16 border-t border-white/5">
                    {/*  Bridge Fee Structure  */}
                    <div>
                        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-6">BRIDGE<br /><span className="text-primary">FEE STRUCTURE</span></h2>
                        <p className="text-on-surface-variant leading-relaxed mb-8">
                            Comisiones transparentes y competitivas para transferencias cross-chain industriales. Sin fees ocultos, sin intermediarios bancarios.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4 bg-white/5 p-4 rounded-lg">
                                <span className="material-symbols-outlined text-primary mt-1" data-icon="percent">percent</span>
                                <div>
                                    <h4 className="font-bold uppercase text-sm tracking-tight">BRIDGE FEE RATE</h4>
                                    <p className="text-2xl font-black italic text-primary">0.5%</p>
                                    <p className="text-xs text-on-surface-variant">Sobre el valor total bridgeado. Aplica a todas las chains soportadas.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-white/5 p-4 rounded-lg">
                                <span className="material-symbols-outlined text-primary mt-1" data-icon="toll">toll</span>
                                <div>
                                    <h4 className="font-bold uppercase text-sm tracking-tight">MINIMUM FEE</h4>
                                    <p className="text-2xl font-black italic text-primary">10 BEZ</p>
                                    <p className="text-xs text-on-surface-variant">Fee mínimo por transacción (~$1.00 USD). Protege contra spam de micro-transacciones.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-white/5 p-4 rounded-lg">
                                <span className="material-symbols-outlined text-primary mt-1" data-icon="speed">speed</span>
                                <div>
                                    <h4 className="font-bold uppercase text-sm tracking-tight">SETTLEMENT TIME</h4>
                                    <p className="text-2xl font-black italic text-tertiary">1-5 min</p>
                                    <p className="text-xs text-on-surface-variant">vs 3-5 días hábiles en SWIFT. Confirmación MPC multi-node.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-cyan-500/20 blur-2xl opacity-30"></div>
                        <div className="relative glass-panel rounded-xl p-8 border border-white/10 h-full flex flex-col justify-center">
                            <h5 className="text-xs tracking-widest uppercase text-primary font-bold mb-6">COMPARATIVA DE COSTOS</h5>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                                    <span className="font-bold uppercase text-sm tracking-tight">BeZhas Bridge</span>
                                    <span className="text-xl font-black italic text-primary">0.5% + 10 BEZ</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                    <span className="text-sm text-on-surface-variant">SWIFT Transfer</span>
                                    <span className="font-bold text-on-surface-variant">1-3% + $25-50</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                    <span className="text-sm text-on-surface-variant">Wormhole</span>
                                    <span className="font-bold text-on-surface-variant">Variable (gas)</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                    <span className="text-sm text-on-surface-variant">LayerZero</span>
                                    <span className="font-bold text-on-surface-variant">Variable (gas + relayer)</span>
                                </div>
                            </div>
                            <div className="mt-6 p-4 border border-primary/20 rounded-lg bg-primary/5">
                                <p className="text-xs text-on-surface-variant">
                                    <span className="text-primary font-bold">ENTERPRISE:</span> Suscriptores Enterprise (1,000 BEZ/mes) obtienen bridge prioritario sin el fee mínimo de 10 BEZ.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/*  Liquidity Tokenization  */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 py-16 border-t border-white/5">
                    <div>
                        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-6">LIQUIDITY<br />TOKENIZATION</h2>
                        <p className="text-on-surface-variant leading-relaxed mb-8">
                            The BeZhas Bridge Protocol goes beyond simple cross-chain transfers. We specialize in the wrapping of physical machinery, raw materials, and energy grid capacity into Liquid Industrial Tokens (LITs). This allows industrial giants to leverage their physical assets as collateral on decentralized finance platforms.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-primary mt-1" data-icon="verified">verified</span>
                                <div>
                                    <h4 className="font-bold uppercase text-sm tracking-tight">ORACLE-VERIFIED ASSETS</h4>
                                    <p className="text-xs text-on-surface-variant">Real-time IoT data feeds confirm asset status before minting tokens.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-primary mt-1" data-icon="account_balance_wallet">account_balance_wallet</span>
                                <div>
                                    <h4 className="font-bold uppercase text-sm tracking-tight">FRACTIONAL OWNERSHIP</h4>
                                    <p className="text-xs text-on-surface-variant">Divide billion-dollar refineries into accessible $100 units.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-cyan-500/20 blur-2xl opacity-30"></div>
                        <div className="relative glass-panel rounded-xl p-8 border border-white/10 h-full flex flex-col justify-center">
                            <div className="flex items-center gap-6 mb-8">
                                <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center p-2">
                                    <div className="w-full h-full bg-primary rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white" data-icon="token">token</span>
                                    </div>
                                </div>
                                <div>
                                    <h5 className="text-xs tracking-widest uppercase text-primary font-bold">WRAPPING PROCESS</h5>
                                    <p className="text-xl font-bold uppercase tracking-tighter">PHYSICAL &gt; DIGITAL &gt; LIQUID</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="h-1 bg-white/10 rounded-full relative">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-[0_0_10px_rgba(13,51,242,1)]"></div>
                                    <div className="absolute left-[33%] top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full"></div>
                                    <div className="absolute left-[66%] top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full"></div>
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-surface-container rounded-full border border-primary animate-pulse"></div>
                                </div>
                                <div className="grid grid-cols-4 text-[9px] tracking-widest uppercase text-center text-on-surface-variant">
                                    <span>AUDIT</span>
                                    <span>MINT</span>
                                    <span>ESCROW</span>
                                    <span className="text-primary font-bold">BRIDGE</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

        </>
    );
}
