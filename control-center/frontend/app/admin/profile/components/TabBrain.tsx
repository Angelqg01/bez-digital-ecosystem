'use client';

import { useEffect, useState } from 'react';
import { Map as MapIcon, Radar } from 'lucide-react';
import TabObsidian from './TabObsidian';
import TabBrainLive from './TabBrainLive';

// Una sola pestaña para el Brain: el vault (conocimiento, mapa y qué ven los
// clientes) y la red en vivo (tráfico de la API). Sólo se monta la vista
// activa: Brain Live sondea cada pocos segundos y no debe hacerlo oculta.

type Vista = 'vault' | 'live';
const CLAVE = 'bezhas_admin_brain_vista';

const VISTAS: { id: Vista; label: string; desc: string; Icon: typeof MapIcon }[] = [
    { id: 'vault', label: 'Vault y conocimiento', desc: 'Mapa, notas y lo que ven los clientes', Icon: MapIcon },
    { id: 'live', label: 'Red en vivo', desc: 'Tráfico de la API por actor y módulo', Icon: Radar },
];

export default function TabBrain() {
    const [vista, setVista] = useState<Vista>('vault');

    useEffect(() => {
        try {
            const guardada = localStorage.getItem(CLAVE);
            if (guardada === 'vault' || guardada === 'live') setVista(guardada);
        } catch { /* sin almacenamiento: vista por defecto */ }
    }, []);

    const elegir = (v: Vista) => {
        setVista(v);
        try { localStorage.setItem(CLAVE, v); } catch { /* sin almacenamiento */ }
    };

    return (
        <div className="space-y-6">
            <div role="tablist" aria-label="Vistas del Brain" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {VISTAS.map(({ id, label, desc, Icon }) => {
                    const activa = vista === id;
                    return (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={activa}
                            onClick={() => elegir(id)}
                            className={`flex items-center gap-3 border p-3 text-left transition-colors ${
                                activa ? 'border-[#0d33f2]/60 bg-[#0d33f2]/10 text-white' : 'border-white/10 text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}
                        >
                            <Icon size={18} className={activa ? 'text-[#0d33f2]' : 'text-gray-600'} />
                            <span>
                                <span className="block text-xs font-bold uppercase tracking-widest">{label}</span>
                                <span className="block text-[10px] uppercase tracking-widest opacity-70">{desc}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
            {vista === 'vault' ? <TabObsidian /> : <TabBrainLive />}
        </div>
    );
}
