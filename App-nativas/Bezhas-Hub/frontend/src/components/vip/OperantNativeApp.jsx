/**
 * OperantNativeApp — qué desbloquea cada plan en OPERANT, dentro de /be-vip.
 *
 * OPERANT no es un producto aparte: es una App Nativa que se activa sobre la
 * suscripción que el cliente ya está mirando en esta página. Por eso vive aquí
 * y no en una landing propia — la decisión de plan y la de agentes son la misma.
 *
 * Todo sale de `config/operant-native-app.js`, espejo público del catálogo del
 * backend (`GET /api/operant/catalog`). Este componente no conoce costes ni
 * márgenes a propósito: solo el precio por tarea, que sí es del cliente.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Check, Minus, ShieldCheck, Link2, ChevronDown } from 'lucide-react';
import {
    OPERANT_DEPARTMENTS,
    OPERANT_BY_PLAN,
    OPERANT_TASK_PRICE_EUR,
    OPERANT_MODULE_PRICE_EUR,
    ONCHAIN_FEATURE_LABELS,
    AUTONOMY_LABELS,
    AUTONOMY_BLURBS,
    ANCHOR_LABELS,
    paygValueOf,
    savingsVsPayg,
} from '../../config/operant-native-app';

const PLAN_ORDER = ['starter', 'creator_pro', 'business', 'enterprise_vip'];
const PLAN_NAMES = {
    starter: 'Starter',
    creator_pro: 'Creator Pro',
    business: 'Business',
    enterprise_vip: 'Enterprise VIP',
};

const eur = (n) => `${n.toFixed(4).replace(/0+$/, '').replace('.', ',')} €`;
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Cuota del plan en una línea. Starter no tiene: paga por uso desde la primera. */
function cuotaDe(plan) {
    if (plan.includedTasks === 0) return 'Pago por uso';
    return `${miles(plan.includedTasks)} tareas/mes`;
}

export default function OperantNativeApp() {
    const [abierto, setAbierto] = useState(false);

    return (
        <section className="mb-12 max-w-6xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-gray-900/60 backdrop-blur-sm overflow-hidden"
            >
                {/* Cabecera */}
                <div className="p-6 md:p-8 border-b border-white/10">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl flex-shrink-0">
                            <Bot className="w-7 h-7 text-purple-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="text-2xl font-bold text-white">OPERANT</h3>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
                                    Incluido en tu plan
                                </span>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed max-w-3xl">
                                Diez departamentos de agentes IA trabajando dentro de tu empresa —
                                ventas, soporte, marketing, finanzas, RRHH, operaciones, legal,
                                blockchain ops, tesorería y fundraising — con{' '}
                                <span className="text-purple-300">cada decisión registrada</span> en
                                una cadena de auditoría anclada en BeZhas L2.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg">
                            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                            Aprobación humana obligatoria en activos, datos personales y legal
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg">
                            <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                            Misma api-key, misma factura
                        </span>
                    </div>
                </div>

                {/* Comparativa por plan */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.03]">
                                <th className="text-left text-gray-400 font-medium px-6 py-3 w-48">&nbsp;</th>
                                {PLAN_ORDER.map((id) => (
                                    <th key={id} className="text-left text-white font-bold px-4 py-3">
                                        {PLAN_NAMES[id]}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-white/10 bg-purple-500/[0.06]">
                                <td className="text-gray-300 font-medium px-6 py-4 align-top">
                                    Precio del módulo
                                </td>
                                {PLAN_ORDER.map((id) => {
                                    const precio = OPERANT_MODULE_PRICE_EUR[id];
                                    const payg = paygValueOf(id);
                                    const ahorro = savingsVsPayg(id);
                                    return (
                                        <td key={id} className="px-4 py-4 align-top">
                                            <div className="text-white font-black text-lg leading-none">
                                                {precio === 0 ? 'Pago por uso' : `${precio} €`}
                                                {precio > 0 && (
                                                    <span className="text-xs font-normal text-gray-400"> /mes</span>
                                                )}
                                            </div>
                                            {ahorro > 0 && (
                                                <div className="text-[11px] text-green-400 mt-1 leading-tight">
                                                    −{ahorro}% frente a comprar
                                                    <br />esas tareas sueltas ({payg.toFixed(0)} €)
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                            <Fila label="Departamentos">
                                {(p) => `${p.departments.length} de ${OPERANT_DEPARTMENTS.length}`}
                            </Fila>
                            <Fila label="Tareas incluidas">{(p) => cuotaDe(p)}</Fila>
                            <Fila label="Tareas simultáneas">{(p) => p.maxConcurrent}</Fila>
                            <Fila label="Peticiones / minuto">{(p) => miles(p.rpm)}</Fila>
                            <Fila label="Autonomía" title={(p) => AUTONOMY_BLURBS[p.autonomy]}>
                                {(p) => AUTONOMY_LABELS[p.autonomy]}
                            </Fila>
                            <Fila label="Auditoría on-chain">
                                {(p) => (p.anchor === 'none'
                                    ? <span className="text-gray-500 inline-flex items-center gap-1"><Minus className="w-3.5 h-3.5" /> —</span>
                                    : ANCHOR_LABELS[p.anchor])}
                            </Fila>
                            <Fila label="Historial">
                                {(p) => (p.retentionDays >= 365
                                    ? `${Math.round(p.retentionDays / 365)} año${p.retentionDays >= 730 ? 's' : ''}`
                                    : `${p.retentionDays} días`)}
                            </Fila>
                        </tbody>
                    </table>
                </div>

                {/* Detalle plegable */}
                <button
                    onClick={() => setAbierto(!abierto)}
                    className="w-full py-4 px-6 border-t border-white/10 hover:bg-white/[0.03] transition-colors flex items-center justify-center gap-2 text-sm text-gray-300"
                >
                    {abierto ? 'Ocultar' : 'Ver'} departamentos, capacidades on-chain y precio por tarea
                    <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                </button>

                {abierto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-6 md:p-8 border-t border-white/10 space-y-8"
                    >
                        {/* Departamentos */}
                        <div>
                            <h4 className="text-white font-bold mb-1">Los 10 departamentos</h4>
                            <p className="text-gray-400 text-xs mb-4">
                                Los marcados con escudo piden aprobación humana en sus acciones
                                sensibles, sea cual sea tu plan. No es configurable a propósito.
                            </p>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {OPERANT_DEPARTMENTS.map((d) => (
                                    <div key={d.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-lg">{d.icon}</span>
                                            <span className="text-white font-semibold text-sm">{d.label}</span>
                                            {d.hitl && (
                                                <ShieldCheck className="w-3.5 h-3.5 text-green-400 flex-shrink-0" title="Aprobación humana obligatoria" />
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-xs leading-relaxed mb-2">{d.blurb}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {PLAN_ORDER.filter((id) => OPERANT_BY_PLAN[id].departments.includes(d.id)).map((id) => (
                                                <span key={id} className="text-[9px] uppercase tracking-wider text-purple-300 bg-purple-500/15 px-1.5 py-0.5 rounded">
                                                    {PLAN_NAMES[id]}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Capacidades on-chain */}
                        <div>
                            <h4 className="text-white font-bold mb-4">Qué queda en la cadena</h4>
                            <div className="space-y-2">
                                {Object.entries(ONCHAIN_FEATURE_LABELS).map(([id, label]) => {
                                    const desde = PLAN_ORDER.find((p) => OPERANT_BY_PLAN[p].onchain.includes(id));
                                    return (
                                        <div key={id} className="flex items-start gap-3 text-sm">
                                            <Check className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                            <span className="text-gray-300 flex-1">{label}</span>
                                            <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-white/5 px-2 py-0.5 rounded flex-shrink-0">
                                                desde {PLAN_NAMES[desde]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Precio por tarea */}
                        <div>
                            <h4 className="text-white font-bold mb-1">Si te pasas de la cuota</h4>
                            <p className="text-gray-400 text-xs mb-4 max-w-3xl leading-relaxed">
                                Una tarea es un trabajo completo: el manager del departamento enruta,
                                los especialistas ejecutan y todo queda escrito en la auditoría. Las
                                de tu cuota ya las paga el módulo; por encima, se facturan por
                                créditos en la misma línea de consumo del Gateway, al precio de abajo.
                            </p>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="text-white font-semibold text-sm mb-1">
                                        Ventas · Marketing · Fundraising
                                    </div>
                                    <div className="text-2xl font-black text-purple-300">
                                        {eur(OPERANT_TASK_PRICE_EUR.frontier)}
                                        <span className="text-xs font-normal text-gray-400"> / tarea</span>
                                    </div>
                                    <p className="text-gray-500 text-xs mt-1">
                                        Modelo más capaz: su salida la lee un cliente tuyo.
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="text-white font-semibold text-sm mb-1">Los otros 7 departamentos</div>
                                    <div className="text-2xl font-black text-cyan-300">
                                        {eur(OPERANT_TASK_PRICE_EUR.mid)}
                                        <span className="text-xs font-normal text-gray-400"> / tarea</span>
                                    </div>
                                    <p className="text-gray-500 text-xs mt-1">Trabajo interno.</p>
                                </div>
                            </div>
                            <p className="text-gray-500 text-xs mt-3">
                                Si agotas la cuota y no tienes el pago por uso activado, la siguiente
                                tarea se detiene en vez de ejecutarse. Preferimos frenarte a cobrarte
                                algo que no esperabas.
                            </p>
                        </div>

                        <a
                            href="https://bez.digital/docs/operant"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 font-medium"
                        >
                            Documentación completa de OPERANT →
                        </a>
                    </motion.div>
                )}
            </motion.div>
        </section>
    );
}

/** Una fila de la comparativa, resuelta para los 4 planes. */
function Fila({ label, title, children }) {
    return (
        <tr className="border-b border-white/5 last:border-0">
            <td className="text-gray-400 px-6 py-3 align-top">{label}</td>
            {PLAN_ORDER.map((id) => {
                const plan = OPERANT_BY_PLAN[id];
                return (
                    <td
                        key={id}
                        className="text-gray-200 px-4 py-3 align-top"
                        title={title ? title(plan) : undefined}
                    >
                        {children(plan)}
                    </td>
                );
            })}
        </tr>
    );
}
