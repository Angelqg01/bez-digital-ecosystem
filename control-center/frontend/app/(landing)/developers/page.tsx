'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const nativeApps = [
    {
        name: 'BeZhas Hub',
        category: 'App preferente',
        icon: 'apps',
        href: '/dashboard',
        gcpUrl: '/dashboard',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/Bezhas-Hub',
        accent: 'from-primary/80 to-tertiary/70',
        description: 'Centro operativo para coordinar identidad, wallet, pagos, social layer, contratos y flujos de negocio dentro del ecosistema.',
        use: 'La mejor base para crear nuevas apps porque ya conecta SDK, autenticacion, pagos, wallet y paneles de control.',
    },
    {
        name: 'BEZ Wallet',
        category: 'Wallet',
        icon: 'account_balance_wallet',
        href: '/dashboard/wallet',
        gcpUrl: '/dashboard/wallet',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/bez-wallet',
        accent: 'from-emerald-400/80 to-primary/70',
        description: 'Wallet nativa para gestionar cuentas, activos BEZ, QR, pagos y operaciones on-chain.',
        use: 'Sirve como punto de entrada de usuarios, firmas y experiencia financiera Web3.',
    },
    {
        name: 'Gas Tank Manager',
        category: 'Infraestructura',
        icon: 'local_gas_station',
        href: '/dashboard/gas',
        gcpUrl: '/dashboard/gas',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/gas-tank-manager',
        accent: 'from-cyan-300/80 to-primary/70',
        description: 'Gestor de gas, consumo y subvenciones para operaciones empresariales y usuarios finales.',
        use: 'Permite controlar costes, patrocinar transacciones y operar apps sin friccion de gas.',
    },
    {
        name: 'Edge Node Manager',
        category: 'Nodos',
        icon: 'hub',
        href: '/dashboard/validators',
        gcpUrl: '/dashboard/validators',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/edge-node-manager',
        accent: 'from-tertiary/80 to-emerald-400/70',
        description: 'Panel para registrar, monitorizar y operar nodos edge conectados a BeZhas.',
        use: 'Ayuda a desplegar capacidad local, telemetria y servicios de validacion empresarial.',
    },
    {
        name: 'BEZ Vision Scan',
        category: 'IA visual',
        icon: 'center_focus_strong',
        href: '/dashboard/qr',
        gcpUrl: '/dashboard/qr',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/bez-vision-scan',
        accent: 'from-fuchsia-400/80 to-cyan-300/70',
        description: 'Scanner de vision artificial para logistica, trazabilidad, documentos y control de calidad.',
        use: 'Convierte imagenes y eventos fisicos en datos auditables dentro de la red.',
    },
    {
        name: 'BZ Capital',
        category: 'DeFi',
        icon: 'query_stats',
        href: '/dashboard/farming',
        gcpUrl: '/dashboard/farming',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/BZ%20Capital',
        accent: 'from-primary/80 to-emerald-400/70',
        description: 'Frontend DeFi para tesoreria, mercados, staking, farming y analitica financiera.',
        use: 'Sirve para construir productos financieros sobre BEZ y liquidez tokenizada.',
    },
    {
        name: 'BZ Prestige',
        category: 'Luxury/RWA',
        icon: 'diamond',
        href: '/dashboard/nfts',
        gcpUrl: '/dashboard/nfts',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/BZ%20Prestige',
        accent: 'from-amber-300/80 to-primary/70',
        description: 'Experiencia para activos premium, certificados, productos exclusivos y trazabilidad de lujo.',
        use: 'Ideal para tokenizar autenticidad, propiedad y beneficios de objetos de alto valor.',
    },
    {
        name: 'BZ CargoLink',
        category: 'Logistica',
        icon: 'local_shipping',
        href: '/dashboard/sectors',
        gcpUrl: '/dashboard/sectors',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/BZ%20CargoLink',
        accent: 'from-sky-300/80 to-emerald-400/70',
        description: 'Aplicacion de coordinacion logistica para rutas, carga, eventos y seguimiento operacional.',
        use: 'Conecta supply chain real con contratos, pagos, alertas y evidencia verificable.',
    },
    {
        name: 'BeZhas Pay Manager',
        category: 'Pagos',
        icon: 'payments',
        href: '/payments',
        gcpUrl: '/payments',
        gcpStatus: '200 OK',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/bezhas-pay-manager',
        accent: 'from-emerald-300/80 to-cyan-300/70',
        description: 'Gestor de cobros, suscripciones, checkout y conciliacion de pagos para comercios.',
        use: 'Acelera la integracion de pagos fiat/on-chain en apps y marketplaces.',
    },
    {
        name: 'BZ PureScan',
        category: 'Trazabilidad',
        icon: 'qr_code_scanner',
        href: '/dashboard/qr',
        gcpUrl: '/dashboard/qr',
        gcpStatus: '307 Redirect (→ /login)',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/BZ%20PureScan',
        accent: 'from-cyan-300/80 to-fuchsia-400/70',
        description: 'App de escaneo y verificacion para lotes, productos, QR y evidencias de autenticidad.',
        use: 'Permite validar origen, estado y documentos desde una experiencia ligera.',
    },
    {
        name: 'BZ Sphere',
        category: 'Comunidad',
        icon: 'public',
        href: '/solutions',
        gcpUrl: '/solutions',
        gcpStatus: '200 OK',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/BZ%20Sphere',
        accent: 'from-primary/80 to-fuchsia-400/70',
        description: 'Capa social y colaborativa para comunidad, experiencias y actividad del ecosistema.',
        use: 'Sirve para crear espacios de usuario, reputacion y engagement alrededor de apps BeZhas.',
    },
    {
        name: 'BEZ Energy',
        category: 'Energia',
        icon: 'energy_savings_leaf',
        href: '/enterprise',
        gcpUrl: '/enterprise',
        gcpStatus: '200 OK',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/bez-energy',
        accent: 'from-emerald-400/80 to-amber-300/70',
        description: 'App sectorial para activos energeticos, eficiencia, auditoria y datos operativos.',
        use: 'Facilita casos de uso de energia tokenizada, medicion y cumplimiento.',
    },
    {
        name: 'BZ Genesis',
        category: 'Launchpad',
        icon: 'rocket_launch',
        href: '/developers#build-with-bezhas',
        gcpUrl: '/developers',
        gcpStatus: '200 OK',
        githubUrl: 'https://github.com/Angelqg01/bez-digital-ecosystem/tree/main/App-nativas/BZ%20Genesis',
        accent: 'from-fuchsia-400/80 to-primary/70',
        description: 'Plantilla de arranque para prototipos, nuevos verticales y experiencias nativas.',
        use: 'Sirve como base conceptual para clonar patrones y lanzar una app BeZhas rapidamente.',
    },
];

// Enlaces ONLINE reales de cada App Nativa ya desarrollada (subdominios bez.digital).
// Edita aqui para cambiar el destino de una App; las tarjetas abren en pestana nueva.
const NATIVE_APP_URLS: Record<string, string> = {
    'BeZhas Hub': 'https://bezhas-hub-o5xep6gbwq-ew.a.run.app',
    'BEZ Wallet': 'https://bezhas-wallet-o5xep6gbwq-ew.a.run.app',
    'Gas Tank Manager': 'https://bezhas-gas-o5xep6gbwq-ew.a.run.app',
    'Edge Node Manager': 'https://bezhas-edge-o5xep6gbwq-ew.a.run.app',
    'BEZ Vision Scan': 'https://bezhas-vision-o5xep6gbwq-ew.a.run.app',
    'BZ Capital': 'https://bezhas-capital-o5xep6gbwq-ew.a.run.app/defi',
    'BZ Prestige': 'https://bezhas-prestige-o5xep6gbwq-ew.a.run.app',
    'BZ CargoLink': 'https://bezhas-cargolink-o5xep6gbwq-ew.a.run.app',
    'BeZhas Pay Manager': 'https://bezhas-pay-o5xep6gbwq-ew.a.run.app',
    'BZ PureScan': 'https://bezhas-purescan-o5xep6gbwq-ew.a.run.app',
    'BZ Sphere': 'https://bezhas-sphere-o5xep6gbwq-ew.a.run.app',
    'BEZ Energy': 'https://bezhas-energy-o5xep6gbwq-ew.a.run.app',
    'BZ Genesis': 'https://bezhas-genesis-o5xep6gbwq-ew.a.run.app',
};
const nativeAppUrl = (name: string) => NATIVE_APP_URLS[name] || '#';

export default function DevelopersPage() {
    const [appsList, setAppsList] = useState(nativeApps);
    const [hubHref, setHubHref] = useState('/dashboard');

    useEffect(() => {
        // Enforce unified SSO relative routes across all environments. Local development overrides are commented out.
        /*
        const isLocal = window.location.hostname !== 'bez.digital';
        if (isLocal) {
            setHubHref('http://127.0.0.1:5173');
            setAppsList([
                { ...nativeApps[0], href: 'http://127.0.0.1:5173' },
                { ...nativeApps[1], href: 'http://127.0.0.1:3010' },
                { ...nativeApps[2], href: 'http://127.0.0.1:3011' },
                { ...nativeApps[3], href: 'http://127.0.0.1:3012' },
                { ...nativeApps[4], href: 'http://127.0.0.1:3013' },
                { ...nativeApps[5], href: 'http://127.0.0.1:3014' },
                { ...nativeApps[6], href: 'http://127.0.0.1:3015' },
                { ...nativeApps[7], href: 'http://127.0.0.1:3016' },
                ...nativeApps.slice(8)
            ]);
        } else {
            setHubHref('/dashboard');
            setAppsList(nativeApps);
        }
        */
        setHubHref('/dashboard');
        setAppsList(nativeApps);
    }, []);

    return (
        <>

            {/*  Hero Section  */}
            <section className="relative min-h-[716px] flex flex-col items-center justify-center px-8 overflow-hidden hero-gradient">
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary blur-[120px]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-tertiary blur-[120px]"></div>
                </div>
                <div className="relative z-10 text-center max-w-4xl mx-auto">
                    <div className="inline-flex items-center space-x-2 bg-surface-container-high border border-outline-variant px-3 py-1 rounded-full mb-8">
                        <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                        <span className="text-[10px] tracking-[0.3em] uppercase text-tertiary font-bold">SDK v4.2.0 Stable Released</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase mb-6 leading-none">
                        Architecting <span className="text-primary">Intelligence.</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-on-surface-variant font-light max-w-2xl mx-auto mb-10 leading-relaxed italic">
                        The ultimate developer environment for decentralized AI protocols and autonomous supply chain logistics.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a href="#sdk" className="w-full sm:w-auto px-10 py-4 bg-primary text-white text-lg font-bold tracking-widest uppercase rounded-xl shadow-[0_0_30px_rgba(13,51,242,0.5)] active:scale-95 transition-all inline-flex items-center justify-center">
                            Get Started with the SDK
                        </a>
                        <Link href="/learn" className="w-full sm:w-auto px-10 py-4 glass-btn text-white text-lg font-bold tracking-widest uppercase rounded-xl active:scale-95 transition-all inline-flex items-center justify-center">
                            Read the Docs
                        </Link>
                    </div>
                </div>
                {/*  Abstract Visualizer Background Element  */}
                <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-between px-4 opacity-10 pointer-events-none">
                    <div className="flex gap-1 items-end">
                        <div className="w-2 bg-primary h-12"></div>
                        <div className="w-2 bg-primary h-24"></div>
                        <div className="w-2 bg-primary h-16"></div>
                        <div className="w-2 bg-primary h-32"></div>
                        <div className="w-2 bg-primary h-8"></div>
                    </div>
                    <div className="flex gap-1 items-end">
                        <div className="w-2 bg-tertiary h-32"></div>
                        <div className="w-2 bg-tertiary h-12"></div>
                        <div className="w-2 bg-tertiary h-24"></div>
                        <div className="w-2 bg-tertiary h-16"></div>
                        <div className="w-2 bg-tertiary h-8"></div>
                    </div>
                </div>
            </section>
            {/*  Technical Bento Grid  */}
            <section id="sdk" className="px-8 py-24 max-w-7xl mx-auto">
                <div className="flex items-end justify-between mb-16">
                    <div>
                        <div className="text-[10px] tracking-[0.4em] uppercase text-primary font-bold mb-2">Protocol Infrastructure</div>
                        <h2 className="text-4xl font-black italic tracking-tighter uppercase">Developer Resources</h2>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">Global System Uptime</div>
                        <div className="text-2xl font-['Space_Grotesk'] text-tertiary">99.9998%</div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/*  Core Protocol APIs  */}
                    <div id="api" className="md:col-span-8 group relative overflow-hidden rounded-xl bg-surface-container border border-outline-variant p-8 glass-panel">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-9xl">api</span>
                        </div>
                        <div className="relative z-10 h-full flex flex-col">
                            <div className="flex items-center space-x-3 mb-6">
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-3xl">terminal</span>
                                </div>
                                <h3 className="text-2xl font-bold italic uppercase tracking-tight">Core Protocol APIs</h3>
                            </div>
                            <p className="text-on-surface-variant mb-8 max-w-md">
                                Direct interaction layer for neural-consensus and state management. Optimized for low-latency transaction processing and high-throughput data streams.
                            </p>
                            <div className="mt-auto grid grid-cols-2 gap-4">
                                <div className="p-4 bg-surface-container-high rounded-lg border border-white/5">
                                    <div className="text-[10px] tracking-widest uppercase text-white/40 mb-1">REST Endpoint</div>
                                    <div className="text-xs font-mono text-tertiary truncate">api.bezhas.protocol/v4/*</div>
                                </div>
                                <div className="p-4 bg-surface-container-high rounded-lg border border-white/5">
                                    <div className="text-[10px] tracking-widest uppercase text-white/40 mb-1">Websocket</div>
                                    <div className="text-xs font-mono text-tertiary truncate">wss://stream.bezhas.io</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/*  Side Stats / Small Card  */}
                    <div className="md:col-span-4 rounded-xl bg-surface-container border border-outline-variant p-8 flex flex-col justify-between group">
                        <div className="flex justify-between items-start">
                            <span className="material-symbols-outlined text-primary text-4xl">bolt</span>
                            <span className="text-[10px] tracking-[0.3em] font-bold text-tertiary">FAST-PATH</span>
                        </div>
                        <div>
                            <div className="text-4xl font-black italic mb-2 tracking-tighter">1.2ms</div>
                            <div className="text-xs uppercase tracking-widest text-on-surface-variant">Avg Consensus Finality</div>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="w-3/4 h-full bg-primary group-hover:w-full transition-all duration-700"></div>
                        </div>
                    </div>
                    {/*  Smart Contract Tooling  */}
                    <div className="md:col-span-6 rounded-xl bg-surface-container-high border border-outline-variant p-8 holographic-border group">
                        <span className="material-symbols-outlined text-secondary text-4xl mb-6">integration_instructions</span>
                        <h3 className="text-2xl font-bold italic uppercase tracking-tight mb-4">Smart Contract Tooling</h3>
                        <p className="text-on-surface-variant mb-6">
                            Deploy high-performance, AI-aware smart contracts using our custom 'Kinetic' compiler. Built-in formal verification and security auditing.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">Kinetic-CLI</span>
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">Solidity Bridge</span>
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">EVM Compatible</span>
                        </div>
                    </div>
                    {/*  Supply Chain Node Validators  */}
                    <div className="md:col-span-6 rounded-xl bg-[#0d33f2] p-8 text-white relative overflow-hidden group">
                        <div className="absolute -bottom-10 -right-10 opacity-20 transform rotate-12 transition-transform group-hover:rotate-0 duration-500">
                            <span className="material-symbols-outlined text-[12rem]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl font-black italic uppercase tracking-tight mb-4">Node Validators</h3>
                            <p className="text-white/80 mb-8 max-w-sm">
                                Secure the supply chain network by running a validator node. Earn protocol rewards while processing autonomous freight manifests.
                            </p>
                            <Link href="/validators#onboarding" className="inline-flex bg-white text-primary px-6 py-3 rounded-lg font-bold tracking-widest uppercase text-xs active:scale-95 transition-all">
                                Deploy a Node
                            </Link>
                        </div>
                    </div>
                    <div className="md:col-span-12 rounded-xl bg-surface-container border border-primary/20 p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            <div className="lg:col-span-5">
                                <div className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold mb-2">Instalacion real</div>
                                <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-3">SDK, API, Nodos y RPC unificados</h3>
                                <p className="text-sm text-on-surface-variant leading-relaxed">
                                    Todas las Apps Nativas deben pasar por la misma API Core para pagos, creditos, billing, compra de BEZ-Coin,
                                    contratos y ABIs. El SDK se instala con pnpm y el RPC se configura por entorno.
                                </p>
                            </div>
                            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-black/30 rounded-lg border border-white/5 p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">SDK</div>
                                    <code className="block text-xs font-mono text-tertiary break-words">pnpm add @bezhas/sdk</code>
                                </div>
                                <div className="bg-black/30 rounded-lg border border-white/5 p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Core API</div>
                                    <code className="block text-xs font-mono text-tertiary break-words">http://localhost:3001/api</code>
                                </div>
                                <div className="bg-black/30 rounded-lg border border-white/5 p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">RPC local</div>
                                    <code className="block text-xs font-mono text-tertiary break-words">BEZHAS_L2_RPC_URL=http://localhost:8545</code>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                            <Link href="/docs#api-sdk-nodes-rpc" className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:scale-[1.02] transition-transform">
                                Leer guia completa <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </Link>
                            <a href="https://github.com/Angelqg01/bezhas-enterprise-sdk" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 border border-white/10 text-white/70 px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:text-white hover:border-primary/40 transition-colors">
                                Ver SDK en GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </section>
            {/*  Native Apps Ecosystem  */}
            <section id="native-apps" className="relative px-4 sm:px-8 py-24 overflow-hidden bg-[#080911]">
                <div className="absolute inset-0 bezhas-grid opacity-60 pointer-events-none"></div>
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent"></div>
                <div className="absolute left-0 top-24 h-64 w-px bg-gradient-to-b from-transparent via-tertiary/70 to-transparent bezhas-node-rail"></div>
                <div className="relative max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-12">
                        <div className="lg:col-span-7">
                            <div className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold mb-3">Native BeZhas Apps</div>
                            <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase leading-none">
                                Apps listas para construir, conectar y escalar.
                            </h2>
                        </div>
                        <div id="build-with-bezhas" className="lg:col-span-5 glass-panel border border-primary/20 rounded-lg p-6 relative overflow-hidden">
                            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-tertiary to-emerald-400"></div>
                            <p className="text-sm md:text-base text-on-surface-variant leading-relaxed">
                                Para desarrollar una app con BeZhas, empieza desde el SDK y el Hub: define el caso de uso, conecta wallet e identidad,
                                registra contratos o endpoints en la API, anade telemetria y publica la experiencia como app nativa del ecosistema.
                            </p>
                            <div className="mt-5 flex flex-col sm:flex-row gap-3">
                                <Link href={hubHref} className="bezhas-builder-button group inline-flex items-center justify-center gap-3 px-6 py-4 text-xs font-black uppercase tracking-widest text-white">
                                    <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">rocket_launch</span>
                                    Empezar a crear app
                                </Link>
                                <a href="#sdk" className="inline-flex items-center justify-center px-6 py-4 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white hover:border-primary/40 transition-colors">
                                    Ver SDK
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 border border-white/10 rounded-lg p-5 bg-white/[0.02]">
                            <div className="text-[10px] tracking-[0.3em] uppercase text-primary font-bold mb-2">Recomendacion</div>
                            <p className="text-xl font-bold italic tracking-tight text-white">
                                La app preferente para crear nuevas apps dentro de BeZhas es <span className="text-tertiary">BeZhas Hub</span>.
                            </p>
                            <p className="mt-2 text-sm text-on-surface-variant">
                                Es el punto mas completo porque agrupa control plane, autenticacion, wallet, pagos, SDK, contratos y conexiones con el resto de modulos nativos.
                            </p>
                        </div>
                        <div className="border border-white/10 rounded-lg p-5 bg-primary/10 relative overflow-hidden">
                            <div className="absolute right-4 top-4 text-primary/20">
                                <span className="material-symbols-outlined text-7xl">deployed_code</span>
                            </div>
                            <div className="relative">
                                <div className="text-4xl font-black italic">13</div>
                                <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">Apps nativas detectadas</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {appsList.map((app: any, index) => (
                            <div
                                key={app.name}
                                className="native-app-card group rounded-lg border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-white/[0.055] flex flex-col justify-between"
                                style={{ animationDelay: `${index * 60}ms` }}
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-4 mb-5">
                                        <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${app.accent} flex items-center justify-center text-white shadow-[0_0_28px_rgba(13,51,242,0.22)]`}>
                                            <span className="material-symbols-outlined text-2xl">{app.icon}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] tracking-[0.3em] uppercase text-tertiary font-bold">{app.category}</div>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-black italic uppercase tracking-tight mb-3 text-white">{app.name}</h3>
                                    <p className="text-sm text-on-surface-variant leading-relaxed mb-4 min-h-[66px]">{app.description}</p>
                                    
                                    {/* GCP Route Deployment Details */}
                                    <div className="mb-3 p-3 bg-black/20 rounded-lg border border-white/5 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] tracking-wider text-slate-500 uppercase font-bold">Enlace Online</span>
                                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                                {app.gcpStatus || '200 OK'}
                                            </span>
                                        </div>
                                        <a
                                            href={nativeAppUrl(app.name)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-mono text-cyan-300 hover:text-cyan-200 transition-colors block truncate"
                                        >
                                            {nativeAppUrl(app.name).replace('https://', '')}
                                        </a>
                                    </div>

                                    {/* GitHub Folder Link */}
                                    <div className="mb-4 p-3 bg-black/20 rounded-lg border border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4 fill-slate-400 group-hover:fill-white transition-colors" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                            </svg>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GitHub Folder</span>
                                        </div>
                                        <a 
                                            href={app.githubUrl || 'https://github.com/Angelqg01/bez-digital-ecosystem'} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-xs text-primary hover:text-cyan-300 transition-colors font-semibold"
                                        >
                                            Ver código →
                                        </a>
                                    </div>
                                </div>

                                <div className="border-t border-white/10 pt-4">
                                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{app.use}</p>
                                    <a
                                        href={nativeAppUrl(app.name)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Abrir ${app.name}`}
                                        className="w-full py-2.5 bg-primary/20 hover:bg-primary text-white rounded-lg text-xs font-bold tracking-widest uppercase transition-all duration-300 inline-flex items-center justify-center gap-2 group-hover:shadow-[0_0_20px_rgba(13,51,242,0.4)]"
                                    >
                                        <span>Abrir App</span>
                                        <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">arrow_forward</span>
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            {/*  Data Viz / Technical Spec Section  */}
            <section className="bg-surface-container-low py-24 px-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">Neural Consensus Architecture</h2>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded bg-primary flex items-center justify-center font-bold italic">01</div>
                                <div>
                                    <h4 className="text-lg font-bold uppercase tracking-tight mb-1">Asymmetric Sharding</h4>
                                    <p className="text-sm text-on-surface-variant">Parallel transaction processing across 1,024 dynamic shards with cross-chain synchronization.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded bg-primary flex items-center justify-center font-bold italic">02</div>
                                <div>
                                    <h4 className="text-lg font-bold uppercase tracking-tight mb-1">AI Proof of Intent</h4>
                                    <p className="text-sm text-on-surface-variant">Validation mechanism that predicts network congestion and optimizes routing in real-time.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded bg-primary flex items-center justify-center font-bold italic">03</div>
                                <div>
                                    <h4 className="text-lg font-bold uppercase tracking-tight mb-1">Holographic Security</h4>
                                    <p className="text-sm text-on-surface-variant">Distributed redundancy layers ensuring zero single points of failure across global nodes.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="relative glass-panel rounded-xl p-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-error"></div>
                                <span className="text-[10px] tracking-widest uppercase text-white/40">Live Network Stream</span>
                            </div>
                            <div className="text-[10px] tracking-widest uppercase text-primary">Status: Critical Path OK</div>
                        </div>
                        <div className="h-64 flex items-end gap-1">
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[20%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[35%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[55%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[45%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[75%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[90%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[60%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[40%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[85%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[30%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[50%]"></div>
                            <div className="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[95%]"></div>
                        </div>
                        <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-xl"></div>
                        <div className="mt-4 flex justify-between text-[8px] font-mono text-white/20 uppercase tracking-[0.4em]">
                            <span>Block_0x1A2</span>
                            <span>Block_0x1B9</span>
                            <span>Block_0x1CF</span>
                        </div>
                    </div>
                </div>
            </section>
            <section className="px-8 py-20 bg-[#080911] border-t border-white/5">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold mb-4">Build on BeZhas</div>
                    <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase mb-6">
                        Convierte tu idea en una app nativa.
                    </h2>
                    <p className="text-on-surface-variant max-w-2xl mx-auto mb-8 leading-relaxed">
                        Usa BeZhas Hub como base, conecta SDK, wallet, pagos y contratos, y empieza a construir sobre la infraestructura del ecosistema.
                    </p>
                    <Link href={hubHref} className="bezhas-builder-button group inline-flex items-center justify-center gap-3 px-8 py-5 text-xs font-black uppercase tracking-widest text-white">
                        <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">rocket_launch</span>
                        Empezar a crear app
                    </Link>
                </div>
            </section>
            {/*  Footer  */}
            <footer className="w-full py-12 px-8 border-t border-white/5 bg-[#080911]">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-7xl mx-auto">
                    <div className="col-span-1 md:col-span-1">
                        <div className="text-lg font-black italic text-white font-['Space_Grotesk'] uppercase mb-4">BEZHAS</div>
                        <p className="text-[10px] text-white/30 tracking-widest uppercase leading-relaxed">
                            Powering the next generation of industrial intelligence through decentralized protocols.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[10px] tracking-[0.3em] font-bold text-primary uppercase mb-4">Resources</div>
                        <div className="flex flex-col space-y-2">
                            <a className="text-white/30 hover:text-[#0d33f2] transition-colors font-['Space_Grotesk'] tracking-widest text-[10px] uppercase" href="/learn">Whitepaper</a>
                            <a className="text-white/30 hover:text-[#0d33f2] transition-colors font-['Space_Grotesk'] tracking-widest text-[10px] uppercase" href="https://github.com/bezhas" target="_blank" rel="noopener noreferrer">GitHub</a>
                            <a className="text-white/30 hover:text-[#0d33f2] transition-colors font-['Space_Grotesk'] tracking-widest text-[10px] uppercase" href="/learn">Documentation</a>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[10px] tracking-[0.3em] font-bold text-primary uppercase mb-4">Community</div>
                        <div className="flex flex-col space-y-2">
                            <a className="text-white/30 hover:text-[#0d33f2] transition-colors font-['Space_Grotesk'] tracking-widest text-[10px] uppercase" href="https://discord.gg/bezhas" target="_blank" rel="noopener noreferrer">Discord</a>
                            <a className="text-white/30 hover:text-[#0d33f2] transition-colors font-['Space_Grotesk'] tracking-widest text-[10px] uppercase" href="https://twitter.com/bezhas" target="_blank" rel="noopener noreferrer">Twitter</a>
                            <a className="text-white/30 hover:text-[#0d33f2] transition-colors font-['Space_Grotesk'] tracking-widest text-[10px] uppercase" href="/enterprise">Contact</a>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[10px] tracking-[0.3em] font-bold text-primary uppercase mb-4">Legal</div>
                        <div className="flex flex-col space-y-2">
                            <a className="text-white/30 hover:text-[#0d33f2] transition-colors font-['Space_Grotesk'] tracking-widest text-[10px] uppercase" href="/privacy">Legal</a>
                            <a className="text-white/30 hover:text-[#0d33f2] transition-colors font-['Space_Grotesk'] tracking-widest text-[10px] uppercase" href="/privacy">Privacy Policy</a>
                        </div>
                    </div>
                </div>
                <div className="mt-12 text-center">
                    <div className="text-white/30 font-['Space_Grotesk'] tracking-widest text-[10px] uppercase">
                        © 2024 BEZHAS PROTOCOL. ALL RIGHTS RESERVED.
                    </div>
                </div>
            </footer>

        </>
    );
}
