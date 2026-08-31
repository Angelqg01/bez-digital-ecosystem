'use client';

import Link from 'next/link';
import CopyButton from '@/components/CopyButton';
import { usePublicStats } from '@/lib/public-hooks';

export default function RPCPage() {
  const { data } = usePublicStats();
  const net = data?.network;

  const uptime = net ? `${net.uptime}%` : '—';
  const clusters = net?.validatorsActive?.toLocaleString() ?? '—';

  return (
    <>

      <div className="p-8 max-w-7xl mx-auto">
        {/*  Hero Section  */}
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-[10px] tracking-[0.4em] text-primary font-bold uppercase">SYSTEM ARCHITECTURE</span>
            <div className="h-[1px] flex-1 bg-white/10"></div>
          </div>
          <h1 className="text-6xl md:text-7xl font-black italic tracking-tighter uppercase text-white leading-none mb-4">RPC <span className="text-primary">&amp;</span> NODES</h1>
          <p className="text-xl text-gray-400 max-w-2xl font-light">
            High-performance, low-latency access to the BeZhas ledger. Decentralized infrastructure for industrial-grade applications and high-frequency trading.
          </p>
        </section>
        {/*  Metrics Grid  */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <div className="surface-container p-6 border-l-2 border-primary group hover:bg-surface-bright transition-colors">
            <span className="text-[10px] tracking-widest text-gray-500 uppercase block mb-1">Global Latency</span>
            <div className="text-3xl font-bold italic tracking-tighter text-white">12MS <span className="text-xs text-primary">AVG</span></div>
            <div className="mt-4 h-1 w-full bg-white/5">
              <div className="h-full bg-primary w-4/5"></div>
            </div>
          </div>
          <div className="surface-container p-6 border-l-2 border-primary group hover:bg-surface-bright transition-colors">
            <span className="text-[10px] tracking-widest text-gray-500 uppercase block mb-1">Uptime Index</span>
            <div className="text-3xl font-bold italic tracking-tighter text-white">{uptime}</div>
            <div className="mt-4 flex gap-1">
              <div className="h-1 flex-1 bg-primary"></div>
              <div className="h-1 flex-1 bg-primary"></div>
              <div className="h-1 flex-1 bg-primary"></div>
              <div className="h-1 flex-1 bg-primary"></div>
              <div className="h-1 flex-1 bg-white/20"></div>
            </div>
          </div>
          <div className="surface-container p-6 border-l-2 border-primary group hover:bg-surface-bright transition-colors">
            <span className="text-[10px] tracking-widest text-gray-500 uppercase block mb-1">Active Clusters</span>
            <div className="text-3xl font-bold italic tracking-tighter text-white">{clusters}</div>
            <div className="mt-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-primary" data-icon="public">public</span>
              <span className="text-[10px] text-gray-600 uppercase">Multi-Region Active</span>
            </div>
          </div>
          <div className="surface-container p-6 border-l-2 border-primary group hover:bg-surface-bright transition-colors">
            <span className="text-[10px] tracking-widest text-gray-500 uppercase block mb-1">Throttling rate</span>
            <div className="text-3xl font-bold italic tracking-tighter text-white">0.02%</div>
            <div className="mt-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-error" data-icon="warning">warning</span>
              <span className="text-[10px] text-gray-600 uppercase">Critical Threshold 1%</span>
            </div>
          </div>
        </section>
        {/*  Main Content Bento  */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/*  RPC Endpoints  */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-8 border border-white/5">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Public RPC Clusters</h2>
                <span className="bg-primary/10 text-primary text-[10px] px-3 py-1 font-bold tracking-widest uppercase">Shared Access</span>
              </div>
              <div className="space-y-4">
                {/*  Endpoint Row  */}
                <div className="flex items-center justify-between p-4 bg-white/5 border-l-2 border-primary">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">HTTPS ENDPOINT</span>
                    <code className="text-sm text-on-tertiary-container font-mono">https://mainnet-rpc.bezhas.io/v2/secure</code>
                  </div>
                  <CopyButton text="https://mainnet-rpc.bezhas.io/v2/secure" iconOnly />
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 border-l-2 border-primary">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">WEBSOCKET (WSS)</span>
                    <code className="text-sm text-on-tertiary-container font-mono">wss://mainnet-ws.bezhas.io/v2/stream</code>
                  </div>
                  <CopyButton text="wss://mainnet-ws.bezhas.io/v2/stream" iconOnly />
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-white/5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4">Current Rate Limits</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-low p-4 rounded-none border border-white/5">
                    <span className="text-[10px] text-gray-600 block mb-1">ANONYMOUS</span>
                    <span className="text-lg font-bold text-white">50 req/sec</span>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-none border border-white/5">
                    <span className="text-[10px] text-gray-600 block mb-1">DEVELOPER API</span>
                    <span className="text-lg font-bold text-white">2,500 req/sec</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-panel p-8 border border-primary/20">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
                <div>
                  <div className="text-[10px] tracking-[0.4em] text-tertiary font-bold uppercase mb-2">Local real setup</div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">RPC, Enterprise Node &amp; Edge Node</h2>
                  <p className="text-sm text-gray-400 mt-3 max-w-2xl">
                    Para pruebas unitarias y desarrollo de Apps Nativas, apunta primero a un RPC local compatible EVM y valida que los nodos
                    respondan antes de conectar testnet, mainnet o servicios de produccion.
                  </p>
                </div>
                <Link href="/docs#api-sdk-nodes-rpc" className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 text-[10px] font-bold tracking-widest uppercase hover:scale-[1.02] transition-transform">
                  Guia completa <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Iniciar RPC local', value: 'anvil --chain-id 31337 --port 8545' },
                  { label: 'Variable de entorno', value: 'BEZHAS_L2_RPC_URL=http://localhost:8545' },
                  { label: 'Validar despliegue', value: 'node scripts/verify-deployment.js' },
                  { label: 'Estado de validadores', value: 'node scripts/validator-status.js' },
                ].map((command) => (
                  <div key={command.label} className="flex items-center justify-between gap-4 p-4 bg-white/5 border-l-2 border-tertiary">
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">{command.label}</span>
                      <code className="text-sm text-on-tertiary-container font-mono break-words">{command.value}</code>
                    </div>
                    <CopyButton text={command.value} iconOnly />
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container-low p-4 border border-white/5">
                  <span className="text-[10px] text-gray-600 block mb-1 uppercase tracking-widest">Chain local</span>
                  <span className="text-lg font-bold text-white">31337</span>
                </div>
                <div className="bg-surface-container-low p-4 border border-white/5">
                  <span className="text-[10px] text-gray-600 block mb-1 uppercase tracking-widest">Core API</span>
                  <span className="text-lg font-bold text-white">3001</span>
                </div>
                <div className="bg-surface-container-low p-4 border border-white/5">
                  <span className="text-[10px] text-gray-600 block mb-1 uppercase tracking-widest">SDK install</span>
                  <span className="text-lg font-bold text-white">pnpm</span>
                </div>
              </div>
            </div>
            {/*  Visualizer Panel  */}
            <div className="glass-panel p-8 border border-white/5 overflow-hidden relative min-h-[300px]">
              <div className="flex justify-between items-center mb-8 relative z-10">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Global Traffic</h2>
                  <p className="text-[10px] tracking-widest text-gray-500 uppercase">Live Node Response Distribution</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-3 h-3 bg-primary rounded-full"></span>
                  <span className="w-3 h-3 bg-secondary rounded-full"></span>
                  <span className="w-3 h-3 bg-tertiary rounded-full"></span>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-full p-8 flex items-end gap-1 h-48 opacity-40">
                <div className="flex-1 bg-primary/20 h-[20%]" ></div>
                <div className="flex-1 bg-primary/20 h-[60%]" ></div>
                <div className="flex-1 bg-primary/40 h-[80%]" ></div>
                <div className="flex-1 bg-primary/20 h-[40%]" ></div>
                <div className="flex-1 bg-primary/30 h-[90%]" ></div>
                <div className="flex-1 bg-primary/20 h-[70%]" ></div>
                <div className="flex-1 bg-primary/50 h-[100%]" ></div>
                <div className="flex-1 bg-primary/20 h-[30%]" ></div>
                <div className="flex-1 bg-primary/40 h-[50%]" ></div>
                <div className="flex-1 bg-primary/20 h-[40%]" ></div>
                <div className="flex-1 bg-primary/30 h-[80%]" ></div>
                <div className="flex-1 bg-primary/60 h-[100%]" ></div>
              </div>
              <div className="relative z-10 grid grid-cols-2 gap-8 mt-4">
                <div className="bg-[#080911]/60 p-4 backdrop-blur-md border border-white/5">
                  <span className="text-[10px] text-gray-500 uppercase mb-2 block">Peak Load</span>
                  <div className="text-2xl font-bold tracking-tighter italic">1.2M <span className="text-xs">RPS</span></div>
                </div>
                <div className="bg-[#080911]/60 p-4 backdrop-blur-md border border-white/5">
                  <span className="text-[10px] text-gray-500 uppercase mb-2 block">Data Throughput</span>
                  <div className="text-2xl font-bold tracking-tighter italic">14.8 <span className="text-xs">GB/S</span></div>
                </div>
              </div>
            </div>
          </div>
          {/*  Right Sidebar: Dedicated Nodes  */}
          <div className="space-y-6">
            <div className="surface-container p-8 border-t-2 border-secondary shadow-xl shadow-purple-900/10">
              <span className="material-symbols-outlined text-secondary mb-4 scale-125" data-icon="developer_board" style={{ fontVariationSettings: "'FILL' 1" }}>developer_board</span>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white mb-2">Dedicated Nodes</h2>
              <p className="text-sm text-gray-400 mb-6">Zero-latency dedicated infrastructure for institutional traders and validator operators.</p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary text-sm" data-icon="check_circle">check_circle</span>
                  <span className="text-xs text-gray-300 uppercase tracking-wider">Isolated CPU/RAM clusters</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary text-sm" data-icon="check_circle">check_circle</span>
                  <span className="text-xs text-gray-300 uppercase tracking-wider">Private Mempool Access</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary text-sm" data-icon="check_circle">check_circle</span>
                  <span className="text-xs text-gray-300 uppercase tracking-wider">Historical state (Full Archive)</span>
                </li>
              </ul>
              <a href="/validators#onboarding" className="block w-full bg-secondary text-white font-headline font-bold italic tracking-widest uppercase py-4 px-4 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all text-center">
                PROVISION NODE
              </a>
            </div>
            <div className="surface-container p-8 border border-white/5 relative group overflow-hidden">
              <img className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:scale-110 transition-transform duration-700" data-alt="Technical data center visualization with dark aesthetic and blue glowing server lights, cinematic lighting and industrial feel" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBGMNoQXdBVh3ggFSUiCFflAfvuQAbEPikckMgbpJF7QfD9-rbbnEGMlL6Y_FjMrrAfK2YosdgEJ3GlQX4DUvqSIyCP5ub9vEQZJIca7cIcgxTfmuz4YUDP5lH--_5Itvebw9H_bEZAL-oq5q2wJvFgfKNBEFEb2sz3w2OX590DMwFV7ukRl_Fdh3lycLdd8dPqJjuNzKlKSWHuF8E0DM_uzG824Z_87YV0T6gfQ3rNL6MA9Xda7j34Aa46bjm2i1ge9aMqxK4eIBY" />
              <div className="relative z-10">
                <h3 className="text-lg font-black italic tracking-tighter uppercase text-white mb-4">Enterprise SLA</h3>
                <p className="text-xs text-gray-400 mb-6 font-mono leading-relaxed">
                                // COMPLIANCE_ID: 982-ZHA<br />
                                // STATUS: ACTIVE<br />
                                // AUTH: LEVEL_4
                </p>
                <a className="text-[10px] font-bold text-primary tracking-[0.3em] uppercase flex items-center gap-2 group-hover:gap-4 transition-all" href="/learn">
                  VIEW DOCS <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">arrow_forward</span>
                </a>
              </div>
            </div>
            <div className="bg-primary p-1">
              <div className="bg-background p-6 flex flex-col items-center text-center">
                <span className="text-[10px] tracking-[0.4em] text-primary font-black uppercase mb-2">DEBUG CONSOLE</span>
                <p className="text-xs text-gray-500 mb-4">Connect your wallet to inspect live chain state directly in the browser.</p>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary/20"></div>
                  <div className="w-2 h-2 rounded-full bg-primary/20"></div>
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/*  Developer Tools Section  */}
        <section id="sdk" className="mt-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">SDK &amp; Integrations</h2>
            <div className="h-[1px] flex-1 bg-white/10"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="surface-container p-6 hover:translate-y-[-4px] transition-transform">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-white/5 p-3">
                  <span className="material-symbols-outlined text-tertiary" data-icon="javascript">javascript</span>
                </div>
                <span className="font-bold text-white uppercase tracking-widest text-sm">BeZhas.js</span>
              </div>
              <p className="text-xs text-gray-500 mb-4 font-mono">pnpm add @bezhas/web3-core</p>
              <a href="/developers" className="text-[10px] text-primary uppercase font-bold tracking-widest">GET STARTED</a>
            </div>
            <div className="surface-container p-6 hover:translate-y-[-4px] transition-transform">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-white/5 p-3">
                  <span className="material-symbols-outlined text-tertiary" data-icon="terminal">terminal</span>
                </div>
                <span className="font-bold text-white uppercase tracking-widest text-sm">CLI Toolset</span>
              </div>
              <p className="text-xs text-gray-500 mb-4 font-mono">curl -sL https://bezhas.sh | bash</p>
              <a href="/developers" className="text-[10px] text-primary uppercase font-bold tracking-widest">INSTALL CLI</a>
            </div>
            <div className="surface-container p-6 hover:translate-y-[-4px] transition-transform">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-white/5 p-3">
                  <span className="material-symbols-outlined text-tertiary" data-icon="monitoring">monitoring</span>
                </div>
                <span className="font-bold text-white uppercase tracking-widest text-sm">Graph Indexer</span>
              </div>
              <p className="text-xs text-gray-500 mb-4 font-mono">Query high-speed indexed chain data</p>
              <a href="/developers#api" className="text-[10px] text-primary uppercase font-bold tracking-widest">EXPLORE QUERIES</a>
            </div>
          </div>
        </section>
      </div>

    </>
  );
}
