/**
 * LitigationSection — "Adiós a los litigios": los problemas que BeZhas-Hub resuelve.
 *
 * Lista contraste "antes / con BeZhas-Hub" sobre disputas, conciliación y
 * auditorías. Mantiene el tono comercial: explicar QUÉ se resuelve, no cómo.
 */
import React from 'react';
import { Scale, FileCheck2, GitBranch, ShieldX } from 'lucide-react';

const PROBLEMS = [
    {
        icon: Scale,
        title: 'Disputas con socios',
        before: 'Cada parte sostiene su versión. Reuniones, emails, abogados.',
        after: 'Hilo único de evidencia firmada por todas las partes. La disputa se resuelve por hechos, no por interpretación.',
    },
    {
        icon: FileCheck2,
        title: 'Conciliación que no cuadra',
        before: 'Equipos enteros cuadrando facturas, pedidos y entregas a mano.',
        after: 'Todos los eventos quedan registrados al instante. Conciliación automática, cierre de mes sin sorpresas.',
    },
    {
        icon: GitBranch,
        title: 'Contratos en sombra',
        before: 'Versiones distintas del mismo contrato circulando por correo.',
        after: 'Una única versión vigente, firmada y consultable por las partes autorizadas.',
    },
    {
        icon: ShieldX,
        title: 'Auditorías costosas',
        before: 'Cada auditoría destapa huecos y requiere semanas de reconstrucción.',
        after: 'Trazabilidad continua: el auditor consulta directamente la fuente, sin reconstruir nada.',
    },
];

export default function LitigationSection() {
    return (
        <section
            id="litigios"
            className="relative py-24 px-6 lg:px-20 z-10 border-y border-white/5 bg-[#080911]/60 backdrop-blur-sm"
        >
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-rose-300/30 mb-5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-rose-300">
                            Lo que dejas atrás
                        </span>
                    </div>
                    <h2 className="font-display text-4xl md:text-6xl font-black leading-tight text-white uppercase italic">
                        Adiós a las disputas <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-300 to-purple-400">
                            que no deberían existir
                        </span>
                    </h2>
                    <p className="mt-6 text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                        BeZhas-Hub está pensado para que las dudas se resuelvan por evidencia.
                        Tu empresa y sus socios trabajan sobre el mismo hilo, no sobre copias.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-5 lg:gap-6">
                    {PROBLEMS.map(({ icon: Icon, title, before, after }) => (
                        <div
                            key={title}
                            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 lg:p-8"
                        >
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-11 h-11 rounded-xl bg-rose-300/15 flex items-center justify-center">
                                    <Icon size={22} className="text-rose-300" />
                                </div>
                                <h3 className="text-white font-bold text-lg">{title}</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="rounded-lg border border-white/10 bg-rose-500/5 px-4 py-3">
                                    <div className="text-[10px] uppercase tracking-widest text-rose-300 font-bold mb-1">Antes</div>
                                    <div className="text-gray-300 text-sm leading-relaxed">{before}</div>
                                </div>
                                <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/5 px-4 py-3">
                                    <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-1">Con BeZhas-Hub</div>
                                    <div className="text-gray-200 text-sm leading-relaxed">{after}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
