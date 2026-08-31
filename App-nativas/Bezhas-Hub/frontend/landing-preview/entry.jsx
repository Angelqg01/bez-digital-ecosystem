/**
 * Entry point STANDALONE para la nueva landing comercial.
 * No usa App.jsx, no toca wagmi/viem/web3 → evita las deps rotas del workspace.
 * Sólo monta los 6 componentes nuevos para verificación visual.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import CommercialHero from '../src/components/landing/CommercialHero';
import BusinessFeatures from '../src/components/landing/BusinessFeatures';
import ApiConnectionGuide from '../src/components/landing/ApiConnectionGuide';
import SavingsSection from '../src/components/landing/SavingsSection';
import LitigationSection from '../src/components/landing/LitigationSection';
import SubAppActivation from '../src/components/landing/SubAppActivation';
import PricingPlans from '../src/components/landing/PricingPlans';

function App() {
    const scrollToPlanes = () => {
        const el = document.getElementById('planes');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return (
        <div className="relative min-h-screen bg-[#080911] text-white font-sans antialiased overflow-x-hidden">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.10), transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(13, 51, 242, 0.10), transparent 60%)',
                    }}
                />
            </div>
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#080911]/70 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 lg:px-20 h-16 flex items-center justify-between">
                    <a href="#" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-300 to-purple-400 flex items-center justify-center text-[#080911] font-black">B</div>
                        <span className="font-display font-black uppercase tracking-widest text-white">BeZhas-Hub</span>
                    </a>
                    <div className="hidden md:flex items-center gap-7 text-sm text-gray-300">
                        <a href="#funciones" className="hover:text-white">Funciones</a>
                        <a href="#conexion-api" className="hover:text-white">Cómo conectar</a>
                        <a href="#ahorros" className="hover:text-white">Ahorros</a>
                        <a href="#planes" className="hover:text-white">Planes</a>
                    </div>
                    <button
                        onClick={scrollToPlanes}
                        className="h-10 px-4 rounded-lg bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] text-xs font-black uppercase tracking-widest hover:scale-[1.03] transition-transform"
                    >Empezar</button>
                </div>
            </nav>
            <main className="relative z-10">
                <CommercialHero onPrimary={scrollToPlanes} />
                <BusinessFeatures />
                <ApiConnectionGuide />
                <SavingsSection />
                <LitigationSection />
                <SubAppActivation />
                <PricingPlans />
            </main>
            <footer className="relative z-10 border-t border-white/5 bg-[#06070d] py-10 px-6 lg:px-20">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                    <div>© {new Date().getFullYear()} BeZhas · La red comercial de tu empresa</div>
                    <div className="flex gap-5">
                        <a href="#funciones" className="hover:text-gray-300">Funciones</a>
                        <a href="#planes" className="hover:text-gray-300">Planes</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App />);
