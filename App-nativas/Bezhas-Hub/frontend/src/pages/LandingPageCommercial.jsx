/**
 * LandingPageCommercial — Home rediseñada con tono comercial (sin jerga blockchain).
 *
 * 6 secciones del brief: Hero → Funciones → Guía conexión API (glass-pipes) →
 * Ahorros → Litigios → Planes. Reusa el footer del LandingPage legacy si está
 * disponible; navbar nuevo, ligero.
 *
 * El LandingPage.jsx anterior queda intacto y accesible por `/landing-legacy`
 * mientras se itera ésta. Aditivo, sin romper.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Zap, Building2, Crown } from 'lucide-react';
import CommercialHero from '../components/landing/CommercialHero';
import BusinessFeatures from '../components/landing/BusinessFeatures';
import ApiConnectionGuide from '../components/landing/ApiConnectionGuide';
import SavingsSection from '../components/landing/SavingsSection';
import LitigationSection from '../components/landing/LitigationSection';
import { PLANS } from '../config/plans';

// Teaser de planes — el detalle completo (calculador de módulos, ROI, OPERANT,
// pago) vive en un único sitio: /be-vip. Antes esta página duplicaba esa misma
// información con <PricingPlans/> + <NativeAppActivation/>; dos superficies
// ofreciendo lo mismo confundían más de lo que ayudaban a decidir.
const TEASER_ICONS = [Sparkles, Zap, Building2, Crown];

export default function LandingPageCommercial() {
    const navigate = useNavigate();
    const scrollToPlanes = () => navigate('/be-vip');

    return (
        <div className="relative min-h-screen bg-[#080911] text-white font-sans antialiased overflow-x-hidden">
            {/* Universe background — radial soft */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.10), transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(13, 51, 242, 0.10), transparent 60%)',
                    }}
                />
            </div>

            {/* Top navbar — ligero, sin SSO completo (deferido) */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#080911]/70 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 lg:px-20 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-300 to-purple-400 flex items-center justify-center text-[#080911] font-black">B</div>
                        <span className="font-display font-black uppercase tracking-widest text-white">BeZhas-Hub</span>
                    </Link>
                    <div className="hidden md:flex items-center gap-7 text-sm text-gray-300">
                        <a href="#funciones" className="hover:text-white">Funciones</a>
                        <a href="#conexion-api" className="hover:text-white">Cómo conectar</a>
                        <a href="#ahorros" className="hover:text-white">Ahorros</a>
                        <Link to="/be-vip" className="hover:text-white">Planes</Link>
                    </div>
                    <button
                        onClick={scrollToPlanes}
                        className="h-10 px-4 rounded-lg bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] text-xs font-black uppercase tracking-widest hover:scale-[1.03] transition-transform"
                    >
                        Empezar
                    </button>
                </div>
            </nav>

            {/* Secciones */}
            <main className="relative z-10">
                <CommercialHero onPrimary={scrollToPlanes} />
                <BusinessFeatures />
                <ApiConnectionGuide />
                <SavingsSection />
                <LitigationSection />
                <PlansTeaser />
            </main>

            {/* Footer ligero */}
            <footer className="relative z-10 border-t border-white/5 bg-[#06070d] py-10 px-6 lg:px-20">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                    <div>© {new Date().getFullYear()} BeZhas · La red comercial de tu empresa</div>
                    <div className="flex gap-5">
                        <a href="/developers" className="hover:text-gray-300">Developers</a>
                        <a href="/terms" className="hover:text-gray-300">Términos</a>
                        <a href="/privacy" className="hover:text-gray-300">Privacidad</a>
                        <Link to="/landing-legacy" className="hover:text-gray-300">Versión clásica</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function PlansTeaser() {
    return (
        <section id="planes" className="relative py-24 px-6 lg:px-20 z-10">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-cyan-300/30 mb-5">
                        <Sparkles size={14} className="text-cyan-300" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
                            4 planes · módulo a módulo · desde gratis
                        </span>
                    </div>
                    <h2 className="font-display text-4xl md:text-6xl font-black leading-tight text-white uppercase italic">
                        Un plan que{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
                            crece con tu empresa
                        </span>
                    </h2>
                    <p className="mt-6 text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                        Elige un plan base, activa solo las Apps Nativas que necesitas y multiplica la eficiencia,
                        automatización y validez laboral de tu equipo hasta 15x. Simulador en vivo, precio final al instante.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6 mb-12">
                    {PLANS.map((p, i) => {
                        const Icon = TEASER_ICONS[i] || Sparkles;
                        return (
                            <Link
                                key={p.id}
                                to="/be-vip"
                                className={`group relative rounded-2xl border bg-white/[0.04] backdrop-blur-md p-6 flex flex-col transition hover:-translate-y-1 ${
                                    p.recommended ? 'border-cyan-300/50 shadow-[0_0_30px_rgba(34,211,238,0.2)]' : 'border-white/10 hover:border-white/25'
                                }`}
                            >
                                {p.recommended && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] text-[9px] font-black uppercase tracking-widest">
                                        Popular
                                    </span>
                                )}
                                <Icon size={20} className="text-cyan-300 mb-3" />
                                <div className="text-white font-bold text-lg">{p.name}</div>
                                <div className="text-2xl font-black text-white mt-1">
                                    {p.priceEUR === 0 ? 'Gratis' : `${p.priceEUR} €`}
                                    {p.priceEUR > 0 && <span className="text-gray-400 text-xs font-normal"> /mes</span>}
                                </div>
                                {p.laborMultiplier && (
                                    <div className="mt-3 inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-300/10 border border-cyan-300/30">
                                        <span className="text-cyan-300 font-black text-xs">{p.laborMultiplier}</span>
                                        <span className="text-gray-400 text-[10px]">eficiencia y automatización</span>
                                    </div>
                                )}
                                <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white">
                                    Ver detalle <ArrowRight size={13} className="transition group-hover:translate-x-1" />
                                </span>
                            </Link>
                        );
                    })}
                </div>

                <div className="flex flex-col items-center gap-3">
                    <Link
                        to="/be-vip"
                        className="inline-flex items-center gap-2 h-14 px-8 rounded-xl bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] font-black uppercase tracking-widest text-sm hover:scale-[1.03] transition-transform"
                    >
                        Ver los 4 planes en detalle y suscribirme <ArrowRight size={18} />
                    </Link>
                    <p className="text-gray-500 text-xs">Simulador de módulos, ROI y pago en EUR o $BEZ — todo en un mismo sitio.</p>
                </div>
            </div>
        </section>
    );
}
