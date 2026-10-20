'use client';

import { useEffect, useState } from 'react';
import { Megaphone, CheckCircle2, CircleDashed, ExternalLink, Loader2 } from 'lucide-react';
import { ADS_ID, ADS_CONVERSION_LABEL } from '@/lib/adsTag';

// Métricas de Google Ads (30 días) vía /api/admin/ads, que sólo responde a SuperAdmin
// y lee las credenciales del servidor. Sin credenciales la pestaña lo indica.

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

interface AdsSummary {
    configured: boolean;
    missing?: string[];
    impressions?: number;
    clicks?: number;
    costEur?: number;
    conversions?: number;
    ctrPct?: number | null;
    cpcEur?: number | null;
    error?: string;
}

const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const num = (n: number) => n.toLocaleString('es-ES');

function Row({ ok, label, value }: { ok: boolean; label: string; value: string }) {
    const Icon = ok ? CheckCircle2 : CircleDashed;
    return (
        <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
                <Icon size={18} className={ok ? 'text-emerald-500' : 'text-gray-600'} />
                <span className="text-sm text-gray-300">{label}</span>
            </div>
            <span className="font-mono text-xs text-gray-400">{value}</span>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-black/30 border border-white/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
            <div className="font-mono text-xl text-white mt-1">{value}</div>
        </div>
    );
}

export default function TabPublicidad() {
    const [ads, setAds] = useState<AdsSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        fetch('/api/admin/ads', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : { configured: false, error: `HTTP ${r.status}` }))
            .then((data: AdsSummary) => alive && setAds(data))
            .catch(() => alive && setAds({ configured: false, error: 'No se pudo consultar /api/admin/ads' }))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, []);

    return (
        <div className="space-y-8">
            <div>
                <h2 className="flex items-center gap-3 text-lg font-bold uppercase tracking-widest">
                    <Megaphone size={20} className="text-[#0d33f2]" />
                    Publicidad y medición
                </h2>
                <p className="text-xs text-gray-500 mt-1">Últimos 30 días · Google Ads</p>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 size={14} className="animate-spin" /> Consultando Google Ads…
                </div>
            )}

            {!loading && ads?.configured && !ads.error && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Metric label="Impresiones" value={num(ads.impressions ?? 0)} />
                    <Metric label="Clics" value={num(ads.clicks ?? 0)} />
                    <Metric label="CTR" value={ads.ctrPct == null ? '—' : `${ads.ctrPct} %`} />
                    <Metric label="Coste" value={eur(ads.costEur ?? 0)} />
                    <Metric label="CPC medio" value={ads.cpcEur == null ? '—' : eur(ads.cpcEur)} />
                    <Metric label="Conversiones" value={num(ads.conversions ?? 0)} />
                </div>
            )}

            {!loading && ads?.configured && ads.error && (
                <p className="text-xs text-red-400">Google Ads: {ads.error}</p>
            )}

            {!loading && !ads?.configured && (
                <p className="text-xs text-gray-500">
                    Métricas no disponibles: faltan credenciales de la API de Google Ads
                    {ads?.missing?.length ? ` (${ads.missing.join(', ')})` : ''}.
                </p>
            )}

            <div className="bg-black/30 border border-white/5 p-6">
                <Row ok={!!ADS_ID} label="Google Ads · etiqueta base" value={ADS_ID || 'sin configurar'} />
                <Row ok={!!ADS_CONVERSION_LABEL} label="Google Ads · conversión" value={ADS_CONVERSION_LABEL ? 'configurada' : 'pendiente'} />
                <Row ok={!!GA_ID} label="Google Analytics 4" value={GA_ID || 'sin configurar'} />
            </div>

            <a
                href="https://ads.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-[#0d33f2] hover:underline"
            >
                Abrir Google Ads <ExternalLink size={12} />
            </a>
        </div>
    );
}
