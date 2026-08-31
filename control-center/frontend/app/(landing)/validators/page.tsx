'use client';

import { usePublicStats } from '@/lib/public-hooks';

export default function ValidatorsPage() {
  const { data } = usePublicStats();
  const net = data?.network;
  const stk = data?.staking;

  const totalStaked = stk ? (stk.totalStaked / 1_000_000).toFixed(1) + 'M' : '—';
  const activeNodes = net?.validatorsActive?.toLocaleString() ?? '—';
  const uptimeVal = net?.uptime?.toFixed(2) ?? '—';
  const aprVal = stk ? stk.apr.toFixed(1) + '%' : '—';

  return (
    <>

      <div className="hero-gradient absolute inset-0 -z-10"></div>
      <div className="p-8 max-w-7xl mx-auto space-y-12">
        {/*  Hero Section  */}
        <section className="flex flex-col md:flex-row items-end gap-8 border-b border-white/5 pb-12">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-primary font-bold">Mainnet Phase 4</span>
            </div>
            <h1 className="text-7xl font-black italic tracking-tighter uppercase leading-none">
              NEURAL <br /> <span className="text-primary">LOGISTICS</span>
            </h1>
            <p className="text-xl text-on-surface-variant max-w-xl font-light">
              Power the BeZhas decentralized intelligence layer. Secure the network, process high-fidelity neural data, and earn industrial-grade yields.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <div className="glass-panel p-6 border border-white/5 rounded-xl">
              <p className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1">Total Staked</p>
              <p className="text-3xl font-bold italic tracking-tight">{totalStaked} <span className="text-xs text-primary">BEZ</span></p>
            </div>
            <div className="glass-panel p-6 border border-white/5 rounded-xl">
              <p className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1">Active Nodes</p>
              <p className="text-3xl font-bold italic tracking-tight">{activeNodes}</p>
            </div>
          </div>
        </section>
        {/*  Real-Time Stats Bento Grid  */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 bg-surface-container-high border border-white/5 p-8 rounded-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-colors"></div>
            <h3 className="text-xs tracking-[0.3em] uppercase text-gray-500 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">cycle</span> Epoch Progress
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-4xl font-black italic tracking-tighter">74.2%</span>
                <span className="text-[10px] tracking-[0.1em] text-gray-400">EPOCH #4,192</span>
              </div>
              <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                <div className="h-full bg-primary w-3/4 shadow-[0_0_10px_rgba(13,51,242,0.5)]"></div>
              </div>
              <p className="text-xs text-on-surface-variant">Time remaining: 04h 12m 44s</p>
            </div>
          </div>
          <div className="bg-surface-container border border-white/5 p-8 rounded-xl">
            <h3 className="text-xs tracking-[0.3em] uppercase text-gray-500 mb-6">Network Health</h3>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-black italic text-tertiary">{uptimeVal}</div>
              <div className="text-[10px] uppercase text-tertiary font-bold tracking-widest leading-none">Up <br /> Time</div>
            </div>
            <div className="mt-6 flex gap-1 h-8 items-end">
              <div className="w-1 bg-tertiary/20 h-4"></div>
              <div className="w-1 bg-tertiary/40 h-6"></div>
              <div className="w-1 bg-tertiary/60 h-5"></div>
              <div className="w-1 bg-tertiary h-8"></div>
              <div className="w-1 bg-tertiary h-7"></div>
              <div className="w-1 bg-tertiary/50 h-6"></div>
              <div className="w-1 bg-tertiary h-8"></div>
            </div>
          </div>
          <div className="bg-surface-container border border-white/5 p-8 rounded-xl">
            <h3 className="text-xs tracking-[0.3em] uppercase text-gray-500 mb-6">Staking APR</h3>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-black italic text-secondary">{aprVal}</div>
              <div className="text-[10px] uppercase text-secondary font-bold tracking-widest leading-none">Net <br /> Yield</div>
            </div>
            <p className="mt-6 text-xs text-on-surface-variant leading-relaxed">Adjusted for inflation and network density.</p>
          </div>
        </section>
        {/*  Hardware Requirements & Rewards  */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/*  Becoming a Validator (Process)  */}
          <div className="lg:col-span-2 space-y-8">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase border-l-4 border-primary pl-4">Onboarding Protocol</h2>
            <div id="onboarding" className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 border border-white/5 rounded-xl space-y-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-primary font-black italic text-2xl">01</span>
                  <span className="material-symbols-outlined text-gray-500">terminal</span>
                </div>
                <h4 className="font-bold tracking-tight uppercase">Provision Node</h4>
                <p className="text-sm text-on-surface-variant">Initialize the BeZhas Core OS on dedicated industrial hardware. Sync with the primary neural ledger.</p>
              </div>
              <div className="glass-panel p-6 border border-white/5 rounded-xl space-y-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-primary font-black italic text-2xl">02</span>
                  <span className="material-symbols-outlined text-gray-500">lock_open</span>
                </div>
                <h4 className="font-bold tracking-tight uppercase">Stake BEZ</h4>
                <p className="text-sm text-on-surface-variant">Lock a minimum of 50,000 BEZ tokens to register your identity in the active validator set.</p>
              </div>
              <div className="glass-panel p-6 border border-white/5 rounded-xl space-y-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-primary font-black italic text-2xl">03</span>
                  <span className="material-symbols-outlined text-gray-500">memory</span>
                </div>
                <h4 className="font-bold tracking-tight uppercase">Calibrate Neural Hub</h4>
                <p className="text-sm text-on-surface-variant">Verify high-speed data packets. Ensure sub-50ms latency for logistics routing.</p>
              </div>
              <div className="glass-panel p-6 border border-white/5 rounded-xl space-y-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-primary font-black italic text-2xl">04</span>
                  <span className="material-symbols-outlined text-gray-500">rocket_launch</span>
                </div>
                <h4 className="font-bold tracking-tight uppercase">Live Production</h4>
                <p className="text-sm text-on-surface-variant">Start signing blocks and collecting rewards directly to your designated vault address.</p>
              </div>
            </div>
          </div>
          {/*  Hardware Specs Sidebar  */}
          <div className="bg-surface-container-low border border-white/10 rounded-xl p-8 space-y-8 relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
            <h2 className="text-xl font-black italic tracking-tighter uppercase">Hardware Spec V2</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-primary">computer</span>
                <div className="flex-1">
                  <p className="text-[10px] tracking-widest text-gray-500 uppercase">Processor</p>
                  <p className="text-sm font-bold">EPYC™ 7003 Series (16+ Cores)</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-primary">memory</span>
                <div className="flex-1">
                  <p className="text-[10px] tracking-widest text-gray-500 uppercase">Memory</p>
                  <p className="text-sm font-bold">128GB ECC DDR4 3200MHz</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-primary">storage</span>
                <div className="flex-1">
                  <p className="text-[10px] tracking-widest text-gray-500 uppercase">Storage</p>
                  <p className="text-sm font-bold">4TB NVMe Gen4 (RAID 1 Mirroring)</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-primary">router</span>
                <div className="flex-1">
                  <p className="text-[10px] tracking-widest text-gray-500 uppercase">Connectivity</p>
                  <p className="text-sm font-bold">10Gbps Dedicated Uplink</p>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-white/5">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                <span className="text-primary font-bold">CRITICAL:</span> Validators falling below the 95% performance threshold will face neural degradation (slashing) of 0.5% per epoch.
              </p>
            </div>
            <img alt="Industrial Server" className="w-full h-48 object-cover rounded-lg opacity-50 grayscale hover:grayscale-0 transition-all cursor-crosshair" data-alt="close-up of a high-tech blue-lit server rack with fiber optic cables in a dark industrial data center" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAxEYt_YOllVrcSpWopnAwQ3GI-JOeNXW3zqA9ZbyVNcUc5e9J8tisi2abOVD6lBhf7kXIDxU6Ng4nIEpsol_7t8svFWYwAY2spPD8UbNqVBWRzeMggwpvtKa7_KfBeXLnKr2DE8ljd5V_4W2mqoPInCqUH6fCnFMaWF1ce3ApFiVz1YJxLQA__5I3wTxUQGkYuSDczmVPTP97c04UGIvNnBSElHEuthKukC7poghL7NAAIq9Wys27Aejd5ZPbcBh1inpMGbS8zBw" />
          </div>
        </section>
        {/*  Rewards Matrix  */}
        <section className="bg-surface-container rounded-xl overflow-hidden border border-white/5">
          <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">Rewards Structure</h2>
              <p className="text-sm text-on-surface-variant uppercase tracking-widest">Modelo Sostenible v2.0 — Emisión Controlada</p>
            </div>
            <div className="flex gap-2">
              <a href="/learn" target="_blank" className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[10px] tracking-widest uppercase font-bold transition-all inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">download</span> Download PDF
              </a>
              <a href="/financial" className="px-4 py-2 bg-primary text-white text-[10px] tracking-widest uppercase font-bold transition-all inline-flex items-center">Staking Overview</a>
            </div>
          </div>
          {/* Emission Caps Alert */}
          <div className="px-8 py-4 bg-primary/5 border-b border-white/5 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">info</span>
              <span className="text-xs font-bold uppercase tracking-widest">Topes de Emisión Diaria:</span>
            </div>
            <div className="flex gap-6 text-xs">
              <span><span className="text-primary font-bold">Staking Pool:</span> 50,000 BEZ/día (0.05 BEZ/s)</span>
              <span><span className="text-primary font-bold">Farming:</span> 25,000 BEZ/día (0.5 BEZ/bloque)</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-[10px] tracking-[0.3em] uppercase text-gray-400">
                  <th className="p-6 font-medium">Tier</th>
                  <th className="p-6 font-medium">Min Stake</th>
                  <th className="p-6 font-medium">Commission</th>
                  <th className="p-6 font-medium">Target APR</th>
                  <th className="p-6 font-medium">Uptime Req.</th>
                  <th className="p-6 font-medium">Retorno Anual Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/5 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 bg-primary/40 rounded-full"></span>
                      <span className="font-bold italic uppercase tracking-tighter">Sentinel</span>
                    </div>
                  </td>
                  <td className="p-6 font-mono text-sm">50,000 BEZ</td>
                  <td className="p-6 font-mono text-sm">10.0%</td>
                  <td className="p-6 font-bold text-tertiary">~8.2%</td>
                  <td className="p-6 font-mono text-sm">99.0%</td>
                  <td className="p-6 text-sm">~4,100 BEZ (~$410)</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 bg-primary/70 rounded-full"></span>
                      <span className="font-bold italic uppercase tracking-tighter">Guardian</span>
                    </div>
                  </td>
                  <td className="p-6 font-mono text-sm">250,000 BEZ</td>
                  <td className="p-6 font-mono text-sm">5.0%</td>
                  <td className="p-6 font-bold text-tertiary">~10.5%</td>
                  <td className="p-6 font-mono text-sm">99.5%</td>
                  <td className="p-6 text-sm">~26,250 BEZ (~$2,625)</td>
                </tr>
                <tr className="bg-primary/5 hover:bg-primary/10 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_rgba(13,51,242,1)]"></span>
                      <span className="font-bold italic uppercase tracking-tighter">Core Nexus</span>
                    </div>
                  </td>
                  <td className="p-6 font-mono text-sm">1,000,000 BEZ</td>
                  <td className="p-6 font-mono text-sm">2.0%</td>
                  <td className="p-6 font-bold text-tertiary">~12.4%</td>
                  <td className="p-6 font-mono text-sm">99.9%</td>
                  <td className="p-6 text-sm">~124,000 BEZ (~$12,400)</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Lock Multiplier Info */}
          <div className="p-8 border-t border-white/5">
            <h4 className="text-sm font-bold italic tracking-widest uppercase mb-4">Multiplicadores por Periodo de Lock</h4>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: 'Sin lock', mult: '1x' },
                { label: '7 días', mult: '1.1x' },
                { label: '30 días', mult: '1.25x' },
                { label: '90 días', mult: '1.5x' },
                { label: '180 días', mult: '2x' },
                { label: '365 días', mult: '3x' },
              ].map((m) => (
                <div key={m.label} className="bg-white/5 p-3 rounded-lg text-center">
                  <div className="text-lg font-bold text-primary">{m.mult}</div>
                  <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">{m.label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant mt-4">Ejemplo: Sentinel (50K BEZ) con lock 365 días = 8.2% × 3x = <span className="text-tertiary font-bold">~24.6% APR efectivo</span> (~12,300 BEZ/año)</p>
          </div>
        </section>
        {/*  Bottom CTA  */}
        <section className="relative h-64 rounded-xl overflow-hidden flex items-center justify-center text-center group">
          <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" data-alt="abstract digital pattern of glowing blue hexagonal circuitry on a dark background representing high-speed data transfer" ></div>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>
          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl font-black italic tracking-tighter uppercase">READY TO VALIDATE?</h2>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <a href="/support" className="bg-primary text-white font-bold tracking-[0.3em] px-10 py-4 hover:shadow-[0_0_20px_rgba(13,51,242,0.5)] transition-all uppercase text-xs inline-flex items-center">Request Validator Access</a>
              <a href="/enterprise" className="bg-transparent border border-white/20 hover:border-white text-white font-bold tracking-[0.3em] px-10 py-4 transition-all uppercase text-xs backdrop-blur-md inline-flex items-center">Contact Enterprise Support</a>
            </div>
          </div>
        </section>
      </div>
      {/*  Footer Info  */}
      <footer className="p-8 border-t border-white/5 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
        <div className="text-[10px] tracking-widest uppercase">© 2024 BEZHAS NEURAL PROTOCOL. ALL RIGHTS RESERVED.</div>
        <div className="flex gap-8 text-[10px] tracking-widest uppercase">
          <a className="hover:text-primary" href="/network">Status</a>
          <a className="hover:text-primary" href="/validators">Governance</a>
          <a className="hover:text-primary" href="/learn">Security</a>
        </div>
      </footer>

    </>
  );
}
