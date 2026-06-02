'use client';

import { usePublicStats } from '@/lib/public-hooks';

export default function FinancialPage() {
  const { data } = usePublicStats();
  const defi = data?.defi;
  const stk = data?.staking;
  const tk = data?.token;

  const tvl = defi ? `$${(defi.tvl / 1_000_000).toFixed(1)}M` : '—';
  const tvlChange = tk ? `${tk.change24h >= 0 ? '↑' : '↓'} ${Math.abs(tk.change24h).toFixed(1)}% / 24h` : '—';
  const collateral = stk ? stk.activePositions.toLocaleString() : '—';
  const apy = stk ? `${stk.apr.toFixed(2)}%` : '—';

  return (
    <>

      {/*  Ambient Hero Gradient  */}
      <div className="absolute top-0 left-0 w-full h-[600px] hero-gradient pointer-events-none"></div>
      <div className="max-w-7xl mx-auto px-8 py-12 relative z-10">
        {/*  Hero Section  */}
        <div className="mb-16">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2 w-2 bg-tertiary rounded-full animate-pulse"></span>
            <span className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold">Protocol Status: Optimal</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase mb-6 leading-none">
            Financial <span className="text-primary">Infrastructure</span>
          </h1>
          <p className="text-xl text-on-surface-variant max-w-2xl font-light leading-relaxed">
            BeZhas Kinetic enables the next generation of decentralized finance for global logistics. Modular liquidity pools, RWA-backed lending, and automated treasury systems.
          </p>
        </div>
        {/*  Dashboard Grid (Bento)  */}
        <div className="grid grid-cols-12 gap-6">
          {/*  RWA Lending Panel  */}
          <div className="col-span-12 lg:col-span-8 glass-panel p-8 rounded-xl group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-6xl text-primary" data-icon="hub">hub</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl font-bold italic uppercase tracking-tight mb-2">RWA-Backed Lending Pools</h3>
              <p className="text-on-surface-variant mb-8 max-w-lg">Collateralize real-world freight assets and bills of lading into instant on-chain liquidity.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-container p-6 border border-white/5 rounded-lg">
                  <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Total Value Locked</div>
                  <div className="text-3xl font-bold font-headline">{tvl}</div>
                  <div className="text-xs text-tertiary mt-2">{tvlChange}</div>
                </div>
                <div className="bg-surface-container p-6 border border-white/5 rounded-lg">
                  <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Active Collateral</div>
                  <div className="text-3xl font-bold font-headline">{collateral}</div>
                  <div className="text-xs text-on-surface-variant mt-2 italic">Validated Assets</div>
                </div>
                <div className="bg-surface-container p-6 border border-white/5 rounded-lg">
                  <div className="text-[10px] tracking-widest uppercase text-on-surface-variant mb-1">Avg. Yield (APY)</div>
                  <div className="text-3xl font-bold font-headline text-primary">{apy}</div>
                  <div className="text-xs text-on-surface-variant mt-2 italic">Fixed-term Supply</div>
                </div>
              </div>
            </div>
          </div>
          {/*  Treasury Management  */}
          <div className="col-span-12 lg:col-span-4 bg-surface-container-high border border-white/10 p-8 rounded-xl relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-full h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
            <span className="material-symbols-outlined text-primary mb-6 block text-4xl" data-icon="account_balance_wallet">account_balance_wallet</span>
            <h3 className="text-2xl font-bold italic uppercase mb-4">Automated Treasury</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">Smart contracts for logistics firms to manage cross-border settlements, fuel hedging, and automated payroll across 40+ fiat-pegged stablecoins.</p>
            <a href="/payments" className="block w-full py-3 border border-primary text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold tracking-widest uppercase text-center">
              View Paymaster
            </a>
          </div>
          {/*  Logistics Assets Visualizer  */}
          <div className="col-span-12 lg:col-span-4 glass-panel p-6 rounded-xl aspect-square flex flex-col">
            <h4 className="text-xs font-bold tracking-[0.3em] uppercase text-on-surface-variant mb-6 flex justify-between">
              Supply Chain Liquidity
              <span className="text-primary">LIVE SCAN</span>
            </h4>
            <div className="flex-1 flex items-end gap-2 px-2">
              <div className="w-full bg-primary/20 h-1/2 relative group hover:bg-primary/40 transition-colors">
                <div className="absolute -top-6 left-0 text-[8px] font-mono">08:00</div>
              </div>
              <div className="w-full bg-primary/20 h-3/4 relative"></div>
              <div className="w-full bg-primary h-full relative">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] px-2 py-1">PEAK</div>
              </div>
              <div className="w-full bg-primary/20 h-2/3 relative"></div>
              <div className="w-full bg-primary/20 h-1/2 relative"></div>
              <div className="w-full bg-tertiary/40 h-1/3 relative"></div>
              <div className="w-full bg-primary/20 h-4/5 relative"></div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-white/5">
                <div className="text-[10px] text-on-surface-variant uppercase">Transit Index</div>
                <div className="text-lg font-bold">1.442</div>
              </div>
              <div className="text-center p-3 bg-white/5">
                <div className="text-[10px] text-on-surface-variant uppercase">Volatility</div>
                <div className="text-lg font-bold">LOW</div>
              </div>
            </div>
          </div>
          {/*  Asset Classes  */}
          <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
              <img className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity" data-alt="high-tech shipping container yard with rows of steel boxes under cool blue twilight cinematic lighting with digital data overlays" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5wIe0J_bEcBQz0M_6g5LIRhaha2VJWpqAFS3S0tl6SVL4L-dCNmjR6XyIpQR0_LZY3BAQd2NK4bamXau5GMI97GT7r0eL7TGgKMDcwR5eueTgVCafCd8lC293RIbHrJI9U8KORQPJSv8HD6o-K3332ArkgeFU2-U8v76DIl9buB9wMsIlWyEKWxWsxq4EwJ63cfuIm58izfez-tT0xj3NDUP8xpl3JmG-ym9pVcOHGi1qR7_nYuwKuFpvPKagkN43g0_ksPhsNM0" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-tertiary" data-icon="terminal">terminal</span>
                  <span className="text-[10px] bg-tertiary/10 text-tertiary px-2 py-1 rounded">RWA:01</span>
                </div>
                <h5 className="text-xl font-bold italic uppercase mb-2">Freight Tokenization</h5>
                <p className="text-sm text-on-surface-variant mb-4">Fractionalized ownership of shipping containers and long-haul aircraft fleet assets.</p>
                <a className="text-xs font-bold text-white border-b border-primary pb-1 inline-flex items-center gap-2" href="/commerce">
                  VIEW CATALOG <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
                </a>
              </div>
            </div>
            <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
              <img className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity" data-alt="abstract digital representation of a secure blockchain ledger with glowing blue lines and hexagonal nodes in a dark void" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjrxUwJspSJZaKAJGiwQadqVUP3ecPeeTNpQ7gkTWYxRa4OTm_OGjSA3705JI9IP6p6hCNr06iJmajdvy-DQ66FiWB88_uAM0wsQtV71YL_7Y6UPXlklih5Nxi3wOTGI3gzmwYCTVEdLVa0Upqj2XhX85qAVfzBGA15Km2QL0JUHJx8--_gM4Z0jVwW4ceVeIjfPz21kAx7Gsicbp5wjUEGdTWVfbjmJxdfT0_PG9uaQ1eu-JhR0gVmj5I5p4kzLYRxn-ixfywinM" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-primary" data-icon="shield_with_heart">shield_with_heart</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded">DEFI:02</span>
                </div>
                <h5 className="text-xl font-bold italic uppercase mb-2">Risk Mitigation Vaults</h5>
                <p className="text-sm text-on-surface-variant mb-4">Algorithmically balanced protection against supply chain disruptions and fuel spikes.</p>
                <a className="text-xs font-bold text-white border-b border-primary pb-1 inline-flex items-center gap-2" href="/token">
                  VIEW BEZ TOKEN <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
                </a>
              </div>
            </div>
          </div>
          {/*  Settlement Status  */}
          <div className="col-span-12 glass-panel overflow-hidden">
            <div className="bg-surface-container-high px-8 py-4 flex justify-between items-center border-b border-white/5">
              <h4 className="text-sm font-bold italic tracking-widest uppercase">Real-Time Global Settlements</h4>
              <div className="flex gap-4">
                <span className="text-[10px] text-tertiary">● TOKYO (SETTLED)</span>
                <span className="text-[10px] text-on-surface-variant">● ROTTERDAM (PENDING)</span>
                <span className="text-[10px] text-on-surface-variant">● SINGAPORE (ACTIVE)</span>
              </div>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="border-l-2 border-primary pl-4">
                <div className="text-[10px] text-on-surface-variant uppercase mb-1">Total Transaction Vol</div>
                <div className="text-2xl font-bold">4.2M BHS</div>
              </div>
              <div className="border-l-2 border-white/10 pl-4">
                <div className="text-[10px] text-on-surface-variant uppercase mb-1">Platform Fee</div>
                <div className="text-2xl font-bold text-tertiary">2.5%</div>
              </div>
              <div className="border-l-2 border-white/10 pl-4">
                <div className="text-[10px] text-on-surface-variant uppercase mb-1">Active Smart Invoices</div>
                <div className="text-2xl font-bold">12,492</div>
              </div>
              <div className="border-l-2 border-white/10 pl-4">
                <div className="text-[10px] text-on-surface-variant uppercase mb-1">Settlement Speed</div>
                <div className="text-2xl font-bold">~1.2s</div>
              </div>
            </div>
          </div>

          {/*  DeFi Fee Structure  */}
          <div className="col-span-12 glass-panel overflow-hidden rounded-xl">
            <div className="bg-surface-container-high px-8 py-4 border-b border-white/5">
              <h4 className="text-sm font-bold italic tracking-widest uppercase">Estructura de Comisiones DeFi</h4>
              <p className="text-[10px] text-on-surface-variant tracking-widest uppercase mt-1">Modelo sostenible auditado — Emisiones con topes diarios</p>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface-container p-6 border border-white/5 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary" data-icon="receipt_long">receipt_long</span>
                  <h5 className="font-bold italic uppercase tracking-tight">Invoice Factoring</h5>
                </div>
                <div className="text-3xl font-black italic text-primary mb-2">1%</div>
                <p className="text-xs text-on-surface-variant">Comisión de plataforma sobre facturas tokenizadas. Liquidez instantánea para empresas contra facturas pendientes de cobro.</p>
              </div>
              <div className="bg-surface-container p-6 border border-white/5 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary" data-icon="account_balance">account_balance</span>
                  <h5 className="font-bold italic uppercase tracking-tight">Micro Lending</h5>
                </div>
                <div className="text-3xl font-black italic text-primary mb-2">1%</div>
                <p className="text-xs text-on-surface-variant">Originación fee sobre préstamos RWA-backed. Colateral verificado por oráculos industriales IoT.</p>
              </div>
              <div className="bg-surface-container p-6 border border-white/5 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary" data-icon="work">work</span>
                  <h5 className="font-bold italic uppercase tracking-tight">Freelance Market</h5>
                </div>
                <div className="text-3xl font-black italic text-primary mb-2">7.5%</div>
                <p className="text-xs text-on-surface-variant">Comisión de marketplace con escrow inteligente. Protección comprador-vendedor con liberación automática.</p>
              </div>
            </div>
          </div>

          {/*  Yield & Emission Caps  */}
          <div className="col-span-12 glass-panel overflow-hidden rounded-xl">
            <div className="bg-surface-container-high px-8 py-4 border-b border-white/5">
              <h4 className="text-sm font-bold italic tracking-widest uppercase">Rendimiento Sostenible por Perfil</h4>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h5 className="font-bold italic uppercase tracking-tight text-lg">Staking Pool</h5>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-on-surface-variant">Reward Rate</span>
                    <span className="font-bold">0.05 BEZ/segundo</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-on-surface-variant">Tope Diario</span>
                    <span className="font-bold text-primary">50,000 BEZ</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-on-surface-variant">APR Base Validador</span>
                    <span className="font-bold text-tertiary">~8.2%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-on-surface-variant">APR Máximo (Core Nexus)</span>
                    <span className="font-bold text-tertiary">~12.4%</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h5 className="font-bold italic uppercase tracking-tight text-lg">Liquidity Farming</h5>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-on-surface-variant">Emisión por Bloque</span>
                    <span className="font-bold">0.5 BEZ/bloque</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-on-surface-variant">Tope Diario</span>
                    <span className="font-bold text-primary">25,000 BEZ</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-on-surface-variant">APY Pool Principal (BEZ-USDT)</span>
                    <span className="font-bold text-tertiary">~14.2%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-on-surface-variant">APY con Lock 365d (3x)</span>
                    <span className="font-bold text-tertiary">~42.6%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/*  CTA Section  */}
        <div className="mt-20 glass-panel p-12 text-center rounded-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5"></div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-6 relative z-10">Integrate Kinetic <span className="text-primary">Financials</span></h2>
          <p className="text-on-surface-variant max-w-xl mx-auto mb-10 relative z-10 leading-relaxed">
            Deploy your logistics firm's capital with precision. Access deep liquidity, automated hedging, and instant global payouts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <a href="/login" className="bg-primary text-white font-bold tracking-widest px-10 py-4 text-sm uppercase hover:shadow-[0_0_30px_rgba(13,51,242,0.4)] transition-all inline-flex items-center justify-center">
              Connect Institution
            </a>
            <a href="/developers" className="bg-white/5 border border-white/10 text-white font-bold tracking-widest px-10 py-4 text-sm uppercase hover:bg-white/10 transition-all inline-flex items-center justify-center">
              Developer Docs
            </a>
          </div>
        </div>
      </div>
      {/*  Footer Visualizer  */}
      <div className="h-1 bg-surface-container-highest w-full relative">
        <div className="absolute top-0 left-0 h-full bg-primary/40 w-1/3"></div>
        <div className="absolute top-0 right-0 h-full bg-tertiary/40 w-1/4"></div>
      </div>

    </>
  );
}
