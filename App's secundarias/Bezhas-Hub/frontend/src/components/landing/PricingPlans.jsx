/**
 * PricingPlans — Sección de planes de suscripción (4 niveles definitivos).
 * FUENTE ÚNICA: config/plans.js. Antes tenía precios propios (0/199/A medida)
 * que entraban en conflicto con /pay y /be-vip; ahora derivan del PDF definitivo.
 */
import React from 'react';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
import { PLANS as DEFINITIVE_PLANS, BEZ_DISCOUNT_RATE } from '../../config/plans';

const PLANS = DEFINITIVE_PLANS.map((p) => ({
    name: p.name,
    price: p.billingModel === 'payg' ? 'Pago por uso' : p.priceEUR === 0 ? 'Gratis' : `${p.priceEUR} €`,
    period: p.billingModel === 'payg' ? `· ${p.trialDays} días gratis` : p.priceEUR === 0 ? '' : '/ mes',
    tagline: `${p.profile}${p.valueLine ? ` · ${p.valueLine}` : ''}`,
    features: p.features,
    cta: p.billingModel === 'payg' ? `Probar ${p.trialDays} días gratis` : p.priceEUR === 0 ? 'Empezar gratis' : `Elegir ${p.name}`,
    ctaHref: '/be-vip',
    recommended: !!p.recommended,
    accent: p.recommended
        ? 'border-cyan-300/50 shadow-[0_0_30px_rgba(34,211,238,0.25)]'
        : 'border-white/10',
}));

export default function PricingPlans() {
    return (
        <section id="planes" className="relative py-24 px-6 lg:px-20 z-10">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-cyan-300/30 mb-5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
                            Planes claros, sin sorpresas
                        </span>
                    </div>
                    <h2 className="font-display text-4xl md:text-6xl font-black leading-tight text-white uppercase italic">
                        Elige el plan que <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
                            le encaja a tu empresa
                        </span>
                    </h2>
                    <p className="mt-6 text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                        4 niveles para escalar según el tamaño de tu organización. Paga en euros
                        (Stripe/SEPA) o con el token nativo <span className="text-cyan-300">$BEZ</span> y
                        ahorra un {Math.round(BEZ_DISCOUNT_RATE * 100)}%.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6 items-stretch">
                    {PLANS.map((p) => (
                        <div
                            key={p.name}
                            className={`relative rounded-2xl border bg-white/[0.04] backdrop-blur-md p-6 lg:p-7 flex flex-col ${p.accent}`}
                        >
                            {p.recommended && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] text-[10px] font-black uppercase tracking-widest">
                                    <Sparkles size={12} /> Recomendado
                                </div>
                            )}
                            <div className="mb-4">
                                <div className="text-white font-bold text-xl mb-1">{p.name}</div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-white tracking-tight">{p.price}</span>
                                    {p.period && <span className="text-gray-400 text-sm">{p.period}</span>}
                                </div>
                                <p className="text-gray-400 text-sm mt-2">{p.tagline}</p>
                            </div>

                            <ul className="space-y-2.5 mb-6 flex-1">
                                {p.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-gray-200">
                                        <Check size={16} className="text-cyan-300 mt-0.5 flex-shrink-0" />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <a
                                href={p.ctaHref}
                                className={`group h-12 px-5 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all ${
                                    p.recommended
                                        ? 'bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] hover:scale-[1.02]'
                                        : 'bg-white/5 text-white border border-white/15 hover:bg-white/10'
                                }`}
                            >
                                {p.cta}
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    ))}
                </div>

                <p className="mt-10 text-center text-xs text-gray-500 max-w-2xl mx-auto">
                    Los pagos se liquidan en euros (SEPA/tarjeta). Si lo prefieres, puedes pagar y operar con BEZ —
                    la moneda del ecosistema — desde tu panel.
                </p>
            </div>
        </section>
    );
}
