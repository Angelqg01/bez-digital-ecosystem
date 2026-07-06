/**
 * SubAppActivation — calculador "estilo ERP": el cliente elige un plan base y
 * ACTIVA las SubApps que necesita (toggle), viendo el precio total en vivo.
 * Replica el modelo SAP/Odoo de módulos activables sobre una suscripción.
 *
 * Lógica de precios en config/pricing.js (single source of truth).
 */
import React, { useMemo, useState } from 'react';
import { Check, Plus, Sparkles, Calculator } from 'lucide-react';
import {
  BASE_PLANS,
  SUBAPP_ADDONS,
  calculatePricing,
  ANNUAL_FREE_MONTHS,
} from '../../config/pricing';

const euro = (n) => `${n.toLocaleString('es-ES')} €`;

export default function SubAppActivation() {
  const [planId, setPlanId] = useState('business');
  const [annual, setAnnual] = useState(false);
  const [active, setActive] = useState(['pay', 'cargolink']);

  const toggle = (id) =>
    setActive((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const quote = useMemo(
    () => calculatePricing({ planId, activeAddons: active, annual }),
    [planId, active, annual],
  );

  const plan = BASE_PLANS.find((p) => p.id === planId);

  return (
    <section id="activar-subapps" className="relative py-24 px-6 lg:px-20 z-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-cyan-300/30 mb-5">
            <Calculator size={14} className="text-cyan-300" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
              Activa solo lo que usas
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-6xl font-black leading-tight text-white uppercase italic">
            Tu suscripción, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
              módulo a módulo
            </span>
          </h2>
          <p className="mt-6 text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
            Como un ERP: eliges un plan base y activas las SubApps que tu empresa
            necesita. Cuantas más activas, menor el precio por módulo.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_0.8fr] gap-6 items-start">
          {/* Columna izquierda: plan base + módulos */}
          <div className="space-y-6">
            {/* Selector de plan base */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3">
                1 · Plan base
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {BASE_PLANS.map((p) => {
                  const sel = p.id === planId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlanId(p.id)}
                      className={`relative p-4 rounded-xl border text-left transition-all ${
                        sel
                          ? 'border-cyan-300 bg-cyan-300/10'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {p.recommended && (
                        <span className="absolute -top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] text-[9px] font-black uppercase">
                          <Sparkles size={9} /> Top
                        </span>
                      )}
                      <div className="text-white font-bold">{p.name}</div>
                      <div className="text-cyan-300 font-black text-lg">
                        {p.price === null ? 'A medida' : p.price === 0 ? 'Gratis' : `${p.price} €`}
                      </div>
                      <div className="text-gray-500 text-[11px] mt-1">
                        {p.includedAddons === Infinity
                          ? 'Todas las SubApps'
                          : `${p.includedAddons} SubApp${p.includedAddons > 1 ? 's' : ''} incluida${p.includedAddons > 1 ? 's' : ''}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggles de SubApps */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3">
                2 · Activa SubApps
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {SUBAPP_ADDONS.map((app) => {
                  const isActive = app.core || active.includes(app.id);
                  return (
                    <button
                      key={app.id}
                      onClick={() => !app.core && toggle(app.id)}
                      disabled={app.core}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        app.core
                          ? 'border-emerald-300/30 bg-emerald-300/5 cursor-default'
                          : isActive
                          ? 'border-cyan-300/60 bg-cyan-300/10'
                          : 'border-white/10 bg-white/5 hover:border-white/25'
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-cyan-300 text-[#080911]' : 'border border-white/30'
                        }`}
                      >
                        {isActive && <Check size={13} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold text-sm truncate">{app.name}</span>
                          <span className="text-[11px] font-bold text-cyan-300 flex-shrink-0">
                            {app.core ? 'incluida' : `+${app.price} €`}
                          </span>
                        </div>
                        <div className="text-gray-500 text-[11px] leading-snug">{app.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Columna derecha: resumen de coste (sticky) */}
          <div className="lg:sticky lg:top-24 rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-[#06111d] to-[#0d0918] p-6 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-widest text-gray-400 font-bold">Tu suscripción</div>
              {/* Toggle anual/mensual */}
              <button
                onClick={() => setAnnual((a) => !a)}
                className="text-[11px] px-3 py-1 rounded-full border border-white/15 text-gray-300 hover:border-cyan-300/50"
              >
                {annual ? 'Anual ✓' : 'Mensual'} · {annual ? `${ANNUAL_FREE_MONTHS} meses gratis` : 'ver anual'}
              </button>
            </div>

            {quote.custom ? (
              <div className="py-6 text-center">
                <div className="text-3xl font-black text-white mb-2">A medida</div>
                <p className="text-gray-400 text-sm">
                  Enterprise incluye todas las SubApps. Hablemos de tu volumen.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-sm border-b border-white/10 pb-4 mb-4">
                  <Row label={`Plan ${plan.name}`} value={euro(quote.basePrice)} />
                  {quote.includedCount > 0 && (
                    <Row
                      label={`${quote.includedCount} SubApp(s) incluida(s)`}
                      value="0 €"
                      muted
                    />
                  )}
                  {quote.billableAddons.map((a) => (
                    <Row key={a.id} label={a.name} value={euro(a.price)} muted />
                  ))}
                  {quote.discountAmount > 0 && (
                    <Row
                      label={quote.discountLabel}
                      value={`−${euro(quote.discountAmount)}`}
                      accent
                    />
                  )}
                </div>

                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-gray-400 text-sm">Total</span>
                  <div className="text-right">
                    <span className="text-4xl font-black text-white">{euro(quote.monthly)}</span>
                    <span className="text-gray-400 text-sm"> / mes</span>
                  </div>
                </div>
                {annual && (
                  <div className="text-right text-emerald-300 text-xs mb-4">
                    {euro(quote.annual)} / año · ahorras {euro(quote.annualSavings)}
                  </div>
                )}

                <a
                  href={`/developers?plan=${planId}&addons=${active.join(',')}`}
                  className="mt-4 w-full h-12 rounded-xl bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                >
                  <Plus size={16} /> Activar suscripción
                </a>
                <p className="text-center text-[11px] text-gray-500 mt-3">
                  Las SubApps que actives quedan disponibles al instante en tu API key,
                  SDK, plugin de WordPress y widgets. Cambia o cancela cuando quieras · EUR o BEZ.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, muted, accent }) {
  return (
    <div className="flex items-center justify-between">
      <span className={accent ? 'text-emerald-300' : muted ? 'text-gray-400' : 'text-gray-200'}>
        {label}
      </span>
      <span className={`font-semibold ${accent ? 'text-emerald-300' : 'text-white'}`}>{value}</span>
    </div>
  );
}
