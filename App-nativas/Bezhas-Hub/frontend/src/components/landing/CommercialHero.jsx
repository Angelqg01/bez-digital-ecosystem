/**
 * CommercialHero — sustituye el hero "Global Engine" por tono B2B.
 * Una promesa clara, dos CTAs (planes + cómo conectarse), sin jerga.
 * Capa visual: GlassPipes sobre fondo dark conserva la identidad cyan/purple.
 */
import React from 'react';
import { ArrowRight, Plug2 } from 'lucide-react';
import GlassPipes from './GlassPipes';

const HERO_PIPES = [
    { from: [5, 70], to: [50, 35], curve: -25 },
    { from: [50, 35], to: [95, 65], curve: -25 },
    { from: [20, 90], to: [80, 90], curve: -10 },
];
const HERO_NODES = [
    { x: 5, y: 70 },
    { x: 50, y: 35 },
    { x: 95, y: 65 },
];

export default function CommercialHero({ onPrimary, onSecondary }) {
    return (
        <section className="relative min-h-[88vh] flex items-center justify-center px-6 lg:px-20 overflow-hidden z-10 pt-24 pb-20">
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[#080911]" />
                <div
                    className="absolute inset-0 opacity-80"
                    style={{
                        background:
                            'radial-gradient(circle at 75% 20%, rgba(13, 51, 242, 0.20), transparent 55%), radial-gradient(circle at 20% 80%, rgba(168, 85, 247, 0.18), transparent 55%)',
                    }}
                />
                <GlassPipes paths={HERO_PIPES} nodes={HERO_NODES} speed={5} particleCount={3} />
            </div>

            <div className="relative z-20 text-center max-w-5xl mx-auto space-y-7">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-cyan-300/30 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.25)]">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
                        La red comercial de tu empresa
                    </span>
                </div>

                <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 uppercase italic">
                    Una sola conexión, <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
                        toda tu red de socios
                    </span>
                </h1>

                <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
                    BeZhas-Hub conecta tu empresa con sus clientes, proveedores y plataformas
                    por una sola API. Menos integraciones, menos disputas, más ahorro operativo.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <button
                        onClick={onPrimary}
                        className="group w-full sm:w-auto min-w-[220px] h-14 px-6 bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] font-black uppercase tracking-widest rounded-lg shadow-[0_0_25px_rgba(34,211,238,0.35)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                    >
                        Ver planes <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <a
                        href="#conexion-api"
                        onClick={onSecondary}
                        className="w-full sm:w-auto min-w-[220px] h-14 px-6 bg-white/5 text-white font-bold uppercase tracking-widest rounded-lg border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center gap-2 backdrop-blur-md"
                    >
                        <Plug2 size={18} /> Cómo conectarme
                    </a>
                </div>

                <div className="pt-8 text-xs text-gray-500 uppercase tracking-widest">
                    Sin desarrollos a medida · Sin contratos en sombra · Webhooks firmados
                </div>
            </div>
        </section>
    );
}
