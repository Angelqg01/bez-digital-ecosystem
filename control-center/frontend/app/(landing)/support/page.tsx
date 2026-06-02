import Link from 'next/link';

export default function SupportPage() {
    return (
        <>
            <div className="max-w-7xl mx-auto px-8 py-12">

                {/* Hero */}
                <section className="mb-16">
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase mb-6 leading-none">
                        Centro de <span className="text-primary">Soporte</span>
                    </h1>
                    <p className="text-xl text-on-surface-variant max-w-2xl font-light leading-relaxed">
                        ¿Necesitas ayuda? Centralizamos demo, pilotos, integraciones y soporte tecnico desde los canales activos de BeZhas.
                    </p>
                </section>

                {/* Main Contact Cards */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
                    {/* Telegram Bot */}
                    <a href="https://t.me/BeZhasBot" target="_blank" rel="noopener noreferrer" className="glass-panel p-10 border border-primary/20 rounded-xl bg-primary/5 group hover:border-primary/40 transition-all block">
                        <div className="flex items-start gap-6">
                            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                                <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold italic uppercase tracking-tight mb-2">Telegram Bot</h3>
                                <p className="text-on-surface-variant leading-relaxed mb-4">
                                    Habla con nuestro bot inteligente para resolver dudas al instante sobre:
                                </p>
                                <ul className="space-y-2 text-sm text-on-surface-variant mb-6">
                                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Uso de la plataforma BeZhas</li>
                                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Demo read-only para clientes</li>
                                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Pilotos de Smart Escrow e integracion</li>
                                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Configuración de wallet</li>
                                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Integración de APIs y SDKs</li>
                                </ul>
                                <span className="bg-primary text-white px-8 py-3 font-bold italic tracking-widest uppercase text-sm inline-flex items-center gap-2 group-hover:shadow-[0_0_20px_rgba(13,51,242,0.4)] transition-all">
                                    ABRIR TELEGRAM BOT
                                    <span className="material-symbols-outlined text-lg">open_in_new</span>
                                </span>
                            </div>
                        </div>
                    </a>

                    {/* Email */}
                    <a href="mailto:info.angelqg@gmail.com" className="glass-panel p-10 border border-white/5 rounded-xl group hover:border-primary/30 transition-all block">
                        <div className="flex items-start gap-6">
                            <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                                <span className="material-symbols-outlined text-primary text-3xl">email</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold italic uppercase tracking-tight mb-2">Email</h3>
                                <p className="text-on-surface-variant leading-relaxed mb-4">
                                    Contacta a nuestro equipo para pilotos, partnerships, integraciones o derivacion al decisor correcto.
                                </p>
                                <div className="bg-black/40 rounded-lg p-4 font-mono text-sm text-primary mb-6">
                                    info.angelqg@gmail.com
                                </div>
                                <span className="glass-panel border border-white/10 text-white px-8 py-3 font-bold italic tracking-widest uppercase text-sm inline-flex items-center gap-2 group-hover:bg-white/5 transition-all">
                                    ENVIAR EMAIL
                                    <span className="material-symbols-outlined text-lg">send</span>
                                </span>
                            </div>
                        </div>
                    </a>
                </section>

                {/* FAQ Section */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">Preguntas <span className="text-primary">Frecuentes</span></h2>
                    <div className="space-y-4">
                        {[
                            {
                                q: '¿Puedo ver BeZhas sin desplegar infraestructura?',
                                a: 'Si. La demo read-only usa datos simulados para mostrar eventos, auditoria, integracion de sistemas y Smart Escrow sin tocar GCP, mainnet ni sistemas del cliente.',
                                link: '/demo',
                                linkText: 'Ver Demo'
                            },
                            {
                                q: '¿Que se enseña en una primera llamada?',
                                a: 'Se muestran dos flujos: despacho/tasas y servicio terminal. El objetivo es validar el dolor operativo, elegir 1 flujo piloto y definir que sistemas se integrarian.',
                                link: '/demo',
                                linkText: 'Ver Flujos'
                            },
                            {
                                q: '¿Qué es el Bridge cross-chain?',
                                a: 'El bridge permite mover activos entre BeZhas L2, Ethereum y Polygon de forma segura. La comisión es 0.5% + 10 BEZ mínimo por transacción. Las transacciones se confirman en ~1-5 minutos, aseguradas por MPC nodes.',
                                link: '/bridges',
                                linkText: 'Ir a Bridge'
                            },
                            {
                                q: '¿Cómo integro BeZhas Pay en mi aplicación?',
                                a: 'Instala el SDK con pnpm add @bezhas/sdk, configura tu API key y usa los endpoints de la Gateway API. Consulta nuestra documentación para ejemplos.',
                                link: '/docs',
                                linkText: 'Ver Documentación'
                            },
                            {
                                q: '¿Cómo me convierto en validador?',
                                a: 'Necesitas un mínimo de BEZ-Coin en staking y un servidor que cumpla los requisitos técnicos. Sigue la guía de onboarding paso a paso.',
                                link: '/validators#onboarding',
                                linkText: 'Guía de Validadores'
                            },
                            {
                                q: '¿Las transacciones tienen gas fees?',
                                a: 'BeZhas Pay ofrece transacciones gasless para usuarios finales gracias al Paymaster integrado. La comisión de la plataforma es 2.5% plana, más competitiva que Stripe (2.9%+$0.30). Los desarrolladores pueden sponsorizear gas para sus usuarios.',
                                link: '/payments',
                                linkText: 'BeZhas Pay'
                            },
                        ].map((faq, i) => (
                            <details key={i} className="glass-panel border border-white/5 rounded-xl group">
                                <summary className="p-6 cursor-pointer flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                    <span className="font-bold italic uppercase tracking-tight">{faq.q}</span>
                                    <span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
                                </summary>
                                <div className="px-6 pb-6 border-t border-white/5 pt-4">
                                    <p className="text-on-surface-variant text-sm leading-relaxed mb-3">{faq.a}</p>
                                    <Link href={faq.link} className="text-primary text-xs font-bold tracking-widest uppercase inline-flex items-center gap-1 hover:gap-2 transition-all">
                                        {faq.linkText} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                    </Link>
                                </div>
                            </details>
                        ))}
                    </div>
                </section>

                {/* Quick Links */}
                <section className="mb-16">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-8">Recursos <span className="text-primary">Rápidos</span></h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { icon: 'dashboard_customize', label: 'Demo Clientes', href: '/demo' },
                            { icon: 'school', label: 'Tutoriales', href: '/learn' },
                            { icon: 'code', label: 'Developer Portal', href: '/developers' },
                            { icon: 'description', label: 'API Docs', href: '/docs#api-reference' },
                            { icon: 'lan', label: 'Endpoints RPC', href: '/rpc' },
                            { icon: 'token', label: 'Token BEZ', href: '/token' },
                            { icon: 'sensors', label: 'Estado de Red', href: '/network' },
                            { icon: 'security', label: 'Validadores', href: '/validators' },
                            { icon: 'account_balance', label: 'Financiero', href: '/financial' },
                        ].map((link) => (
                            <Link key={link.label} href={link.href} className="glass-panel p-4 border border-white/5 rounded-xl text-center group hover:border-primary/30 transition-all block">
                                <span className="material-symbols-outlined text-primary text-2xl mb-2 block">{link.icon}</span>
                                <span className="text-xs font-bold tracking-widest uppercase">{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Community */}
                <section className="text-center py-16 relative">
                    <div className="absolute inset-0 bg-primary/5 -z-10"></div>
                    <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-6">
                        Únete a la <span className="text-primary">Comunidad</span>
                    </h2>
                    <p className="text-on-surface-variant text-xl mb-10 max-w-2xl mx-auto">
                        Miles de desarrolladores y empresas ya construyen sobre BeZhas. Únete a nuestros canales.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="https://t.me/BeZhasBot" target="_blank" rel="noopener noreferrer" className="bg-primary text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform inline-flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                            TELEGRAM
                        </a>
                        <a href="https://discord.gg/bezhas" target="_blank" rel="noopener noreferrer" className="glass-panel border border-white/10 text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors inline-flex items-center justify-center">
                            DISCORD
                        </a>
                        <a href="https://github.com/bezhas" target="_blank" rel="noopener noreferrer" className="glass-panel border border-white/10 text-white px-12 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors inline-flex items-center justify-center">
                            GITHUB
                        </a>
                    </div>
                </section>
            </div>
        </>
    );
}
