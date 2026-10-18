'use client';

import { Megaphone, CheckCircle2, CircleDashed, ExternalLink } from 'lucide-react';
import { ADS_ID, ADS_CONVERSION_LABEL } from '@/lib/adsTag';

// Estado de la medición de anuncios. Las métricas de rendimiento (clics, coste,
// conversiones) viven en Google Ads: leerlas desde aquí requiere la API de Google
// Ads (token de desarrollador, OAuth y el ID de cliente), que aún no está conectada.

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

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

export default function TabPublicidad() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="flex items-center gap-3 text-lg font-bold uppercase tracking-widest">
                    <Megaphone size={20} className="text-[#0d33f2]" />
                    Publicidad y medición
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                    Estado de las etiquetas de Google en la web pública.
                </p>
            </div>

            <div className="bg-black/30 border border-white/5 p-6">
                <Row ok={!!ADS_ID} label="Google Ads · etiqueta base" value={ADS_ID || 'sin configurar'} />
                <Row ok={!!ADS_CONVERSION_LABEL} label="Google Ads · conversión" value={ADS_CONVERSION_LABEL ? 'configurada' : 'pendiente'} />
                <Row ok={!!GA_ID} label="Google Analytics 4" value={GA_ID || 'sin configurar'} />
                <Row ok={true} label="Consentimiento de cookies" value="requerido antes de cargar" />
            </div>

            <div className="text-xs text-gray-500 leading-relaxed space-y-2">
                <p>
                    Los datos de rendimiento de los anuncios (impresiones, clics, coste y conversiones)
                    se consultan en Google Ads. Mostrarlos aquí exige conectar la API de Google Ads.
                </p>
                <a
                    href="https://ads.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#0d33f2] hover:underline"
                >
                    Abrir Google Ads <ExternalLink size={12} />
                </a>
            </div>
        </div>
    );
}
