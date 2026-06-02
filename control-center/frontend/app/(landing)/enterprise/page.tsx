export default function EnterprisePage() {
    return (
        <>

            {/*  Hero Section  */}
            <section className="relative min-h-[819px] flex items-center justify-center px-6 hero-gradient overflow-hidden">
                <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 glass-panel px-4 py-1 rounded-full border border-white/10">
                            <span className="w-2 h-2 bg-tertiary rounded-full animate-pulse"></span>
                            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-tertiary">Industrial Protocol v4.0</span>
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
                            GLOBAL <br /> <span className="text-primary">KINETICS</span>
                        </h1>
                        <p className="text-on-surface-variant text-xl max-w-lg font-light leading-relaxed">
                            The definitive L2 protocol for industrial supply chains. Deploy AI Oracles and RWA Tokenization at the speed of light.
                        </p>
                        <div className="flex flex-wrap gap-4 pt-4">
                            <a href="/learn" className="bg-primary text-white px-10 py-4 font-bold uppercase tracking-widest text-sm hover:translate-y-[-2px] transition-transform inline-flex items-center">
                                GET THE WHITE PAPER
                            </a>
                            <a href="/learn" className="glass-panel border border-white/10 text-white px-10 py-4 font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors inline-flex items-center">
                                VIEW CASE STUDIES
                            </a>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute -inset-10 bg-primary/20 blur-[100px] rounded-full"></div>
                        <div className="relative glass-panel border border-white/10 p-4 rounded-xl rotate-3 hover:rotate-0 transition-transform duration-500">
                            <img alt="Logistics terminal" className="rounded-lg grayscale hover:grayscale-0 transition-all duration-700 aspect-video object-cover" data-alt="Futuristic cargo port at night with glowing blue interface overlays and automated shipping containers under dramatic neon lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB941UyrGVkEO10Lxx6j5tqQnQ6dXcBdPFb64ETyL7JvEYAJ2nPCqmO2oeTguTV1NIlDeWQNbwsS0DR0T7oj1ddyjRA88OEN-9XY-JBnGnNWlzBUMkJNWDfRbCKL-fXnjjXz9DjPARqwDIkRwhZgSigKo8vkaZCMtpkf4-J_iidUmQySOTvqMzAL-21GXZXPlX4evyKxx-1xFivMzjCwCwX5c_GmsFVsyyrUCdzz2U5vvwk5mEKkLWUjp4nD8ROspMMj8-iaxzcx5c" />
                            <div className="mt-4 flex justify-between items-center text-[10px] font-mono text-primary tracking-widest uppercase">
                                <span>TRANSIT_ID: BZ-9920</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-primary rounded-full"></span> ENCRYPTED</span>
                            </div>
                        </div>
                    </div>
                </div>
                {/*  Technical Data Watermark  */}
                <div className="absolute bottom-10 right-10 opacity-10 pointer-events-none hidden lg:block">
                    <pre className="font-mono text-[10px] leading-tight">                    RUNNING SYNC...
                        [SYSTEM_OK]
                        LATENCY: 4.2ms
                        NODES: 12,401
                        SECURITY: LEVEL_A
                        PROTO: BEZHAS_X_9
                    </pre>
                </div>
            </section>
            {/*  Solutions Bento Grid  */}
            <section className="py-24 px-6 max-w-7xl mx-auto">
                <div className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Core <span className="text-primary">Capabilities</span></h2>
                    <div className="h-1 w-24 bg-primary"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/*  AI Oracles Card  */}
                    <div className="md:col-span-2 group relative glass-panel border border-white/5 p-8 rounded-xl overflow-hidden hover:border-primary/50 transition-colors">
                        <div className="relative z-10 h-full flex flex-col">
                            <span className="material-symbols-outlined text-4xl text-primary mb-6">psychology</span>
                            <h3 className="text-3xl font-bold italic uppercase tracking-tighter mb-4">Industrial-Grade AI Oracles</h3>
                            <p className="text-on-surface-variant max-w-md mb-8 leading-relaxed">
                                Connect your physical assets to the ledger via hyper-local AI processing. Zero-latency verification for temperature, tilt, and transit velocity.
                            </p>
                            <div className="mt-auto flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-primary">
                                LEARN MORE <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-1/3 h-full opacity-20 grayscale group-hover:grayscale-0 group-hover:opacity-40 transition-all">
                            <img alt="Data visualization" className="h-full object-cover" data-alt="Close-up of a complex digital dashboard showing real-time global shipping metrics with neon blue and cyan line graphs" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUqA9F6o6Z6PqtQfU_gf7mBJ_eptoXBJwbheBKEr2hyrJq2avxl5hv-H0DSc-bPKB0wNJuLIv1z7MKvLD1hdWy6tjasqu8Rw7evYASV4BeVBZeRv46NRAEfy-beK0BskWvEf3VMA3rx8fjpmSrI5o-_vLWcgGUUAReCNtbBq-WSt87v-Owh04r_89voHnr1U6pZ533Z9-toCETVVcS3NoaArkdWTrpyhdXqp7LMZHbvIvdotXkel3vMUHAVNK01IYu7XJyQCSSGMc" />
                        </div>
                    </div>
                    {/*  RWA Tokenization  */}
                    <div className="group relative glass-panel border border-white/5 p-8 rounded-xl hover:border-primary/50 transition-colors">
                        <span className="material-symbols-outlined text-4xl text-primary mb-6">token</span>
                        <h3 className="text-2xl font-bold italic uppercase tracking-tighter mb-4">RWA HUB Tokenization</h3>
                        <p className="text-on-surface-variant text-sm mb-8">
                            Fractionalize logistics infrastructure into liquid assets. Real-world asset (RWA) liquidity for regional hubs.
                        </p>
                        <div className="mt-auto flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-primary">
                            HUB SPECS <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </div>
                    </div>
                    {/*  Automated Compliance  */}
                    <div className="group relative glass-panel border border-white/5 p-8 rounded-xl hover:border-primary/50 transition-colors">
                        <span className="material-symbols-outlined text-4xl text-primary mb-6">fact_check</span>
                        <h3 className="text-2xl font-bold italic uppercase tracking-tighter mb-4">Freight Compliance</h3>
                        <p className="text-on-surface-variant text-sm mb-8">
                            Automated customs filing and automated bill of lading (BoL) verification using zero-knowledge proofs.
                        </p>
                        <div className="mt-auto flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-primary">
                            ZKP DOCS <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </div>
                    </div>
                    {/*  Global Sync  */}
                    <div className="md:col-span-2 group relative bg-primary p-8 rounded-xl overflow-hidden hover:shadow-[0_0_30px_rgba(13,51,242,0.4)] transition-all">
                        <div className="relative z-10 flex flex-col h-full">
                            <h3 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-white">24/7 Global <br /> Ledger Sync</h3>
                            <p className="text-white/80 max-w-lg mb-8 leading-relaxed">
                                Synchronize your entire enterprise fleet across 40+ maritime zones with sub-second finality. No more reconciliation delays.
                            </p>
                            <a href="/network" className="w-fit bg-white text-primary px-8 py-3 font-bold uppercase tracking-widest text-xs inline-flex items-center">
                                EXPLORE NETWORK
                            </a>
                        </div>
                        {/*  Abstract Background Element  */}
                        <div className="absolute -right-10 -bottom-10 opacity-20">
                            <span className="material-symbols-outlined text-[200px] text-white">public</span>
                        </div>
                    </div>
                </div>
            </section>
            {/*  Partnership Section  */}
            <section className="py-24 bg-surface-container-low border-y border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <p className="text-primary font-bold uppercase tracking-[0.4em] text-[10px] mb-4">INSTITUTIONAL PARTNERS</p>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase">TRUSTED BY <span className="text-primary">TIER 1</span> TITANS</h2>
                    </div>
                    <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-40 grayscale transition-all duration-500 hover:grayscale-0">
                        {/*  Faux Logos  */}
                        <div className="flex items-center gap-2 font-black italic text-2xl tracking-tighter uppercase">
                            <span className="material-symbols-outlined text-primary">rocket</span> NOVA LOGISTICS
                        </div>
                        <div className="flex items-center gap-2 font-black italic text-2xl tracking-tighter uppercase">
                            <span className="material-symbols-outlined text-primary">anchor</span> MAERSK_X
                        </div>
                        <div className="flex items-center gap-2 font-black italic text-2xl tracking-tighter uppercase">
                            <span className="material-symbols-outlined text-primary">flight_takeoff</span> AIRTRANS GLOBAL
                        </div>
                        <div className="flex items-center gap-2 font-black italic text-2xl tracking-tighter uppercase">
                            <span className="material-symbols-outlined text-primary">rainy_snow</span> HYDRO_HUB
                        </div>
                    </div>
                </div>
            </section>
            {/*  Case Study Highlight  */}
            <section className="py-24 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="order-2 lg:order-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass-panel p-6 border border-white/5 rounded-xl">
                                <p className="text-3xl font-black text-primary italic mb-1">32%</p>
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Efficiency Gain</p>
                            </div>
                            <div className="glass-panel p-6 border border-white/5 rounded-xl">
                                <p className="text-3xl font-black text-tertiary italic mb-1">$40M</p>
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">OPEX SAVED</p>
                            </div>
                            <div className="glass-panel p-6 border border-white/5 rounded-xl">
                                <p className="text-3xl font-black text-white italic mb-1">0.0s</p>
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">AUDIT DELAY</p>
                            </div>
                            <div className="glass-panel p-6 border border-white/5 rounded-xl">
                                <p className="text-3xl font-black text-secondary italic mb-1">100%</p>
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">ESG COMPLIANCE</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6 order-1 lg:order-2">
                        <p className="text-primary font-bold uppercase tracking-[0.4em] text-[10px]">CASE STUDY: ROTTERDAM HUB</p>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">THE FUTURE OF THE <span className="text-primary">SMART PORT</span></h2>
                        <p className="text-on-surface-variant text-lg leading-relaxed">
                            Discover how the Port of Rotterdam leveraged BeZhas AI Oracles to automate berth scheduling and real-time cargo tokenization, reducing dwell time by 32% in the first quarter of deployment.
                        </p>
                        <a href="/learn" className="border-b-2 border-primary text-white font-bold uppercase tracking-widest py-2 text-sm hover:text-primary transition-colors inline-flex items-center gap-2">
                            READ FULL CASE STUDY <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </a>
                    </div>
                </div>
            </section>
            {/*  Enterprise Tokenomics  */}
            <section className="py-24 px-6 max-w-7xl mx-auto">
                <div className="mb-16">
                    <p className="text-primary font-bold uppercase tracking-[0.4em] text-[10px] mb-4">ENTERPRISE ECONOMICS</p>
                    <h2 className="text-5xl font-black italic tracking-tighter uppercase">TOKENOMICS <span className="text-primary">EMPRESARIAL</span></h2>
                    <div className="h-1 w-24 bg-primary mt-4"></div>
                    <p className="text-on-surface-variant text-lg mt-4 max-w-2xl">Modelo económico sostenible con emisiones controladas. Comisiones competitivas diseñadas para operaciones industriales a escala.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {/* Payment Processing */}
                    <div className="glass-panel p-8 border border-white/5 rounded-xl hover:border-primary/50 transition-colors">
                        <span className="material-symbols-outlined text-4xl text-primary mb-4">payments</span>
                        <h3 className="text-2xl font-bold italic uppercase tracking-tighter mb-2">BeZhas Pay</h3>
                        <div className="text-4xl font-black italic text-primary mb-4">2.5%</div>
                        <p className="text-on-surface-variant text-sm mb-4">Comisión plana sobre pagos procesados. Sin fees ocultos, sin cargos por transacción.</p>
                        <div className="bg-white/5 p-3 rounded-lg text-xs">
                            <span className="text-on-surface-variant">vs Stripe:</span> <span className="font-bold text-tertiary">2.9% + $0.30/tx</span>
                        </div>
                    </div>

                    {/* Bridge Fees */}
                    <div className="glass-panel p-8 border border-white/5 rounded-xl hover:border-primary/50 transition-colors">
                        <span className="material-symbols-outlined text-4xl text-primary mb-4">swap_horiz</span>
                        <h3 className="text-2xl font-bold italic uppercase tracking-tighter mb-2">Bridge Cross-Chain</h3>
                        <div className="text-4xl font-black italic text-primary mb-4">0.5%</div>
                        <p className="text-on-surface-variant text-sm mb-4">Fee de bridge + 10 BEZ mínimo por transacción. MPC-secured multi-chain.</p>
                        <div className="bg-white/5 p-3 rounded-lg text-xs">
                            <span className="text-on-surface-variant">Chains:</span> <span className="font-bold">Ethereum, Polygon, Solana</span>
                        </div>
                    </div>

                    {/* Validator ROI */}
                    <div className="glass-panel p-8 border border-primary/20 rounded-xl bg-primary/5">
                        <span className="material-symbols-outlined text-4xl text-primary mb-4">trending_up</span>
                        <h3 className="text-2xl font-bold italic uppercase tracking-tighter mb-2">Validator Enterprise</h3>
                        <div className="text-4xl font-black italic text-tertiary mb-4">12.4%</div>
                        <p className="text-on-surface-variant text-sm mb-4">APR Core Nexus (1M+ BEZ). Tope diario 50K BEZ. Comisión mínima 2%.</p>
                        <div className="bg-white/5 p-3 rounded-lg text-xs">
                            <span className="text-on-surface-variant">Retorno:</span> <span className="font-bold text-tertiary">~124,000 BEZ/año (~$12,400)</span>
                        </div>
                    </div>
                </div>

                {/* Enterprise ROI Calculator */}
                <div className="glass-panel p-8 border border-white/5 rounded-xl">
                    <h3 className="text-2xl font-bold italic uppercase tracking-tighter mb-6">ROI Estimado por Operación</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] tracking-[0.3em] uppercase text-gray-400 border-b border-white/10">
                                    <th className="p-4 font-medium">Operación</th>
                                    <th className="p-4 font-medium">Volumen Mensual</th>
                                    <th className="p-4 font-medium">Fee BeZhas</th>
                                    <th className="p-4 font-medium">Fee Tradicional</th>
                                    <th className="p-4 font-medium">Ahorro Anual</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                <tr className="hover:bg-white/5">
                                    <td className="p-4 font-bold">Pagos B2B</td>
                                    <td className="p-4">$500K</td>
                                    <td className="p-4 text-primary font-bold">$12,500 (2.5%)</td>
                                    <td className="p-4 text-red-400">$14,800 (2.9%+$0.30)</td>
                                    <td className="p-4 text-tertiary font-bold">$27,600/año</td>
                                </tr>
                                <tr className="hover:bg-white/5">
                                    <td className="p-4 font-bold">Bridge Cross-Chain</td>
                                    <td className="p-4">$1M</td>
                                    <td className="p-4 text-primary font-bold">$5,000 (0.5%)</td>
                                    <td className="p-4 text-red-400">$10,000 (1% SWIFT)</td>
                                    <td className="p-4 text-tertiary font-bold">$60,000/año</td>
                                </tr>
                                <tr className="hover:bg-white/5">
                                    <td className="p-4 font-bold">Invoice Factoring (RWA)</td>
                                    <td className="p-4">$200K</td>
                                    <td className="p-4 text-primary font-bold">$2,000 (1%)</td>
                                    <td className="p-4 text-red-400">$6,000 (3% bancario)</td>
                                    <td className="p-4 text-tertiary font-bold">$48,000/año</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
            {/*  CTA Section  */}
            <section className="py-32 px-6">
                <div className="max-w-4xl mx-auto glass-panel border border-primary/20 p-12 text-center rounded-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 -z-10"></div>
                    <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-6">Ready to <span className="text-primary">Evolve?</span></h2>
                    <p className="text-on-surface-variant text-xl mb-10 max-w-2xl mx-auto">
                        Speak with our industrial solutions team to design a bespoke deployment architecture for your global operations.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="/onboarding" className="bg-primary text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform inline-flex items-center justify-center">
                            REQUEST A DEMO
                        </a>
                        <a href="mailto:info.bezcoin@bez.digital" className="glass-panel border border-white/10 text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors inline-flex items-center justify-center">
                            CONTACT SALES
                        </a>
                        <a href="https://t.me/BeZhasBot" target="_blank" rel="noopener noreferrer" className="glass-panel border border-white/10 text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                            TELEGRAM BOT
                        </a>
                    </div>
                </div>
            </section>
            {/*  Footer  */}
            <footer className="py-12 border-t border-white/5 bg-surface-container-lowest">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col items-center md:items-start">
                        <span className="text-2xl font-black italic tracking-tighter text-white font-['Space_Grotesk'] uppercase">BEZHAS</span>
                        <p className="text-[10px] text-gray-600 tracking-[0.2em] mt-2">© 2024 BEZHAS KINETIC PROTOCOL. ALL RIGHTS RESERVED.</p>
                    </div>
                    <div className="flex gap-8 text-[10px] font-bold tracking-[0.3em] uppercase text-gray-400">
                        <a className="hover:text-primary transition-colors" href="/network">System Status</a>
                        <a className="hover:text-primary transition-colors" href="/learn">Privacy Lex</a>
                        <a className="hover:text-primary transition-colors" href="/validators">Governance</a>
                        <a className="hover:text-primary transition-colors" href="/developers">Developer Portal</a>
                    </div>
                </div>
            </footer>

        </>
    );
}
