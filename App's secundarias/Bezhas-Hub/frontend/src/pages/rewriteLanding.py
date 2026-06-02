import re
import os

JSX_FILE = 'd:/Documentos D/Documentos Yoe/BeZhas/BeZhas Web/bezhas-web3/frontend/src/pages/LandingPage.jsx'
CSS_FILE = 'd:/Documentos D/Documentos Yoe/BeZhas/BeZhas Web/bezhas-web3/frontend/src/components/landing/Landing.css'

with open(JSX_FILE, 'r', encoding='utf-8') as f:
    jsx_content = f.read()

# CSS Injection
NEW_CSS = """
@keyframes pulse-flow {
    0% { left: -10%; opacity: 0; }
    50% { opacity: 1; }
    100% { left: 110%; opacity: 0; }
}

.pulse-dot {
    position: absolute;
    top: 50%;
    width: 40px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #22d3ee, white, #22d3ee, transparent);
    box-shadow: 0 0 15px #22d3ee;
    animation: pulse-flow 3s infinite linear;
}

.holographic-border {
    position: relative;
}

.holographic-border::before {
    content: '';
    position: absolute;
    inset: -2px;
    background: linear-gradient(45deg, #0d33f2, #a855f7, #22d3ee, #f472b6);
    z-index: -1;
    filter: blur(10px);
    opacity: 0.5;
}

.visualizer-bar {
    background: linear-gradient(to top, #0d33f2, #22d3ee);
    width: 3px;
    height: 100%;
    margin: 0 2px;
}
"""
with open(CSS_FILE, 'a', encoding='utf-8') as f:
    f.write(NEW_CSS)


# Replacement 1: The Hero section
hero_pattern = re.compile(r'\{\/\* Hero Section \*\/\}.*?\{\/\* EL DIAGNÓSTICO: Problema vs Solución \*\/\}', re.DOTALL)
new_hero = """{/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center justify-center px-6 lg:px-20 overflow-hidden z-10 pt-20">
                <TokenWidget position="hero" />
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-[#080911]/60 dark:bg-[#080911]/80 z-10"></div>
                    <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(circle at top right, rgba(13, 51, 242, 0.15), transparent), radial-gradient(circle at bottom left, rgba(168, 85, 247, 0.1), transparent)' }}></div>
                    <img className="w-full h-full object-cover blur-sm opacity-60 scale-105" alt="Futuristic logistics" src="https://lh3.googleusercontent.com/yvngB3D9G0oJ6K4Yq7hA7WzP82oHn1-7j8I7xZy_R6r99_tJv1tQfE_9d_76t4QZ0B82sWd_Hn_r92RzX_rN-c9bY1cZ2n8wG1r" />
                </div>
                <div className="relative z-20 text-center max-w-5xl mx-auto space-y-8 reveal active">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-[#0d33f2]/30 backdrop-blur-md mb-4 shadow-[0_0_15px_rgba(13,51,242,0.3)]">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22d3ee] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22d3ee]"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#22d3ee]">BeZhas Web3 Enterprise Grade</span>
                    </div>
                    
                    <h1 className="font-display text-5xl md:text-8xl font-black leading-[0.9] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 uppercase italic">
                        BeZhas: The Web3 <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0d33f2] to-[#a855f7] italic py-2">Global Engine</span>
                    </h1>
                    
                    <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed drop-shadow-md">
                        Revolucionamos las cadenas de suministro globales con inteligencia descentralizada, Oráculos IA en tiempo real y tokenización industrial.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
                        <button onClick={() => openModal('register')} className="w-full sm:w-auto min-w-[200px] h-14 bg-[#0d33f2] hover:bg-[#0a28bd] text-white font-bold uppercase tracking-widest rounded-lg shadow-[0_0_20px_rgba(13,51,242,0.4)] hover:scale-105 transition-all flex items-center justify-center gap-2 backdrop-blur-sm z-30">
                            Explorar Ecosistema
                        </button>
                        <a href="#technology" className="w-full sm:w-auto min-w-[200px] h-14 bg-white/5 text-white font-bold uppercase tracking-widest rounded-lg border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center backdrop-blur-md z-30">
                            Leer Whitepaper
                        </a>
                    </div>
                </div>
            </section>

            {/* EL DIAGNÓSTICO: Problema vs Solución */}\n"""

jsx_content = hero_pattern.sub(new_hero, jsx_content)

# Replacement 2: Ecosystem
eco_pattern = re.compile(r'\{\/\* 4\. ECOSISTEMA BEZHAS: Productos \*\/\}.*?\{\/\* Video Introduction Section \*\/\}', re.DOTALL)
new_eco = """{/* 4. ECOSISTEMA BEZHAS: Productos */}
            <section id="ecosystem" className="py-24 px-6 relative z-10 overflow-hidden bg-[#080911]/80 backdrop-blur-lg border-y border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6 reveal">
                        <div className="space-y-4">
                            <span className="text-[#0d33f2] font-bold uppercase tracking-widest text-xs">Protocolo Core</span>
                            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight italic uppercase">The Chain-Flow Ecosystem</h2>
                        </div>
                        <p className="text-gray-400 max-w-md text-sm leading-relaxed">
                            Un protocolo multidimensional interactivo que conecta el mundo físico con sistemas de verificación inteligente. Diseñado para alta frecuencia comercial en logística global.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative py-10 reveal">
                        {/* Connecting animated glowing lines (desktop only) */}
                        <div className="hidden lg:block absolute inset-0 pointer-events-none z-0">
                            <div className="absolute top-1/2 left-[20%] w-[15%] h-[2px] bg-gray-800">
                                <div className="pulse-dot" style={{ animationDelay: '0s' }}></div>
                            </div>
                            <div className="absolute top-1/2 left-[45%] w-[15%] h-[2px] bg-gray-800">
                                <div className="pulse-dot" style={{ animationDelay: '1s' }}></div>
                            </div>
                            <div className="absolute top-1/2 left-[70%] w-[15%] h-[2px] bg-gray-800">
                                <div className="pulse-dot" style={{ animationDelay: '2s' }}></div>
                            </div>
                        </div>

                        {/* Node 1: Logistics */}
                        <Link to="/logistics" className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-gray-800 hover:border-[#22d3ee]/80 transition-all relative overflow-hidden z-10 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] flex flex-col items-start h-full">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#22d3ee]/10 rounded-full blur-2xl group-hover:bg-[#22d3ee]/30 transition-all"></div>
                            <Ship className="w-10 h-10 text-[#22d3ee] mb-6 block" />
                            <h3 className="text-xl font-bold text-white mb-3 uppercase italic">Logistics</h3>
                            <p className="text-gray-400 text-sm leading-relaxed flex-grow">Rastreo automatizado de fletes corporativos usando Smart Contracts. Despachos y liberaciones de aduana con cero latencia.</p>
                            <div className="mt-8 flex items-center gap-2 text-[#22d3ee] text-xs font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                Learn More <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>

                        {/* Node 2: AI Oracle */}
                        <Link to="/oracle" className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-gray-800 hover:border-[#a855f7]/80 transition-all relative overflow-hidden z-10 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] flex flex-col items-start h-full">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#a855f7]/10 rounded-full blur-2xl group-hover:bg-[#a855f7]/30 transition-all"></div>
                            <BrainCircuit className="w-10 h-10 text-[#a855f7] mb-6 block" />
                            <h3 className="text-xl font-bold text-white mb-3 uppercase italic">AI Oracle</h3>
                            <p className="text-gray-400 text-sm leading-relaxed flex-grow">Motores de validación de datos en tiempo real impulsados por IA (IoT, clima, peso), disparando contratos infalibles.</p>
                            <div className="mt-8 flex items-center gap-2 text-[#a855f7] text-xs font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                View Nodes <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>

                        {/* Node 3: Real Estate (RWA) */}
                        <Link to="/real-estate" className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-gray-800 hover:border-[#f472b6]/80 transition-all relative overflow-hidden z-10 hover:shadow-[0_0_30px_rgba(244,114,182,0.2)] flex flex-col items-start h-full">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#f472b6]/10 rounded-full blur-2xl group-hover:bg-[#f472b6]/30 transition-all"></div>
                            <Building2 className="w-10 h-10 text-[#f472b6] mb-6 block" />
                            <h3 className="text-xl font-bold text-white mb-3 uppercase italic">Real Estate RWA</h3>
                            <p className="text-gray-400 text-sm leading-relaxed flex-grow">Hubs industriales y almacenes físicos fraccionados. Flujos de capital inyectados a nivel inmobiliario corporativo.</p>
                            <div className="mt-8 flex items-center gap-2 text-[#f472b6] text-xs font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                Invest Portfolio <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>

                        {/* Node 4: DAO  */}
                        <Link to="/dao-page" className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-gray-800 hover:border-gray-400/80 transition-all relative overflow-hidden z-10 hover:shadow-[0_0_30px_rgba(156,163,175,0.2)] flex flex-col items-start h-full">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-gray-500/10 rounded-full blur-2xl group-hover:bg-gray-500/30 transition-all"></div>
                            <Vote className="w-10 h-10 text-gray-200 mb-6 block" />
                            <h3 className="text-xl font-bold text-white mb-3 uppercase italic">Gobernanza DAO</h3>
                            <p className="text-gray-400 text-sm leading-relaxed flex-grow">Decisiones hiper-descentralizadas para corporaciones y accionistas, optimizando dinámicamente rutas comerciales globales.</p>
                            <div className="mt-8 flex items-center gap-2 text-gray-200 text-xs font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                Vote System <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>
                    </div>

                    {/* Secondary Row connected */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 reveal">
                        <Link to="/developer-console" className="group bg-white/5 backdrop-blur-md p-6 rounded-xl border border-gray-800 hover:border-[#0d33f2]/60 transition-all overflow-hidden relative">
                            <Terminal className="w-8 h-8 text-[#0d33f2] mb-4" />
                            <h4 className="text-lg font-bold text-white mb-2 uppercase italic">Dev Console / SDK</h4>
                            <p className="text-gray-400 text-xs">Conecte su SAP o ERP actual al flujo del ecosistema en minutos.</p>
                        </Link>
                        <Link to="/liquidity" className="group bg-white/5 backdrop-blur-md p-6 rounded-xl border border-gray-800 hover:border-yellow-400/60 transition-all overflow-hidden relative">
                            <Droplets className="w-8 h-8 text-yellow-400 mb-4" />
                            <h4 className="text-lg font-bold text-white mb-2 uppercase italic">Liquidity Pools</h4>
                            <p className="text-gray-400 text-xs">Genere rendimientos optimizados con tesorería inactiva (Yield Farm).</p>
                        </Link>
                        <Link to="/be-vip" className="group bg-gradient-to-r from-amber-500/10 to-transparent backdrop-blur-md p-6 rounded-xl border border-amber-500/20 hover:border-amber-400/60 transition-all overflow-hidden relative">
                            <Crown className="w-8 h-8 text-amber-500 mb-4" />
                            <h4 className="text-lg font-bold text-white mb-2 uppercase italic">Be-VIP Corporate</h4>
                            <p className="text-gray-400 text-xs">Sin comisiones, networking elite y soporte ingenieril 24/7 de alta prioridad.</p>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Video Introduction Section */}\n"""

jsx_content = eco_pattern.sub(new_eco, jsx_content)


# Replacement 3: Video
video_pattern = re.compile(r'\{\/\* Video Introduction Section \*\/\}.*?\{\/\* 5\. TECNOLOGÍA \& TOKEN: El Motor \*\/\}', re.DOTALL)
new_video = """{/* Video Holographic Section */}
            <section className="py-24 px-6 lg:px-20 bg-[#080911]/90 relative z-10 border-y border-white/5">
                <div className="max-w-7xl mx-auto reveal">
                    <div className="text-center mb-16 space-y-4">
                        <span className="text-[#f472b6] font-bold uppercase tracking-widest text-xs">Visión Profunda</span>
                        <h2 className="text-4xl md:text-6xl font-black text-white leading-tight uppercase italic">The Holographic Concept</h2>
                        <p className="text-gray-400 text-lg">Inteligencia Artificial y Smart Contracts auditando el mundo físico.</p>
                    </div>
                    
                    <div className="relative max-w-5xl mx-auto">
                        <div className="holographic-border rounded-2xl p-[2px] overflow-hidden">
                            <div className="relative bg-[#080911] rounded-2xl overflow-hidden aspect-video group">
                                {/* AI Generative Visualizers Left */}
                                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-center items-center gap-1 opacity-20 group-hover:opacity-60 transition-opacity py-10 pointer-events-none">
                                    <div className="visualizer-bar" style={{ height: '15%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '35%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '65%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '45%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '85%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '55%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '25%' }}></div>
                                </div>

                                {/* AI Generative Visualizers Right */}
                                <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-center items-center gap-1 opacity-20 group-hover:opacity-60 transition-opacity py-10 pointer-events-none">
                                    <div className="visualizer-bar" style={{ height: '25%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '55%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '85%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '45%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '65%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '35%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '15%' }}></div>
                                </div>

                                <iframe
                                    className="w-full h-full grayscale opacity-80 mix-blend-screen group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                                    src="https://www.youtube.com/embed/L8H2AapjtVc" 
                                    title="BeZhas Protocol Insight"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>

                                <div className="absolute top-6 right-10 flex items-center gap-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-mono text-[#22d3ee] uppercase">Decoding feed...</span>
                                        <span className="text-[10px] font-mono text-gray-500">Oracle: 0x8A...f32</span>
                                    </div>
                                    <Activity className="w-5 h-5 text-[#22d3ee] animate-pulse" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-between items-center px-4">
                            <div className="flex gap-2">
                                <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full"></span>
                                <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full opacity-50"></span>
                                <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full opacity-25"></span>
                            </div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Protocol Matrix v2.0 Live</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. TECNOLOGÍA & TOKEN: El Motor */}\n"""
jsx_content = video_pattern.sub(new_video, jsx_content)


with open(JSX_FILE, 'w', encoding='utf-8') as f:
    f.write(jsx_content)

print("Rewrote LandingPage JSX successfully")
