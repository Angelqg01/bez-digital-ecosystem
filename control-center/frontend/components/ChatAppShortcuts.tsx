'use client';

/**
 * Accesos directos a las apps nativas del ecosistema, dentro de la barra de chat.
 * El destino lo decide el servidor (POST /actions/:id/open); aquí solo se pintan las tarjetas.
 */
import { Crown, CreditCard, Fuel, Globe, Landmark, ScanLine, Truck, Wallet, Zap, type LucideIcon } from 'lucide-react';
import type { ChatAction } from '@/lib/ai-workspace';

const MARCA: Record<string, { icon: LucideIcon; from: string; to: string; ring: string }> = {
    app_hub: { icon: Globe, from: 'from-cyan-400/25', to: 'to-sky-500/5', ring: 'hover:border-cyan-300/60' },
    app_defi: { icon: Landmark, from: 'from-violet-400/25', to: 'to-fuchsia-500/5', ring: 'hover:border-violet-300/60' },
    app_purescan: { icon: ScanLine, from: 'from-emerald-400/25', to: 'to-teal-500/5', ring: 'hover:border-emerald-300/60' },
    app_energy: { icon: Zap, from: 'from-amber-400/25', to: 'to-orange-500/5', ring: 'hover:border-amber-300/60' },
    app_wallet: { icon: Wallet, from: 'from-sky-400/25', to: 'to-indigo-500/5', ring: 'hover:border-sky-300/60' },
    app_gas: { icon: Fuel, from: 'from-lime-400/25', to: 'to-green-500/5', ring: 'hover:border-lime-300/60' },
    app_pay: { icon: CreditCard, from: 'from-teal-400/25', to: 'to-cyan-500/5', ring: 'hover:border-teal-300/60' },
    app_prestige: { icon: Crown, from: 'from-yellow-400/25', to: 'to-amber-500/5', ring: 'hover:border-yellow-300/60' },
    app_cargolink: { icon: Truck, from: 'from-rose-400/25', to: 'to-pink-500/5', ring: 'hover:border-rose-300/60' },
};

export const esApp = (a: ChatAction) => a.kind === 'app';

export default function ChatAppShortcuts({
    apps, onOpen, disabled, compact = false,
}: { apps: ChatAction[]; onOpen: (a: ChatAction) => void; disabled?: boolean; compact?: boolean }) {
    const lista = apps.filter(esApp);
    if (lista.length === 0) return null;
    return (
        <nav aria-label="Apps del ecosistema BeZhas" className={compact ? 'mt-2' : ''}>
            {!compact && <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Apps del ecosistema</p>}
            <ul className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {lista.map((a) => {
                    const m = MARCA[a.id] || MARCA.app_hub;
                    const Icon = m.icon;
                    const caida = !!a.unavailable;
                    return (
                        <li key={a.id} className="snap-start">
                            <button
                                onClick={() => onOpen(a)}
                                disabled={disabled}
                                title={caida ? `${a.title} no está disponible ahora mismo` : a.description}
                                aria-label={caida ? `${a.title} (no disponible)` : `Abrir ${a.title}`}
                                className={`group flex ${compact ? 'w-40 p-2' : 'w-44 p-2.5'} flex-col gap-1 rounded-xl border border-white/10 bg-gradient-to-br ${m.from} ${m.to} text-left transition ${m.ring} hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 disabled:opacity-50 ${caida ? 'opacity-60' : ''}`}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-black/30 text-slate-100 ring-1 ring-white/10"><Icon size={15} /></span>
                                    <span className="truncate text-sm font-semibold text-slate-100">{a.title}</span>
                                </span>
                                {!compact && <span className="line-clamp-2 text-[11px] leading-snug text-slate-400">{a.description}</span>}
                                <span className={`mt-auto text-[10px] font-medium ${caida ? 'text-amber-300' : 'text-cyan-300 opacity-0 transition group-hover:opacity-100'}`}>
                                    {caida ? 'Próximamente' : 'Abrir en pestaña nueva ↗'}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
