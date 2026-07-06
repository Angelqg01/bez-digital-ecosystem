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
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import CommercialHero from '../components/landing/CommercialHero';
import BusinessFeatures from '../components/landing/BusinessFeatures';
import ApiConnectionGuide from '../components/landing/ApiConnectionGuide';
import SavingsSection from '../components/landing/SavingsSection';
import LitigationSection from '../components/landing/LitigationSection';
import SubAppActivation from '../components/landing/SubAppActivation';
import PricingPlans from '../components/landing/PricingPlans';

export default function LandingPageCommercial() {
    const scrollToPlanes = useCallback(() => {
        const el = document.getElementById('planes');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

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
                        <a href="#planes" className="hover:text-white">Planes</a>
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
                <SubAppActivation />
                <PricingPlans />
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
