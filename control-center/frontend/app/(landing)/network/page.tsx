'use client';

import { usePublicStats } from '@/lib/public-hooks';

export default function NetworkPage() {
  const { data } = usePublicStats();
  const net = data?.network;

  const tps = net ? net.totalTransactions.toLocaleString() : '—';
  const nodes = net ? net.validatorsActive.toLocaleString() : '—';
  const status = net?.status === 'operational' ? 'OPERATIONAL' : (net?.status?.toUpperCase() || '—');
  const uptime = net ? `${net.uptime}%` : '—';

  return (
    <>

      <header className="mb-12">
        <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase mb-2">Network_Command</h1>
        <p className="text-on-surface-variant font-medium tracking-wide">Real-time Bezhas protocol integrity and neural performance monitoring.</p>
      </header>
      {/*  Stats Bento Grid  */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/*  Current TPS  */}
        <div className="surface-container p-6 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full translate-x-16 -translate-y-16 group-hover:bg-primary/20 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 font-bold">Total Transactions</span>
            <span className="material-symbols-outlined text-primary" data-icon="bolt">bolt</span>
          </div>
          <div className="text-4xl font-black italic tracking-tighter text-white mb-1">{tps}</div>
          <div className="text-[10px] tracking-widest text-tertiary flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]" data-icon="trending_up">trending_up</span>
            LIVE FROM CHAIN
          </div>
        </div>
        {/*  Active Nodes  */}
        <div className="surface-container p-6 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 font-bold">Active Validators</span>
            <span className="material-symbols-outlined text-primary" data-icon="lan">lan</span>
          </div>
          <div className="text-4xl font-black italic tracking-tighter text-white mb-1">{nodes}</div>
          <div className="text-[10px] tracking-widest text-on-surface-variant">OF {net?.validatorsTotal ?? '—'} REGISTERED</div>
        </div>
        {/*  Mainnet Status  */}
        <div className="surface-container p-6 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 font-bold">Mainnet Status</span>
            <div className={`w-3 h-3 rounded-full ${status === 'OPERATIONAL' ? 'bg-tertiary shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'bg-error'}`}></div>
          </div>
          <div className={`text-4xl font-black italic tracking-tighter mb-1 ${status === 'OPERATIONAL' ? 'text-tertiary' : 'text-error'}`}>{status}</div>
          <div className="text-[10px] tracking-widest text-on-surface-variant uppercase">Uptime: {uptime}</div>
        </div>
        {/*  Bridge Volume  */}
        <div className="surface-container p-6 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 font-bold">Bridge Volume</span>
            <span className="material-symbols-outlined text-primary" data-icon="timer">timer</span>
          </div>
          <div className="text-4xl font-black italic tracking-tighter text-white mb-1">{net ? parseFloat(net.bridgeVolume).toLocaleString() : '—'}</div>
          <div className="text-[10px] tracking-widest text-on-surface-variant flex items-center gap-1 uppercase">
            BEZ BRIDGED TOTAL
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/*  Visualization Canvas  */}
        <div className="lg:col-span-2 space-y-8">
          {/*  Throughput Chart  */}
          <div className="surface-container p-8 rounded-xl border border-white/5 relative">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">Network_Throughput_24H</h3>
                <p className="text-[10px] tracking-widest text-white/40 uppercase">Neural data processing cycles</p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold tracking-widest rounded-sm">LIVE</span>
                <span className="px-3 py-1 bg-white/5 text-white/40 text-[10px] font-bold tracking-widest rounded-sm">HISTORIC</span>
              </div>
            </div>
            <div className="h-64 w-full flex items-end gap-1 relative">
              {/*  Mock Chart Bars  */}
              <div className="flex-grow bg-primary/20 hover:bg-primary/40 transition-all h-[40%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/20 hover:bg-primary/40 transition-all h-[55%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/20 hover:bg-primary/40 transition-all h-[45%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/30 hover:bg-primary/50 transition-all h-[70%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/40 hover:bg-primary/60 transition-all h-[85%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/20 hover:bg-primary/40 transition-all h-[60%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/50 hover:bg-primary/70 transition-all h-[95%] rounded-t-sm relative">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-mono text-tertiary bg-background border border-tertiary/30 px-2 py-1">PEAK_62K</div>
              </div>
              <div className="flex-grow bg-primary/30 hover:bg-primary/50 transition-all h-[75%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/20 hover:bg-primary/40 transition-all h-[40%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/10 hover:bg-primary/30 transition-all h-[20%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/20 hover:bg-primary/40 transition-all h-[50%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/40 hover:bg-primary/60 transition-all h-[80%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/60 hover:bg-primary/80 transition-all h-[90%] rounded-t-sm border-t-2 border-tertiary/50"></div>
              <div className="flex-grow bg-primary/20 hover:bg-primary/40 transition-all h-[60%] rounded-t-sm"></div>
              <div className="flex-grow bg-primary/10 hover:bg-primary/30 transition-all h-[30%] rounded-t-sm"></div>
              {/*  Grid Lines  */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                <div className="border-t border-white w-full"></div>
                <div className="border-t border-white w-full"></div>
                <div className="border-t border-white w-full"></div>
                <div className="border-t border-white w-full"></div>
              </div>
            </div>
          </div>
          {/*  Global Nodes Map Overlay  */}
          <div className="surface-container p-8 rounded-xl border border-white/5 relative min-h-[400px]">
            <h3 className="text-xl font-black italic tracking-tighter uppercase text-white mb-6">Geospatial_Node_Distribution</h3>
            <div className="w-full h-[300px] rounded-lg overflow-hidden relative">
              <img alt="Global Nodes" className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-700" data-alt="abstract digital world map with neon blue connected points and data lines on dark background representing global network topology" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWzYiN_PbbD7wW4pTRgJkIXF1up2CaRcy86N741-TI1oAADBgD3EY3ejr1e2zoWNpdMmel4TlC2eaZ-zbsReKMc5rZm6WrUDgxkXVukJ3Ngwrm4lxTNurpamJFA-M-1n3w3Xvn8y8Tn5jnDHsTNAXJ1BBO7NQcrvg3JOC6YLzeWCfF3AoeghGgarkp-X7hSuIeVRBI9nJzfYKzk27KVpF8j_ZfrSo6tU9ZbV-Vfq1zjzKMLUSnLLcTMCnxDCmPuyb1_J0wYRAO1E0" />
              {/*  Floating HUD Info  */}
              <div className="absolute top-4 right-4 glass-panel p-4 border border-white/10 rounded-lg">
                <div className="text-[10px] tracking-widest text-white/40 uppercase mb-2">Active Regions</div>
                <div className="space-y-2">
                  <div className="flex justify-between gap-8">
                    <span className="text-[10px] text-white font-bold uppercase">North America</span>
                    <span className="text-[10px] text-tertiary">4,291</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span className="text-[10px] text-white font-bold uppercase">Europe</span>
                    <span className="text-[10px] text-tertiary">3,804</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span className="text-[10px] text-white font-bold uppercase">Asia Pacific</span>
                    <span className="text-[10px] text-tertiary">5,102</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/*  Side Log Panel  */}
        <div className="space-y-6">
          {/*  Protocol Health  */}
          <div className="surface-container p-6 rounded-xl border border-white/5">
            <h3 className="text-sm font-black italic tracking-widest uppercase text-white mb-6 border-b border-white/5 pb-4">Protocol_Health</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] tracking-widest text-white/60 uppercase">Consensus Integrity</span>
                  <span className="text-[10px] text-tertiary font-bold">100%</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-tertiary w-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] tracking-widest text-white/60 uppercase">Data Replication</span>
                  <span className="text-[10px] text-tertiary font-bold">94%</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[94%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] tracking-widest text-white/60 uppercase">Network Jitter</span>
                  <span className="text-[10px] text-error font-bold">12ms</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-error w-[60%]"></div>
                </div>
              </div>
            </div>
          </div>
          {/*  Event Log  */}
          <div className="surface-container rounded-xl border border-white/5 flex flex-col h-[600px]">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-black italic tracking-widest uppercase text-white">Event_Stream</h3>
              <span className="material-symbols-outlined text-white/40 text-sm" data-icon="refresh">refresh</span>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4 font-mono">
              <div className="p-3 bg-white/[0.02] border-l-2 border-tertiary">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-tertiary font-bold">NODE_CONNECT</span>
                  <span className="text-white/20">14:20:11</span>
                </div>
                <p className="text-[11px] text-white/60 uppercase tracking-tighter">New validator node validated: #XJ-9921 in Frankfurt.</p>
              </div>
              <div className="p-3 bg-white/[0.02] border-l-2 border-primary">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-primary font-bold">EPOCH_TRANSITION</span>
                  <span className="text-white/20">14:18:04</span>
                </div>
                <p className="text-[11px] text-white/60 uppercase tracking-tighter">Epoch 18,292 finalized. Success rate: 99.998%</p>
              </div>
              <div className="p-3 bg-error/5 border-l-2 border-error">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-error font-bold">LATENCY_SPIKE</span>
                  <span className="text-white/20">14:15:22</span>
                </div>
                <p className="text-[11px] text-white/60 uppercase tracking-tighter">Gateway timeout detected at Cluster_Alpha_9.</p>
              </div>
              <div className="p-3 bg-white/[0.02] border-l-2 border-tertiary">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-tertiary font-bold">TX_FLUSH</span>
                  <span className="text-white/20">14:12:59</span>
                </div>
                <p className="text-[11px] text-white/60 uppercase tracking-tighter">Mempool cleared. 42k transactions processed.</p>
              </div>
              <div className="p-3 bg-white/[0.02] border-l-2 border-primary">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-primary font-bold">BLOCK_REWARD</span>
                  <span className="text-white/20">14:11:02</span>
                </div>
                <p className="text-[11px] text-white/60 uppercase tracking-tighter">Block #8,291,402 issued. Reward: 12.5 BEZ.</p>
              </div>
              {/*  Filler items for scroll  */}
              <div className="p-3 bg-white/[0.02] border-l-2 border-white/20">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-white/40 font-bold">HEARTBEAT</span>
                  <span className="text-white/20">14:09:44</span>
                </div>
                <p className="text-[11px] text-white/40 uppercase tracking-tighter">All systems operational.</p>
              </div>
            </div>
            <div className="p-4 border-t border-white/5">
              <a href="/support" className="block w-full text-[10px] tracking-widest text-primary font-bold uppercase hover:underline text-center">Request Full Log</a>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
