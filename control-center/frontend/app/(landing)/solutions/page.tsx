'use client';

import { usePublicStats } from '@/lib/public-hooks';

export default function SolutionsPage() {
  const { data } = usePublicStats();
  const net = data?.network;
  const defi = data?.defi;
  const comm = data?.commerce;

  const tvl = defi ? `$${(defi.tvl / 1_000_000).toFixed(2)}M` : '—';
  const nodesActive = net?.validatorsActive?.toLocaleString() ?? '—';
  const dailyTx = comm ? `${(comm.dailyTransactions / 1_000_000).toFixed(1)}M TX` : '—';
  const uptime = net ? `${net.uptime}%` : '—';

  return (
    <>

      {/*  Hero Section  */}
      <section className="relative min-h-[819px] flex items-center px-8 overflow-hidden">
        <div className="absolute inset-0 hero-gradient z-0"></div>
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-40 z-0">
          <img alt="Automated Warehouse" className="w-full h-full object-cover mix-blend-screen" data-alt="Ultra-modern automated warehouse with robotic arms and blue glowing network lines mapping logistics flow in a dark industrial setting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAi7M6HrMxplfWBBkXhWE4qlzRJCX8XcPP2F9VwYlKNGbmVOlLXKzwIk4m6rK7nf0YZLhoxnG2qSeGxeGoc_Yzby4FA14w8_UMPEj5vHEEq1i6casFXqNNU-O2kpVtQONpqPVF7UvcGfgVSuAvGcSFPe0tmruV1RDp1ArG8AoQ8dTX0A74GgK6lwRYYwjy6EumWNTVXC8SlCtF-_2cEob1yFp1XyHFeWGm6dhC0rWDHYAnMdHLkpgtlav6YX5N6OvNum2VCDrUr71s" />
        </div>
        <div className="relative z-10 max-w-5xl">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 glass-panel rounded-full">
            <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#22d3ee] animate-pulse"></span>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-tertiary">Industrial Revolution 4.0</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-[0.9] mb-8">
            Industrial <br />
            <span className="text-primary">Tokenization</span>
          </h1>
          <p className="text-xl md:text-2xl text-on-surface-variant max-w-2xl font-light leading-relaxed mb-10">
            The Bezhas Protocol bridges physical infrastructure with decentralized liquidity. Real World Assets (RWA) optimized by Neural Logistics.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="/onboarding" className="bg-primary text-on-primary px-8 py-4 font-bold uppercase tracking-widest rounded-lg hover:shadow-[0_0_30px_rgba(13,51,242,0.4)] transition-all inline-flex items-center">Launch Deployment</a>
            <a href="/learn" className="glass-panel px-8 py-4 font-bold uppercase tracking-widest text-white border border-white/10 hover:bg-white/10 transition-all inline-flex items-center">Whitepaper v2.0</a>
          </div>
        </div>
      </section>
      {/*  Stats HUD  */}
      <section className="px-8 -mt-12 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-6 border-l-2 border-primary">
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Total Value Locked</div>
            <div className="text-3xl font-bold font-headline">{tvl}</div>
          </div>
          <div className="glass-panel p-6 border-l-2 border-tertiary">
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Nodes Active</div>
            <div className="text-3xl font-bold font-headline">{nodesActive}</div>
          </div>
          <div className="glass-panel p-6 border-l-2 border-primary">
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Daily Throughput</div>
            <div className="text-3xl font-bold font-headline">{dailyTx}</div>
          </div>
          <div className="glass-panel p-6 border-l-2 border-secondary">
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Protocol Uptime</div>
            <div className="text-3xl font-bold font-headline">{uptime}</div>
          </div>
        </div>
      </section>
      {/*  Core Solutions Bento Grid  */}
      <section className="py-32 px-8 max-w-7xl mx-auto">
        <div className="mb-20">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter kinetic-border inline-block pb-4">Core Ecosystem Solutions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[800px]">
          {/*  Asset Tokenization Card  */}
          <div className="md:col-span-8 glass-panel rounded-xl overflow-hidden group relative">
            <img alt="Asset Tokenization" className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700" data-alt="Digital representation of real estate logistics hub with geometric blue overlays and data particles floating in air" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3vKFreIlxdBP7EV8A-RqIBNOc_GDTmcjuQwNQ8C_qKU-P0umffUQjtAo_WX6NbjCdIwHFecRYvnUg1VRupj0YPr96TYDWYrXBQSi4x4n2mX9_CV1hzS1j_p_76_IMpzUCOEG2sDVaJZyiybjD-rtOGTX5O_cRj_-S-zI5q1ojZAWBxPLwfc8XMjntZ6MS0XRj8tr0QTj56ehMkjFt4ydeSz4z00QTayNEJHqOxD-QMbCE07IbU2PN26TH6ujHpPEc1MkgMmvFBXo" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
            <div className="relative h-full p-10 flex flex-col justify-end">
              <span className="material-symbols-outlined text-primary text-5xl mb-4" data-icon="account_balance_wallet">account_balance_wallet</span>
              <h3 className="text-4xl font-black italic uppercase mb-4">Asset Tokenization</h3>
              <p className="text-on-surface-variant max-w-lg text-lg mb-6">Fractionalize ownership of industrial real estate and heavy machinery. Turn illiquid physical assets into tradeable on-chain instruments with automated compliance.</p>
              <div className="flex gap-4">
                <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest rounded">RWA Standards</span>
                <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest rounded">Legal Wrapper</span>
              </div>
            </div>
          </div>
          {/*  Institutional Payments Card  */}
          <div className="md:col-span-4 bg-surface-container rounded-xl p-8 flex flex-col border border-white/5">
            <span className="material-symbols-outlined text-tertiary text-4xl mb-6" data-icon="payments">payments</span>
            <h3 className="text-2xl font-black italic uppercase mb-4">Institutional Payments</h3>
            <p className="text-on-surface-variant text-sm flex-grow">Global settlement rails for industrial giants. Instant cross-border transactions using the BEZHAS AI-driven liquidity protocol to minimize slippage.</p>
            <hr className="border-white/5 my-6" />
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold">
                <span className="material-symbols-outlined text-tertiary scale-75" data-icon="check_circle">check_circle</span>
                Multi-Currency Support
              </li>
              <li className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold">
                <span className="material-symbols-outlined text-tertiary scale-75" data-icon="check_circle">check_circle</span>
                Gasless Transactions
              </li>
              <li className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold">
                <span className="material-symbols-outlined text-tertiary scale-75" data-icon="check_circle">check_circle</span>
                Fiat Off-ramps
              </li>
            </ul>
          </div>
          {/*  DePIN Infrastructure Card  */}
          <div className="md:col-span-4 bg-primary rounded-xl p-10 relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 opacity-20 group-hover:rotate-12 transition-transform duration-500">
              <span className="material-symbols-outlined text-[200px]" data-icon="hub">hub</span>
            </div>
            <h3 className="text-3xl font-black italic uppercase mb-4 text-on-primary">DePIN <br />Infrastructure</h3>
            <p className="text-on-primary/80 mb-8 font-medium">Decentralized physical infrastructure for logistics. Reward node operators for providing real-world data and storage capacity.</p>
            <a href="/rpc" className="bg-white text-primary px-6 py-3 font-bold uppercase text-xs tracking-widest rounded-lg inline-flex items-center">Explore Nodes</a>
          </div>
          {/*  AI Neural Network Card  */}
          <div className="md:col-span-8 glass-panel rounded-xl overflow-hidden relative">
            <div className="absolute inset-0 opacity-20">
              <div className="w-full h-full bg-[radial-gradient(#0d33f2_1px,transparent_1px)] [background-size:20px_20px]"></div>
            </div>
            <div className="p-10 relative flex flex-col md:flex-row gap-10 items-center h-full">
              <div className="flex-1">
                <h3 className="text-3xl font-black italic uppercase mb-4">Neural Supply Chain</h3>
                <p className="text-on-surface-variant mb-6">Predictive AI models optimize routing and inventory management in real-time, reducing operational costs by up to 30% through automated smart contracts.</p>
                <div className="flex flex-col gap-2">
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div className="bg-secondary w-3/4 h-full"></div>
                  </div>
                  <div className="flex justify-between text-[10px] uppercase font-bold text-on-surface-variant">
                    <span>AI Efficiency</span>
                    <span>75% Optimization</span>
                  </div>
                </div>
              </div>
              <div className="w-48 h-48 flex-shrink-0 bg-surface-container-highest rounded-full border border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(13,51,242,0.2)]">
                <span className="material-symbols-outlined text-primary text-7xl" data-icon="psychology">psychology</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/*  CTA Section  */}
      <section className="py-24 px-8">
        <div className="max-w-5xl mx-auto glass-panel p-12 rounded-xl border border-primary/20 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
          <h2 className="text-4xl md:text-5xl font-black italic uppercase mb-6">Ready to Tokenize?</h2>
          <p className="text-xl text-on-surface-variant mb-10 max-w-2xl mx-auto">Connect with our institutional advisors to deploy your first industrial RWA vault on the Bezhas Protocol.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <a href="/enterprise" className="bg-primary text-white px-10 py-4 font-bold uppercase tracking-widest rounded-lg inline-flex items-center justify-center">Institutional Access</a>
            <a href="/learn" className="text-white border border-white/20 px-10 py-4 font-bold uppercase tracking-widest rounded-lg hover:bg-white/5 inline-flex items-center justify-center">View Documentation</a>
          </div>
        </div>
      </section>

    </>
  );
}
