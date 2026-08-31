import Link from 'next/link';
import { DOC_CATEGORIES, DOC_LIBRARY, getDocsByCategory } from '@/lib/docs-library';

export default function DocsPage() {
    return (
        <>
            <div className="max-w-7xl mx-auto px-8 py-12">

                {/* Hero */}
                <section className="mb-16">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="h-2 w-2 bg-tertiary rounded-full animate-pulse"></span>
                        <span className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold">Docs v4.2</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase mb-6 leading-none">
                        Developer <span className="text-primary">Docs</span>
                    </h1>
                    <p className="text-xl text-on-surface-variant max-w-2xl font-light leading-relaxed">
                        Documentación completa del protocolo BeZhas. APIs REST &amp; WebSocket, SDKs, Smart Contracts y guías de integración.
                    </p>
                    <div className="flex flex-wrap gap-4 mt-8">
                        <Link href="/docs/introduccion" className="bg-primary text-white px-8 py-4 font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform inline-flex items-center gap-2">
                            EMPEZAR AQUÍ <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                        <a href="#biblioteca" className="glass-panel border border-white/10 text-white px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">menu_book</span>
                            VER LOS {DOC_LIBRARY.length} DOCUMENTOS
                        </a>
                    </div>
                </section>

                {/* Biblioteca de documentación */}
                <section id="biblioteca" className="mb-16 scroll-mt-24">
                    <div className="flex items-end justify-between gap-6 mb-4">
                        <div>
                            <div className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold mb-2">Biblioteca</div>
                            <h2 className="text-4xl font-black italic tracking-tighter uppercase">
                                Documentación <span className="text-primary">completa</span>
                            </h2>
                        </div>
                    </div>
                    <p className="text-on-surface-variant text-sm leading-relaxed max-w-3xl mb-10">
                        Todo lo que necesitas para construir sobre BeZhas: uso de la plataforma, tokenización de activos,
                        NFT y credenciales, creación de nodos, validadores y staking, gobernanza y seguridad.
                        Documentación pública — no incluye credenciales, arquitectura interna ni material confidencial.
                    </p>

                    <div className="space-y-12">
                        {DOC_CATEGORIES.map((cat) => {
                            const docs = getDocsByCategory(cat.id);
                            if (docs.length === 0) return null;
                            return (
                                <div key={cat.id}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="material-symbols-outlined text-primary text-xl">{cat.icon}</span>
                                        <h3 className="text-lg font-bold italic uppercase tracking-tight">{cat.id}</h3>
                                        <span className="text-[10px] tracking-widest uppercase text-on-surface-variant bg-white/5 px-2 py-0.5 rounded">
                                            {docs.length}
                                        </span>
                                    </div>
                                    <p className="text-on-surface-variant text-xs mb-5 ml-9">{cat.blurb}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {docs.map((doc) => (
                                            <Link
                                                key={doc.slug}
                                                href={`/docs/${doc.slug}`}
                                                className="glass-panel p-6 border border-white/5 rounded-xl group hover:border-primary/30 transition-all flex flex-col"
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <span className="material-symbols-outlined text-primary text-2xl">{doc.icon}</span>
                                                    <span className="text-[9px] tracking-[0.2em] uppercase text-on-surface-variant bg-white/5 px-2 py-1 rounded flex-shrink-0">
                                                        {doc.level}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-white text-sm mb-2 leading-snug">{doc.title}</h4>
                                                <p className="text-on-surface-variant text-xs leading-relaxed mb-4 flex-1">
                                                    {doc.description}
                                                </p>
                                                <span className="text-primary text-[10px] font-bold tracking-widest uppercase inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                                                    LEER <span className="material-symbols-outlined text-xs">arrow_forward</span>
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Quick Start Cards */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    <Link href="/developers#sdk" className="glass-panel p-8 border border-white/5 rounded-xl group hover:border-primary/30 transition-all block">
                        <span className="material-symbols-outlined text-primary text-3xl mb-4 block">download</span>
                        <h3 className="text-xl font-bold italic uppercase tracking-tight mb-3">SDK &amp; Librerías</h3>
                        <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                            JavaScript, Python y Rust SDKs para integrar BeZhas en tu aplicación.
                        </p>
                        <div className="bg-black/40 rounded-lg p-4 font-mono text-xs text-primary mb-4">
                            <div className="text-gray-500">$ pnpm add @bezhas/sdk</div>
                            <div>import {'{'} BeZhasClient {'}'} from '@bezhas/sdk'</div>
                        </div>
                        <span className="text-primary text-xs font-bold tracking-widest uppercase inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                            VER SDK <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </span>
                    </Link>

                    <Link href="/developers#api" className="glass-panel p-8 border border-white/5 rounded-xl group hover:border-primary/30 transition-all block">
                        <span className="material-symbols-outlined text-primary text-3xl mb-4 block">api</span>
                        <h3 className="text-xl font-bold italic uppercase tracking-tight mb-3">API Reference</h3>
                        <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                            REST endpoints con autenticación JWT y API keys para acceso programático completo.
                        </p>
                        <div className="bg-black/40 rounded-lg p-4 font-mono text-xs text-primary mb-4">
                            <div className="text-gray-500">GET /api/gateway/v1/</div>
                            <div>Authorization: Bearer &lt;jwt&gt;</div>
                        </div>
                        <span className="text-primary text-xs font-bold tracking-widest uppercase inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                            VER APIs <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </span>
                    </Link>

                    <Link href="/rpc" className="glass-panel p-8 border border-white/5 rounded-xl group hover:border-primary/30 transition-all block">
                        <span className="material-symbols-outlined text-primary text-3xl mb-4 block">lan</span>
                        <h3 className="text-xl font-bold italic uppercase tracking-tight mb-3">RPC &amp; Nodos</h3>
                        <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                            Endpoints JSON-RPC públicos y dedicados para interactuar con la blockchain.
                        </p>
                        <div className="bg-black/40 rounded-lg p-4 font-mono text-xs text-primary mb-4">
                            <div className="text-gray-500">// HTTPS RPC</div>
                            <div>https://rpc.bezhas.io</div>
                        </div>
                        <span className="text-primary text-xs font-bold tracking-widest uppercase inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                            ENDPOINTS <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </span>
                    </Link>
                </section>

                {/* Unified API / SDK / Nodes / RPC Guide */}
                <section id="api-sdk-nodes-rpc" className="mb-16">
                    <div className="flex items-end justify-between gap-6 mb-8">
                        <div>
                            <div className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold mb-2">Guia unificada</div>
                            <h2 className="text-4xl font-black italic tracking-tighter uppercase">
                                API, SDK, Nodos <span className="text-primary">y RPC</span>
                            </h2>
                        </div>
                        <Link href="/rpc" className="hidden md:inline-flex items-center gap-2 text-primary text-xs font-bold tracking-widest uppercase hover:gap-3 transition-all">
                            Abrir RPC <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="glass-panel border border-primary/20 rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                            <p className="text-on-surface-variant text-sm leading-relaxed max-w-4xl">
                                Esta es la ruta recomendada para conectar cualquier App Nativa a la BeZhas-Blockchain Core: instalar el SDK con pnpm,
                                consumir la API Core, apuntar al RPC real o local y validar nodos antes de pasar a produccion.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
                            {[
                                {
                                    icon: 'download',
                                    title: 'Instalar SDK',
                                    body: 'Paquete oficial para contratos, ABI, pagos, creditos y BEZ-Coin.',
                                    code: 'pnpm add @bezhas/sdk',
                                    href: '/developers#sdk',
                                    cta: 'Ver SDK',
                                },
                                {
                                    icon: 'api',
                                    title: 'API Core',
                                    body: 'Gateway unificado para wallet, billing, contratos, CargoLink y Apps Nativas.',
                                    code: 'http://localhost:3001/api',
                                    href: '/developers#api',
                                    cta: 'Ver API',
                                },
                                {
                                    icon: 'lan',
                                    title: 'RPC local',
                                    body: 'Entorno de pruebas EVM antes de apuntar a testnet o mainnet.',
                                    code: 'anvil --chain-id 31337 --port 8545',
                                    href: '/rpc',
                                    cta: 'Ver RPC',
                                },
                                {
                                    icon: 'hub',
                                    title: 'Nodos',
                                    body: 'Enterprise Node y Edge Node para capacidad real, telemetria y validacion.',
                                    code: 'enterprise-node / bezhas-edge-node',
                                    href: '/validators#onboarding',
                                    cta: 'Ver nodos',
                                },
                            ].map((item) => (
                                <Link key={item.title} href={item.href} className="p-6 block hover:bg-white/[0.03] transition-colors group">
                                    <span className="material-symbols-outlined text-primary text-3xl mb-4 block">{item.icon}</span>
                                    <h3 className="text-lg font-bold italic uppercase tracking-tight mb-2">{item.title}</h3>
                                    <p className="text-on-surface-variant text-xs leading-relaxed mb-4 min-h-[54px]">{item.body}</p>
                                    <div className="bg-black/40 rounded-lg p-3 font-mono text-[11px] text-tertiary mb-4 overflow-hidden text-ellipsis whitespace-nowrap">
                                        {item.code}
                                    </div>
                                    <span className="text-primary text-[10px] font-bold tracking-widest uppercase inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                                        {item.cta} <span className="material-symbols-outlined text-xs">arrow_forward</span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* API Endpoints Reference */}
                <section id="api-reference" className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">API <span className="text-primary">Gateway</span></h2>
                    <div className="glass-panel border border-white/5 rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                            <p className="text-on-surface-variant text-sm">
                                Todos los endpoints están disponibles bajo <code className="text-primary font-mono text-xs bg-primary/10 px-2 py-0.5 rounded">/api/gateway/v1/</code>.
                                Requieren autenticación via API Key + JWT (excepto SSO).
                            </p>
                        </div>
                        <div className="divide-y divide-white/5">
                            {[
                                { method: 'POST', path: '/sso/login', desc: 'Wallet-based login (cross-app JWT)', scope: 'public' },
                                { method: 'GET', path: '/wallet/balances', desc: 'Obtener balances de todos los tokens', scope: 'wallet:read' },
                                { method: 'POST', path: '/wallet/transfer', desc: 'Transferir tokens entre wallets', scope: 'wallet:write' },
                                { method: 'GET', path: '/staking/positions', desc: 'Posiciones de staking activas', scope: 'staking:read' },
                                { method: 'POST', path: '/staking/stake', desc: 'Iniciar staking de BEZ-Coin', scope: 'staking:write' },
                                { method: 'GET', path: '/farming/pools', desc: 'Pools de farming disponibles', scope: 'farming:read' },
                                { method: 'GET', path: '/governance/proposals', desc: 'Propuestas de gobernanza activas', scope: 'governance:read' },
                                { method: 'POST', path: '/governance/vote', desc: 'Votar en una propuesta', scope: 'governance:write' },
                                { method: 'POST', path: '/bridge/initiate', desc: 'Iniciar bridge cross-chain', scope: 'bridge:write' },
                                { method: 'GET', path: '/token/info', desc: 'Información del token BEZ-Coin', scope: 'public' },
                                { method: 'GET', path: '/treasury/overview', desc: 'Estado de la tesorería DAO', scope: 'treasury:read' },
                                { method: 'GET', path: '/contracts/addresses', desc: 'Direcciones de smart contracts', scope: 'public' },
                            ].map((ep) => (
                                <div key={ep.path} className="p-4 px-6 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                    <span className={`font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded ${ep.method === 'GET' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                                        }`}>
                                        {ep.method}
                                    </span>
                                    <code className="font-mono text-xs text-white flex-shrink-0">{ep.path}</code>
                                    <span className="text-on-surface-variant text-sm flex-1">{ep.desc}</span>
                                    <span className="text-[10px] tracking-widest uppercase text-on-surface-variant bg-white/5 px-2 py-1 rounded hidden md:inline">
                                        {ep.scope}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Smart Contracts Reference */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">Smart <span className="text-primary">Contracts</span></h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { name: 'BEZCoinV2', desc: 'Token ERC-20 nativo con Permit, Votes y cap de 10.000M', icon: 'token', link: '/docs/bez-coin' },
                            { name: 'ValidatorRegistry', desc: 'Registro de validadores, tiers, boosts y unbonding', icon: 'verified_user', link: '/docs/validadores-staking' },
                            { name: 'EdgeNodeRewards', desc: 'Sistema DePIN para rewards de nodos B2B', icon: 'hub', link: '/docs/nodos-enterprise-edge' },
                            { name: 'BeZhasLogisticsNFT', desc: 'NFT de manifiestos y activos logísticos (ERC-721)', icon: 'style', link: '/docs/nft-y-sbt' },
                            { name: 'BeZhasPayment', desc: 'Pagos B2B con comisión, lotes y protección anti-replay', icon: 'payments', link: '/docs/pagos-y-gas' },
                            { name: 'GovernanceSystem', desc: 'DAO sobre OpenZeppelin Governor con timelock', icon: 'how_to_vote', link: '/docs/gobernanza-dao' },
                        ].map((contract) => (
                            <Link key={contract.name} href={contract.link} className="glass-panel p-6 border border-white/5 rounded-xl flex gap-4 hover:border-primary/30 transition-all group">
                                <span className="material-symbols-outlined text-primary text-2xl flex-shrink-0">{contract.icon}</span>
                                <div>
                                    <h4 className="font-mono text-sm font-bold text-white mb-1">{contract.name}.sol</h4>
                                    <p className="text-on-surface-variant text-xs leading-relaxed">{contract.desc}</p>
                                </div>
                                <span className="material-symbols-outlined text-on-surface-variant text-sm ml-auto self-center opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Integration Guides */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">Guías de <span className="text-primary">Integración</span></h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { title: 'BeZhas Pay', desc: 'Integra pagos gasless en tu dApp o e-commerce. SDK + webhooks para confirmaciones.', icon: 'payments', href: '/payments' },
                            { title: 'Supply Chain SDK', desc: 'Tokeniza inventario, trackea envíos en tiempo real con IoT + blockchain.', icon: 'local_shipping', href: '/commerce' },
                            { title: 'Validador Node', desc: 'Paso a paso para desplegar un nodo validador BeZhas y ganar rewards.', icon: 'dns', href: '/validators#onboarding' },
                            { title: 'Bridge Cross-Chain', desc: 'Conecta activos entre BeZhas L2, Ethereum y Polygon.', icon: 'alt_route', href: '/bridges' },
                            { title: 'DeFi Integration', desc: 'Pools de liquidez, farming y lending con RWA tokenizados.', icon: 'account_balance', href: '/financial' },
                            { title: 'SSO & Auth', desc: 'Login con wallet, JWT cross-app y permisos basados en roles.', icon: 'vpn_key', href: '/login' },
                            { title: 'OPERANT — Agentes IA', desc: '10 departamentos de agentes autónomos con aprobación humana y auditoría anclada en L2.', icon: 'smart_toy', href: '/docs/operant' },
                        ].map((guide) => (
                            <Link key={guide.title} href={guide.href} className="glass-panel p-6 border border-white/5 rounded-xl group hover:border-primary/30 transition-all block">
                                <span className="material-symbols-outlined text-primary text-2xl mb-3 block">{guide.icon}</span>
                                <h4 className="font-bold italic uppercase tracking-tight mb-2">{guide.title}</h4>
                                <p className="text-on-surface-variant text-xs leading-relaxed mb-4">{guide.desc}</p>
                                <span className="text-primary text-[10px] font-bold tracking-widest uppercase inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                                    LEER GUÍA <span className="material-symbols-outlined text-xs">arrow_forward</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center py-16 relative">
                    <div className="absolute inset-0 bg-primary/5 -z-10"></div>
                    <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-6">
                        ¿Listo para <span className="text-primary">Construir</span>?
                    </h2>
                    <p className="text-on-surface-variant text-xl mb-10 max-w-2xl mx-auto">
                        Únete a la comunidad de desarrolladores BeZhas. SDK gratuito, soporte 24/7 y documentación completa.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/developers#sdk" className="bg-primary text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform inline-flex items-center justify-center">
                            DESCARGAR SDK
                        </Link>
                        <a href="https://t.me/BeZhasBot" target="_blank" rel="noopener noreferrer" className="glass-panel border border-white/10 text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                            SOPORTE VIA TELEGRAM
                        </a>
                    </div>
                </section>
            </div>
        </>
    );
}
