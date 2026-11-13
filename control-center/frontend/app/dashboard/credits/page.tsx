'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, Loader2, AlertCircle, CheckCircle2, Sparkles, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import { api } from '@/lib/api';

// Contrato de GET /api/credits (api/services/apiCredits resumen). La API manda los
// importes, los paquetes y los modelos: aquí no se duplica ninguna cifra.
type Paquete = { id: string; eur: number; credits: number };
type Modelo = { proveedor: string; familia: string; estado: 'disponible' | 'proximamente' };
type Movimiento = { id: number; kind: string; credits: number; eur: number; balanceAfterEUR: number; at: string; concepto: string | null };
type Saldo = {
    hasApp: boolean; prepaid: boolean; balanceCredits: number; balanceEUR: number;
    packages: Paquete[]; limits: { min: number; max: number }; models: Modelo[]; activity: Movimiento[];
};

const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const token = () => (typeof window === 'undefined' ? '' : localStorage.getItem('bezhas_token') || '');

const CONCEPTO: Record<string, string> = { recharge: 'Recarga', bonus: 'Bono', refund: 'Devolución', adjustment: 'Ajuste', charge: 'Consumo' };

export default function CreditsPage() {
    const [saldo, setSaldo] = useState<Saldo | null>(null);
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(true);
    const [pagando, setPagando] = useState<string | null>(null);
    const [otro, setOtro] = useState('');
    const [aviso, setAviso] = useState('');

    const cargar = useCallback(async () => {
        try {
            setSaldo(await api.get<Saldo>('/credits', { token: token() }));
            setError('');
        } catch {
            setError('No se pudo leer tu saldo. Inténtalo de nuevo en un momento.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
        const q = new URLSearchParams(window.location.search).get('checkout');
        if (q === 'success') setAviso('Pago recibido. El saldo se abona en cuanto Stripe lo confirma (unos segundos).');
        if (q === 'cancelled') setAviso('Has cancelado el pago. No se ha cobrado nada.');
        // Tras volver de Stripe el webhook puede tardar un instante: se vuelve a leer.
        if (q === 'success') { const t = setTimeout(cargar, 4000); return () => clearTimeout(t); }
    }, [cargar]);

    async function recargar(cuerpo: { packageId?: string; amountEur?: number }, id: string) {
        setPagando(id); setError('');
        try {
            const r = await api.post<{ url: string }>('/credits/checkout', cuerpo, { token: token() });
            window.location.href = r.url;
        } catch (e) {
            const msg = e instanceof Error ? e.message : '';
            setError(msg.replace(/\s*\(POST .*\)$/, '') || 'No se pudo iniciar el pago.');
            setPagando(null);
        }
    }

    if (cargando) {
        return <div className="flex items-center justify-center h-64 text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Cargando saldo…</div>;
    }

    const importe = Number(otro.replace(',', '.'));
    const importeValido = saldo && Number.isFinite(importe) && importe >= saldo.limits.min && importe <= saldo.limits.max;

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Wallet className="w-6 h-6" /> Saldo de la API</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Recarga saldo y úsalo con tu API key en la API y el MCP de BeZhas. Pagas lo que consumes, sin cuotas ni permanencia.
                </p>
            </div>

            {aviso && <div className="flex items-center gap-2 rounded-lg bg-green-50 text-green-800 text-sm px-4 py-3"><CheckCircle2 className="w-4 h-4" /> {aviso}</div>}
            {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3"><AlertCircle className="w-4 h-4" /> {error}</div>}

            {saldo && !saldo.hasApp && (
                <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-4 py-3">
                    Tu cuenta todavía no tiene una aplicación a la que abonar el saldo. Crea tu aplicación en el Hub y vuelve aquí.
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="text-sm text-gray-500">Saldo disponible</div>
                <div className="text-4xl font-black text-gray-900 mt-1" data-testid="saldo">{eur(saldo?.balanceEUR ?? 0)}</div>
                {saldo?.prepaid && saldo.balanceCredits === 0 && (
                    <p className="text-sm text-red-600 mt-2">Te has quedado sin saldo: las llamadas a la API responden 402 hasta que recargues.</p>
                )}
                {saldo && !saldo.prepaid && <p className="text-xs text-gray-400 mt-2">Aún no has recargado. Tu primera recarga activa el pago por adelantado.</p>}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Recargar saldo</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {saldo?.packages.map((p) => (
                        <button key={p.id} disabled={!saldo.hasApp || pagando !== null} onClick={() => recargar({ packageId: p.id }, p.id)}
                            className="rounded-lg border border-gray-200 hover:border-teal-500 hover:bg-teal-50 disabled:opacity-50 py-4 text-center transition">
                            <div className="text-xl font-bold text-gray-900">{pagando === p.id ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `${p.eur} €`}</div>
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 mt-4">
                    <input value={otro} onChange={(e) => setOtro(e.target.value)} inputMode="decimal" placeholder={`Otro importe (${saldo?.limits.min}–${saldo?.limits.max} €)`}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                    <button disabled={!saldo?.hasApp || !importeValido || pagando !== null} onClick={() => recargar({ amountEur: importe }, 'otro')}
                        className="rounded-lg bg-teal-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-50">
                        {pagando === 'otro' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recargar'}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-3">Pago seguro con Stripe. El IVA se añade al pagar y no forma parte del saldo. El saldo no caduca.</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4" /> Modelos con tu saldo</h2>
                <ul className="divide-y divide-gray-50">
                    {saldo?.models.map((m) => (
                        <li key={m.proveedor} className="flex items-center justify-between py-2.5 text-sm">
                            <span className="text-gray-900">{m.familia} <span className="text-gray-400">· {m.proveedor}</span></span>
                            {m.estado === 'disponible'
                                ? <span className="text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">Disponible</span>
                                : <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Próximamente</span>}
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-gray-400 mt-3">Cada llamada cuesta el precio del modelo más un 25 % de operación. Se descuenta de tu saldo en el momento.</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Movimientos</h2>
                {saldo?.activity.length ? (
                    <ul className="divide-y divide-gray-50">
                        {saldo.activity.map((m) => (
                            <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                                <span className="flex items-center gap-2 text-gray-700">
                                    {m.eur >= 0 ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-gray-400" />}
                                    {CONCEPTO[m.kind] || m.kind}{m.concepto ? <span className="text-gray-400"> · {m.concepto}</span> : null}
                                    <span className="text-xs text-gray-400">{new Date(m.at).toLocaleString('es-ES')}</span>
                                </span>
                                <span className={`font-mono ${m.eur >= 0 ? 'text-green-700' : 'text-gray-900'}`}>{m.eur >= 0 ? '+' : ''}{eur(m.eur)}</span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-gray-400">Todavía no hay movimientos.</p>}
            </div>
        </div>
    );
}
