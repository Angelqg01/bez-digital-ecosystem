'use client';

import { usePublicStats } from '@/lib/public-hooks';

export default function CommercePage() {
  const { data } = usePublicStats();
  const comm = data?.commerce;

  const unitsInMotion = comm ? comm.totalNFTs.toLocaleString() : '—';
  const newMints = comm ? (comm.newMints24h >= 1000 ? `${(comm.newMints24h / 1000).toFixed(1)}k` : comm.newMints24h.toString()) : '—';

  return (
    <>

      {/*  Hero Section  */}
      <section className="mb-12">
        <div className="max-w-6xl">
          <h1 className="text-7xl font-black italic tracking-tighter uppercase mb-4 leading-none">
            Supply Chain <span className="text-primary">Intelligence</span>
          </h1>
          <p className="text-xl text-on-surface-variant max-w-2xl mb-8">
            Real-time logistics, inventory tokenization, and consumer engagement metrics powered by the Midnight Kinetic blockchain.
          </p>
          <div className="flex space-x-4">
            <a href="/developers#sdk" className="bg-primary px-8 py-3 font-bold tracking-widest uppercase italic text-sm hover:shadow-[0_0_20px_rgba(13,51,242,0.4)] transition-all inline-flex items-center">
              Deploy SDK
            </a>
            <a href="/network" className="glass-panel border border-white/10 px-8 py-3 font-bold tracking-widest uppercase italic text-sm hover:bg-white/5 transition-all inline-flex items-center">
              View Network
            </a>
          </div>
        </div>
      </section>
      {/*  Bento Grid Dashboard  */}
      <div className="grid grid-cols-12 gap-6 max-w-7xl">
        {/*  Real-time Flow Map (Bento Large)  */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container rounded-xl overflow-hidden relative border border-outline-variant group">
          <div className="absolute top-4 left-4 z-10 space-y-2">
            <div className="bg-primary/20 backdrop-blur-md px-3 py-1 rounded-full flex items-center space-x-2 border border-primary/30">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold tracking-widest uppercase">Live Logistics Stream</span>
            </div>
          </div>
          <div className="h-96 w-full relative">
            <img alt="Global Logistics" className="w-full h-full object-cover opacity-30 grayscale" data-alt="Abstract dark world map with neon blue digital data lines representing global trade routes and logistics flow" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkxBVrw71peoGaOXrRAudpClthEKzTZfVZQNIvuP3KZXkNLeVjvCCAubFdYd02f66xACKXfLP0TfPiZFsaHCbBqS-aGtsoafakk6Ex6KEqIZYge44UQyD1NUyxv4x5npCuLXGYdGh5Mqaw0IZd8MzwqTddpTy89vfaMa4nNbCzF2Fr3lP0xNsnt3l6SNnFObQvQvhZ9IbRNs3HUwcKFdIFnLCoG8A4m2Y4eoRrL6BNMnGHz72JBEXBoUq5z-WMLwn-8HYFqagXAEY" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent"></div>
          </div>
          <div className="p-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-2xl font-bold italic uppercase tracking-tighter">Global Inventory Transit</h3>
                <p className="text-on-surface-variant text-sm">Active shipments crossing 14 geographic zones</p>
              </div>
              <div className="text-right">
                <span className="text-primary text-4xl font-black italic">{unitsInMotion}</span>
                <span className="block text-[10px] tracking-widest text-on-surface-variant uppercase">Units in Motion</span>
              </div>
            </div>
          </div>
        </div>
        {/*  Tokenization Status (Bento Small)  */}
        <div className="col-span-12 lg:col-span-4 bg-surface-container-high rounded-xl p-6 border border-outline-variant flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <span className="material-symbols-outlined text-primary text-4xl">inventory_2</span>
              <div className="text-[10px] tracking-widest uppercase bg-white/5 px-2 py-1 rounded">Status: Synced</div>
            </div>
            <h3 className="text-xl font-bold italic uppercase tracking-tight mb-2">Tokenized SKU Registry</h3>
            <p className="text-on-surface-variant text-sm mb-6">Automated asset-to-token conversion for warehouse tracking.</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-xs tracking-widest uppercase text-on-surface-variant">
              <span>Registry Health</span>
              <span>99.9%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[99.9%]"></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-surface-bright p-3 rounded-lg border border-white/5">
                <div className="text-lg font-bold italic">{newMints}</div>
                <div className="text-[9px] tracking-widest text-on-surface-variant uppercase">New Mints</div>
              </div>
              <div className="bg-surface-bright p-3 rounded-lg border border-white/5">
                <div className="text-lg font-bold italic">0.02s</div>
                <div className="text-[9px] tracking-widest text-on-surface-variant uppercase">Avg Latency</div>
              </div>
            </div>
          </div>
        </div>
        {/*  Analytics SDK (Bento Small)  */}
        <div className="col-span-12 lg:col-span-4 bg-surface-container-high rounded-xl p-6 border border-outline-variant">
          <h3 className="text-xl font-bold italic uppercase tracking-tight mb-4">Commerce SDK v4</h3>
          <div className="bg-black/40 rounded-lg p-4 font-mono text-xs text-primary mb-6 overflow-hidden">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <div className="text-gray-500">// Initialize Bezhas Bridge</div>
            <div><span className="text-secondary">const</span> bridge = <span className="text-white">new BezhasCommerce()</span>;</div>
            <div>bridge.<span className="text-tertiary">trackEngagement</span>(&#123;</div>
            <div className="pl-4">sku: <span className="text-white">'BZ-909'</span>,</div>
            <div className="pl-4">method: <span className="text-white">'NFC_TAP'</span></div>
            <div>&#125;);</div>
          </div>
          <ul className="space-y-3 text-xs tracking-widest uppercase text-on-surface-variant">
            <li className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>React / Vue Native Wrappers</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>E2E Inventory Proofs</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Zero-Knowledge Tracking</span>
            </li>
          </ul>
        </div>
        {/*  Consumer Engagement (Bento Medium)  */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container rounded-xl border border-outline-variant overflow-hidden flex flex-col md:flex-row">
          <div className="p-6 md:w-1/2 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-bold italic uppercase tracking-tighter mb-2">Consumer Engagement</h3>
              <p className="text-on-surface-variant text-sm mb-6">Real-time heatmap of direct-to-consumer interactions via tokenized product tags.</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-widest uppercase font-bold italic">Retail Velocity</span>
                <span className="text-primary text-xl font-bold">+22%</span>
              </div>
              <div className="h-16 flex items-end space-x-1">
                <div className="flex-1 bg-primary/20 h-[40%] rounded-t-sm"></div>
                <div className="flex-1 bg-primary/30 h-[60%] rounded-t-sm"></div>
                <div className="flex-1 bg-primary/40 h-[45%] rounded-t-sm"></div>
                <div className="flex-1 bg-primary/60 h-[80%] rounded-t-sm"></div>
                <div className="flex-1 bg-primary h-[100%] rounded-t-sm"></div>
                <div className="flex-1 bg-primary/80 h-[70%] rounded-t-sm"></div>
                <div className="flex-1 bg-primary/50 h-[55%] rounded-t-sm"></div>
              </div>
            </div>
          </div>
          <div className="md:w-1/2 h-full min-h-[300px] relative">
            <img alt="Consumer Tech" className="w-full h-full object-cover grayscale brightness-50" data-alt="Futuristic glowing smartphone display showing 3D digital product holographic tokens and engagement heatmaps in a dark industrial environment" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD80QJim_uoE54-4AYwXkJWNmiVLlubQWMjjIr8ThCEHlLBsAY6tE2xGmLDU7XfNGH4OIPGLq0vCh6bWrbuPzwocTshFW9J7spscvyk-JXbdT6oprSvcHvKyMblV4BOr8jTXP8X_zvQGDsJgEtMHAjI0U4UkM8iWIBo0AXStN9nozqzwgMuWtfdqnBci3o6E4G45HiYELlZfOELmsQOV90OZyx_0o4MZUZcI90euF9sKqfY5yssh854rmsEf4HLKpkLDVLdbHcZxfQ" />
            <div className="absolute inset-0 bg-gradient-to-l from-surface-container via-transparent to-transparent hidden md:block"></div>
          </div>
        </div>
      </div>
      {/*  Metric Cards  */}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl">
        <div className="glass-panel p-6 border border-white/5 rounded-xl group hover:border-primary/50 transition-all">
          <div className="text-[10px] tracking-[0.3em] text-on-surface-variant uppercase mb-4">Manufacturer Nodes</div>
          <div className="text-4xl font-black italic mb-2">1,204</div>
          <div className="flex items-center text-xs text-primary space-x-1 font-bold">
            <span className="material-symbols-outlined text-xs">arrow_upward</span>
            <span>12% Active Peak</span>
          </div>
        </div>
        <div className="glass-panel p-6 border border-white/5 rounded-xl group hover:border-primary/50 transition-all">
          <div className="text-[10px] tracking-[0.3em] text-on-surface-variant uppercase mb-4">Retail Point-of-Sale</div>
          <div className="text-4xl font-black italic mb-2">48.2K</div>
          <div className="flex items-center text-xs text-primary space-x-1 font-bold">
            <span className="material-symbols-outlined text-xs">arrow_upward</span>
            <span>Synced Terminals</span>
          </div>
        </div>
        <div className="glass-panel p-6 border border-white/5 rounded-xl group hover:border-primary/50 transition-all">
          <div className="text-[10px] tracking-[0.3em] text-on-surface-variant uppercase mb-4">Throughput (TPS)</div>
          <div className="text-4xl font-black italic mb-2">8,500</div>
          <div className="flex items-center text-xs text-secondary space-x-1 font-bold">
            <span className="material-symbols-outlined text-xs">bolt</span>
            <span>Max Industrial Load</span>
          </div>
        </div>
        <div className="glass-panel p-6 border border-white/5 rounded-xl group hover:border-primary/50 transition-all">
          <div className="text-[10px] tracking-[0.3em] text-on-surface-variant uppercase mb-4">Mean Settlement</div>
          <div className="text-4xl font-black italic mb-2">1.8s</div>
          <div className="flex items-center text-xs text-tertiary space-x-1 font-bold">
            <span className="material-symbols-outlined text-xs">timer</span>
            <span>Finality Guaranteed</span>
          </div>
        </div>
      </section>

    </>
  );
}
