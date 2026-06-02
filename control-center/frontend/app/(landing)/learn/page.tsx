export default function LearnPage() {
  return (
    <>

      {/*  Breadcrumbs  */}
      <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-white/30 mb-8 font-bold">
        <a className="hover:text-primary transition-colors" href="/learn">Documentation</a>
        <span className="material-symbols-outlined text-[12px]" data-icon="chevron_right">chevron_right</span>
        <a className="hover:text-primary transition-colors" href="/learn">Foundation</a>
        <span className="material-symbols-outlined text-[12px]" data-icon="chevron_right">chevron_right</span>
        <span className="text-white">Introduction to BeZhas</span>
      </div>
      {/*  Hero Section Content  */}
      <header className="max-w-4xl mb-16">
        <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-6 uppercase">
          Introduction to <span className="text-primary">BeZhas</span>
        </h1>
        <p className="text-xl text-on-surface-variant leading-relaxed font-light">
          BeZhas is an autonomous neural architecture designed for decentralized supply chain optimization. By merging industrial-grade AI with protocol-level transparency, we enable a trustless, high-velocity logistics ecosystem.
        </p>
      </header>
      {/*  Grid Content  */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mb-16">
        {/*  Documentation Categories  */}
        <div className="glass-panel p-8 rounded-xl border border-white/5 hover:border-primary/30 transition-all group">
          <div className="flex justify-between items-start mb-6">
            <span className="material-symbols-outlined text-primary text-4xl" data-icon="precision_manufacturing">precision_manufacturing</span>
            <span className="text-[10px] tracking-[0.3em] text-white/20 font-bold uppercase">Module 01</span>
          </div>
          <h3 className="text-2xl font-bold italic tracking-tighter text-white mb-3 uppercase group-hover:text-primary transition-colors">Supply Chain AI</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
            Leverage neural-gradient analysis to predict logistical bottlenecks before they manifest in the physical layer.
          </p>
          <a className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase" href="/commerce">
            Initialize Protocol <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
          </a>
        </div>
        <div className="glass-panel p-8 rounded-xl border border-white/5 hover:border-primary/30 transition-all group">
          <div className="flex justify-between items-start mb-6">
            <span className="material-symbols-outlined text-tertiary text-4xl" data-icon="database">database</span>
            <span className="text-[10px] tracking-[0.3em] text-white/20 font-bold uppercase">Module 02</span>
          </div>
          <h3 className="text-2xl font-bold italic tracking-tighter text-white mb-3 uppercase group-hover:text-tertiary transition-colors">Oracle Networks</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
            High-fidelity sensor data streams integrated directly into the blockchain via our proprietary kinetic bridge.
          </p>
          <a className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-tertiary uppercase" href="/network">
            View Schema <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
          </a>
        </div>
      </div>
      {/*  Code Snippet Section  */}
      <div className="max-w-4xl mb-16">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs tracking-[0.4em] uppercase font-bold text-white/40">Quick Start Terminal</h2>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-error/40"></div>
            <div className="w-2 h-2 rounded-full bg-secondary/40"></div>
            <div className="w-2 h-2 rounded-full bg-primary/40"></div>
          </div>
        </div>
        <div className="bg-surface-container-highest p-6 rounded-xl border border-white/10 font-mono text-sm overflow-x-auto">
          <div className="flex gap-4 mb-4 border-b border-white/5 pb-4">
            <span className="text-primary font-bold">pnpm</span>
            <span className="text-white/40">Cloud Run</span>
            <span className="text-white/40">SDK</span>
          </div>
          <pre className="text-on-primary-container leading-relaxed"><span className="text-secondary"># Install the BeZhas Kinetic SDK</span>
            <span className="text-primary">$</span> pnpm add @bezhas/protocol-core

            <span className="text-secondary">// Initialize the AI Protocol Engine</span>
            <span className="text-tertiary">import</span> &#123; ProtocolEngine &#125; <span className="text-tertiary">from</span> <span className="text-on-secondary-container">'@bezhas/core'</span>;

            <span className="text-tertiary">const</span> node = <span className="text-tertiary">new</span> ProtocolEngine(&#123;
            apiKey: process.env.BEZHAS_API_KEY,
            mode: <span className="text-on-secondary-container">'kinetic-active'</span>
            &#125;);

            <span className="text-tertiary">await</span> node.initialize();
            console.log(<span className="text-on-secondary-container">'Protocol Status: Online'</span>);</pre>
        </div>
      </div>
      {/*  Secondary Info (Governance)  */}
      <div className="max-w-4xl bg-surface-container-low rounded-xl border border-white/5 p-8 flex flex-col md:flex-row gap-8 items-center">
        <div className="w-full md:w-1/3 aspect-video bg-surface-container-highest rounded-lg overflow-hidden relative">
          <img alt="Abstract digital network visualization" className="w-full h-full object-cover mix-blend-lighten opacity-60" data-alt="Intricate blue laser lines forming a complex geometric neural network structure in a dark industrial space with blue neon glow" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBnqhnRi8aySkSqFXzvdqZU8v4ix8NFNzzPPs_f1ZeqBluuJNmEYRQMWX9rTVxyXlFLxjiyMF5FfzRFGOuSMhxmGVMOy55rGjDhnhi0Zqd_l0mr4Gt6trAISIV_kmfqf2qY93bH_K3Lx0kTIT99dajD_F9pTk4-Rn0DSI9gN_p4BM8tep46WgRVP5i5L-2iwzE2_T83O8WPxrF-r9KnJ3l7k1cK0vx__wZLROdx7RbPC_aDFVwxW5PZEMm2-1U52UVbY7YzGvCxQE4" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent"></div>
        </div>
        <div className="flex-1">
          <div className="text-[10px] tracking-[0.3em] text-secondary font-bold uppercase mb-2">Protocol Governance</div>
          <h3 className="text-2xl font-bold italic tracking-tighter text-white mb-4 uppercase">Direct Democratic Control</h3>
          <p className="text-on-surface-variant text-sm mb-6">
            The BeZhas DAO empowers token holders to vote on architectural upgrades, parameter adjustments, and ecosystem fund allocations.
          </p>
          <div className="flex gap-4">
            <a href="/validators" className="bg-secondary text-white px-6 py-2 text-[10px] tracking-widest uppercase font-bold hover:opacity-90 transition-opacity inline-flex items-center">Read Constitution</a>
            <a href="/validators" className="glass-btn text-white px-6 py-2 text-[10px] tracking-widest uppercase font-bold inline-flex items-center">Proposals</a>
          </div>
        </div>
      </div>

    </>
  );
}
