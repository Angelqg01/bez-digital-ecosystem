/**
 * SavingsSection — "Lo que se ahorra tu empresa" en tono positivo.
 *
 * Tres bloques: ahorro operativo, ahorro en disputas, y rendimiento de tesorería
 * (staking/farming framed como "tu liquidez genera mientras la usas").
 * Cero mención a recortes de personal — el brief lo pide explícitamente.
 */
import React from 'react';
import { Wallet, Receipt, Sprout } from 'lucide-react';

const SAVINGS = [
    {
        icon: Receipt,
        kpi: '~30%',
        title: 'Menos coste por integración',
        text:
            'Una API en vez de N adaptadores por socio. Tu equipo dedica horas a producto, no a "hablar" con cada ERP distinto.',
    },
    {
        icon: Wallet,
        kpi: 'Hasta 8%',
        title: 'Menos liquidez atrapada',
        text:
            'Los pagos y conciliaciones se liquidan en horas, no en días. Menos cuentas por cobrar pendientes, mejor cash-flow.',
    },
    {
        icon: Sprout,
        kpi: '+ rendimiento',
        title: 'Tu tesorería trabaja para ti',
        text:
            'La liquidez ociosa puede entrar en staking o pools (staking & farming) y generar rendimiento mientras la usas operativamente. Opt-in y reversible.',
    },
];

export default function SavingsSection() {
    return (
        <section id="ahorros" className="relative py-24 px-6 lg:px-20 z-10">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-emerald-300/30 mb-5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300">
                            Lo que se ahorra tu empresa
                        </span>
                    </div>
                    <h2 className="font-display text-4xl md:text-6xl font-black leading-tight text-white uppercase italic">
                        Menos fricción, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300">
                            más caja en tu bolsillo
                        </span>
                    </h2>
                    <p className="mt-6 text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                        BeZhas-Hub reduce tres costes invisibles: las integraciones a medida, la
                        liquidez atrapada y la tesorería parada. Tu equipo se queda, y trabaja en
                        lo que aporta valor.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
                    {SAVINGS.map(({ icon: Icon, kpi, title, text }) => (
                        <div
                            key={title}
                            className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-md p-6 lg:p-8 hover:border-emerald-300/30 transition-all"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-xl bg-emerald-300/15 flex items-center justify-center">
                                    <Icon size={22} className="text-emerald-300" />
                                </div>
                                <div className="text-3xl font-black text-white tracking-tight">{kpi}</div>
                            </div>
                            <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{text}</p>
                        </div>
                    ))}
                </div>

                <p className="mt-8 text-center text-xs text-gray-500 uppercase tracking-widest">
                    Cifras ilustrativas según implantaciones tipo. Tu ahorro real depende del volumen y los socios conectados.
                </p>
            </div>
        </section>
    );
}
